import { toUserMessage } from '@/core/errors/AppError';
import {
  type AssertionResult,
  evaluateAssertions,
  type ExtractionResult,
  extractValues,
} from '@/core/http/assertions';
import { buildRequest } from '@/core/http/build';
import { interpolate, type VariableScope } from '@/core/http/interpolate';
import type { RequestDraft } from '@/core/http/model';
import { maskValues, redactUrl } from '@/core/http/redact';
import { sendRequest } from '@/services/http/executor';
import { abortError, isAbortError } from '@/services/workers/taskRunner';
import type { HttpMethod } from '@/types/entities';

export interface RunItem {
  id: string;
  draft: RequestDraft;
}

export interface RunResult {
  key: string;
  iteration: number;
  requestId: string;
  name: string;
  method: HttpMethod;
  /** Sent URL with credentials and secret values redacted. */
  url: string;
  status: number | null;
  statusText: string;
  timeMs: number | null;
  sizeBytes: number | null;
  tests: AssertionResult[];
  extracted: ExtractionResult | null;
  error: string | null;
  warnings: string[];
  passed: boolean;
}

export interface RunOptions {
  items: readonly RunItem[];
  /** Environment and collection variables (in that order); extracted values come first. */
  scopes: readonly VariableScope[];
  secrets: readonly string[];
  iterations: number;
  delayMs: number;
  stopOnFailure: boolean;
  signal: AbortSignal;
  onResult: (result: RunResult) => void;
  /** Starting runtime values (e.g. those set in the Request Builder). */
  runtime?: Record<string, string>;
  send?: typeof sendRequest;
}

export interface RunSummary {
  runtime: Record<string, string>;
  stopped: 'completed' | 'failure' | 'cancelled';
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Sends the requests one after another, `iterations` times. Assertions are evaluated for each
 * response, and extracted values become variables for the following requests (chaining).
 */
export async function runCollection(o: RunOptions): Promise<RunSummary> {
  const send = o.send ?? sendRequest;
  const runtime: Record<string, string> = { ...o.runtime };
  const mask = (s: string) => maskValues(s, o.secrets);
  let first = true;
  try {
    for (let iteration = 1; iteration <= o.iterations; iteration++) {
      for (const item of o.items) {
        if (!first && o.delayMs > 0) await sleep(o.delayMs, o.signal);
        first = false;
        if (o.signal.aborted) throw abortError();
        const scopes = [new Map(Object.entries(runtime)), ...o.scopes];
        const d = item.draft;
        const base = {
          key: `${String(iteration)}:${item.id}`,
          iteration,
          requestId: item.id,
          name: d.name,
          method: d.method,
          tests: [] as AssertionResult[],
          extracted: null,
          warnings: [] as string[],
        };
        const apiKey =
          d.auth.type === 'apikey' && d.auth.apiKeyIn === 'query' ? [d.auth.apiKeyName] : [];
        let result: RunResult;
        try {
          const prepared = buildRequest(d, scopes);
          const url = mask(redactUrl(prepared.url, apiKey));
          try {
            const response = await send(prepared, {
              signal: o.signal,
              timeoutMs: d.settings.timeoutMs,
              followRedirects: d.settings.followRedirects,
              includeCredentials: d.settings.includeCredentials,
            });
            const facts = {
              status: response.status,
              headers: response.headers,
              text: response.text,
              timeMs: response.timings.totalMs,
            };
            const tests = evaluateAssertions(
              d.assertions,
              facts,
              (t) => interpolate(t, scopes).text,
            );
            const extracted = d.extract.some((e) => e.enabled)
              ? extractValues(d.extract, facts)
              : null;
            if (extracted) Object.assign(runtime, extracted.values);
            result = {
              ...base,
              url,
              status: response.status,
              statusText: response.statusText,
              timeMs: response.timings.totalMs,
              sizeBytes: response.sizeBytes,
              tests: tests.map((t) => ({ ...t, detail: mask(t.detail) })),
              extracted,
              error: null,
              warnings: prepared.warnings,
              passed: tests.every((t) => t.passed),
            };
          } catch (error) {
            if (isAbortError(error)) throw error;
            result = {
              ...base,
              url,
              status: null,
              statusText: '',
              timeMs: null,
              sizeBytes: null,
              error: mask(toUserMessage(error)),
              warnings: prepared.warnings,
              passed: false,
            };
          }
        } catch (error) {
          if (isAbortError(error)) throw error;
          result = {
            ...base,
            url: mask(d.url),
            status: null,
            statusText: '',
            timeMs: null,
            sizeBytes: null,
            error: mask(toUserMessage(error)),
            passed: false,
          };
        }
        o.onResult(result);
        if (!result.passed && o.stopOnFailure) return { runtime, stopped: 'failure' };
      }
    }
  } catch (error) {
    if (isAbortError(error)) return { runtime, stopped: 'cancelled' };
    throw error;
  }
  return { runtime, stopped: 'completed' };
}

/** Results as a JSON report (redacted; extracted values of secrets are masked). */
export function runReport(
  collection: string,
  results: readonly RunResult[],
  secrets: readonly string[],
  at = new Date(),
): string {
  const mask = (s: string) => maskValues(s, secrets);
  return JSON.stringify(
    {
      collection,
      finishedAt: at.toISOString(),
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      results: results.map((r) => ({
        iteration: r.iteration,
        name: r.name,
        method: r.method,
        url: r.url,
        status: r.status,
        timeMs: r.timeMs,
        passed: r.passed,
        error: r.error,
        assertions: r.tests.map((t) => ({
          label: mask(t.label),
          passed: t.passed,
          detail: t.detail,
        })),
        extracted: r.extracted ? Object.keys(r.extracted.values) : [],
      })),
    },
    null,
    2,
  );
}
