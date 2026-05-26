module.exports = {
  apps: [
    {
      name: 'timekeeper',
      script: 'bun',
      args: 'run src/index.ts',
      env: {
        PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`,
      },
    }
  ],
};
