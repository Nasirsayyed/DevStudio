import { formatXml, minifyXml, type XmlFormatOptions } from '../formatters/xml';
import { formatYaml, jsonToYaml, type YamlFormatOptions, yamlToJson } from '../formatters/yaml';
import type { IndentOption } from '../json/format';
import { type MarkdownOptions, renderMarkdown } from '../markdown/markdown';
import { type CaseStyle, convertCase } from './case';
import { diffTexts, type TextDiffOptions } from './diff';
import { type FindOptions, findAll, type ReplaceOptions, replaceAll } from './findReplace';
import { type LineOptions, processLines } from './lines';
import { type ReverseMode, reverseText } from './reverse';
import { textStats } from './stats';

/** Text tool operations (pure; run on the main thread or in a worker). */
export const textOperations = {
  diff: (p: { original: string; modified: string; options: Partial<TextDiffOptions> }) =>
    diffTexts(p.original, p.modified, p.options),
  stats: (p: { text: string; ignoreStopWords: boolean }) =>
    textStats(p.text, { ignoreStopWords: p.ignoreStopWords }),
  find: (p: { text: string; options: FindOptions }) => findAll(p.text, p.options),
  replace: (p: { text: string; options: ReplaceOptions }) => replaceAll(p.text, p.options),
  lines: (p: { text: string; options: Partial<LineOptions> }) => processLines(p.text, p.options),
  case: (p: { text: string; style: CaseStyle }) => convertCase(p.text, p.style),
  reverse: (p: { text: string; mode: ReverseMode }) => reverseText(p.text, p.mode),
  markdown: (p: { text: string; options: Partial<MarkdownOptions> }) =>
    renderMarkdown(p.text, p.options),
  xmlFormat: (p: { text: string; options: Partial<XmlFormatOptions> }) =>
    formatXml(p.text, p.options),
  xmlMinify: (p: { text: string; removeComments: boolean }) =>
    minifyXml(p.text, { removeComments: p.removeComments }),
  yamlFormat: (p: { text: string; options: Partial<YamlFormatOptions> }) =>
    formatYaml(p.text, p.options),
  yamlToJson: (p: { text: string; indent: IndentOption }) => yamlToJson(p.text, p.indent),
  jsonToYaml: (p: { text: string; options: Partial<YamlFormatOptions> }) =>
    jsonToYaml(p.text, p.options),
} as const;

export type TextOperations = typeof textOperations;
export type TextOperationName = keyof TextOperations;
export type TextOperationInput<K extends TextOperationName> = Parameters<TextOperations[K]>[0];
export type TextOperationOutput<K extends TextOperationName> = ReturnType<TextOperations[K]>;
