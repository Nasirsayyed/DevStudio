/** Hides credentials before anything is written to history or shown in shared output. */

export const REDACTED = '••••••';

const SENSITIVE_HEADER =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|x-auth-token|x-access-token|x-csrf-token|x-xsrf-token)$/i;
const SENSITIVE_PARAM =
  /^(api[-_]?key|key|token|access[-_]?token|refresh[-_]?token|id[-_]?token|secret|client[-_]?secret|password|passwd|pwd|sig|signature|auth|code)$/i;

export function isSensitiveHeader(name: string): boolean {
  return SENSITIVE_HEADER.test(name.trim());
}

export function redactHeaders(
  headers: readonly [string, string][],
  extraNames: readonly string[] = [],
): [string, string][] {
  const extra = new Set(extraNames.map((n) => n.toLowerCase()));
  return headers.map(([k, v]) => [
    k,
    isSensitiveHeader(k) || extra.has(k.toLowerCase()) ? REDACTED : v,
  ]);
}

/** Masks query parameters that usually carry credentials (and any listed explicitly). */
export function redactUrl(url: string, extraParams: readonly string[] = []): string {
  try {
    const u = new URL(url);
    const extra = new Set(extraParams.map((n) => n.toLowerCase()));
    let changed = false;
    for (const key of [...new Set(u.searchParams.keys())]) {
      if (SENSITIVE_PARAM.test(key) || extra.has(key.toLowerCase())) {
        u.searchParams.set(key, REDACTED);
        changed = true;
      }
    }
    if (u.username || u.password) {
      u.username = '';
      u.password = '';
      changed = true;
    }
    return changed ? u.toString() : url;
  } catch {
    return url;
  }
}

/**
 * Replaces every occurrence of the given secret values (e.g. secret environment variables that
 * were interpolated into a body or header). Very short values are ignored to avoid masking noise.
 */
export function maskValues(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const s of [...new Set(secrets)]
    .filter((x) => x.length >= 4)
    .sort((a, b) => b.length - a.length)) {
    out = out.split(s).join(REDACTED);
  }
  return out;
}
