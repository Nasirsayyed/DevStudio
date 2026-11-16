import { describe, expect, it } from 'vitest';
import { buildRequest } from './build';
import { toCurl } from './curl';
import { emptyRequest, rowId } from './model';
import { requestSnippet, SNIPPET_LANGUAGES } from './snippets';

const body = emptyRequest().body;

describe('code snippets for every body kind', () => {
  const formData = buildRequest(
    emptyRequest({
      method: 'POST',
      url: 'https://api.test/upload',
      body: {
        ...body,
        mode: 'form-data',
        formData: [
          { id: rowId(), key: 'name', value: 'Ada "A"', type: 'text', enabled: true },
          { id: 'file1', key: 'avatar', value: 'me.png', type: 'file', enabled: true },
        ],
      },
    }),
    [],
  );
  const binary = buildRequest(
    emptyRequest({
      method: 'PUT',
      url: 'https://api.test/blob',
      body: { ...body, mode: 'binary' },
    }),
    [],
  );
  const get = buildRequest(
    emptyRequest({
      url: 'https://api.test/items',
      headers: [{ id: 'h', key: 'Accept', value: 'application/json', enabled: true }],
    }),
    [],
  );

  it('generates every language for a plain GET without a body', () => {
    for (const lang of SNIPPET_LANGUAGES) {
      const code = requestSnippet(get, lang.id);
      expect(code, lang.id).toContain('https://api.test/items');
      expect(code, lang.id).toContain('Accept');
    }
    expect(requestSnippet(get, 'curl')).toMatch(
      /^curl -X GET 'https:\/\/api\.test\/items' \\\n {2}-H 'Accept: application\/json'\n$/,
    );
    expect(requestSnippet(get, 'fetch')).not.toContain('body:');
  });

  it('references form fields and files by name', () => {
    expect(toCurl(formData, { file1: 'me.png' })).toContain("-F 'avatar=@me.png'");
    expect(requestSnippet(formData, 'curl')).toContain('-F \'name=Ada "A"\'');
    const fetchCode = requestSnippet(formData, 'fetch');
    expect(fetchCode).toContain('new FormData()');
    expect(fetchCode).toContain('form.append("name", "Ada \\"A\\"");');
    expect(requestSnippet(formData, 'python')).toContain('files');
    expect(requestSnippet(formData, 'csharp')).toContain('MultipartFormDataContent');
  });

  it('describes binary bodies as a file to choose', () => {
    for (const lang of SNIPPET_LANGUAGES)
      expect(requestSnippet(binary, lang.id), lang.id).toMatch(/PUT/);
    expect(requestSnippet(binary, 'curl')).toContain('--data-binary');
  });
});
