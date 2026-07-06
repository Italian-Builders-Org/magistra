import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

// Configurazione flat condivisa da tutto il monorepo.
// La knowledge base e gli script di build (.mjs) restano fuori: hanno le loro
// regole in AGENTS.md e non fanno parte dell'applicativo TypeScript.
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/out/**',
      '**/dist/**',
      '**/release/**',
      'scripts/**',
      'knowledge/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module'
    },
    rules: {
      // TypeScript gestisce già la risoluzione dei simboli.
      'no-undef': 'off',
      // I file di dichiarazione usano legittimamente le triple-slash reference.
      '@typescript-eslint/triple-slash-reference': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
)
