import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AppProviders } from '@/app/providers/AppProviders';
import { resetJsonWorkspaceState } from '@/stores/jsonWorkspaceStore';
import { resetSqlWorkspaceState } from '@/stores/sqlWorkspaceStore';
import { resetTextWorkspaceState } from '@/stores/textWorkspaceStore';
import { routes } from '@/app/router/routes';
import { db } from '@/services/db/database';
import { DEFAULT_PREFERENCES } from '@/services/preferences/preferences';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useUiStore } from '@/stores/uiStore';
import { clearDatabase } from './db';

/** Resets all app-wide state: IndexedDB singleton, preferences and UI stores. */
export async function resetAppState(): Promise<void> {
  resetJsonWorkspaceState();
  resetTextWorkspaceState();
  resetSqlWorkspaceState();
  await clearDatabase(db);
  usePreferencesStore.setState(DEFAULT_PREFERENCES);
  useUiStore.setState({
    commandPaletteOpen: false,
    commandPaletteInitialQuery: '',
    shortcutsDialogOpen: false,
    mobileNavOpen: false,
  });
  window.localStorage.clear();
}

/** Replaces the content of an editor double (textarea) like a paste would. */
export async function setEditorText(
  user: ReturnType<typeof userEvent.setup>,
  editor: HTMLElement,
  text: string,
): Promise<void> {
  await user.clear(editor);
  if (text) {
    await user.click(editor);
    await user.paste(text);
  }
}

/** Renders the full application (real routes, layout and providers) at a path. */
export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  const utils = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, user, router };
}
