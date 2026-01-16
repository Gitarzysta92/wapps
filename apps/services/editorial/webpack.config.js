const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../../dist/apps/services/editorial'),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/index.ts',
      tsConfig: './tsconfig.app.json',
      optimization: process.env.NODE_ENV === 'production',
      outputHashing: 'none',
      generatePackageJson: true,
      assets: [
        // Copy entire src/api directory (includes schemas and structure)
        { input: 'apps/services/editorial/src/api', output: 'src/api', glob: '**/*.json' },
        // Copy config directory
        { input: 'apps/services/editorial/config', output: 'config', glob: '**/*' },
        // Copy public directory
        { input: 'apps/services/editorial/public', output: 'public', glob: '**/*' },
        // Copy favicon
        { input: 'apps/services/editorial', output: '.', glob: 'favicon.png' }
      ]
    }),
  ],
};
