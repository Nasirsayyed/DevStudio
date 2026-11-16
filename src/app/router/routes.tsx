import type { RouteObject } from 'react-router';
import type { ModuleId } from '@/types/tools';
import { AppLayout } from '../layout/AppLayout';
import {
  DashboardPage,
  FavoritesPage,
  HistoryPage,
  ModuleOverviewPage,
  NotFoundPage,
  SettingsPage,
  SnippetsPage,
  ToolRoutePage,
} from './lazyPages';
import OAuthCallbackPage from './OAuthCallbackPage';
import { RouteErrorPage } from './RouteErrorPage';

/** Multi-tool modules: `/<module>` overview + `/<module>/:toolSlug` tool pages. */
const TOOL_MODULES: { id: ModuleId; path: string }[] = [
  { id: 'api', path: 'api' },
  { id: 'json', path: 'json' },
  { id: 'codegen', path: 'codegen' },
  { id: 'sql', path: 'sql' },
  { id: 'utils', path: 'utils' },
  { id: 'text', path: 'text' },
];

export const routes: RouteObject[] = [
  // OAuth 2.0 redirect target (no app chrome; relays the result to the opener tab).
  { path: '/oauth/callback', element: <OAuthCallbackPage />, errorElement: <RouteErrorPage /> },
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      ...TOOL_MODULES.map(({ id, path }) => ({
        path,
        children: [
          { index: true, element: <ModuleOverviewPage moduleId={id} /> },
          { path: ':toolSlug', element: <ToolRoutePage key={id} moduleId={id} /> },
        ],
      })),
      { path: 'snippets', element: <SnippetsPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'favorites', element: <FavoritesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
