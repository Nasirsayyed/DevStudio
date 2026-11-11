import type { RouteObject } from 'react-router';
import type { ModuleId } from '@/types/tools';
import { AppLayout } from '../layout/AppLayout';
import {
  DashboardPage,
  FavoritesPage,
  ModuleOverviewPage,
  NotFoundPage,
  ScheduledModulePage,
  SettingsPage,
  ToolRoutePage,
} from './lazyPages';
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
      { path: 'snippets', element: <ScheduledModulePage moduleId="snippets" /> },
      { path: 'history', element: <ScheduledModulePage moduleId="history" /> },
      { path: 'favorites', element: <FavoritesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
