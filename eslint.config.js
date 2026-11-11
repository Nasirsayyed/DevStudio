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
          ],
        },
      ],
    },
  },
  ...featureIsolation,
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**', 'e2e/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['*.config.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
