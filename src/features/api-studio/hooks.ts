import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toUserMessage } from '@/core/errors/AppError';
import { buildRequest, type PreparedRequest } from '@/core/http/build';
import {
  type AssertionResult,
  evaluateAssertions,
  type ExtractionResult,
  extractValues,
} from '@/core/http/assertions';
import { interpolate, type VariableScope } from '@/core/http/interpolate';
import { type RequestDraft, withoutCredentials } from '@/core/http/model';
import { maskValues, redactHeaders, redactUrl } from '@/core/http/redact';
import { apiCollectionsRepository } from '@/services/db/repositories/apiCollectionsRepository';
import {
  apiHistoryRepository,
  truncateBody,
} from '@/services/db/repositories/apiHistoryRepository';
import {
  environmentsRepository,
  variableMap,
} from '@/services/db/repositories/environmentsRepository';
import { type HttpResponseSnapshot, sendRequest } from '@/services/http/executor';
import { isAbortError } from '@/services/workers/taskRunner';
import { hydrateApiWorkspaceDraft, useApiWorkspaceStore } from '@/stores/apiWorkspaceStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import type { EnvironmentEntity } from '@/types/entities';

let defaultsRequested = false;

/** Environments (live), creating the built-in ones on first use. */
export function useEnvironments(): EnvironmentEntity[] | undefined {
  useEffect(() => {
    if (defaultsRequested) return;
    defaultsRequested = true;
    void environmentsRepository.ensureDefaults();
  }, []);
  return useLiveQuery(() => environmentsRepository.list(), []);
}

/** Test helper: create the built-in environments again on next use. */
export function resetEnvironmentDefaultsFlag(): void {
  defaultsRequested = false;
}

export function useActiveEnvironment(): {
  environments: EnvironmentEntity[] | undefined;
  active: EnvironmentEntity | null;
  setActive: (id: string | null) => void;
} {
  const environments = useEnvironments();
  const id = usePreferencesStore((s) => s.selectedEnvironmentId);
  const setActive = usePreferencesStore((s) => s.setSelectedEnvironmentId);
  const active = environments?.find((e) => e.id === id) ?? null;
  return { environments, active, setActive };
}

/** Variable scopes in resolution order: runtime values, active environment, collection. */
export function useVariableScopes(collectionId: string | null): {
  scopes: VariableScope[];
  secrets: string[];
} {
  const { active } = useActiveEnvironment();
  const runtime = useApiWorkspaceStore((s) => s.runtime);
  const collection = useLiveQuery(
    () =>
      collectionId
        ? apiCollectionsRepository.getCollection(collectionId)
        : Promise.resolve(undefined),
    [collectionId],
  );
  return useMemo(
    () => ({
      scopes: [
        new Map(Object.entries(runtime)),
        variableMap(active?.variables ?? []),
        variableMap(collection?.variables ?? []),
      ],
      secrets: (active?.variables ?? []).filter((v) => v.secret && v.enabled).map((v) => v.value),
    }),
    [runtime, active, collection],
  );
}

export interface SendState {
  status: 'idle' | 'sending' | 'done' | 'error' | 'cancelled';
  prepared: PreparedRequest | null;
  response: HttpResponseSnapshot | null;
  error: string | null;
  errorCode: string | null;
  /** Assertion results of the last response (empty without assertions). */
  tests: AssertionResult[];
  /** Variables extracted from the last response, and extraction problems. */
  extracted: ExtractionResult | null;
}

const IDLE: SendState = {
  status: 'idle',
  prepared: null,
  response: null,
  error: null,
  errorCode: null,
  tests: [],
  extracted: null,
};

/** Builds, sends and records requests; one at a time, cancellable. */
export function useSendRequest() {
  const [state, setState] = useState<SendState>(IDLE);
  const controller = useRef<AbortController | null>(null);
  const files = useApiWorkspaceStore((s) => s.files);
  const binaryFile = useApiWorkspaceStore((s) => s.binaryFile);
  const environment = useActiveEnvironment().active;

  const send = useCallback(
    async (
      draft: RequestDraft,
      scopes: VariableScope[],
      secrets: string[],
      requestId: string | null,
    ) => {
      controller.current?.abort();
      let prepared: PreparedRequest;
      try {
        prepared = buildRequest(draft, scopes);
      } catch (error) {
        setState({
          ...IDLE,
          status: 'error',
          error: toUserMessage(error),
          errorCode: 'VALIDATION',
        });
        return;
      }
      const c = new AbortController();
      controller.current = c;
      setState({ ...IDLE, status: 'sending', prepared });
      // Everything written to history is redacted: credential headers and parameters, and every
      // value of a secret variable wherever it was interpolated.
      const apiKeyName = draft.auth.type === 'apikey' ? [draft.auth.apiKeyName] : [];
      const mask = (s: string) => maskValues(s, secrets);
      const requestRecord = {
        method: prepared.method,
        url: mask(redactUrl(prepared.url, draft.auth.apiKeyIn === 'query' ? apiKeyName : [])),
        headers: redactHeaders(prepared.headers, apiKeyName).map(([k, v]): [string, string] => [
          k,
          mask(v),
        ]),
        body:
          prepared.body.kind === 'text'
            ? mask(truncateBody(prepared.body.text).body ?? '')
            : prepared.body.kind === 'none'
              ? null
              : `[${prepared.body.kind}]`,
      };
      const base = {
        draft: withoutCredentials(draft) as unknown as Record<string, unknown>,
        environment: environment?.name ?? null,
      };
      try {
        const response = await sendRequest(prepared, {
          signal: c.signal,
          timeoutMs: draft.settings.timeoutMs,
          followRedirects: draft.settings.followRedirects,
          includeCredentials: draft.settings.includeCredentials,
          files: new Map(Object.entries(files)),
          binaryFile,
        });
        if (controller.current !== c) return;
        const facts = {
          status: response.status,
          headers: response.headers,
          text: response.text,
          timeMs: response.timings.totalMs,
        };
        const resolve = (t: string) => interpolate(t, scopes).text;
        const tests = evaluateAssertions(draft.assertions, facts, resolve);
        const extracted = draft.extract.some((e) => e.enabled)
          ? extractValues(draft.extract, facts)
          : null;
        if (extracted && Object.keys(extracted.values).length > 0) {
          const store = useApiWorkspaceStore.getState();
          store.set({ runtime: { ...store.runtime, ...extracted.values } });
        }
        setState({ ...IDLE, status: 'done', prepared, response, tests, extracted });
        const body = truncateBody(response.text);
        void apiHistoryRepository
          .record({
            requestId,
            snapshot: {
              ...base,
              request: requestRecord,
              response: {
                status: response.status,
                statusText: response.statusText,
                headers: redactHeaders(response.headers),
                contentType: response.contentType,
                body: body.body === null ? null : mask(body.body),
                bodyTruncated: body.truncated || response.truncated,
                sizeBytes: response.sizeBytes,
                durationMs: response.timings.totalMs,
              },
              error: null,
            },
          })
          .catch(() => undefined);
      } catch (error) {
        if (controller.current !== c) return;
        if (isAbortError(error)) {
          setState({ ...IDLE, status: 'cancelled', prepared });
          return;
        }
        const message = toUserMessage(error);
        const code = (error as { code?: string }).code ?? null;
        setState({ ...IDLE, status: 'error', prepared, error: message, errorCode: code });
        void apiHistoryRepository
          .record({
            requestId,
            snapshot: { ...base, request: requestRecord, response: null, error: message },
          })
          .catch(() => undefined);
      }
    },
    [files, binaryFile, environment],
  );

  const cancel = useCallback(() => {
    controller.current?.abort();
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState(IDLE);
  }, []);

  return useMemo(() => ({ state, send, cancel, reset }), [state, send, cancel, reset]);
}

export function useApiDraft(): void {
  useEffect(() => {
    void hydrateApiWorkspaceDraft();
  }, []);
}
