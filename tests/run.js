// Convenience runner kept for existing tooling: runs the Jest suite in band.
// The individual suites are normal Jest tests, so `npx jest` works too.
const { spawnSync } = require('child_process');
const path = require('path');

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['jest', '--runInBand'],
  { cwd: path.join(__dirname, '..'), stdio: 'inherit', shell: process.platform === 'win32' }
);

process.exit(result.status === null ? 1 : result.status);
