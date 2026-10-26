/*
 * Der Linter: liest den Code, ohne ihn auszuführen.
 *
 * Übernommen aus der Workout-App: `js.configs.recommended` und darüber eine
 * Handvoll Regeln für Fehler, die man an der Form erkennt – eine Variable,
 * die nach einem Umbau niemand mehr liest, ein `==`, eine Funktion, die mal
 * etwas zurückgibt und mal nicht. Kein Stilregelwerk.
 */
import js from '@eslint/js';

export default [
  {
    ignores: ['node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['js/**/*.js', 'sw.js', 'tests/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        // Browser und Service Worker – von Hand, damit sichtbar bleibt, was
        // die App wirklich anfasst.
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        caches: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        self: 'readonly',
        clients: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-fallthrough': 'error',
      'consistent-return': 'error',
      eqeqeq: ['error', 'always'],
      'no-cond-assign': ['error', 'always'],
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-var': 'error',
    },
  },
  {
    // Die Tests laufen in Node.
    files: ['tests/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
];
