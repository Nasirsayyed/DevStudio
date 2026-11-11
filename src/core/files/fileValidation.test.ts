import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/AppError';
import {
  JSON_FILE_RULES,
  fileExtension,
  normalizeTextContent,
  validateFileMeta,
} from './fileValidation';

describe('file validation', () => {
  it('accepts supported files', () => {
    expect(() => {
      validateFileMeta({ name: 'data.JSON', size: 10, type: 'application/json' }, JSON_FILE_RULES);
    }).not.toThrow();
  });

  it('rejects empty, oversized and unsupported files', () => {
    expect(() => {
      validateFileMeta({ name: 'a.json', size: 0, type: '' }, JSON_FILE_RULES);
    }).toThrow(/empty/);
    expect(() => {
      validateFileMeta({ name: 'a.json', size: 60 * 1024 * 1024, type: '' }, JSON_FILE_RULES);
    }).toThrow(/limit is 50 MB/);
    expect(() => {
      validateFileMeta({ name: 'a.exe', size: 5, type: '' }, JSON_FILE_RULES);
    }).toThrow(ValidationError);
  });

  it('extracts extensions', () => {
    expect(fileExtension('x.tar.GZ')).toBe('.gz');
    expect(fileExtension('.env')).toBe('');
    expect(fileExtension('noext')).toBe('');
  });

  it('strips BOM and rejects binary content', () => {
    expect(normalizeTextContent('a', '﻿{"a":1}')).toBe('{"a":1}');
    expect(() => normalizeTextContent('img.json', 'PNG\u0000\u0001')).toThrow(/binary/);
  });
});
