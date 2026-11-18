import { describe, expect, it } from 'vitest';
import { AppError, ParseError, ValidationError } from '../errors/AppError';
import { jsonOperations } from '../json/operations';
import { deserializeError, handleTaskRequest, serializeError } from './protocol';

describe('task protocol', () => {
  it('executes operations and returns results', async () => {
    expect(
      await handleTaskRequest(jsonOperations, {
        id: 1,
        op: 'minify',
        payload: { text: '{ "a" : [1, 2] }' },
      }),
    ).toEqual({
      id: 1,
      ok: true,
      result: '{"a":[1,2]}',
    });
  });

  it('serializes ParseErrors with their position and rebuilds them', async () => {
    const res = await handleTaskRequest(jsonOperations, {
      id: 2,
      op: 'format',
      payload: { text: '{\n "a": }', indent: 2 },
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const err = deserializeError(res.error);
    expect(err).toBeInstanceOf(ParseError);
    expect((err as ParseError).line).toBe(2);
    expect((err as ParseError).column).toBe(7);
  });

  it('keeps the failing input source for multi-input operations', async () => {
    const res = await handleTaskRequest(jsonOperations, {
      id: 5,
      op: 'diff',
      payload: { left: '{}', right: '[1,', options: {}, normalize: false },
    });
    if (res.ok) throw new Error('expected failure');
    const err = deserializeError(res.error) as ParseError;
    expect(err.source).toBe('right');
    expect(err.message).toMatch(/^Right document: /);
  });

  it('round-trips validation and generic errors', () => {
    expect(deserializeError(serializeError(new ValidationError('bad')))).toBeInstanceOf(
      ValidationError,
    );
    const generic = deserializeError(serializeError(new Error('boom')));
    expect(generic).toBeInstanceOf(AppError);
    expect(generic.message).toBe('boom');
    expect(serializeError('text').message).toBe('text');
  });

  it('rejects unknown and inherited operation names', async () => {
    expect(
      await handleTaskRequest(jsonOperations, { id: 3, op: 'nope', payload: {} }),
    ).toMatchObject({
      ok: false,
    });
    expect(
      await handleTaskRequest(jsonOperations, { id: 4, op: 'toString', payload: {} }),
    ).toMatchObject({ ok: false });
  });
});
