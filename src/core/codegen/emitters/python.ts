import type { JsonValue } from '../../json/types';
import {
  type GeneratedCode,
  type ModelClass,
  type TypeRef,
  classesDependencyFirst,
  classesFromRoot,
  collectTypes,
  inferTypeModel,
} from '../model';
import { NameScope, toIdentifier, toPascalCase, toSnakeCase } from '../naming';

export interface PythonOptions {
  rootName: string;
  style: 'dataclass' | 'pydantic' | 'typeddict';
  /** Map ISO dates / UUIDs to datetime / date / UUID (dataclass & pydantic only). */
  richTypes: boolean;
  detectDictionaries: boolean;
}

export const DEFAULT_PYTHON_OPTIONS: PythonOptions = {
  rootName: 'Root',
  style: 'dataclass',
  richTypes: true,
  detectDictionaries: true,
};

const KEYWORDS = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case type'.split(
    ' ',
  ),
);
/** Names that would shadow builtins/typing imports used by the generated module. */
const RESERVED = [
  'Any',
  'List',
  'Dict',
  'Optional',
  'TypedDict',
  'NotRequired',
  'BaseModel',
  'Field',
  'ConfigDict',
  'UUID',
  'datetime',
  'date',
  'dataclass',
  'field',
  'str',
  'int',
  'float',
  'bool',
  'list',
  'dict',
];

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function generatePython(
  value: JsonValue,
  options: Partial<PythonOptions> = {},
): GeneratedCode {
  const o: PythonOptions = { ...DEFAULT_PYTHON_OPTIONS, ...options };
  const rich = o.richTypes && o.style !== 'typeddict';
  const model = inferTypeModel(value, {
    rootName: o.rootName,
    detectDictionaries: o.detectDictionaries,
    detectUuids: rich,
    detectDates: rich,
  });
  const notes: string[] = [];
  const scope = new NameScope(RESERVED);
  const names = new Map<string, string>();
  for (const c of classesFromRoot(model)) {
    const wanted = toIdentifier(c.name, toPascalCase, 'Item');
    const name = scope.has(wanted) ? scope.claim(`${wanted}Model`) : scope.claim(wanted);
    if (name !== c.name) notes.push(`Class "${c.name}" was named "${name}" to avoid a conflict.`);
    names.set(c.name, name);
  }

  const imports = new Set<string>();
  const typeOf = (t: TypeRef): string => {
    let base: string;
    switch (t.kind) {
      case 'string':
        if (t.format === 'date-time') {
          imports.add('from datetime import datetime');
          base = 'datetime';
        } else if (t.format === 'date') {
          imports.add('from datetime import date');
          base = 'date';
        } else if (t.format === 'uuid') {
          imports.add('from uuid import UUID');
          base = 'UUID';
        } else base = 'str';
        break;
      case 'integer':
        base = 'int';
        break;
      case 'number':
        base = 'float';
        break;
      case 'boolean':
        base = 'bool';
        break;
      case 'any':
        imports.add('from typing import Any');
        return 'Any';
      case 'class':
        base = names.get(t.name) ?? t.name;
        break;
      case 'union':
        base = [...new Set(t.types.map(typeOf))].join(' | ');
        break;
      case 'array':
        base = `list[${typeOf(t.items)}]`;
        break;
      case 'dictionary':
        base = `dict[str, ${typeOf(t.values)}]`;
        break;
    }
    return t.nullable ? `${base} | None` : base;
  };

  const fieldName = (fieldScope: NameScope, json: string) => {
    const snake = toIdentifier(json, toSnakeCase, 'value');
    return fieldScope.claim(KEYWORDS.has(snake) ? `${snake}_` : snake);
  };

  const emit = (c: ModelClass): string => {
    const name = names.get(c.name) ?? c.name;
    if (o.style === 'typeddict') {
      const entries = c.properties.map((p) => {
        let t = typeOf(p.type);
        if (p.optional) {
          imports.add('from typing import NotRequired');
          t = `NotRequired[${t}]`;
        }
        return { key: p.jsonName, t };
      });
      imports.add('from typing import TypedDict');
      if (entries.every((e) => IDENT.test(e.key) && !KEYWORDS.has(e.key))) {
        return `class ${name}(TypedDict):\n${entries.length ? entries.map((e) => `    ${e.key}: ${e.t}`).join('\n') : '    pass'}`;
      }
      // Keys that aren't valid identifiers require the functional syntax.
      return `${name} = TypedDict(\n    ${JSON.stringify(name)},\n    {\n${entries.map((e) => `        ${JSON.stringify(e.key)}: ${e.t},`).join('\n')}\n    },\n)`;
    }

    const fieldScope = new NameScope();
    // Fields with defaults (optional/nullable) must follow required fields in dataclasses.
    const fields = c.properties.map((p) => {
      const pyName = fieldName(fieldScope, p.jsonName);
      const t = typeOf(p.type);
      const hasDefault = p.optional || p.type.nullable || p.type.kind === 'any';
      return {
        pyName,
        json: p.jsonName,
        t: p.optional && !t.endsWith('| None') && t !== 'Any' ? `${t} | None` : t,
        hasDefault,
      };
    });
    const sorted =
      o.style === 'dataclass'
        ? [...fields.filter((f) => !f.hasDefault), ...fields.filter((f) => f.hasDefault)]
        : fields;

    if (o.style === 'pydantic') {
      imports.add('from pydantic import BaseModel');
      const aliased = fields.some((f) => f.pyName !== f.json);
      if (aliased) {
        imports.add('from pydantic import ConfigDict');
        imports.add('from pydantic import Field');
      }
      const lines = sorted.map((f) => {
        const alias = f.pyName !== f.json ? `alias=${JSON.stringify(f.json)}` : '';
        if (f.hasDefault)
          return `    ${f.pyName}: ${f.t} = ${alias ? `Field(default=None, ${alias})` : 'None'}`;
        return `    ${f.pyName}: ${f.t}${alias ? ` = Field(${alias})` : ''}`;
      });
      const config = aliased ? ['    model_config = ConfigDict(populate_by_name=True)', ''] : [];
      return `class ${name}(BaseModel):\n${[...config, ...lines].join('\n') || '    pass'}`;
    }

    imports.add('from dataclasses import dataclass');
    const lines = sorted.map((f) => {
      const comment = f.pyName !== f.json ? `  # JSON key: ${JSON.stringify(f.json)}` : '';
      return `    ${f.pyName}: ${f.t}${f.hasDefault ? ' = None' : ''}${comment}`;
    });
    return `@dataclass\nclass ${name}:\n${lines.join('\n') || '    pass'}`;
  };

  // Python needs classes defined before use: nested classes first, root last.
  const ordered = classesDependencyFirst(model);
  for (const t of collectTypes(model)) typeOf(t);
  const blocks = ordered.map(emit);
  const root = names.get(model.rootClass) ?? model.rootClass;
  const usage =
    o.style === 'pydantic'
      ? model.rootIsArray
        ? `TypeAdapter(list[${root}]).validate_json(json)`
        : `${root}.model_validate_json(json)`
      : o.style === 'typeddict'
        ? `data: ${model.rootIsArray ? `list[${root}]` : root} = json.loads(text)`
        : `dacite.from_dict(${root}, data) (dataclasses don't convert nested dicts by themselves)`;
  const importLines = mergeImports([...imports]);
  const code = `# Generated by DevStudio. Usage: ${usage}\nfrom __future__ import annotations\n\n${importLines.join('\n')}\n\n\n${blocks.join('\n\n\n')}\n`;
  return { code, files: [{ path: 'models.py', content: code }], notes };
}

/** Combines "from x import a" lines per module, sorted (stdlib first, then third party). */
function mergeImports(lines: string[]): string[] {
  const byModule = new Map<string, Set<string>>();
  for (const l of lines) {
    const m = /^from (\S+) import (\S+)$/.exec(l);
    if (!m) continue;
    const [, mod = '', name = ''] = m;
    byModule.set(mod, (byModule.get(mod) ?? new Set()).add(name));
  }
  const thirdParty = new Set(['pydantic']);
  const fmt = (mod: string) =>
    `from ${mod} import ${[...(byModule.get(mod) ?? [])].sort().join(', ')}`;
  const mods = [...byModule.keys()].sort();
  const std = mods.filter((m) => !thirdParty.has(m)).map(fmt);
  const third = mods.filter((m) => thirdParty.has(m)).map(fmt);
  return std.length && third.length ? [...std, '', ...third] : [...std, ...third];
}
