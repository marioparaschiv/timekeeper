module.exports = {
  apps: [
    {
      name: 'timekeeper',
      script: 'dist/index.js',
      node_args: '--env-file=.env',
    }
  ],
};
