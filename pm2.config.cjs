module.exports = {
  apps: [
    {
      name: 'timekeeper',
      script: 'dist/index.js',
      interpreter: 'node',
      node_args: '--env-file=.env',
    }
  ],
};
