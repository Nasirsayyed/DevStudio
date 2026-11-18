import { useLocation } from 'react-router';
import { findModuleByPath } from '@/tools/modules';
import { getToolBySlug } from '@/tools/toolRegistry';

export interface Crumb {
  label: string;
  to?: string;
}

/** Derives breadcrumbs from the URL and the tool registry: Dashboard › Module › Tool. */
export function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation();
  const mod = findModuleByPath(pathname);
  if (!mod || mod.id === 'dashboard') return [{ label: 'Dashboard' }];
  const crumbs: Crumb[] = [{ label: 'Dashboard', to: '/' }];
  const slug = pathname.split('/').filter(Boolean)[1];
  const tool = slug && mod.hasTools ? getToolBySlug(mod.id, slug) : undefined;
  if (tool) {
    crumbs.push({ label: mod.title, to: mod.path }, { label: tool.title });
  } else {
    crumbs.push({ label: mod.title });
  }
  return crumbs;
}
