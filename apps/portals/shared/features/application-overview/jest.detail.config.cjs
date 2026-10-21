const root = require('path').resolve(__dirname, '../../../../..');
const { pathsToModuleNameMapper } = require(root + '/node_modules/ts-jest');
const ts = require(root + '/node_modules/typescript');
const paths = ts.readConfigFile(root + '/tsconfig.base.json', ts.sys.readFile).config.compilerOptions.paths;
module.exports = {
 rootDir: __dirname,
 displayName: 'application-detail',
 preset: root + '/node_modules/jest-preset-angular',
 testEnvironment: 'jsdom',
 setupFilesAfterEnv: [__dirname + '/test-setup.cjs'],
 transform: {'^.+\\.(ts|js|mjs|html)$': [root + '/node_modules/jest-preset-angular', { tsconfig: root + '/apps/portals/shared/features/application-overview/tsconfig.spec.json', stringifyContentPathRegex: '\\.html$' }]},
 transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
 moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: root + '/' }),
 testMatch: ['<rootDir>/src/**/*.spec.ts']
};
