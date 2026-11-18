import Papa from 'papaparse';
import { ValidationError } from '../errors/AppError';
import { flattenJson, unflattenJson } from './flatten';
import { isJsonObject, setOwn } from './objects';
import type { JsonObject, JsonValue } from './types';

export interface JsonToCsvOptions {
  delimiter?: string;
  header?: boolean;
  /** Flatten nested objects into dotted columns (e.g. `address.city`). */
  flattenObjects?: boolean;
  /** How arrays inside rows are written: as JSON text, or expanded into indexed columns. */
  arrays?: 'json' | 'expand';
  /** Prefix cells starting with =, +, -, @ to prevent spreadsheet formula injection. */
  escapeFormulae?: boolean;
  newline?: '\r\n' | '\n';
}

export interface JsonToCsvResult {
  csv: string;
  columns: string[];
  rowCount: number;
}

function cell(v: JsonValue | undefined): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function toRow(item: JsonValue, opts: Required<JsonToCsvOptions>): JsonObject {
  if (!isJsonObject(item)) {
    const row: JsonObject = {};
    setOwn(row, 'value', item);
    return row;
  }
  if (!opts.flattenObjects) return item;
  if (opts.arrays === 'expand') return flattenJson(item).value;
  // Flatten objects only; keep arrays as JSON cells.
  const out: JsonObject = {};
  const visit = (v: JsonValue, prefix: string) => {
    if (isJsonObject(v) && Object.keys(v).length > 0) {
      for (const k of Object.keys(v)) visit(v[k] as JsonValue, prefix ? `${prefix}.${k}` : k);
    } else {
      setOwn(out, prefix, v);
    }
  };
  visit(item, '');
  return out;
}

export function jsonToCsv(value: JsonValue, options: JsonToCsvOptions = {}): JsonToCsvResult {
  const opts: Required<JsonToCsvOptions> = {
    delimiter: ',',
    header: true,
    flattenObjects: true,
    arrays: 'json',
    escapeFormulae: true,
    newline: '\r\n',
    ...options,
  };
  let items: JsonValue[];
  if (Array.isArray(value)) items = value;
  else if (isJsonObject(value)) items = [value];
  else throw new ValidationError('CSV conversion needs an array of objects (or a single object).');

  const rows = items.map((item) => toRow(item, opts));
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        columns.push(k);
      }
    }
  }
  const csv = Papa.unparse(
    {
      fields: columns,
      data: rows.map((r) =>
        columns.map((c) => cell(Object.prototype.hasOwnProperty.call(r, c) ? r[c] : undefined)),
      ),
    },
    {
      delimiter: opts.delimiter,
      header: opts.header,
      newline: opts.newline,
      escapeFormulae: opts.escapeFormulae,
    },
  );
  return { csv, columns, rowCount: rows.length };
}

export interface CsvToJsonOptions {
  /** Empty string = auto-detect. */
  delimiter?: string;
  header?: boolean;
  /** Convert numbers and booleans (note: "007" becomes 7). */
  dynamicTyping?: boolean;
  /** Rebuild nested objects from dotted headers (e.g. `address.city`). */
  nest?: boolean;
}

export interface CsvIssue {
  row: number | null;
  message: string;
}

export interface CsvToJsonResult {
  value: JsonValue[];
  fields: string[];
  delimiter: string;
  issues: CsvIssue[];
}

export function csvToJson(text: string, options: CsvToJsonOptions = {}): CsvToJsonResult {
  const { delimiter = '', header = true, dynamicTyping = true, nest = false } = options;
  if (!text.trim()) throw new ValidationError('The CSV input is empty.');
  const parsed = Papa.parse<Record<string, unknown> | unknown[]>(text, {
    delimiter,
    header,
    dynamicTyping,
    skipEmptyLines: 'greedy',
  });
  const issues: CsvIssue[] = parsed.errors.slice(0, 100).map((e) => ({
    row: typeof e.row === 'number' ? e.row + (header ? 2 : 1) : null,
    message: e.message,
  }));
  const normalize = (v: unknown): JsonValue => {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
    if (v instanceof Date) return v.toISOString();
    return v as JsonValue;
  };
  const value: JsonValue[] = parsed.data.map((row) => {
    if (Array.isArray(row)) return row.map(normalize);
    const obj: JsonObject = {};
    for (const k of Object.keys(row)) setOwn(obj, k, normalize(row[k]));
    return nest ? unflattenJson(obj, { detectArrays: true }) : obj;
  });
  return { value, fields: parsed.meta.fields ?? [], delimiter: parsed.meta.delimiter, issues };
}
