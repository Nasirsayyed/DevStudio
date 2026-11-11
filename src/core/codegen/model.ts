import { ValidationError } from '../errors/AppError';
import { isJsonObject } from '../json/objects';
import type { JsonValue } from '../json/types';
import { NameScope, singularizeName, toPascalCase } from './naming';

/**
 * Language-neutral type model inferred from JSON samples. Every emitter
 * (C#, TypeScript, Java, Python, SQL) is generated from this single model.
 */
export type StringFormat = 'date-time' | 'date' | 'uuid';

interface Nullable {
  /** A `null` value was observed. */
  nullable: boolean;
}

export type TypeRef =
  | ({ kind: 'string'; format?: StringFormat; maxLength: number } & Nullable)
  | ({ kind: 'integer'; long: boolean } & Nullable)
  | ({ kind: 'number'; integerDigits: number; scale: number } & Nullable)
  | ({ kind: 'boolean' } & Nullable)
  | ({ kind: 'any' } & Nullable)
  | ({ kind: 'array'; items: TypeRef } & Nullable)
  | ({ kind: 'dictionary'; values: TypeRef } & Nullable)
  | ({ kind: 'class'; name: string } & Nullable)
  | ({ kind: 'union'; types: TypeRef[] } & Nullable);

export interface ModelProperty {
  /** Original JSON key. */
  jsonName: string;
  type: TypeRef;
  /** Missing in some of the sampled objects. */
  optional: boolean;
}

export interface ModelClass {
  name: string;
  properties: ModelProperty[];
}

export interface TypeModel {
  /** Root type: a class, or an array of a class. */
  root: TypeRef;
  rootClass: string;
  rootIsArray: boolean;
  /** Classes in dependency order: nested classes before the classes using them. */
  classes: ModelClass[];
}

export interface ModelOptions {
  rootName?: string;
  /** Objects whose keys are all ids/numbers/dates become dictionaries. */
  detectDictionaries?: boolean;
  /** Detect ISO date-time / date strings. */
  detectDates?: boolean;
  /** Detect UUID strings. */
  detectUuids?: boolean;
  /** Reuse one class for objects with identical structure. */
  mergeIdenticalClasses?: boolean;
}

const DATE_TIME = /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?([Zz]|[+-]\d{2}:?\d{2})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const INT32_MAX = 2_147_483_647;

function signature(t: TypeRef): string {
  const n = t.nullable ? '?' : '';
  switch (t.kind) {
    case 'array':
      return `[${signature(t.items)}]${n}`;
    case 'dictionary':
      return `{${signature(t.values)}}${n}`;
    case 'class':
      return `C:${t.name}${n}`;
    case 'union':
      return `(${t.types.map(signature).join('|')})${n}`;
    case 'string':
      return `string${t.format ? `:${t.format}` : ''}${n}`;
    case 'integer':
      return `${t.long ? 'long' : 'int'}${n}`;
    default:
      return `${t.kind}${n}`;
  }
}

function fractionDigits(n: number): number {
  const s = String(n);
  if (s.includes('e')) return 0;
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

class Inferrer {
  readonly classes: ModelClass[] = [];
  private readonly bySignature = new Map<string, string>();
  private readonly names = new NameScope([], true);
  private readonly opts: Required<Omit<ModelOptions, 'rootName'>>;

  constructor(opts: Required<Omit<ModelOptions, 'rootName'>>) {
    this.opts = opts;
  }

  infer(samples: readonly JsonValue[], nameHint: string, parentName: string): TypeRef {
    let nullable = false;
    const strings: string[] = [];
    const numbers: number[] = [];
    let booleans = 0;
    const objects: Record<string, JsonValue>[] = [];
    const arrays: JsonValue[][] = [];
    for (const s of samples) {
      if (s === null) nullable = true;
      else if (typeof s === 'string') strings.push(s);
      else if (typeof s === 'number') numbers.push(s);
      else if (typeof s === 'boolean') booleans += 1;
      else if (Array.isArray(s)) arrays.push(s);
      else if (isJsonObject(s)) objects.push(s);
    }

    const parts: TypeRef[] = [];
    if (strings.length) parts.push(this.stringType(strings));
    if (numbers.length) parts.push(this.numberType(numbers));
    if (booleans) parts.push({ kind: 'boolean', nullable: false });
    if (objects.length) parts.push(this.objectType(objects, nameHint, parentName));
    if (arrays.length) {
      parts.push({
        kind: 'array',
        items: this.infer(arrays.flat(), singularizeName(nameHint), parentName),
        nullable: false,
      });
    }

    if (parts.length === 0) return { kind: 'any', nullable };
    if (parts.length === 1) return { ...(parts[0] as TypeRef), nullable };
    return { kind: 'union', types: parts, nullable };
  }

  private stringType(values: string[]): TypeRef {
    const maxLength = values.reduce((m, v) => Math.max(m, v.length), 0);
    let format: StringFormat | undefined;
    if (this.opts.detectDates && values.every((v) => DATE_TIME.test(v))) format = 'date-time';
    else if (this.opts.detectDates && values.every((v) => DATE.test(v))) format = 'date';
    else if (this.opts.detectUuids && values.every((v) => UUID.test(v))) format = 'uuid';
    return format
      ? { kind: 'string', format, maxLength, nullable: false }
      : { kind: 'string', maxLength, nullable: false };
  }

  private numberType(values: number[]): TypeRef {
    if (values.every((v) => Number.isInteger(v))) {
      return {
        kind: 'integer',
        long: values.some((v) => Math.abs(v) > INT32_MAX),
        nullable: false,
      };
    }
    const integerDigits = values.reduce(
      (m, v) => Math.max(m, String(Math.trunc(Math.abs(v))).length),
      1,
    );
    const scale = values.reduce((m, v) => Math.max(m, fractionDigits(v)), 0);
    return { kind: 'number', integerDigits, scale, nullable: false };
  }

  private looksLikeDictionary(objects: Record<string, JsonValue>[]): boolean {
    const keys = objects.flatMap((o) => Object.keys(o));
    if (keys.length === 0) return false;
    return (
      keys.every((k) => /^-?\d+$/.test(k)) ||
      keys.every((k) => UUID.test(k)) ||
      keys.every((k) => DATE.test(k) || DATE_TIME.test(k))
    );
  }

  private objectType(
    objects: Record<string, JsonValue>[],
    nameHint: string,
    parentName: string,
  ): TypeRef {
    if (this.opts.detectDictionaries && this.looksLikeDictionary(objects)) {
      const values = objects.flatMap((o) => Object.values(o));
      return {
        kind: 'dictionary',
        values: this.infer(values, singularizeName(nameHint), parentName),
        nullable: false,
      };
    }
    const baseName = toPascalCase(nameHint) || 'Item';
    const order: string[] = [];
    const valuesByKey = new Map<string, JsonValue[]>();
    for (const o of objects) {
      for (const k of Object.keys(o)) {
        let bucket = valuesByKey.get(k);
        if (!bucket) {
          bucket = [];
          valuesByKey.set(k, bucket);
          order.push(k);
        }
        bucket.push(o[k] as JsonValue);
      }
    }
    // Children are inferred first, so nested classes precede their parents.
    const properties: ModelProperty[] = order.map((k) => {
      const values = valuesByKey.get(k) ?? [];
      return {
        jsonName: k,
        type: this.infer(values, k, baseName),
        optional: values.length < objects.length,
      };
    });
    const sig = properties
      .map((p) => `${p.jsonName}${p.optional ? '?' : ''}:${signature(p.type)}`)
      .join(',');
    if (this.opts.mergeIdenticalClasses) {
      const existing = this.bySignature.get(sig);
      if (existing) return { kind: 'class', name: existing, nullable: false };
    }
    // Prefer "Item"; on conflict use the parent prefix ("OrderItem"), then numbers.
    const name =
      this.names.has(baseName) && parentName && !this.names.has(`${parentName}${baseName}`)
        ? this.names.claim(`${parentName}${baseName}`)
        : this.names.claim(baseName);
    this.classes.push({ name, properties });
    this.bySignature.set(sig, name);
    return { kind: 'class', name, nullable: false };
  }
}

/** Infers a type model from a JSON document (object or array of objects). */
export function inferTypeModel(value: JsonValue, options: ModelOptions = {}): TypeModel {
  const rootName = toPascalCase(options.rootName ?? 'Root') || 'Root';
  const inferrer = new Inferrer({
    detectDictionaries: options.detectDictionaries ?? true,
    detectDates: options.detectDates ?? true,
    detectUuids: options.detectUuids ?? true,
    mergeIdenticalClasses: options.mergeIdenticalClasses ?? true,
  });
  let rootIsArray = false;
  let samples: JsonValue[];
  if (isJsonObject(value)) samples = [value];
  else if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => isJsonObject(v) || v === null)
  ) {
    rootIsArray = true;
    samples = value;
  } else {
    throw new ValidationError(
      'Code generation needs a JSON object, or an array of objects, at the root.',
    );
  }
  const root = inferrer.infer(samples, rootName, '');
  if (root.kind !== 'class')
    throw new ValidationError(
      'Code generation needs a JSON object, or an array of objects, at the root.',
    );
  return {
    root: rootIsArray ? { kind: 'array', items: root, nullable: false } : root,
    rootClass: root.name,
    rootIsArray,
    classes: inferrer.classes,
  };
}

/** Visits every type reference in a model (for import/using detection). */
export function collectTypes(model: TypeModel): TypeRef[] {
  const out: TypeRef[] = [];
  const visit = (t: TypeRef) => {
    out.push(t);
    if (t.kind === 'array') visit(t.items);
    else if (t.kind === 'dictionary') visit(t.values);
    else if (t.kind === 'union') t.types.forEach(visit);
  };
  for (const c of model.classes) for (const p of c.properties) visit(p.type);
  return out;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GeneratedCode {
  /** Single-file output shown in the editor. */
  code: string;
  /** One file per type, for ZIP download (same as `code` for single-file languages). */
  files: GeneratedFile[];
  /** Non-fatal notes (renamed identifiers, mixed types…). */
  notes: string[];
}

function visitTypes(t: TypeRef, fn: (t: TypeRef) => void): void {
  fn(t);
  if (t.kind === 'array') visitTypes(t.items, fn);
  else if (t.kind === 'dictionary') visitTypes(t.values, fn);
  else if (t.kind === 'union') t.types.forEach((u) => visitTypes(u, fn));
}

/** All type references used by one class's properties. */
export function typesOfClass(c: ModelClass): TypeRef[] {
  const out: TypeRef[] = [];
  for (const p of c.properties) visitTypes(p.type, (t) => out.push(t));
  return out;
}

/** Classes in reading order: root first, then nested classes in declaration order (depth-first). */
export function classesFromRoot(model: TypeModel): ModelClass[] {
  const byName = new Map(model.classes.map((c) => [c.name, c]));
  const seen = new Set<string>();
  const out: ModelClass[] = [];
  const visit = (name: string) => {
    const c = byName.get(name);
    if (!c || seen.has(name)) return;
    seen.add(name);
    out.push(c);
    for (const t of typesOfClass(c)) if (t.kind === 'class') visit(t.name);
  };
  visit(model.rootClass);
  for (const c of model.classes) if (!seen.has(c.name)) out.push(c);
  return out;
}

/** Classes with dependencies first (post-order from the root), keeping declaration order otherwise. */
export function classesDependencyFirst(model: TypeModel): ModelClass[] {
  const byName = new Map(model.classes.map((c) => [c.name, c]));
  const seen = new Set<string>();
  const out: ModelClass[] = [];
  const visit = (name: string) => {
    const c = byName.get(name);
    if (!c || seen.has(name)) return;
    seen.add(name);
    for (const t of typesOfClass(c)) if (t.kind === 'class') visit(t.name);
    out.push(c);
  };
  visit(model.rootClass);
  for (const c of model.classes) if (!seen.has(c.name)) out.push(c);
  return out;
}
