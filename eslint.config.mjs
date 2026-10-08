import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import a11y from 'eslint-plugin-jsx-a11y';
import hooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/generated/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'jsx-a11y': a11y, 'react-hooks': hooks },
    rules: {
      ...a11y.configs.strict.rules,
      ...hooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { globals: { module: 'readonly', require: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
);
