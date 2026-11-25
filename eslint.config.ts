// One lint setup for both apps and the tooling scripts. Type-aware rules catch
// floating promises, unsafe `any` and misused async code; Prettier owns formatting.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      'frontend/playwright-report/**',
      'frontend/test-results/**',
      '.*/**', // local tool folders such as editor or CLI caches
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./backend/tsconfig.spec.json', './frontend/tsconfig.json', './tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  { files: ['frontend/**/*.{ts,tsx}'], ...reactHooks.configs.flat.recommended },
  {
    files: ['backend/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // Nest injects by class reference, so decorated constructor params must stay value imports.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    // Tooling runs in Node; Playwright scripts also pass callbacks into the page.
    files: ['scripts/**/*.ts', '*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  prettier,
);
