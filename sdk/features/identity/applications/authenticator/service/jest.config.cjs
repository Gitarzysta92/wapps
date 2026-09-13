const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('../../../../../../tsconfig.base.json');
module.exports = {
  displayName: 'authenticator',
  testEnvironment: 'node',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/../../../../../../' }),
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }] },
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
};
