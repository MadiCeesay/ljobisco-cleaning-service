import js from '@eslint/js';
import globals from 'globals';
export default [{ ignores: ['node_modules/**', '.cache/**'] }, js.configs.recommended, { files: ['**/*.js'], languageOptions: { globals: globals.node }, rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } }, { files: ['scripts/browser-check.js'], languageOptions: { globals: globals.browser } }];
