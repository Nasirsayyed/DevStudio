import type { JsonObject, JsonType, JsonValue } from './types';

export function jsonTypeOf(value: unknown): JsonType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'object';
  }
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isContainer(value: unknown): value is JsonObject | JsonValue[] {
  return typeof value === 'object' && value !== null;
}

/**
 * Defines an own, enumerable property. Unlike `obj[key] = value`, this never
 * invokes the `__proto__` setter, so keys like "__proto__" are kept as plain
 * data and can never change an object's prototype (prototype-pollution safe).
 */
export function setOwn(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

export function hasOwn(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}
