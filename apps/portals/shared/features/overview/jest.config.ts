/* eslint-disable */
export default {
  displayName: 'apps-portals-shared-features-overview',
  preset: '../../../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
  },
  moduleFileExtensions: ['ts', 'js', 'html'], 
  coverageDirectory: '../../../../../coverage/apps/portals/shared/features/overview'
};
