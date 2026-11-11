export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type JsonType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

/** A location inside a JSON document: object keys and array indexes. */
export type PathSegment = string | number;
export type JsonPathSegments = readonly PathSegment[];
