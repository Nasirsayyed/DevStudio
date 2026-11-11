import { describe, expect, it } from 'vitest';
import {
  AppError,
  ParseError,
  StorageQuotaError,
  ValidationError,
  isAppError,
  toUserMessage,
} from './AppError';

describe('AppError hierarchy', () => {
  it('carries codes, causes and details', () => {
    const cause = new Error('low level');
    const err = new ParseError('Unexpected token', { line: 3, column: 7 }, cause);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('PARSE');
    expect(err.line).toBe(3);
    expect(err.details).toEqual({ line: 3, column: 7 });
    expect(err.cause).toBe(cause);
    expect(new ValidationError('bad').code).toBe('VALIDATION');
    expect(new StorageQuotaError().code).toBe('STORAGE_QUOTA');
  });

  it('isAppError distinguishes app errors', () => {
    expect(isAppError(new ValidationError('x'))).toBe(true);
    expect(isAppError(new Error('x'))).toBe(false);
  });
});

describe('toUserMessage', () => {
  it('extracts messages from errors, strings and unknowns', () => {
    expect(toUserMessage(new ValidationError('Name is required'))).toBe('Name is required');
    expect(toUserMessage(new Error('boom'))).toBe('boom');
    expect(toUserMessage('plain')).toBe('plain');
    expect(toUserMessage(undefined)).toBe('Something went wrong.');
    expect(toUserMessage({ weird: true }, 'Fallback')).toBe('Fallback');
    expect(toUserMessage(new Error(''))).toBe('Something went wrong.');
  });
});
