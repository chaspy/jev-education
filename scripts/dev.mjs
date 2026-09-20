import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
const path = new URL('../apps/learning-path/.dev.vars', import.meta.url);
if (!process.env.TYPESAFE_API_KEY) throw new Error('.env に TYPESAFE_API_KEY が必要です。');
await writeFile(path, `TYPESAFE_API_KEY=${JSON.stringify(process.env.TYPESAFE_API_KEY)}\n`, { mode: 0o600 });
await mkdir(new URL('../logs/', import.meta.url), { recursive: true });
const child = spawn('npx', ['--no-install', 'wrangler', 'dev', '--config', 'apps/learning-path/wrangler.jsonc', '--port', '4322'], { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 0));
