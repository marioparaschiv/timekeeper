import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.ts', 'src/deploy.ts', 'src/migrate.ts'],
	format: 'esm',
	platform: 'node',
	target: 'node22',
	clean: true,
});
