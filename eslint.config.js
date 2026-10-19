import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'tmp/**', 'output/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{js,mjs,ts,tsx}'], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: ['src/**/ui/**/*.{ts,tsx}'], rules: {
    'no-restricted-imports': ['error', { patterns: [
      { group: ['**/data/*', '**/data/**', '**/lib/supabase/*', '@supabase/supabase-js'], message: 'UI uses feature application hooks; database calls belong in data adapters.' },
    ] }],
  } },
)
