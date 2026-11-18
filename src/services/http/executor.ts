import { AppError } from '@/core/errors/AppError';
import type { PreparedRequest } from '@/core/http/build';
import { abortError } from '@/services/workers/taskRunner';

/**
 * Sends a prepared request with `fetch`. CORS is never bypassed: when the browser blocks a
 * response, the request fails before any response arrives, and the error says why that usually
 * happens and what the server must allow.
 */

export const MAX_RESPONSE_BYTES = 50 * 1024 * 1024;

export interface HttpResponseSnapshot {
  status: number;
  statusText: string;
  /** Final URL after redirects. */
  url: string;
  redirected: boolean;
  headers: [string, string][];
  contentType: string;
  /** Decoded text for textual responses; null for binary content. */
  text: string | null;
  /** Raw bytes (in memory only: downloads and image previews). */
  bytes: Uint8Array<ArrayBuffer>;
  sizeBytes: number;
  /** The body was larger than the limit and was cut. */
  truncated: boolean;
  timings: { totalMs: number; firstByteMs: number };
}

export interface SendOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  followRedirects?: boolean;
  includeCredentials?: boolean;
  /** Files of form-data file fields, by entry id. */
  files?: ReadonlyMap<string, File>;
  binaryFile?: File | null;
  maxBytes?: number;
  /** For tests. */
  fetchImpl?: typeof fetch;
  now?: () => number;
}

const TEXTUAL =
  /^(text\/|application\/(json|xml|javascript|ecmascript|x-www-form-urlencoded|graphql|problem\+json|problem\+xml|ld\+json|x-ndjson|yaml|x-yaml|sql)|image\/svg\+xml)|[+](json|xml)\b/i;

function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 8192);
  if (sample.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(
      sample.length < bytes.length ? sample.subarray(0, Math.max(0, sample.length - 4)) : sample,
    );
    return true;
  } catch {
    return false;
  }
}

function decode(bytes: Uint8Array, contentType: string): string {
  const charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().replace(/"/g, '') ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

function buildBody(p: PreparedRequest, options: SendOptions): BodyInit | null {
  switch (p.body.kind) {
    case 'none':
      return null;
    case 'text':
      return p.body.text;
    case 'binary':
      if (!options.binaryFile)
        throw new AppError('VALIDATION', 'Choose the file to send as the body.');
      return options.binaryFile;
    case 'form-data': {
      const form = new FormData();
      for (const f of p.body.fields) {
        if (f.fileEntryId) {
          const file = options.files?.get(f.fileEntryId);
          if (!file)
            throw new AppError('VALIDATION', `Choose a file for the form field "${f.key}".`);
          form.append(f.key, file, file.name);
        } else form.append(f.key, f.value);
      }
      return form;
    }
  }
}

function isLocal(host: string): boolean {
  return /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(host);
}

/** Explains a request that failed without a response. */
export function classifyFailure(url: string, pageOrigin: string | null): AppError {
  let target: URL | null = null;
  try {
    target = new URL(url);
  } catch {
    /* handled below */
  }
  if (
    target &&
    pageOrigin?.startsWith('https:') &&
    target.protocol === 'http:' &&
    !isLocal(target.hostname)
  ) {
    return new AppError(
      'NETWORK',
      `Browsers block http:// requests from an https:// page (mixed content). Use https://${target.host}${target.pathname} if the server supports it.`,
    );
  }
  const crossOrigin = target && pageOrigin ? target.origin !== pageOrigin : true;
  return new AppError(
    'CORS',
    crossOrigin
      ? `The request failed before a response arrived. Usually the server does not allow cross-origin requests from ${pageOrigin ?? 'this page'} (CORS): it must answer with Access-Control-Allow-Origin (and allow your method and headers in its preflight response). It can also mean the server is unreachable, the address is wrong, or its certificate is invalid. DevStudio sends requests directly from your browser and does not bypass CORS.`
      : 'The request failed before a response arrived: the server is unreachable or refused the connection.',
  );
}

export async function sendRequest(
  p: PreparedRequest,
  options: SendOptions = {},
): Promise<HttpResponseSnapshot> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => performance.now());
  const maxBytes = options.maxBytes ?? MAX_RESPONSE_BYTES;
  const controller = new AbortController();
  const onAbort = () => {
    controller.abort();
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });
  const state = { timedOut: false };
  const timer =
    options.timeoutMs && options.timeoutMs > 0
      ? setTimeout(() => {
          state.timedOut = true;
          controller.abort();
        }, options.timeoutMs)
      : undefined;
  const started = now();
  try {
    const body = buildBody(p, options);
    let response: Response;
    try {
      response = await fetchImpl(p.url, {
        method: p.method,
        headers: p.headers,
        body,
        signal: controller.signal,
        redirect: options.followRedirects === false ? 'manual' : 'follow',
        credentials: options.includeCredentials ? 'include' : 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
    } catch (error) {
      if (state.timedOut)
        throw new AppError(
          'TIMEOUT',
          `No response within ${String(Math.round((options.timeoutMs ?? 0) / 1000))} s.`,
        );
      if (controller.signal.aborted) throw abortError();
      if (error instanceof AppError) throw error;
      throw classifyFailure(p.url, typeof location === 'undefined' ? null : location.origin);
    }
    const firstByteMs = Math.round(now() - started);
    const chunks: Uint8Array[] = [];
    let size = 0;
    let truncated = false;
    if (response.body) {
      const reader = response.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (size + value.byteLength > maxBytes) {
            chunks.push(value.subarray(0, maxBytes - size));
            size = maxBytes;
            truncated = true;
            await reader.cancel();
            break;
          }
          chunks.push(value);
          size += value.byteLength;
        }
      } catch (error) {
        if (state.timedOut)
          throw new AppError(
            'TIMEOUT',
            `The response did not finish within ${String(Math.round((options.timeoutMs ?? 0) / 1000))} s.`,
          );
        if (controller.signal.aborted) throw abortError();
        throw new AppError(
          'NETWORK',
          `The connection was interrupted while reading the response: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }
    const headers: [string, string][] = [];
    response.headers.forEach((value, key) => {
      headers.push([key, value]);
    });
    const contentType = response.headers.get('content-type') ?? '';
    const textual =
      TEXTUAL.test(contentType) ||
      (!contentType && looksLikeText(bytes)) ||
      (contentType === '' && size === 0);
    return {
      status: response.type === 'opaqueredirect' ? 0 : response.status,
      statusText:
        response.type === 'opaqueredirect'
          ? 'Redirect (not followed; browsers hide the target)'
          : response.statusText,
      url: response.url || p.url,
      redirected: response.redirected,
      headers,
      contentType,
      text: textual ? decode(bytes, contentType) : null,
      bytes,
      sizeBytes: size,
      truncated,
      timings: { totalMs: Math.round(now() - started), firstByteMs },
    };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}
