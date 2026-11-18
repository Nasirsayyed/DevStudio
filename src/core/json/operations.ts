import { ValidationError } from '../errors/AppError';
import { type CsvToJsonOptions, type JsonToCsvOptions, csvToJson, jsonToCsv } from './csv';
import { type DiffOptions, diffJson } from './diff';
import { type FlattenOptions, type UnflattenOptions, flattenJson, unflattenJson } from './flatten';
import {
  type BeautifyOptions,
  type IndentOption,
  type SortKeysOptions,
  beautifyJson,
  formatJson,
  minifyJson,
  sortKeysDeep,
} from './format';
import { queryJsonPath } from './jsonpath';
import { analyzeJson, parseJsonOrThrow } from './parse';
import { type SchemaGeneratorOptions, generateJsonSchema } from './schemaGenerator';
import { type ValidatorDraft, validateJsonSchema } from './schemaValidator';
import { type SearchOptions, searchJson } from './search';

/**
 * Every JSON Studio operation, keyed by name. Inputs are raw text so that
 * parsing (the expensive part for large documents) happens wherever the
 * operation runs — on the main thread for small inputs, in a Web Worker for
 * large ones. Inputs and outputs are structured-clone friendly.
 */
export const jsonOperations = {
  analyze: (p: { text: string }) => analyzeJson(p.text),
  parse: (p: { text: string }) => parseJsonOrThrow(p.text),
  format: (p: { text: string; indent: IndentOption }) =>
    formatJson(parseJsonOrThrow(p.text), p.indent),
  minify: (p: { text: string }) => minifyJson(parseJsonOrThrow(p.text)),
  beautify: (p: { text: string; options: BeautifyOptions }) =>
    beautifyJson(parseJsonOrThrow(p.text), p.options),
  sortKeys: (p: { text: string; options: SortKeysOptions; indent: IndentOption }) =>
    formatJson(sortKeysDeep(parseJsonOrThrow(p.text), p.options), p.indent),
  flatten: (p: { text: string; options: FlattenOptions }) => {
    const result = flattenJson(parseJsonOrThrow(p.text), p.options);
    return {
      text: formatJson(result.value),
      ambiguousKeys: result.ambiguousKeys,
      keyCount: Object.keys(result.value).length,
    };
  },
  unflatten: (p: { text: string; options: UnflattenOptions }) =>
    formatJson(unflattenJson(parseJsonOrThrow(p.text), p.options)),
  toCsv: (p: { text: string; options: JsonToCsvOptions }) =>
    jsonToCsv(parseJsonOrThrow(p.text), p.options),
  fromCsv: (p: { text: string; options: CsvToJsonOptions }) => {
    const result = csvToJson(p.text, p.options);
    return {
      text: formatJson(result.value),
      fields: result.fields,
      delimiter: result.delimiter,
      issues: result.issues,
      rowCount: result.value.length,
    };
  },
  diff: (p: { left: string; right: string; options: DiffOptions; normalize: boolean }) => {
    const left = parseJsonOrThrow(p.left, 'Left document', 'left');
    const right = parseJsonOrThrow(p.right, 'Right document', 'right');
    const result = diffJson(left, right, p.options);
    // Normalized text (sorted keys) for a meaningful line-by-line view.
    const leftText = formatJson(p.normalize ? sortKeysDeep(left) : left);
    const rightText = formatJson(p.normalize ? sortKeysDeep(right) : right);
    return { ...result, leftText, rightText };
  },
  search: (p: { text: string; options: SearchOptions }) =>
    searchJson(parseJsonOrThrow(p.text), p.options),
  jsonPath: (p: { text: string; expression: string }) =>
    queryJsonPath(parseJsonOrThrow(p.text), p.expression),
  schemaGenerate: (p: { text: string; options: SchemaGeneratorOptions }) =>
    formatJson(generateJsonSchema(parseJsonOrThrow(p.text), p.options)),
  schemaValidate: (p: { data: string; schema: string; draft: ValidatorDraft }) => {
    const data = parseJsonOrThrow(p.data, 'Data', 'data');
    const schema = parseJsonOrThrow(p.schema, 'Schema', 'schema');
    return validateJsonSchema(data, schema, p.draft);
  },
} as const;

export type JsonOperations = typeof jsonOperations;
export type JsonOperationName = keyof JsonOperations;
export type JsonOperationInput<K extends JsonOperationName> = Parameters<JsonOperations[K]>[0];
export type JsonOperationOutput<K extends JsonOperationName> = ReturnType<JsonOperations[K]>;

export function assertNonEmpty(text: string, label = 'Input'): void {
  if (!text.trim()) throw new ValidationError(`${label} is empty.`);
}
