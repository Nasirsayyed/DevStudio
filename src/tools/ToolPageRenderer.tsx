import { type LazyExoticComponent, createElement, lazy } from 'react';
import type { ToolPageComponent } from '@/types/tools';
import { getToolPageLoader } from './toolPages';

// One lazy component per tool, created once at module level (never during render).
const cache = new Map<string, LazyExoticComponent<ToolPageComponent>>();

function getLazyToolPage(toolId: string): LazyExoticComponent<ToolPageComponent> | null {
  const cached = cache.get(toolId);
  if (cached) return cached;
  const loader = getToolPageLoader(toolId);
  if (!loader) return null;
  const component = lazy(loader);
  cache.set(toolId, component);
  return component;
}

/** Renders an implemented tool page (must be wrapped in <Suspense>). */
export function ToolPageRenderer({ toolId }: { toolId: string }) {
  const page = getLazyToolPage(toolId);
  return page ? createElement(page) : null;
}
