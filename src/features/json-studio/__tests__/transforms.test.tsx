import { screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_ORDER_JSON } from '@/core/json/samples';
import { db } from '@/services/db/database';
import { renderApp, resetAppState, setEditorText } from '@/test/renderApp';
import {
  DRAFT_SETTING_KEY,
  hydrateJsonStudioDraft,
  resetJsonStudioState,
  useJsonStudioStore,
} from '../store';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

beforeEach(async () => {
  await resetAppState();
});

const output = () => screen.findByRole('textbox', { name: 'Output' });

describe('JSON Formatter', () => {
  it('formats valid JSON with the chosen indentation', async () => {
    const { user } = renderApp('/json/formatter');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      '{"a":[1,{"b":true}]}',
    );
    await waitFor(async () => {
      expect(await output()).toHaveValue(
        '{\n  "a": [\n    1,\n    {\n      "b": true\n    }\n  ]\n}',
      );
    });
    expect(screen.getByText('✓ Valid JSON')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Indentation' }));
    await user.click(screen.getByRole('option', { name: '4 spaces' }));
    await waitFor(async () => {
      expect(await output()).toHaveValue(
        '{\n    "a": [\n        1,\n        {\n            "b": true\n        }\n    ]\n}',
      );
    });
  });

  it('reports syntax errors with line/column in the editor, status bar and output', async () => {
    const { user } = renderApp('/json/formatter');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      '{\n  "a": 1,\n}',
    );
    const problems = await screen.findByRole('list', { name: 'Input problems' });
    expect(problems).toHaveTextContent(
      "error 2:9 Trailing comma before '}' is not allowed in JSON (line 2, column 9)",
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Fix the input to see the result.');
    const goTo = screen.getByRole('button', { name: /Go to error/ });
    expect(goTo).toHaveTextContent("Ln 2, Col 9: Trailing comma before '}' is not allowed in JSON");
    await user.click(goTo);
    expect(screen.getAllByTestId('code-editor')[0]).toHaveAttribute('data-reveal-line', '2');
  });

  it('loads a sample, copies output and records history', async () => {
    const { user } = renderApp('/json/formatter');
    await user.click(await screen.findByRole('button', { name: 'Load sample' }));
    expect(await screen.findByRole('textbox', { name: 'Input' })).toHaveValue(SAMPLE_ORDER_JSON);
    await waitFor(async () => {
      expect((await output()).textContent).toContain('"order_id": 1001');
    });
    await user.click(screen.getByRole('button', { name: 'Copy output' }));
    expect(await navigator.clipboard.readText()).toContain('"customer_name": "Ahmed"');
    await waitFor(async () => {
      const [entry] = await db.toolHistory.toArray();
      expect(entry).toMatchObject({ toolId: 'json.formatter', label: 'JSON Formatter (copy)' });
    });
  });

  it('opens a dropped/uploaded file and rejects unsupported files', async () => {
    const { user } = renderApp('/json/formatter');
    const fileInput = await screen.findByLabelText('Open file', { selector: 'input' });
    await user.upload(
      fileInput,
      new File(['{"uploaded": true}'], 'data.json', { type: 'application/json' }),
    );
    expect(await screen.findByRole('textbox', { name: 'Input' })).toHaveValue('{"uploaded": true}');
    expect(await screen.findByText('Loaded data.json')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    const picky = userEvent.setup({ applyAccept: false });
    await picky.upload(fileInput, new File(['MZ\u0000'], 'tool.exe'));
    expect(await screen.findByText(/"tool.exe" is not a supported file type/)).toBeInTheDocument();
  });

  it('can reuse the output as the new input', async () => {
    const { user } = renderApp('/json/formatter');
    await setEditorText(user, await screen.findByRole('textbox', { name: 'Input' }), '[1,2]');
    await waitFor(async () => {
      expect(await output()).toHaveValue('[\n  1,\n  2\n]');
    });
    await user.click(screen.getByRole('button', { name: 'Use output as input' }));
    expect(screen.getByRole('textbox', { name: 'Input' })).toHaveValue('[\n  1,\n  2\n]');
  });
});

describe('saved documents', () => {
  it('saves, reopens and deep-links documents', async () => {
    const { user, router } = renderApp('/json/minifier');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      '{ "doc": 1 }',
    );
    await user.click(screen.getByRole('button', { name: 'Save document' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save as document' });
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Order payload');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved "Order payload"')).toBeInTheDocument();
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    const [saved] = await db.jsonDocuments.toArray();
    expect(saved).toMatchObject({ name: 'Order payload', content: '{ "doc": 1 }' });
    // The document chip appears on the input panel
    expect(screen.getByText('Order payload')).toBeInTheDocument();

    await setEditorText(user, screen.getByRole('textbox', { name: 'Input' }), '');
    await user.click(screen.getByRole('button', { name: 'Open saved document' }));
    const open = await screen.findByRole('dialog', { name: 'Open saved document' });
    await user.click(await within(open).findByText('Order payload'));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    expect(screen.getByRole('textbox', { name: 'Input' })).toHaveValue('{ "doc": 1 }');

    // Deep link used by the dashboard and command palette
    useJsonStudioStore.setState({ input: '', document: null });
    await router.navigate(`/json/formatter?document=${saved!.id}`);
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Input' })).toHaveValue('{ "doc": 1 }');
    });
    expect(router.state.location.search).toBe('');
  });
});

describe('transform tools', () => {
  it('minifies and reports savings', async () => {
    const { user } = renderApp('/json/minifier');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      '{\n  "a": [ 1, 2 ]\n}',
    );
    await waitFor(async () => {
      expect(await output()).toHaveValue('{"a":[1,2]}');
    });
    expect(screen.getByText(/^−\d+ B \(\d+%\)$/)).toBeInTheDocument();
  });

  it('beautifies with inline short arrays and optional key sorting', async () => {
    const { user } = renderApp('/json/beautifier');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      '{"b":[1,2],"a":{"x":1}}',
    );
    await waitFor(async () => {
      expect(await output()).toHaveValue('{\n  "b": [1, 2],\n  "a": { "x": 1 }\n}');
    });
    await user.click(screen.getByRole('switch', { name: 'Sort keys' }));
    await waitFor(async () => {
      expect(await output()).toHaveValue('{\n  "a": { "x": 1 },\n  "b": [1, 2]\n}');
    });
  });

  it('sorts keys recursively', async () => {
    const { user } = renderApp('/json/sort-keys');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      '{"b":1,"a":{"d":1,"c":2}}',
    );
    await waitFor(async () => {
      expect(await output()).toHaveValue('{\n  "a": {\n    "c": 2,\n    "d": 1\n  },\n  "b": 1\n}');
    });
  });

  it('flattens and unflattens', async () => {
    const { user, router } = renderApp('/json/flatten');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      '{"user":{"tags":["a"],"x.y":1}}',
    );
    await waitFor(async () => {
      expect(await output()).toHaveValue('{\n  "user.tags.0": "a",\n  "user.x.y": 1\n}');
    });
    expect(screen.getByText(/contain the delimiter/)).toBeInTheDocument();
    expect(screen.getByText('2 keys')).toBeInTheDocument();

    await router.navigate('/json/unflatten');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      '{"a.0":"x","a.1":"y","b.c":true}',
    );
    await waitFor(async () => {
      expect(await output()).toHaveValue(
        '{\n  "a": [\n    "x",\n    "y"\n  ],\n  "b": {\n    "c": true\n  }\n}',
      );
    });
  });

  it('shows validation errors from the operation (e.g. unflatten conflicts)', async () => {
    const { user } = renderApp('/json/unflatten');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      '{"a":1,"a.b":2}',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Conflicting keys');
  });

  it('generates a schema and hands it to the validator', async () => {
    const { user, router } = renderApp('/json/schema-generator');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      '{"id":1,"email":"a@b.co"}',
    );
    await waitFor(async () => {
      expect((await output()).textContent).toContain('"format": "email"');
    });
    await user.click(screen.getByRole('button', { name: 'Validate with this schema' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/json/schema-validator');
    });
    expect(await screen.findByText('The data is valid against the schema.')).toBeInTheDocument();
  });

  it('converts JSON to CSV with formula-injection protection', async () => {
    const { user } = renderApp('/json/to-csv');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      '[{"id":1,"user":{"name":"A"},"f":"=1+1"}]',
    );
    await waitFor(async () => {
      expect(await output()).toHaveValue('id,user.name,f\n1,A,"\'=1+1"');
    });
    expect(screen.getByText('1 rows × 3 columns')).toBeInTheDocument();
  });

  it('converts CSV to JSON with nesting and reports malformed rows', async () => {
    const { user } = renderApp('/json/from-csv');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      'id,address.city\n1,Paris\n2',
    );
    await user.click(screen.getByRole('switch', { name: 'Nest dotted headers' }));
    await waitFor(async () => {
      expect((await output()).textContent).toContain('"city": "Paris"');
    });
    expect(screen.getByText(/Row 3: Too few fields/)).toBeInTheDocument();
    // The CSV input does not overwrite the shared JSON document.
    expect(useJsonStudioStore.getState().input).toBe('');
  });
});

describe('large inputs and drafts', () => {
  it('switches to manual runs above the auto-run limit', async () => {
    const big = JSON.stringify(
      Array.from({ length: 40_000 }, (_, i) => ({ id: i, name: `item ${i}` })),
    );
    expect(big.length).toBeGreaterThan(1_000_000);
    useJsonStudioStore.setState({ input: big });
    const { user } = renderApp('/json/minifier');
    expect(await screen.findByText('Large input')).toBeInTheDocument();
    // Both the header and the empty state offer Run.
    await user.click(screen.getAllByRole('button', { name: 'Run' })[0]!);
    await waitFor(
      async () => {
        expect((await output()).getAttribute('aria-label')).toBe('Output');
        expect(((await output()) as HTMLTextAreaElement).value.length).toBe(big.length);
      },
      { timeout: 8000 },
    );
  });

  it('saves edits made while the draft is still loading', async () => {
    const pending = hydrateJsonStudioDraft();
    // The user types before the IndexedDB read has completed.
    useJsonStudioStore.getState().setInput('{"early":true}');
    await pending;
    await waitFor(
      async () => {
        expect((await db.settings.get(DRAFT_SETTING_KEY))?.value).toMatchObject({
          input: '{"early":true}',
        });
      },
      { timeout: 3000 },
    );
  });

  it('persists the working input as a draft and restores it after a reload', async () => {
    const { user, unmount } = renderApp('/json/formatter');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      '{"draft":true}',
    );
    await waitFor(
      async () => {
        expect((await db.settings.get(DRAFT_SETTING_KEY))?.value).toMatchObject({
          input: '{"draft":true}',
        });
      },
      { timeout: 3000 },
    );
    unmount();
    // Simulate a reload: memory is cleared, IndexedDB is kept.
    resetJsonStudioState();
    await hydrateJsonStudioDraft();
    expect(useJsonStudioStore.getState().input).toBe('{"draft":true}');
  });
});
