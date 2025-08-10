import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  // Apply to TypeScript files
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.eslint.json'],
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
  // Ignore patterns (equivalent to .eslintignore)
  {
    ignores: [
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