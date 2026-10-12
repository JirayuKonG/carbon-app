const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageDir = (name) => path.dirname(require.resolve(`${name}/package.json`, { paths: [root] }));
const commands = [
  ['backend', path.join(packageDir('@nestjs/cli'), 'bin', 'nest.js'), ['start', '--watch']],
  ['frontend', path.join(packageDir('vite'), 'bin', 'vite.js'), []],
];
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
  process.exitCode = code;
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
for (const [workspace, entry, args] of commands) {
  const child = spawn(process.execPath, [entry, ...args], {
    cwd: path.join(root, workspace),
    env: process.env,
    windowsHide: true,
    stdio: 'inherit',
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(`${workspace} could not start: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`${workspace} stopped (${signal || code}); stopping both servers.`);
      stop(code || 1);
    }
  });
}
