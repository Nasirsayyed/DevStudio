import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SAMPLE_ORDER_JSON, SAMPLE_ORDER_JSON_V2, SAMPLE_SCHEMA_JSON } from '@/core/json/samples';
import { renderApp, resetAppState, setEditorText } from '@/test/renderApp';
import { useJsonStudioStore } from '../store';

beforeEach(async () => {
  await resetAppState();
});

describe('JSON Validator', () => {
  it('shows statistics for valid JSON and warns about duplicate keys', async () => {
    const { user } = renderApp('/json/validator');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      '{"a": 1, "list": [1, 2], "a": 2}',
    );
    expect(await screen.findByText('Valid JSON')).toBeInTheDocument();
    expect(screen.getByText('1 duplicate key')).toBeInTheDocument();
    const dupes = screen.getByRole('list', { name: 'Duplicate keys' });
    expect(within(dupes).getByText('"a" in $')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Input problems' })).toHaveTextContent(
      'warning 1:26 Duplicate key "a"',
    );
    await user.click(within(dupes).getByRole('button'));
    expect(screen.getAllByTestId('code-editor')[0]).toHaveAttribute('data-reveal-line', '1');
    expect(screen.getByText('Max depth').nextSibling).toHaveTextContent('2');
  });

  it('explains errors with a context snippet and caret', async () => {
    const { user } = renderApp('/json/validator');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'Input' }),
      '{\n  "name": \'x\'\n}',
    );
    expect(await screen.findByText('Invalid JSON')).toBeInTheDocument();
    expect(
      screen.getAllByText('Strings must use double quotes (") in JSON')[0],
    ).toBeInTheDocument();
    expect(screen.getByText('Line 2, column 11')).toBeInTheDocument();
    expect(screen.getByLabelText('Error context').textContent).toContain(
      '    2 │   "name": \'x\'\n      │           ^',
    );
  });
});

describe('JSON Tree Viewer', () => {
  it('renders an expandable, keyboard-navigable tree', async () => {
    useJsonStudioStore.setState({ input: '{"user":{"name":"Ada","roles":["admin"]},"ok":true}' });
    const { user } = renderApp('/json/tree');
    const tree = await screen.findByRole('tree', { name: 'JSON tree' });
    // Expanded to depth 2 by default
    expect(
      within(tree)
        .getAllByRole('treeitem')
        .map((r) => r.textContent),
    ).toEqual(['Object{2}', '"user":Object{2}', '"name":"Ada"', '"roles":Array[1]', '"ok":true']);
    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(within(tree).getAllByRole('treeitem')).toHaveLength(1);
    // Keyboard: ArrowRight expands, ArrowDown moves, ArrowLeft collapses
    tree.focus();
    await user.keyboard('{ArrowRight}');
    expect(within(tree).getAllByRole('treeitem')).toHaveLength(3);
    await user.keyboard('{ArrowDown}{ArrowRight}');
    expect(within(tree).getAllByRole('treeitem')).toHaveLength(5);
    expect(within(tree).getAllByRole('treeitem')[1]).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(within(tree).getAllByRole('treeitem')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(within(tree).getAllByRole('treeitem')).toHaveLength(6);
  });

  it('highlights matching text', async () => {
    useJsonStudioStore.setState({ input: '{"customer":"Ahmed"}' });
    const { user } = renderApp('/json/tree');
    await screen.findByRole('tree', { name: 'JSON tree' });
    await user.type(screen.getByRole('searchbox', { name: 'Highlight in tree' }), 'hme');
    await waitFor(() => {
      expect(document.querySelector('mark')?.textContent).toBe('hme');
    });
  });
});

describe('JSON Path Finder', () => {
  it('shows JSONPath, JS accessor and JSON Pointer for the selected node', async () => {
    useJsonStudioStore.setState({ input: '{"items":[{"first name":"A"}]}' });
    const { user } = renderApp('/json/path-finder');
    const tree = await screen.findByRole('tree', { name: 'JSON tree' });
    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    await user.click(within(tree).getByText('"A"'));
    expect(screen.getByLabelText('JSONPath')).toHaveTextContent("$.items[0]['first name']");
    expect(screen.getByLabelText('JavaScript')).toHaveTextContent('data.items[0]["first name"]');
    expect(screen.getByLabelText('JSON Pointer')).toHaveTextContent('/items/0/first name');
    expect(screen.getByLabelText('Selected value')).toHaveTextContent('"A"');
    await user.click(screen.getByRole('button', { name: 'Copy JSONPath' }));
    expect(await navigator.clipboard.readText()).toBe("$.items[0]['first name']");
  });
});

describe('JSONPath Tester', () => {
  it('evaluates expressions (including filters) and shows matches', async () => {
    useJsonStudioStore.setState({ input: SAMPLE_ORDER_JSON });
    const { user } = renderApp('/json/jsonpath');
    const grid = await screen.findByRole('grid', { name: 'JSONPath matches' });
    expect(grid).toHaveTextContent('$.items[0].name');
    expect(screen.getByText('2 matches')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '$.items[?(@.unit_price > 1000)]' }));
    await waitFor(() => {
      expect(screen.getByText('1 match')).toBeInTheDocument();
    });
  });

  it('reports invalid expressions next to the field', async () => {
    useJsonStudioStore.setState({ input: '{}' });
    const { user } = renderApp('/json/jsonpath');
    const field = await screen.findByRole('textbox', { name: 'JSONPath expression' });
    await user.clear(field);
    await user.type(field, 'items');
    expect(
      await screen.findByText('JSONPath expressions must start with "$" (the root).'),
    ).toBeInTheDocument();
  });
});

describe('JSON Search', () => {
  it('finds keys and values and reveals results in the tree', async () => {
    useJsonStudioStore.setState({ input: SAMPLE_ORDER_JSON });
    const { user } = renderApp('/json/search');
    await user.type(await screen.findByRole('textbox', { name: 'Search for' }), 'keyboard');
    const grid = await screen.findByRole('grid', { name: 'Search results' });
    await waitFor(() => {
      expect(within(grid).getAllByRole('row')).toHaveLength(2);
    });
    expect(grid).toHaveTextContent('$.items[0].name');
    await user.click(within(grid).getAllByRole('row')[1]!);
    const tree = screen.getByRole('tree', { name: 'Document tree' });
    await waitFor(() => {
      expect(within(tree).getByRole('treeitem', { selected: true })).toHaveTextContent(
        '"name":"Mechanical keyboard"',
      );
    });
  });

  it('reports invalid regular expressions', async () => {
    useJsonStudioStore.setState({ input: '{}' });
    const { user } = renderApp('/json/search');
    await user.click(await screen.findByRole('combobox', { name: 'Match' }));
    await user.click(screen.getByRole('option', { name: 'Regular expression' }));
    await user.type(screen.getByRole('textbox', { name: 'Search for' }), '(');
    expect(await screen.findByText(/Invalid regular expression/)).toBeInTheDocument();
  });
});

describe('JSON Compare', () => {
  it('detects missing properties, value changes and type differences', async () => {
    useJsonStudioStore.setState({ input: SAMPLE_ORDER_JSON, secondary: SAMPLE_ORDER_JSON_V2 });
    renderApp('/json/compare');
    const summary = await screen.findByLabelText('Difference summary');
    expect(summary).toHaveTextContent('Added: 2');
    expect(summary).toHaveTextContent('Missing: 2');
    expect(summary).toHaveTextContent('Changed: 4');
    expect(summary).toHaveTextContent('Type differs: 1');
    const grid = screen.getByRole('grid', { name: 'Structural differences' });
    expect(grid).toHaveTextContent('$.total_amount');
    expect(grid).toHaveTextContent('2500.5 (number)');
    expect(grid).toHaveTextContent('"2500.50" (string)');
    expect(grid).toHaveTextContent('$.shipping_address.postal_code');
  });

  it('reports identical documents and shows a sorted text diff', async () => {
    useJsonStudioStore.setState({ input: '{"a":1,"b":[1,2]}', secondary: '{"b":[1,2],"a":1}' });
    renderApp('/json/compare');
    expect(await screen.findByText(/structurally identical/)).toBeInTheDocument();
  });

  it('points parse errors at the right editor', async () => {
    useJsonStudioStore.setState({ input: '{"a":1}', secondary: '{"a":' });
    renderApp('/json/compare');
    const problems = await screen.findByRole('list', { name: 'Right (changed) problems' });
    expect(problems).toHaveTextContent('Right document: Unexpected end of input');
    expect(
      screen.queryByRole('list', { name: 'Left (original) problems' }),
    ).not.toBeInTheDocument();
  });

  it('can ignore array order', async () => {
    useJsonStudioStore.setState({ input: '{"tags":["a","b"]}', secondary: '{"tags":["b","a"]}' });
    const { user } = renderApp('/json/compare');
    expect(await screen.findByRole('grid', { name: 'Structural differences' })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Arrays' }));
    await user.click(screen.getByRole('option', { name: 'Ignore order' }));
    expect(
      await screen.findByText(/structurally identical \(ignoring array order\)/),
    ).toBeInTheDocument();
  });
});

describe('JSON Schema Validator', () => {
  it('lists validation errors with JSONPath locations', async () => {
    useJsonStudioStore.setState({
      input: '{"order_id": 0, "customer_name": "A", "total_amount": 5, "items": []}',
      secondary: SAMPLE_SCHEMA_JSON,
    });
    renderApp('/json/schema-validator');
    const grid = await screen.findByRole('grid', { name: 'Schema validation errors' });
    expect(grid).toHaveTextContent('$.order_id');
    expect(grid).toHaveTextContent('minimum');
    expect(grid).toHaveTextContent('$.items');
    expect(screen.getByText(/2 validation errors/)).toBeInTheDocument();
    expect(screen.getByText('Draft 2020-12')).toBeInTheDocument();
  });

  it('points schema syntax errors at the schema editor', async () => {
    useJsonStudioStore.setState({ input: '{}', secondary: '{"type": "object",}' });
    renderApp('/json/schema-validator');
    expect(await screen.findByRole('list', { name: 'JSON Schema problems' })).toHaveTextContent(
      'Schema: Trailing comma',
    );
  });
});
