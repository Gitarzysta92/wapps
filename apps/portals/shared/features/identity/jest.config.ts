export default {
  displayName: 'identity',
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  transform: { '^.+\\.(ts|js|mjs|html)$': ['jest-preset-angular', { tsconfig: '<rootDir>/tsconfig.spec.json', stringifyContentPathRegex: '\\.html$' }] },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  moduleNameMapper: {
    '^@foundation/standard$': '<rootDir>/../../../../../sdk/kernel/standard/src/index.ts',
    '^@domains/identity/authentication$': '<rootDir>/../../../../../sdk/features/identity/libs/authentication/src/index.ts',
  },
};
