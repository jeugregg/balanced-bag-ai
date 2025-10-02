export default {
  server: {
    proxy: {
      '/coingecko': {
        target: 'https://api.coingecko.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/coingecko/, ''),
      },
    },
  },
}