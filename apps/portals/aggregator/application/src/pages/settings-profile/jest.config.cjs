const path = require('path');
const { pathsToModuleNameMapper } = require('ts-jest');
const rootDir = path.resolve(__dirname, '../../../../../../..');
const { compilerOptions } = require(path.join(rootDir, 'tsconfig.base.json'));
module.exports = {
  rootDir,
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/.nx/'],
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/apps/portals/aggregator/application/src/pages/settings-profile/settings-persistence.spec.ts',
    '<rootDir>/apps/portals/aggregator/application/src/pages/profile-page/*.spec.ts',
    '<rootDir>/apps/portals/aggregator/application/src/pages/results-page/*.spec.ts',
    '<rootDir>/apps/portals/shared/cross-cutting/theming/src/*.spec.ts'
  ],
  setupFilesAfterEnv: [path.join(__dirname, 'test-setup.ts')],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' }),
  transform: { '^.+\\.(ts|mjs|js|html)$': ['jest-preset-angular', {
    tsconfig: path.join(__dirname, 'tsconfig.spec.json'), stringifyContentPathRegex: '\\.(html|svg)$'
  }] },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)']
};
