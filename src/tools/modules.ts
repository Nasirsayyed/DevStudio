import {
  Clock,
  Code1,
  Cpu,
  Data,
  DocumentCode,
  Element3,
  Global,
  Magicpen,
  Setting2,
  Star1,
  TextBlock,
} from 'iconsax-reactjs';
import type { ModuleDefinition, ModuleId } from '@/types/tools';

/** Ordered as displayed in the sidebar. */
export const MODULES: readonly ModuleDefinition[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    shortTitle: 'Dashboard',
    description: 'Overview of your tools, saved work and activity.',
    path: '/',
    icon: Element3,
    phase: 3,
    hasTools: false,
    section: 'main',
  },
  {
    id: 'api',
    title: 'API Testing',
    shortTitle: 'API',
    description: 'Build, send and test HTTP requests with collections and environments.',
    path: '/api',
    icon: Global,
    phase: 10,
    hasTools: true,
    section: 'main',
  },
  {
    id: 'json',
    title: 'JSON Studio',
    shortTitle: 'JSON',
    description: 'Format, validate, compare, query and transform JSON documents.',
    path: '/json',
    icon: Code1,
    phase: 4,
    hasTools: true,
    section: 'main',
  },
  {
    id: 'codegen',
    title: 'Code Generators',
    shortTitle: 'Codegen',
    description: 'Generate C#, TypeScript, Java, Python, SQL and XML from JSON.',
    path: '/codegen',
    icon: Magicpen,
    phase: 5,
    hasTools: true,
    section: 'main',
  },
  {
    id: 'sql',
    title: 'SQL Tools',
    shortTitle: 'SQL',
    description: 'Format, validate and generate SQL, design schemas and run SQLite locally.',
    path: '/sql',
    icon: Data,
    phase: 9,
    hasTools: true,
    section: 'main',
  },
  {
    id: 'utils',
    title: 'Developer Utilities',
    shortTitle: 'Utilities',
    description: 'Encoders, JWT, generators, date/time, colors, cron and more.',
    path: '/utils',
    icon: Cpu,
    phase: 6,
    hasTools: true,
    section: 'main',
  },
  {
    id: 'text',
    title: 'Text Tools',
    shortTitle: 'Text',
    description: 'Diff, compare, transform, count and preview text and code.',
    path: '/text',
    icon: TextBlock,
    phase: 7,
    hasTools: true,
    section: 'main',
  },
  {
    id: 'snippets',
    title: 'Snippet Manager',
    shortTitle: 'Snippets',
    description: 'Save, tag, search and reuse code snippets.',
    path: '/snippets',
    icon: DocumentCode,
    phase: 8,
    hasTools: false,
    section: 'workspace',
  },
  {
    id: 'history',
    title: 'History',
    shortTitle: 'History',
    description: 'Search and restore previous work across all tools.',
    path: '/history',
    icon: Clock,
    phase: 11,
    hasTools: false,
    section: 'workspace',
  },
  {
    id: 'favorites',
    title: 'Favorites',
    shortTitle: 'Favorites',
    description: 'Your favorite tools in one place.',
    path: '/favorites',
    icon: Star1,
    phase: 3,
    hasTools: false,
    section: 'workspace',
  },
  {
    id: 'settings',
    title: 'Settings',
    shortTitle: 'Settings',
    description: 'Appearance, editor, layout and storage preferences.',
    path: '/settings',
    icon: Setting2,
    phase: 3,
    hasTools: false,
    section: 'system',
  },
];

const MODULE_MAP = new Map<ModuleId, ModuleDefinition>(MODULES.map((m) => [m.id, m]));

export function getModule(id: ModuleId): ModuleDefinition {
  const mod = MODULE_MAP.get(id);
  if (!mod) throw new Error(`Unknown module: ${id}`);
  return mod;
}

export function findModuleByPath(pathname: string): ModuleDefinition | undefined {
  if (pathname === '/' || pathname === '') return MODULE_MAP.get('dashboard');
  const first = `/${pathname.split('/').filter(Boolean)[0] ?? ''}`;
  return MODULES.find((m) => m.path === first);
}
