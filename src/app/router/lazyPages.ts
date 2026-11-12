import { lazy } from 'react';

// Every page is a separate chunk.
export const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
export const ModuleOverviewPage = lazy(
  () => import('@/features/module-overview/pages/ModuleOverviewPage'),
);
export const ToolRoutePage = lazy(() => import('@/features/module-overview/pages/ToolRoutePage'));
export const ScheduledModulePage = lazy(
  () => import('@/features/module-overview/pages/ScheduledModulePage'),
);
export const NotFoundPage = lazy(() => import('@/features/module-overview/pages/NotFoundPage'));
export const SnippetsPage = lazy(() => import('@/features/snippets/pages/SnippetsPage'));
export const FavoritesPage = lazy(() => import('@/features/favorites/pages/FavoritesPage'));
export const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage'));
