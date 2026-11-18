import { type SchemaDraft, Validator } from '@cfworker/json-schema';
import { ValidationError } from '../errors/AppError';
import { isJsonObject } from './objects';
import type { JsonValue } from './types';

export type ValidatorDraft = 'auto' | SchemaDraft;

export interface SchemaValidationIssue {
  /** JSON Pointer to the failing value, e.g. "/items/0/price" ("" = root). */
  instanceLocation: string;
  keyword: string;
  keywordLocation: string;
  message: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  draft: SchemaDraft;
  errors: SchemaValidationIssue[];
}

export function detectDraft(schema: JsonValue): SchemaDraft {
  const uri = isJsonObject(schema) && typeof schema.$schema === 'string' ? schema.$schema : '';
  if (uri.includes('draft-04')) return '4';
  if (uri.includes('draft-06') || uri.includes('draft-07')) return '7';
  if (uri.includes('2019-09')) return '2019-09';
  return '2020-12';
}

/** Error units that only summarize nested failures add noise; keep the specific ones. */
const SUMMARY_KEYWORDS = new Set([
  'properties',
  'items',
  'prefixItems',
  'additionalItems',
  'allOf',
  '$ref',
  'unevaluatedProperties',
]);

/**
 * Validates `instance` against `schema` using an interpreting validator
 * (@cfworker/json-schema). Unlike code-generating validators it never uses
 * `eval`/`new Function`, so it works under a strict Content Security Policy.
 * Remote `$ref`s are not fetched (no network access).
 */
export function validateJsonSchema(
  instance: JsonValue,
  schema: JsonValue,
  draft: ValidatorDraft = 'auto',
): SchemaValidationResult {
  if (typeof schema !== 'boolean' && !isJsonObject(schema)) {
    throw new ValidationError('The schema must be a JSON object (or a boolean).');
  }
  const effectiveDraft = draft === 'auto' ? detectDraft(schema) : draft;
  let validator: Validator;
  try {
    validator = new Validator(schema, effectiveDraft, false);
  } catch (error) {
    throw new ValidationError(
      `Invalid schema: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  let result: ReturnType<Validator['validate']>;
  try {
    result = validator.validate(instance);
  } catch (error) {
    throw new ValidationError(
      `Schema could not be applied: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const seen = new Set<string>();
  const errors: SchemaValidationIssue[] = [];
  const specific = result.errors.filter((e) => !SUMMARY_KEYWORDS.has(e.keyword));
  for (const e of specific.length > 0 ? specific : result.errors) {
    const instanceLocation = e.instanceLocation.replace(/^#/, '');
    const id = `${instanceLocation}|${e.keywordLocation}|${e.error}`;
    if (seen.has(id)) continue;
    seen.add(id);
    errors.push({
      instanceLocation,
      keyword: e.keyword,
      keywordLocation: e.keywordLocation.replace(/^#/, ''),
      message: e.error,
    });
  }
  return { valid: result.valid, draft: effectiveDraft, errors };
}
