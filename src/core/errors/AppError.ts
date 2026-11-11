/**
 * Centralized error model. Every recoverable error surfaced to users should be
 * (or be converted to) an AppError so the UI can render a meaningful message.
 */
export type AppErrorCode =
  | 'VALIDATION'
  | 'PARSE'
  | 'NETWORK'
  | 'CORS'
  | 'STORAGE_QUOTA'
  | 'STORAGE'
  | 'WORKER'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export interface AppErrorOptions {
  cause?: unknown;
  /** Extra structured details (e.g. line/column for parse errors). */
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: AppErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.details = options.details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, options?: AppErrorOptions) {
    super('VALIDATION', message, options);
    this.name = 'ValidationError';
  }
}

export class ParseError extends AppError {
  readonly line: number | undefined;
  readonly column: number | undefined;

  constructor(message: string, position: { line?: number; column?: number } = {}, cause?: unknown) {
    super('PARSE', message, { cause, details: { ...position } });
    this.name = 'ParseError';
    this.line = position.line;
    this.column = position.column;
  }
}

export class StorageQuotaError extends AppError {
  constructor(cause?: unknown) {
    super(
      'STORAGE_QUOTA',
      'Browser storage is full. Free up space by clearing history or deleting large saved items.',
      { cause },
    );
    this.name = 'StorageQuotaError';
  }
}

export class StorageError extends AppError {
  constructor(message: string, cause?: unknown) {
    super('STORAGE', message, { cause });
    this.name = 'StorageError';
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** Converts anything thrown into a short, human-readable message. */
export function toUserMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (isAppError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}
