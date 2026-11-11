import { ThemeProvider } from '@mui/material';
import { act, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createAppTheme } from '@/theme/createAppTheme';
import { ConfirmationProvider } from './feedback/ConfirmationDialog';
import { useConfirm } from './feedback/confirmationContext';
import { EmptyState } from './feedback/EmptyState';
import { ErrorBoundary } from './feedback/ErrorBoundary';
import { NotificationProvider } from './feedback/NotificationProvider';
import { useNotify } from './feedback/notificationContext';
import { CopyButton } from './inputs/CopyButton';
import { SearchInput } from './inputs/SearchInput';

const theme = createAppTheme('light');
const wrap = (ui: React.ReactNode) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('ErrorBoundary', () => {
  function Bomb({ explode }: { explode: boolean }) {
    if (explode) throw new Error('Kaboom');
    return <p>Safe</p>;
  }

  it('shows a recoverable error panel and resets on resetKey change', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender } = wrap(
      <ErrorBoundary resetKey="a">
        <Bomb explode />
      </ErrorBoundary>,
    );
    expect(screen.getByText('This view crashed')).toBeInTheDocument();
    expect(screen.getByText('Kaboom')).toBeInTheDocument();
    rerender(
      <ThemeProvider theme={theme}>
        <ErrorBoundary resetKey="b">
          <Bomb explode={false} />
        </ErrorBoundary>
      </ThemeProvider>,
    );
    expect(screen.getByText('Safe')).toBeInTheDocument();
  });
});

describe('ConfirmationProvider', () => {
  function Harness({ onResult }: { onResult: (v: boolean) => void }) {
    const confirm = useConfirm();
    return (
      <button
        type="button"
        onClick={() =>
          void confirm({ title: 'Delete item?', destructive: true, confirmLabel: 'Delete' }).then(
            onResult,
          )
        }
      >
        ask
      </button>
    );
  }

  it('resolves true on confirm and false on cancel', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    wrap(
      <ConfirmationProvider>
        <Harness onResult={onResult} />
      </ConfirmationProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'ask' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete item?' });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(onResult).toHaveBeenLastCalledWith(true);
    });
    // Content stays intact while the dialog animates out.
    expect(dialog).toHaveTextContent('Delete item?');
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    await user.click(screen.getByRole('button', { name: 'ask' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(onResult).toHaveBeenLastCalledWith(false);
    });
  });
});

describe('NotificationProvider', () => {
  function Harness() {
    const notify = useNotify();
    return (
      <>
        <button
          type="button"
          onClick={() => {
            notify.success('Saved!');
          }}
        >
          ok
        </button>
        <button
          type="button"
          onClick={() => {
            notify.error('Failed!');
          }}
        >
          fail
        </button>
      </>
    );
  }

  it('shows queued notifications one at a time', async () => {
    const user = userEvent.setup();
    wrap(
      <NotificationProvider>
        <Harness />
      </NotificationProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'ok' }));
    await user.click(screen.getByRole('button', { name: 'fail' }));
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
    expect(screen.queryByText('Failed!')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(await screen.findByText('Failed!')).toBeInTheDocument();
  });

  it('does not re-open a closing toast when a new one arrives', async () => {
    const user = userEvent.setup();
    wrap(
      <NotificationProvider>
        <Harness />
      </NotificationProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'ok' }));
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close/i }));
    // Arrives during the exit transition of "Saved!"
    await user.click(screen.getByRole('button', { name: 'fail' }));
    expect(await screen.findByText('Failed!', {}, { timeout: 1500 })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
    });
  });

  it('throws a helpful error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => wrap(<Harness />)).toThrow(/NotificationProvider/);
  });
});

describe('SearchInput', () => {
  function Controlled({
    onChange,
    debounceMs,
  }: {
    onChange: (v: string) => void;
    debounceMs: number;
  }) {
    const [value, setValue] = useState('');
    return (
      <SearchInput
        value={value}
        debounceMs={debounceMs}
        label="Find"
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    );
  }

  it('debounces changes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const onChange = vi.fn();
    wrap(<Controlled onChange={onChange} debounceMs={200} />);
    await user.type(screen.getByRole('searchbox', { name: 'Find' }), 'abc');
    expect(onChange).not.toHaveBeenCalledWith('abc');
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onChange).toHaveBeenLastCalledWith('abc');
    vi.useRealTimers();
  });

  it('never reverts newer input with a stale debounced value (debounceMs = 0)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    wrap(<Controlled onChange={onChange} debounceMs={0} />);
    const input = screen.getByRole('searchbox', { name: 'Find' });
    await user.type(input, 'c#');
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(input).toHaveValue('c#');
    expect(onChange).toHaveBeenLastCalledWith('c#');
  });

  it('clears with Escape and the clear button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    wrap(<Controlled onChange={onChange} debounceMs={0} />);
    const input = screen.getByRole('searchbox', { name: 'Find' });
    await user.type(input, 'xy');
    expect(input).toHaveValue('xy');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    await user.type(input, 'z');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(input).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});

describe('CopyButton', () => {
  it('copies text and reports success', async () => {
    const user = userEvent.setup();
    const onCopied = vi.fn();
    wrap(<CopyButton value={() => 'payload'} onCopied={onCopied} />);
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toBe('payload');
    expect(onCopied).toHaveBeenCalled();
  });

  it('reports clipboard failures', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    wrap(<CopyButton value="x" onError={onError} />);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });
});

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    wrap(
      <EmptyState
        title="Nothing here"
        description="Add something"
        action={<button type="button">Add</button>}
      />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Add something')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});

describe('DataGrid', () => {
  it('renders rows and sorts by column with aria-sort', async () => {
    const { DataGrid } = await import('./data-display/DataGrid');
    const user = userEvent.setup();
    const rows = [
      { name: 'b', size: 10 },
      { name: 'a', size: 2 },
      { name: 'c', size: 30 },
    ];
    wrap(
      <DataGrid
        ariaLabel="Files"
        rows={rows}
        rowKey={(r) => r.name}
        columns={[
          { id: 'name', header: 'Name', getValue: (r) => r.name },
          { id: 'size', header: 'Size', getValue: (r) => r.size },
        ]}
      />,
    );
    const cells = () =>
      screen
        .getAllByRole('gridcell')
        .filter((_, i) => i % 2 === 0)
        .map((c) => c.textContent);
    expect(cells()).toEqual(['b', 'a', 'c']);
    await user.click(screen.getByRole('button', { name: 'Size' }));
    expect(cells()).toEqual(['a', 'b', 'c']);
    expect(screen.getAllByRole('columnheader')[1]).toHaveAttribute('aria-sort', 'ascending');
    await user.click(screen.getByRole('button', { name: 'Size' }));
    expect(cells()).toEqual(['c', 'b', 'a']);
    await user.click(screen.getByRole('button', { name: 'Size' }));
    expect(cells()).toEqual(['b', 'a', 'c']);
  });
});

describe('SplitPane', () => {
  it('resizes with the keyboard and remembers the ratio', async () => {
    const { SplitPane } = await import('./layout/SplitPane');
    const user = userEvent.setup();
    const { unmount } = wrap(
      <SplitPane storageKey="test" first={<p>left</p>} second={<p>right</p>} />,
    );
    const handle = screen.getByRole('separator', { name: 'Resize panes' });
    expect(handle).toHaveAttribute('aria-valuenow', '50');
    handle.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(handle).toHaveAttribute('aria-valuenow', '54');
    unmount();
    wrap(<SplitPane storageKey="test" first={<p>left</p>} second={<p>right</p>} />);
    expect(screen.getByRole('separator', { name: 'Resize panes' })).toHaveAttribute(
      'aria-valuenow',
      '54',
    );
  });
});
