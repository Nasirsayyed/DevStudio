import type { JsonValue } from '../../json/types';
import {
  type GeneratedCode,
  type GeneratedFile,
  type ModelClass,
  type TypeRef,
  classesFromRoot,
  collectTypes,
  inferTypeModel,
  typesOfClass,
} from '../model';
import { NameScope, toCamelCase, toIdentifier, toPascalCase } from '../naming';

export interface JavaOptions {
  rootName: string;
  /** Empty = default package. */
  packageName: string;
  style: 'class' | 'record' | 'lombok';
  /** Jackson `@JsonProperty` annotations. */
  jackson: boolean;
  dateType: 'java.time' | 'String';
  useUuid: boolean;
  detectDictionaries: boolean;
}

export const DEFAULT_JAVA_OPTIONS: JavaOptions = {
  rootName: 'Root',
  packageName: 'com.example.model',
  style: 'class',
  jackson: true,
  dateType: 'java.time',
  useUuid: true,
  detectDictionaries: true,
};

const KEYWORDS = new Set(
  'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record yield sealed permits'.split(
    ' ',
  ),
);
const RESERVED_TYPE_NAMES = [
  'Object',
  'String',
  'Integer',
  'Long',
  'Double',
  'Boolean',
  'List',
  'Map',
  'Class',
  'Record',
  'System',
  'Math',
  'Thread',
  'Exception',
  'Override',
];

interface JavaType {
  type: string;
  imports: string[];
}

const BOXED: Record<string, string> = {
  int: 'Integer',
  long: 'Long',
  double: 'Double',
  boolean: 'Boolean',
};

export function generateJava(value: JsonValue, options: Partial<JavaOptions> = {}): GeneratedCode {
  const o: JavaOptions = { ...DEFAULT_JAVA_OPTIONS, ...options };
  const pkg = o.packageName
    .split('.')
    .map((p) => p.toLowerCase().replace(/[^a-z0-9_]/g, ''))
    .filter(Boolean)
    .map((p) => (KEYWORDS.has(p) || /^\d/.test(p) ? `${p}_` : p))
    .join('.');
  const model = inferTypeModel(value, {
    rootName: o.rootName,
    detectDictionaries: o.detectDictionaries,
    detectUuids: o.useUuid,
  });
  const notes: string[] = [];
  const ordered = classesFromRoot(model);
  const scope = new NameScope(RESERVED_TYPE_NAMES);
  const names = new Map<string, string>();
  for (const c of ordered) {
    const wanted = toIdentifier(c.name, toPascalCase, 'Item');
    const name = scope.has(wanted) ? scope.claim(`${wanted}Model`) : scope.claim(wanted);
    if (name !== c.name) notes.push(`Class "${c.name}" was named "${name}" to avoid a conflict.`);
    names.set(c.name, name);
  }

  const resolve = (t: TypeRef, boxed: boolean): JavaType => {
    const prim = (p: string): JavaType => ({
      type: boxed || t.nullable ? (BOXED[p] ?? p) : p,
      imports: [],
    });
    switch (t.kind) {
      case 'string':
        if (t.format === 'uuid' && o.useUuid) return { type: 'UUID', imports: ['java.util.UUID'] };
        if (t.format === 'date-time' && o.dateType === 'java.time')
          return { type: 'OffsetDateTime', imports: ['java.time.OffsetDateTime'] };
        if (t.format === 'date' && o.dateType === 'java.time')
          return { type: 'LocalDate', imports: ['java.time.LocalDate'] };
        return { type: 'String', imports: [] };
      case 'integer':
        return prim(t.long ? 'long' : 'int');
      case 'number':
        return prim('double');
      case 'boolean':
        return prim('boolean');
      case 'any':
      case 'union':
        return { type: 'Object', imports: [] };
      case 'class':
        return { type: names.get(t.name) ?? t.name, imports: [] };
      case 'array': {
        const item = resolve(t.items, true);
        return { type: `List<${item.type}>`, imports: [...item.imports, 'java.util.List'] };
      }
      case 'dictionary': {
        const v = resolve(t.values, true);
        return { type: `Map<String, ${v.type}>`, imports: [...v.imports, 'java.util.Map'] };
      }
    }
  };

  const importsFor = (types: TypeRef[]): string[] => {
    const set = new Set<string>();
    for (const t of types) for (const i of resolve(t, false).imports) set.add(i);
    if (o.jackson) set.add('com.fasterxml.jackson.annotation.JsonProperty');
    if (o.style === 'lombok') {
      set.add('lombok.Data');
      set.add('lombok.NoArgsConstructor');
      set.add('lombok.AllArgsConstructor');
    }
    return [...set].sort((a, b) =>
      a.startsWith('java') === b.startsWith('java')
        ? a.localeCompare(b)
        : a.startsWith('java')
          ? -1
          : 1,
    );
  };

  const fieldsOf = (c: ModelClass) => {
    const fieldScope = new NameScope([...KEYWORDS]);
    return c.properties.map((p) => {
      const base = toIdentifier(p.jsonName, toCamelCase, 'value');
      const name = fieldScope.claim(KEYWORDS.has(base) ? `${base}_` : base);
      return { name, json: p.jsonName, type: resolve(p.type, p.optional).type };
    });
  };

  const ann = (json: string, pad: string) =>
    o.jackson ? `${pad}@JsonProperty(${JSON.stringify(json)})\n` : '';

  /** Emits one type. `nested` adds `static` for member classes inside the root. */
  const emit = (c: ModelClass, pad: string, nested: boolean, members: string[] = []): string => {
    const name = names.get(c.name) ?? c.name;
    const fields = fieldsOf(c);
    const inner = members.length ? `\n\n${members.join('\n\n')}` : '';
    if (o.style === 'record') {
      const params = fields.map((f) =>
        `${ann(f.json, `${pad}    `).trimEnd()}${o.jackson ? ' ' : `${pad}    `}${f.type} ${f.name}`.replace(
          /^\s*\n/,
          '',
        ),
      );
      const body = members.length ? ` {${inner}\n${pad}}` : ' {}';
      return `${pad}public record ${name}(\n${params.map((p) => (o.jackson ? `${pad}    ${p.trimStart()}` : p)).join(',\n')}\n${pad})${body}`;
    }
    const decl = `${pad}${o.style === 'lombok' ? `@Data\n${pad}@NoArgsConstructor\n${pad}@AllArgsConstructor\n${pad}` : ''}public ${nested ? 'static ' : ''}class ${name} {`;
    const fieldLines = fields
      .map((f) => `${ann(f.json, `${pad}    `)}${pad}    private ${f.type} ${f.name};`)
      .join('\n\n');
    const accessors =
      o.style === 'class'
        ? fields
            .map((f) => {
              const cap = f.name.charAt(0).toUpperCase() + f.name.slice(1);
              const getter = f.type === 'boolean' ? `is${cap}` : `get${cap}`;
              return `${pad}    public ${f.type} ${getter}() {\n${pad}        return ${f.name};\n${pad}    }\n\n${pad}    public void set${cap}(${f.type} ${f.name}) {\n${pad}        this.${f.name} = ${f.name};\n${pad}    }`;
            })
            .join('\n\n')
        : '';
    return `${decl}\n${fieldLines}${accessors ? `\n\n${accessors}` : ''}${inner}\n${pad}}`;
  };

  const header = (imports: string[]) =>
    [
      pkg ? `package ${pkg};\n` : '',
      imports.length ? `${imports.map((i) => `import ${i};`).join('\n')}\n` : '',
    ]
      .filter(Boolean)
      .join('\n');
  const [root, ...rest] = ordered;
  if (!root) throw new Error('No classes');
  const nestedMembers = rest.map((c) => emit(c, '    ', true));
  const rootName = names.get(root.name) ?? root.name;
  const usage = model.rootIsArray
    ? `new TypeReference<List<${rootName}>>() {}`
    : `${rootName}.class`;
  const code = `// Generated by DevStudio. Deserialize with Jackson: new ObjectMapper().readValue(json, ${usage})\n${header(importsFor(collectTypes(model)))}\n${emit(root, '', false, nestedMembers)}\n`;
  const files: GeneratedFile[] = ordered.map((c) => ({
    path: `${pkg ? `${pkg.replace(/\./g, '/')}/` : ''}${names.get(c.name) ?? c.name}.java`,
    content: `${header(importsFor(typesOfClass(c)))}\n${emit(c, '', false)}\n`,
  }));
  return { code, files, notes };
}
