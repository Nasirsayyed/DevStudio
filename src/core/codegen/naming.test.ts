import { describe, expect, it } from 'vitest';
import {
  NameScope,
  singularize,
  singularizeName,
  splitWords,
  toCamelCase,
  toIdentifier,
  toPascalCase,
  toSnakeCase,
} from './naming';

describe('case conversion', () => {
  it.each([
    ['order_id', 'OrderId', 'orderId', 'order_id'],
    ['customerName', 'CustomerName', 'customerName', 'customer_name'],
    ['XMLHttpRequest', 'XmlHttpRequest', 'xmlHttpRequest', 'xml_http_request'],
    ['first name', 'FirstName', 'firstName', 'first_name'],
    ['kebab-case-key', 'KebabCaseKey', 'kebabCaseKey', 'kebab_case_key'],
    ['checkout_v2', 'CheckoutV2', 'checkoutV2', 'checkout_v2'],
    ['ID', 'Id', 'id', 'id'],
    ['$weird!!key', 'WeirdKey', 'weirdKey', 'weird_key'],
  ])('%s', (input, pascal, camel, snake) => {
    expect(toPascalCase(input)).toBe(pascal);
    expect(toCamelCase(input)).toBe(camel);
    expect(toSnakeCase(input)).toBe(snake);
  });

  it('splits words', () => {
    expect(splitWords('userID2fa')).toEqual(['user', 'ID2fa']);
    expect(splitWords('__')).toEqual([]);
  });
});

describe('singularize', () => {
  it.each([
    ['items', 'item'],
    ['Orders', 'Order'],
    ['categories', 'category'],
    ['addresses', 'address'],
    ['boxes', 'box'],
    ['matches', 'match'],
    ['statuses', 'status'],
    ['status', 'status'],
    ['analysis', 'analysis'],
    ['people', 'person'],
    ['Children', 'Child'],
    ['movies', 'movie'],
    ['houses', 'house'],
    ['data', 'data'],
    ['news', 'news'],
    ['ITEMS', 'ITEM'],
    ['as', 'as'],
  ])('%s → %s', (plural, singular) => {
    expect(singularize(plural)).toBe(singular);
  });

  it('singularizes the last word of compound names', () => {
    expect(singularizeName('order_items')).toBe('order_item');
    expect(singularizeName('lineItems')).toBe('line_Item');
  });
});

describe('identifiers and scopes', () => {
  it('handles leading digits and empty names', () => {
    expect(toIdentifier('2fa', toPascalCase)).toBe('_2fa');
    expect(toIdentifier('!!!', toPascalCase, 'Value')).toBe('Value');
    expect(toIdentifier('', toSnakeCase, 'value', 'c_')).toBe('value');
  });

  it('allocates unique names, optionally case-insensitively', () => {
    const s = new NameScope(['Root']);
    expect(s.claim('Root')).toBe('Root2');
    expect(s.claim('Item')).toBe('Item');
    expect(s.claim('Item')).toBe('Item2');
    const ci = new NameScope([], true);
    ci.claim('Name');
    expect(ci.claim('name')).toBe('name2');
  });
});
