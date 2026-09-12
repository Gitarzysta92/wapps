/* eslint-disable */
export default {
  displayName: 'portals-shared-features-search',
  preset: '../../../../../jest.preset.js',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@portals/shared/features/listing$': '<rootDir>/../listing/src/application/catalog-listing.ts',
  },
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../../../coverage/apps/portals/shared/features/search'
};
