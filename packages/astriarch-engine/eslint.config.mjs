import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Base configuration for all files
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
      ecmaVersion: 'latest',
      globals: {
        // Adding globals for Node environment
        'process': 'readonly',
        'console': 'readonly',
        'module': 'readonly',
        'require': 'readonly',
        '__dirname': 'readonly',
        '__filename': 'readonly',
        // Test globals are imported explicitly from vitest
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    extends: [
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
    ],
    ignores: ['.eslintrc.js'],
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      'no-console': "off",
      // Temporarily disable rules that are causing many errors, to be fixed gradually
      '@typescript-eslint/no-unused-vars': 'warn',
      'prefer-const': 'warn',
    },
  },
  // Configuration for test files
  {
    files: ['**/*.spec.ts', '**/test/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-function': 'off'
    }
  }
);
