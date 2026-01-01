import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow empty methods for Strapi lifecycle hooks
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  {
    // Ignore generated types and type definitions
    files: ['**/types/**/*.ts', '**/types/**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/prefer-namespace-keyword': 'off',
    },
  },
];

