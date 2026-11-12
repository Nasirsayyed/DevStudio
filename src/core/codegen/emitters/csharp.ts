import type { JsonValue } from '../../json/types';
import {
  type GeneratedCode,
  type GeneratedFile,
  type ModelClass,
  type TypeModel,
  type TypeRef,
  classesFromRoot,
  collectTypes,
  inferTypeModel,
  typesOfClass,
} from '../model';
import { NameScope, toIdentifier, toPascalCase } from '../naming';

export interface CSharpOptions {
  rootName: string;
  /** Empty = no namespace. */
  namespace: string;
  fileScopedNamespace: boolean;
  /** Emit `#nullable enable` and `string?` for nullable reference types. */
  nullableReferenceTypes: boolean;
  /** JSON name attributes, or Entity Framework data annotations (classes mapped from SQL). */
  attributes: 'system-text-json' | 'newtonsoft' | 'data-annotations' | 'none';
  /** Emit name attributes on every property, or only when the C# name differs from the JSON key. */
  attributeMode: 'always' | 'when-different';
  typeKind: 'class' | 'record';
  collectionType: 'List' | 'IReadOnlyList' | 'Array';
  numberType: 'double' | 'decimal';
  dateType: 'DateTime' | 'DateTimeOffset' | 'string';
  /** Map UUID strings to `Guid`. */
  useGuid: boolean;
  /** Use the C# 11 `required` modifier for non-nullable properties present in every sample. */
  requiredMembers: boolean;
  detectDictionaries: boolean;
}

export const DEFAULT_CSHARP_OPTIONS: CSharpOptions = {
  rootName: 'Root',
  namespace: 'MyApp.Models',
  fileScopedNamespace: true,
  nullableReferenceTypes: true,
  attributes: 'system-text-json',
  attributeMode: 'always',
  typeKind: 'class',
  collectionType: 'List',
  numberType: 'double',
  dateType: 'DateTime',
  useGuid: true,
  requiredMembers: false,
  detectDictionaries: true,
};

/** C# type names a generated class must not shadow. */
const RESERVED_TYPE_NAMES = [
  'Object',
  'String',
  'Boolean',
  'DateTime',
  'DateTimeOffset',
  'Guid',
  'List',
  'Dictionary',
  'Task',
  'Type',
  'Attribute',
  'Exception',
  'Math',
  'Console',
];

const VALUE_TYPES = new Set([
  'int',
  'long',
  'double',
  'decimal',
  'bool',
  'DateTime',
  'DateTimeOffset',
  'DateOnly',
  'Guid',
]);

interface Resolved {
  type: string;
  usings: string[];
}

class CSharpEmitter {
  private readonly o: CSharpOptions;
  private readonly classNames = new Map<string, string>();
  readonly notes: string[] = [];

  constructor(options: CSharpOptions) {
    this.o = options;
  }

  className(modelName: string): string {
    return this.classNames.get(modelName) ?? modelName;
  }

  assignClassNames(model: TypeModel): void {
    const scope = new NameScope(RESERVED_TYPE_NAMES);
    // Root first so it keeps its requested name.
    const ordered = [...model.classes].sort((a, b) =>
      a.name === model.rootClass ? -1 : b.name === model.rootClass ? 1 : 0,
    );
    for (const c of ordered) {
      const wanted = toIdentifier(c.name, toPascalCase, 'Item');
      const name = scope.has(wanted) ? scope.claim(`${wanted}Model`) : scope.claim(wanted);
      if (name !== c.name)
        this.notes.push(`Class "${c.name}" was named "${name}" to avoid a conflict.`);
      this.classNames.set(c.name, name);
    }
  }

  resolve(t: TypeRef): Resolved {
    switch (t.kind) {
      case 'string':
        if (t.format === 'uuid' && this.o.useGuid) return { type: 'Guid', usings: ['System'] };
        if ((t.format === 'date-time' || t.format === 'date') && this.o.dateType !== 'string')
          return { type: this.o.dateType, usings: ['System'] };
        return { type: 'string', usings: [] };
      case 'integer':
        return { type: t.long ? 'long' : 'int', usings: [] };
      case 'number':
        return { type: t.float ? 'double' : this.o.numberType, usings: [] };
      case 'boolean':
        return { type: 'bool', usings: [] };
      case 'any':
      case 'union':
        return { type: 'object', usings: [] };
      case 'class':
        return { type: this.className(t.name), usings: [] };
      case 'array': {
        const item = this.resolveWithNullability(t.items);
        if (this.o.collectionType === 'Array')
          return { type: `${item.type}[]`, usings: item.usings };
        return {
          type: `${this.o.collectionType}<${item.type}>`,
          usings: [...item.usings, 'System.Collections.Generic'],
        };
      }
      case 'dictionary': {
        const value = this.resolveWithNullability(t.values);
        const dict =
          this.o.collectionType === 'IReadOnlyList' ? 'IReadOnlyDictionary' : 'Dictionary';
        return {
          type: `${dict}<string, ${value.type}>`,
          usings: [...value.usings, 'System.Collections.Generic'],
        };
      }
    }
  }

  /** Applies `?` for nullable value types and (when enabled) nullable reference types. */
  resolveWithNullability(t: TypeRef, forceNullable = false): Resolved {
    const r = this.resolve(t);
    const nullable = forceNullable || t.nullable || t.kind === 'any';
    if (!nullable) return r;
    if (VALUE_TYPES.has(r.type) || this.o.nullableReferenceTypes)
      return { ...r, type: `${r.type}?` };
    return r;
  }

  private initializer(t: TypeRef, typeName: string): string {
    if (!this.o.nullableReferenceTypes || typeName.endsWith('?') || VALUE_TYPES.has(typeName))
      return '';
    if (typeName === 'string') return ' = string.Empty;';
    if (typeName === 'object') return ' = default!;';
    if (t.kind === 'array' && this.o.collectionType !== 'List') return ' = [];';
    return ' = new();';
  }

  private attributes(
    p: ModelClass['properties'][number],
    propName: string,
    typeName: string,
  ): string[] {
    if (this.o.attributes === 'none') return [];
    if (this.o.attributes === 'data-annotations') {
      const c = p.column;
      if (!c) return [];
      const out: string[] = [];
      if (c.primaryKey) out.push('[Key]');
      if (c.identity) out.push('[DatabaseGenerated(DatabaseGeneratedOption.Identity)]');
      if (this.o.attributeMode === 'always' || c.name !== propName)
        out.push(`[Column(${JSON.stringify(c.name)})]`);
      if (!typeName.endsWith('?') && !VALUE_TYPES.has(typeName) && !c.primaryKey)
        out.push('[Required]');
      if (c.maxLength !== null && p.type.kind === 'string')
        out.push(`[MaxLength(${String(c.maxLength)})]`);
      return out;
    }
    if (this.o.attributeMode === 'when-different' && p.jsonName === propName) return [];
    const literal = JSON.stringify(p.jsonName);
    return [
      this.o.attributes === 'system-text-json'
        ? `[JsonPropertyName(${literal})]`
        : `[JsonProperty(${literal})]`,
    ];
  }

  emitClass(c: ModelClass, indent: string): string {
    const name = this.className(c.name);
    const scope = new NameScope([name]);
    const lines: string[] = [];
    const accessor = this.o.typeKind === 'record' ? '{ get; init; }' : '{ get; set; }';
    c.properties.forEach((p, i) => {
      const propName = scope.claim(toIdentifier(p.jsonName, toPascalCase, 'Value'));
      if (propName !== toIdentifier(p.jsonName, toPascalCase, 'Value')) {
        this.notes.push(
          `Property "${p.jsonName}" in ${name} was named "${propName}" to keep names unique.`,
        );
      }
      const binary = p.column !== undefined && /binary|blob|bytea|image/i.test(p.column.sqlType);
      const resolved = binary
        ? {
            type: p.type.nullable && this.o.nullableReferenceTypes ? 'byte[]?' : 'byte[]',
            usings: [],
          }
        : this.resolveWithNullability(p.type, p.optional);
      if (p.type.kind === 'union') {
        lines.push(
          `${indent}    // Mixed JSON types: ${p.type.types.map((u) => u.kind).join(' | ')}`,
        );
      }
      for (const attr of this.attributes(p, propName, resolved.type))
        lines.push(`${indent}    ${attr}`);
      const required = this.o.requiredMembers && !resolved.type.endsWith('?') && !p.optional;
      const init = required ? '' : this.initializer(p.type, resolved.type);
      lines.push(
        `${indent}    public ${required ? 'required ' : ''}${resolved.type} ${propName} ${accessor}${init}`,
      );
      if (i < c.properties.length - 1) lines.push('');
    });
    const keyword = this.o.typeKind === 'record' ? 'record' : 'class';
    const classAttrs =
      this.o.attributes === 'data-annotations' && c.table
        ? [
            `${indent}[Table(${JSON.stringify(c.table.name)}${c.table.schema ? `, Schema = ${JSON.stringify(c.table.schema)}` : ''})]`,
          ]
        : [];
    return [
      ...classAttrs,
      `${indent}public ${keyword} ${name}`,
      `${indent}{`,
      ...lines,
      `${indent}}`,
    ].join('\n');
  }

  usings(types: readonly TypeRef[]): string[] {
    const set = new Set<string>();
    for (const t of types) for (const u of this.resolve(t).usings) set.add(u);
    if (this.o.attributes === 'system-text-json') set.add('System.Text.Json.Serialization');
    if (this.o.attributes === 'newtonsoft') set.add('Newtonsoft.Json');
    if (this.o.attributes === 'data-annotations') {
      set.add('System.ComponentModel.DataAnnotations');
      set.add('System.ComponentModel.DataAnnotations.Schema');
    }
    return [...set].sort((a, b) =>
      a.startsWith('System') === b.startsWith('System')
        ? a.localeCompare(b)
        : a.startsWith('System')
          ? -1
          : 1,
    );
  }

  file(classesCode: string[], usings: string[], header: string[]): string {
    const out: string[] = [...header];
    if (this.o.nullableReferenceTypes) out.push('#nullable enable', '');
    if (usings.length) out.push(...usings.map((u) => `using ${u};`), '');
    const ns = this.o.namespace.trim();
    if (!ns) out.push(classesCode.join('\n\n'));
    else if (this.o.fileScopedNamespace) out.push(`namespace ${ns};`, '', classesCode.join('\n\n'));
    else
      out.push(
        `namespace ${ns}`,
        '{',
        classesCode.map((c) => c.replace(/^(?=.)/gm, '    ')).join('\n\n'),
        '}',
      );
    return `${out.join('\n')}\n`;
  }
}

function sanitizeNamespace(ns: string): string {
  return ns
    .split('.')
    .map((part) => toIdentifier(part, toPascalCase, 'Models'))
    .join('.');
}

export function generateCSharp(
  value: JsonValue,
  options: Partial<CSharpOptions> = {},
): GeneratedCode {
  const o: CSharpOptions = { ...DEFAULT_CSHARP_OPTIONS, ...options };
  o.namespace = o.namespace.trim() ? sanitizeNamespace(o.namespace) : '';
  const model = inferTypeModel(value, {
    rootName: o.rootName,
    detectDictionaries: o.detectDictionaries,
    detectUuids: o.useGuid,
  });
  return generateCSharpFromModel(model, o);
}

/**
 * Emits C# for an existing type model (e.g. tables mapped from SQL). `header` replaces the
 * JSON deserialization hint at the top of the file.
 */
export function generateCSharpFromModel(
  model: TypeModel,
  options: Partial<CSharpOptions> = {},
  header?: string[],
): GeneratedCode {
  const o: CSharpOptions = { ...DEFAULT_CSHARP_OPTIONS, ...options };
  o.namespace = o.namespace.trim() ? sanitizeNamespace(o.namespace) : '';
  const e = new CSharpEmitter(o);
  e.assignClassNames(model);
  const ordered = classesFromRoot(model);
  const root = e.className(model.rootClass);
  const usage = model.rootIsArray ? `List<${root}>` : root;
  const code = e.file(
    ordered.map((c) => e.emitClass(c, '')),
    e.usings(collectTypes(model)),
    header ?? [
      `// Generated by DevStudio. Deserialize with: JsonSerializer.Deserialize<${usage}>(json)`,
    ],
  );
  const files: GeneratedFile[] = ordered.map((c) => ({
    path: `${e.className(c.name)}.cs`,
    content: e.file([e.emitClass(c, '')], e.usings(typesOfClass(c)), []),
  }));
  return { code, files, notes: e.notes };
}
