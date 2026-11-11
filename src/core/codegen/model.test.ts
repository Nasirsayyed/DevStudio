import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors/AppError';
import { classesFromRoot, inferTypeModel } from './model';

describe('inferTypeModel', () => {
  it('infers primitives, formats, nested classes and arrays', () => {
    const m = inferTypeModel({
      id: 1,
      big: 9_000_000_000,
      price: 12.345,
      ok: true,
      when: '2026-01-01T10:00:00Z',
      day: '2026-01-01',
      key: '0f8fad5b-d9cb-469f-a165-70867728950e',
      address: { city: 'X' },
      tags: ['a'],
    });
    const root = m.classes.find((c) => c.name === 'Root')!;
    const t = Object.fromEntries(root.properties.map((p) => [p.jsonName, p.type]));
    expect(t.id).toMatchObject({ kind: 'integer', long: false });
    expect(t.big).toMatchObject({ kind: 'integer', long: true });
    expect(t.price).toMatchObject({ kind: 'number', integerDigits: 2, scale: 3 });
    expect(t.when).toMatchObject({ kind: 'string', format: 'date-time' });
    expect(t.day).toMatchObject({ kind: 'string', format: 'date' });
    expect(t.key).toMatchObject({ kind: 'string', format: 'uuid' });
    expect(t.address).toMatchObject({ kind: 'class', name: 'Address' });
    expect(t.tags).toMatchObject({ kind: 'array', items: { kind: 'string' } });
  });

  it('merges array element shapes: optional properties, nullability and int+float', () => {
    const m = inferTypeModel({
      items: [
        { a: 1, b: 'x' },
        { a: 2.5, c: null },
        { a: 3, b: null },
      ],
    });
    const item = m.classes.find((c) => c.name === 'Item')!;
    const props = Object.fromEntries(item.properties.map((p) => [p.jsonName, p]));
    expect(props.a).toMatchObject({ optional: false, type: { kind: 'number', nullable: false } });
    expect(props.b).toMatchObject({ optional: true, type: { kind: 'string', nullable: true } });
    expect(props.c).toMatchObject({ optional: true, type: { kind: 'any', nullable: true } });
  });

  it('represents mixed types as unions', () => {
    const m = inferTypeModel({ v: [1, 'x', true] });
    expect(m.classes[0]!.properties[0]!.type).toMatchObject({
      kind: 'array',
      items: { kind: 'union' },
    });
  });

  it('detects dictionaries keyed by ids or dates', () => {
    const m = inferTypeModel({
      byId: { '1': { n: 'a' }, '2': { n: 'b' } },
      byDate: { '2026-01-01': 3 },
    });
    const root = m.classes.find((c) => c.name === 'Root')!;
    expect(root.properties[0]!.type).toMatchObject({
      kind: 'dictionary',
      values: { kind: 'class' },
    });
    expect(root.properties[1]!.type).toMatchObject({
      kind: 'dictionary',
      values: { kind: 'integer' },
    });
    expect(inferTypeModel({ byId: { '1': 1 } }, { detectDictionaries: false }).classes.length).toBe(
      2,
    );
  });

  it('reuses identical structures and disambiguates name clashes', () => {
    const m = inferTypeModel({
      billing: { street: 'a', city: 'b' },
      shipping: { street: 'c', city: 'd' },
      item: { x: 1 },
      order: { item: { y: 'z' } },
    });
    const names = m.classes.map((c) => c.name).sort();
    expect(names).toEqual(['Billing', 'Item', 'Order', 'OrderItem', 'Root']);
    const shipping = m.classes.find((c) => c.name === 'Root')!.properties[1]!.type;
    expect(shipping).toMatchObject({ kind: 'class', name: 'Billing' });
  });

  it('handles root arrays, empty arrays and orders classes', () => {
    const m = inferTypeModel([{ a: [] }, { a: [], b: { c: 1 } }], { rootName: 'user' });
    expect(m.rootIsArray).toBe(true);
    expect(m.rootClass).toBe('User');
    expect(m.classes.find((c) => c.name === 'User')!.properties[0]!.type).toMatchObject({
      kind: 'array',
      items: { kind: 'any' },
    });
    expect(classesFromRoot(m).map((c) => c.name)).toEqual(['User', 'B']);
  });

  it('rejects primitives and arrays of primitives at the root', () => {
    for (const v of [1, 'x', null, [1, 2], []])
      expect(() => inferTypeModel(v)).toThrow(ValidationError);
  });
});
