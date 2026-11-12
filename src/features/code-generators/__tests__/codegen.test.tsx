import { screen, waitFor, within } from '@testing-library/react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/services/db/database';
import { useJsonWorkspaceStore } from '@/stores/jsonWorkspaceStore';
import { renderApp, resetAppState, setEditorText } from '@/test/renderApp';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

const SPEC_JSON =
  '{\n  "order_id": 1001,\n  "customer_name": "Ahmed",\n  "total_amount": 2500.50\n}';
const output = () => screen.findByRole('textbox', { name: 'Generated code' });

beforeEach(async () => {
  await resetAppState();
  vi.mocked(saveAs).mockClear();
});

describe('JSON → C#', () => {
  it('generates the specification example and reacts to options', async () => {
    const { user } = renderApp('/codegen/csharp');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'JSON input' }),
      SPEC_JSON,
    );
    await waitFor(async () => {
      expect((await output()).textContent).toContain(
        'public string CustomerName { get; set; } = string.Empty;',
      );
    });
    const code = (await output()).textContent;
    expect(code).toContain('[JsonPropertyName("order_id")]\n    public int OrderId { get; set; }');
    expect(code).toContain('public double TotalAmount { get; set; }');
    expect(code).toContain('namespace MyApp.Models;');

    const ns = screen.getByRole('textbox', { name: 'Namespace' });
    await user.clear(ns);
    await user.type(ns, 'Shop.Orders');
    await user.click(screen.getByRole('combobox', { name: 'Decimals' }));
    await user.click(screen.getByRole('option', { name: 'decimal' }));
    // Both edits re-run the generator (debounced); wait for the run that includes both.
    await waitFor(async () => {
      const text = (await output()).textContent;
      expect(text).toContain('namespace Shop.Orders;');
      expect(text).toContain('public decimal TotalAmount { get; set; }');
    });
  });

  it('downloads one file per class as a ZIP and records history', async () => {
    const { user } = renderApp('/codegen/csharp');
    await user.click(await screen.findByRole('button', { name: 'Load sample' }));
    await waitFor(async () => {
      expect((await output()).textContent).toContain('public class ShippingAddress');
    });
    await user.click(screen.getByRole('button', { name: 'Download as ZIP' }));
    await waitFor(() => {
      expect(saveAs).toHaveBeenCalled();
    });
    const [blob, name] = vi.mocked(saveAs).mock.calls[0] as [Blob, string];
    expect(name).toBe('csharp-models.zip');
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual([
      'Experiments.cs',
      'Item.cs',
      'Metadata.cs',
      'Root.cs',
      'ShippingAddress.cs',
    ]);
    expect(await zip.file('Item.cs')!.async('string')).toContain(
      'public List<string> Tags { get; set; } = new();',
    );
    await waitFor(async () => {
      expect((await db.toolHistory.toArray())[0]).toMatchObject({
        toolId: 'codegen.csharp',
        label: 'JSON to C# (zip)',
      });
    });
  });

  it('reports invalid JSON on the input', async () => {
    const { user } = renderApp('/codegen/csharp');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'JSON input' }),
      '{"a": }',
    );
    expect(await screen.findByRole('list', { name: 'JSON input problems' })).toHaveTextContent(
      "Unexpected '}', expected a value",
    );
  });

  it('rejects JSON that is not an object or array of objects', async () => {
    const { user } = renderApp('/codegen/csharp');
    await setEditorText(
      user,
      await screen.findByRole('textbox', { name: 'JSON input' }),
      '[1, 2, 3]',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Code generation needs a JSON object, or an array of objects',
    );
  });
});

describe('other generators', () => {
  it('shares the JSON document across JSON Studio and every generator', async () => {
    useJsonWorkspaceStore.setState({ input: SPEC_JSON });
    const { router } = renderApp('/codegen/typescript');
    await waitFor(async () => {
      expect((await output()).textContent).toContain(
        'export interface Root {\n  order_id: number;\n  customer_name: string;\n  total_amount: number;\n}',
      );
    });
    await router.navigate('/codegen/java');
    await waitFor(async () => {
      expect((await output()).textContent).toContain('private int orderId;');
    });
    await router.navigate('/codegen/python');
    await waitFor(async () => {
      expect((await output()).textContent).toContain('@dataclass\nclass Root:\n    order_id: int');
    });
    await router.navigate('/json/formatter');
    expect(await screen.findByRole('textbox', { name: 'Input' })).toHaveValue(SPEC_JSON);
  });

  it('switches Python style and Java style', async () => {
    useJsonWorkspaceStore.setState({ input: '{"orderId": 1}' });
    const { user, router } = renderApp('/codegen/python');
    await screen.findByRole('textbox', { name: 'Generated code' });
    await user.click(screen.getByRole('combobox', { name: 'Style' }));
    await user.click(screen.getByRole('option', { name: 'Pydantic v2' }));
    await waitFor(async () => {
      expect((await output()).textContent).toContain('order_id: int = Field(alias="orderId")');
    });
    await router.navigate('/codegen/java');
    // Wait for the Java page (and its own options) before interacting.
    await waitFor(async () => {
      expect((await output()).textContent).toContain('private int orderId;');
    });
    await user.click(screen.getByRole('combobox', { name: 'Style' }));
    await user.click(screen.getByRole('option', { name: 'Record (Java 16+)' }));
    await waitFor(async () => {
      expect((await output()).textContent).toContain('public record Root(');
    });
  });

  it('generates SQL per dialect', async () => {
    useJsonWorkspaceStore.setState({ input: '[{"id": 1, "name": "A", "active": true}]' });
    const { user } = renderApp('/codegen/sql-table');
    await waitFor(async () => {
      expect((await output()).textContent).toContain(
        'CREATE TABLE orders (\n  id INTEGER PRIMARY KEY,',
      );
    });
    await user.click(screen.getByRole('combobox', { name: 'Dialect' }));
    await user.click(screen.getByRole('option', { name: 'SQL Server' }));
    await user.click(screen.getByRole('switch', { name: 'INSERT sample rows' }));
    await waitFor(async () => {
      expect((await output()).textContent).toContain(
        "INSERT INTO orders (id, name, active) VALUES\n  (1, N'A', 1);",
      );
    });
    expect((await output()).textContent).toContain('active BIT NOT NULL');
  });

  it('converts JSON to XML and explains renamed keys', async () => {
    useJsonWorkspaceStore.setState({ input: '{"first name": "Ada", "age": 36}' });
    renderApp('/codegen/json-to-xml');
    await waitFor(async () => {
      expect((await output()).textContent).toContain(
        '<root>\n  <first_name>Ada</first_name>\n  <age>36</age>\n</root>',
      );
    });
    expect(
      screen.getByText(/Renamed invalid XML names: "first name" → <first_name>/),
    ).toBeInTheDocument();
  });

  it('converts XML to JSON, marks XML errors and loads the result into JSON Studio', async () => {
    const { user } = renderApp('/codegen/xml-to-json');
    const xmlInput = await screen.findByRole('textbox', { name: 'XML input' });
    await setEditorText(user, xmlInput, '<a>\n<b>1</a>');
    expect(await screen.findByRole('list', { name: 'XML input problems' })).toHaveTextContent(
      "error 2:5 Expected closing tag 'b'",
    );
    await setEditorText(user, xmlInput, '<user id="7"><name>Ada</name></user>');
    await waitFor(async () => {
      expect(await output()).toHaveValue(
        '{\n  "user": {\n    "name": "Ada",\n    "@id": 7\n  }\n}',
      );
    });
    expect(screen.getByText('✓ Valid XML')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use as JSON document' }));
    expect(useJsonWorkspaceStore.getState().input).toContain('"@id": 7');
    // The XML input is kept separately from the JSON document.
    expect(useJsonWorkspaceStore.getState().xml).toContain('<user id="7">');
  });

  it('redirects the JSON → CSV alias to JSON Studio', async () => {
    const { router } = renderApp('/codegen/json-to-csv');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/json/to-csv');
    });
    expect(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByText('JSON to CSV'),
    ).toBeInTheDocument();
  });
});
