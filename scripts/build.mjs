// Forces a production build even if the host (e.g. Netlify) has NODE_ENV set to
// "development" or another non-standard value, which breaks Next.js prerendering.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

const result = spawnSync(process.execPath, [nextBin, 'build'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});
process.exit(result.status ?? 1);
