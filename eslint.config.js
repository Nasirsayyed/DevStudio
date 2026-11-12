import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const FEATURES = [
  'dashboard',
  'api-studio',
  'json-studio',
  'code-generators',
  'sql-toolkit',
  'dev-utilities',
  'text-tools',
  'snippets',
  'history',
  'favorites',
  'settings',
  'module-overview',
];

/** Monaco is heavy and needs special setup: only the code-editor components may import it. */
const MONACO_BAN = {
  group: ['monaco-editor', 'monaco-editor/*', '@monaco-editor/react'],
  message: 'Use CodeEditor / DiffEditor from @/components instead of importing Monaco directly.',
};

/** Code-generating validators need 'unsafe-eval', which the CSP forbids (see CLAUDE.md). */
const EVAL_LIBS_BAN = {
  group: ['ajv', 'ajv/*', 'ajv-*', '@hookform/resolvers/ajv', '@hookform/resolvers/ajv/*'],
  message: 'Ajv generates code at runtime (needs unsafe-eval). Use Zod or @cfworker/json-schema.',
};

/** Each feature may not import from any *other* feature (architecture rule 3). */
const featureIsolation = FEATURES.map((feature) => ({
  files: [`src/features/${feature}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: FEATURES.filter((f) => f !== feature).map((f) => `@/features/${f}/**`),
            message:
              'Features must not import from other features. Move shared code to core/, services/ or components/.',
          },
          {
            group: FEATURES.filter((f) => f !== feature).map((f) => `@/features/${f}`),
            message:
              'Features must not import from other features. Move shared code to core/, services/ or components/.',
          },
          MONACO_BAN,
          EVAL_LIBS_BAN,
        ],
      },
    ],
  },
}));

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'node_modules',
      '*.config.js',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Dialogs must move focus inside (WAI-ARIA dialog pattern); MUI components handle this correctly.
      'jsx-a11y/no-autofocus': ['error', { ignoreNonDOM: true }],
      // Security: no dynamic code execution anywhere.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  // core/ is pure TypeScript: no React, no storage, no app layers.
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-dom',
                '@mui/*',
                'dexie',
                '@/services/*',
                '@/features/*',
                '@/components/*',
                '@/app/*',
                '@/stores/*',
              ],
              message: 'core/ must stay framework-free and side-effect free.',
            },
            MONACO_BAN,
            EVAL_LIBS_BAN,
          ],
        },
      ],
    },
  },
  // services/ must not depend on UI layers.
  {
    files: ['src/services/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '@/components/*', '@/app/*', '@mui/*'],
              message: 'services/ must not depend on UI layers.',
            },
            MONACO_BAN,
            EVAL_LIBS_BAN,
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/app/**/*.{ts,tsx}',
      'src/hooks/**/*.{ts,tsx}',
      'src/stores/**/*.{ts,tsx}',
      'src/tools/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
    ],
    ignores: ['src/components/code-editor/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [MONACO_BAN, EVAL_LIBS_BAN] }] },
  },
  ...featureIsolation,
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**', 'e2e/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'react-refresh/only-export-components': 'off',
      // Tests navigate loosely-typed fixtures (e.g. generated schemas).
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['*.config.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
