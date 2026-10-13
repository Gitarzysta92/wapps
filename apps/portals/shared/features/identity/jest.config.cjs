const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('../../../../../tsconfig.base.json');
module.exports = {
  displayName: 'identity',
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  transform: {
    '^.+\\.(ts|js|mjs|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.html$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/../../../../../',
  }),
};
