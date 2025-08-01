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
        // Adding globals for Node and Jest environments
        'process': 'readonly',
        'console': 'readonly',
        'module': 'readonly',
        'require': 'readonly',
        '__dirname': 'readonly',
        '__filename': 'readonly',
        // Jest globals
        'describe': 'readonly',
        'it': 'readonly',
        'test': 'readonly',
        'expect': 'readonly',
        'beforeAll': 'readonly',
        'beforeEach': 'readonly',
        'afterAll': 'readonly',
        'afterEach': 'readonly',
        'jest': 'readonly',
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
