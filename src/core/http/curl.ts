import { ValidationError } from '../errors/AppError';
import type { HttpMethod } from '@/types/entities';
import type { PreparedRequest } from './build';
import { emptyRequest, type KeyValue, type RequestDraft, rowId } from './model';

/** cURL command → request draft, and prepared request → cURL command. */

/** Splits a shell command line (single/double quotes, backslash escapes, line continuations). */
export function shellWords(command: string): string[] {
  const words: string[] = [];
  let current = '';
  let has = false;
  let quote: '"' | "'" | null = null;
  const text = command.replace(/\\\r?\n/g, ' ').replace(/\^\r?\n/g, ' ');
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i] ?? '';
    if (quote === "'") {
      if (c === "'") quote = null;
      else current += c;
    } else if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === '\\' && /["\\$`]/.test(text[i + 1] ?? '')) {
        current += text[i + 1] ?? '';
        i += 1;
      } else current += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      has = true;
    } else if (c === '\\' && i + 1 < text.length) {
      current += text[i + 1] ?? '';
      i += 1;
      has = true;
    } else if (/\s/.test(c)) {
      if (has || current) words.push(current);
      current = '';
      has = false;
    } else {
      current += c;
      has = true;
    }
  }
  if (quote) throw new ValidationError('The command has an unclosed quote.');
  if (has || current) words.push(current);
  return words;
}

const row = (key: string, value: string): KeyValue => ({ id: rowId(), key, value, enabled: true });

export interface CurlImport {
  request: RequestDraft;
  /** Options that were ignored (with a reason). */
  notes: string[];
}

export function parseCurl(command: string): CurlImport {
  const words = shellWords(command.trim().replace(/^\$\s*/, ''));
  if (words[0] !== 'curl') throw new ValidationError('Paste a command that starts with "curl".');
  const notes: string[] = [];
  const headers: KeyValue[] = [];
  const data: string[] = [];
  const form: { key: string; value: string; file: boolean }[] = [];
  let method: string | null = null;
  let url = '';
  let user: string | null = null;
  let getMode = false;
  let json = false;
  let follow = false;
  const takes = new Set([
    '-X',
    '--request',
    '-H',
    '--header',
    '-d',
    '--data',
    '--data-raw',
    '--data-binary',
    '--data-ascii',
    '--data-urlencode',
    '-u',
    '--user',
    '--url',
    '-F',
    '--form',
    '-A',
    '--user-agent',
    '-e',
    '--referer',
    '-b',
    '--cookie',
    '--json',
    '-o',
    '--output',
    '-m',
    '--max-time',
    '--connect-timeout',
  ]);
  for (let i = 1; i < words.length; i += 1) {
    let w = words[i] ?? '';
    let value: string | undefined;
    const eq = w.startsWith('--') ? w.indexOf('=') : -1;
    if (eq > 0) {
      value = w.slice(eq + 1);
      w = w.slice(0, eq);
    } else if (/^-[A-Za-z]./.test(w) && takes.has(w.slice(0, 2))) {
      value = w.slice(2);
      w = w.slice(0, 2);
    }
    const next = () => {
      if (value !== undefined) return value;
      i += 1;
      const n = words[i];
      if (n === undefined) throw new ValidationError(`${w} needs a value.`);
      return n;
    };
    switch (w) {
      case '-X':
      case '--request':
        method = next().toUpperCase();
        break;
      case '-H':
      case '--header': {
        const h = next();
        const colon = h.indexOf(':');
        if (colon > 0) headers.push(row(h.slice(0, colon).trim(), h.slice(colon + 1).trim()));
        break;
      }
      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-binary':
      case '--data-ascii': {
        const d = next();
        if (d.startsWith('@') && w !== '--data-raw')
          notes.push(`The body comes from a file (${d}); paste its content into the body.`);
        else data.push(d);
        break;
      }
      case '--data-urlencode': {
        const d = next();
        const i2 = d.indexOf('=');
        data.push(
          i2 >= 0
            ? `${d.slice(0, i2)}=${encodeURIComponent(d.slice(i2 + 1))}`
            : encodeURIComponent(d),
        );
        break;
      }
      case '--json':
        json = true;
        data.push(next());
        break;
      case '-F':
      case '--form': {
        const f = next();
        const i2 = f.indexOf('=');
        if (i2 > 0)
          form.push({
            key: f.slice(0, i2),
            value: f.slice(i2 + 1).replace(/^@/, ''),
            file: f[i2 + 1] === '@',
          });
        break;
      }
      case '-u':
      case '--user':
        user = next();
        break;
      case '-A':
      case '--user-agent':
        headers.push(row('User-Agent', next()));
        break;
      case '-e':
      case '--referer':
        next();
        notes.push('Browsers do not allow setting the Referer header; it was ignored.');
        break;
      case '-b':
      case '--cookie':
        next();
        notes.push('Browsers do not allow setting cookies on requests; "--cookie" was ignored.');
        break;
      case '--url':
        url = next();
        break;
      case '-G':
      case '--get':
        getMode = true;
        break;
      case '-I':
      case '--head':
        method = 'HEAD';
        break;
      case '-L':
      case '--location':
        follow = true;
        break;
      case '-k':
      case '--insecure':
        notes.push('Browsers always verify certificates; "--insecure" has no effect.');
        break;
      case '-o':
      case '--output':
      case '-m':
      case '--max-time':
      case '--connect-timeout':
        next();
        break;
      default:
        if (w.startsWith('-')) {
          if (
            ![
              '--compressed',
              '-s',
              '--silent',
              '-v',
              '--verbose',
              '-i',
              '--include',
              '-S',
              '--show-error',
              '-f',
              '--fail',
            ].includes(w)
          )
            notes.push(`"${w}" is not supported and was ignored.`);
        } else if (!url) url = w;
    }
  }
  if (!url) throw new ValidationError('The command has no URL.');
  const req = emptyRequest({ name: 'Imported from cURL', url, headers });
  req.settings.followRedirects = follow || req.settings.followRedirects;
  if (user !== null) {
    const i2 = user.indexOf(':');
    req.auth = {
      ...req.auth,
      type: 'basic',
      username: i2 >= 0 ? user.slice(0, i2) : user,
      password: i2 >= 0 ? user.slice(i2 + 1) : '',
    };
  }
  const ctHeader = headers.find((h) => h.key.toLowerCase() === 'content-type');
  const ct = (ctHeader?.value ?? '').toLowerCase();
  if (getMode && data.length) {
    req.url = `${url}${url.includes('?') ? '&' : '?'}${data.join('&')}`;
  } else if (form.length) {
    req.body = {
      ...req.body,
      mode: 'form-data',
      formData: form.map((f) => ({
        id: rowId(),
        key: f.key,
        value: f.value,
        type: f.file ? 'file' : 'text',
        enabled: true,
      })),
    };
    if (form.some((f) => f.file))
      notes.push('Choose the files for the file fields again (files are not part of the command).');
  } else if (data.length) {
    const text = data.join('&');
    if (json || ct.includes('json') || /^\s*[[{]/.test(text)) {
      req.body = { ...req.body, mode: 'json', raw: text };
      if (json && !ctHeader) headers.push(row('Content-Type', 'application/json'));
    } else if (ct.includes('xml')) req.body = { ...req.body, mode: 'xml', raw: text };
    else if (!ctHeader || ct.includes('x-www-form-urlencoded')) {
      const params = new URLSearchParams(text);
      req.body = {
        ...req.body,
        mode: 'form-urlencoded',
        form: [...params.entries()].map(([k, val]) => row(k, val)),
      };
      if (ctHeader) req.headers = headers.filter((h) => h !== ctHeader);
    } else req.body = { ...req.body, mode: 'text', raw: text };
  }
  const m = (
    method ?? ((data.length > 0 || form.length > 0) && !getMode ? 'POST' : 'GET')
  ).toUpperCase();
  const allowed: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  const found = allowed.find((x) => x === m);
  if (!found) throw new ValidationError(`The method ${m} is not supported.`);
  req.method = found;
  // Move query parameters into the parameter table for editing.
  try {
    const u = new URL(req.url.includes('://') ? req.url : `https://${req.url}`);
    if (u.search && !req.url.includes('{{')) {
      req.params = [...u.searchParams.entries()].map(([k, val]) => row(k, val));
      req.url = req.url.slice(0, req.url.indexOf('?'));
    }
  } catch {
    /* keep the URL as typed */
  }
  return { request: req, notes };
}

const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** POSIX shell command (form-data files use @file placeholders). */
export function toCurl(p: PreparedRequest, files: Record<string, string> = {}): string {
  const parts = [`curl -X ${p.method} ${sq(p.url)}`];
  for (const [k, v] of p.headers) parts.push(`-H ${sq(`${k}: ${v}`)}`);
  if (p.body.kind === 'text') parts.push(`--data-raw ${sq(p.body.text)}`);
  if (p.body.kind === 'form-data')
    for (const f of p.body.fields)
      parts.push(
        `-F ${sq(f.fileEntryId ? `${f.key}=@${files[f.fileEntryId] ?? (f.value || 'file')}` : `${f.key}=${f.value}`)}`,
      );
  if (p.body.kind === 'binary') parts.push(`--data-binary @${sq(files.binary ?? 'file')}`);
  return parts.join(' \\\n  ');
}
