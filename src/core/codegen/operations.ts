import {
  jsonToXml,
  type JsonToXmlOptions,
  xmlToJson,
  type XmlToJsonOptions,
} from '../converters/xml';
import { formatJson, type IndentOption } from '../json/format';
import { parseJsonOrThrow } from '../json/parse';
import { type CSharpOptions, generateCSharp } from './emitters/csharp';
import { generateJava, type JavaOptions } from './emitters/java';
import { generatePython, type PythonOptions } from './emitters/python';
import { generateSqlTable, type SqlTableOptions } from './emitters/sqlTable';
import { generateTypeScript, type TypeScriptOptions } from './emitters/typescript';

/**
 * Code generator operations (pure; run on the main thread or in a worker).
 * Inputs are raw text so that parsing large documents also happens off-thread.
 */
export const codegenOperations = {
  csharp: (p: { text: string; options: Partial<CSharpOptions> }) =>
    generateCSharp(parseJsonOrThrow(p.text), p.options),
  typescript: (p: { text: string; options: Partial<TypeScriptOptions> }) =>
    generateTypeScript(parseJsonOrThrow(p.text), p.options),
  java: (p: { text: string; options: Partial<JavaOptions> }) =>
    generateJava(parseJsonOrThrow(p.text), p.options),
  python: (p: { text: string; options: Partial<PythonOptions> }) =>
    generatePython(parseJsonOrThrow(p.text), p.options),
  sqlTable: (p: { text: string; options: Partial<SqlTableOptions> }) =>
    generateSqlTable(parseJsonOrThrow(p.text), p.options),
  jsonToXml: (p: { text: string; options: JsonToXmlOptions }) =>
    jsonToXml(parseJsonOrThrow(p.text), p.options),
  xmlToJson: (p: { text: string; options: XmlToJsonOptions; indent: IndentOption }) =>
    formatJson(xmlToJson(p.text, p.options), p.indent),
} as const;

export type CodegenOperations = typeof codegenOperations;
export type CodegenOperationName = keyof CodegenOperations;
export type CodegenOperationInput<K extends CodegenOperationName> = Parameters<
  CodegenOperations[K]
>[0];
export type CodegenOperationOutput<K extends CodegenOperationName> = ReturnType<
  CodegenOperations[K]
>;
