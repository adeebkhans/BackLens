//@ts-check

'use strict';

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node', // VS Code extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
	mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

  entry: {
    extension: './src/extension.ts',
    'workers/analyzeWorker': './src/workers/analyzeWorker.ts'
  }, // multiple entry points for extension and worker
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded
    // Keep better-sqlite3 external - we use sql.js (WASM) at runtime,
    // but the graph-store package still has it as an optional export
    'better-sqlite3': 'commonjs better-sqlite3',
    // sql.js must be external - it doesn't bundle correctly with webpack
    'sql.js': 'commonjs sql.js'
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js'],
    fallback: {
      // sql.js needs these Node.js modules
      fs: false,
      path: false,
      crypto: false
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      },
      {
        // Handle WASM files from sql.js
        test: /\.wasm$/,
        type: 'asset/resource'
      }
    ]
  },
  plugins: [
    // Copy sql.js WASM binary to dist folder
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm'),
          to: 'sql-wasm.wasm'
        },
        {
          from: path.resolve(__dirname, 'images'),
          to: 'images'
        }
      ]
    })
  ],
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
};
module.exports = [ extensionConfig ];