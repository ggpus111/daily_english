import js from '@eslint/js'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  { ignores: ['dist', 'dev-dist', 'test-results', 'playwright-report', 'e2e-shots', 'analysis/.venv'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
  {
    files: ['build/**', 'scripts/**', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['e2e/**'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
]
