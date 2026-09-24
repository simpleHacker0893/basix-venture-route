import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // shadcn CLI output is kept untouched (blueprint); it co-exports variant helpers.
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Sprint 006 blueprint §Files pins `VoiceSessionProvider + voiceReducer; useVoice()` to one
    // file. The routing store splits the same shapes across routingContext.ts (useRouting) and
    // RoutingProvider.tsx (the component); the voice blueprint deliberately keeps them together.
    files: ['src/voice/VoiceSession.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
