import { describe, expect, it } from 'vitest';
import { allMimeTypes, extensionsForType, mimeForFileName, searchMimeTypes } from './mime';

describe('MIME lookup', () => {
  it('knows standard and vendor types', () => {
    expect(allMimeTypes().length).toBeGreaterThan(800);
    expect(mimeForFileName('report.PDF')).toBe('application/pdf');
    expect(mimeForFileName('x.unknownext')).toBeNull();
    expect(extensionsForType('image/jpeg')).toEqual(expect.arrayContaining(['jpg', 'jpeg']));
  });

  it('searches by extension, file name, type and keyword, canonical first', () => {
    expect(searchMimeTypes('.json')[0]?.type).toBe('application/json');
    expect(searchMimeTypes('photo.png')[0]?.type).toBe('image/png');
    expect(searchMimeTypes('image/').every((e) => e.type.includes('image/'))).toBe(true);
    expect(searchMimeTypes('zzzzzz')).toEqual([]);
  });
});
