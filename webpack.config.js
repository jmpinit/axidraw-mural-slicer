module.exports = [
  {
    name: 'client-side',
    entry: ['babel-polyfill', './src/main.js'],
    devtool: 'source-map',
    output: {
      path: __dirname,
      filename: 'public/js/app.js',
    },
    module: {
      loaders: [
        {
          test: /\.js$/,
          exclude: /(node_modules)/,
          loader: 'babel-loader',
          query: {
            plugins: ['transform-es2015-parameters'],
            presets: ['es2015'],
          },
        },
      ],
    },
  },
];
