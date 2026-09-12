const root = require('path').resolve(__dirname, '../../../../..');
const { pathsToModuleNameMapper } = require(root + '/node_modules/ts-jest');
const ts = require(root + '/node_modules/typescript');
const paths = ts.readConfigFile(root + '/tsconfig.base.json', ts.sys.readFile).config.compilerOptions.paths;
module.exports = {
 rootDir: root,
 displayName: 'application-detail',
 modulePathIgnorePatterns: ['<rootDir>/dist/'],
 preset: root + '/node_modules/jest-preset-angular',
 testEnvironment: 'jsdom',
 setupFilesAfterEnv: [__dirname + '/test-setup.cjs'],
 transform: {'^.+\\.(ts|js|mjs|html)$': [root + '/node_modules/jest-preset-angular', { tsconfig: root + '/apps/portals/shared/features/application-overview/tsconfig.spec.json', stringifyContentPathRegex: '\\.html$' }]},
 transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
 moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: root + '/' }),
 testMatch: ['**/application-overview/src/infrastructure/local-data.spec.ts', '**/application-timeline-page/application-timeline-feed-provider.service.spec.ts', '**/application-reviews-page/application-reviews-page.component.spec.ts', '**/application-discussion-page/application-discussion-page.component.spec.ts']
};
