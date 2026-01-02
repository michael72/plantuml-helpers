import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  // Apply to TypeScript source files
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.eslint.json'],
      },
      globals: {
        // Node.js globals
        TextEncoder: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // ESLint recommended rules
      ...eslint.configs.recommended.rules,
      
      // TypeScript ESLint recommended rules
      ...tseslint.configs.recommended.rules,
      ...tseslint.configs['recommended-requiring-type-checking'].rules,
      ...tseslint.configs.strict.rules,

      // Custom rules from your original config
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': ['error'],
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': ['error'],
      'no-continue': ['error'],
      'no-mixed-operators': ['error'],
      'no-multi-assign': ['error'],
      'no-negated-condition': ['error'],
      '@typescript-eslint/no-unnecessary-qualifier': ['warn'],
      '@typescript-eslint/strict-boolean-expressions': ['warn'],
      '@typescript-eslint/no-unnecessary-type-arguments': ['warn'],
      '@typescript-eslint/prefer-for-of': ['warn'],
      '@typescript-eslint/prefer-nullish-coalescing': ['warn'],
      '@typescript-eslint/prefer-optional-chain': ['warn'],
      '@typescript-eslint/no-confusing-void-expression': ['error'],
    },
  },
  // Apply to TypeScript test files with different rules
  {
    files: ['test/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.eslint.json'],
      },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        after: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // ESLint recommended rules
      ...eslint.configs.recommended.rules,
      
      // TypeScript ESLint recommended rules (less strict for tests)
      ...tseslint.configs.recommended.rules,
      
      // Disable some strict rules for test files
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      'no-undef': 'off', // TypeScript handles this
    },
  },
  // Ignore patterns (equivalent to .eslintignore)
  {
    ignores: [
      "src/webview/*.ts",
      'out/**',
      'node_modules/**',
      '.vscode-test/**',
      'coverage/**',
      '**/*.js',
      '**/*.d.ts',
      '*.vsix',
      '.c8_output/**',
    ],
  },
];