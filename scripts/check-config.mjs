import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { imageDiagnostics } from '../server/runtime-info.mjs';
import { fileURLToPath } from 'node:url';
import { loadProjectEnv } from '../server/env.mjs';
import { imageRequest, imageStatus } from '../server/image.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const production = process.argv.includes('--production');
process.env.NODE_ENV = production ? 'production' : 'development';
const names = ['GUIDE_IMAGE_ENABLED', 'IMAGE_API_BASE', 'IMAGE_MODEL', 'IMAGE_API_KEY', 'DASHSCOPE_API_KEY', 'GUIDE_DATABASE_URL', 'GUIDE_DATABASE_AUTH_TOKEN'];
const inherited = new Set(names.filter(name => Object.hasOwn(process.env, name)));
const { loadedEnvFiles } = loadProjectEnv(root, !production);
const sources = Object.fromEntries(names.map(name => {
  const files = loadedEnvFiles.filter(file => Object.hasOwn(file.env, name)).map(file => file.path);
  return [name, { effective: inherited.has(name) ? '进程环境变量' : files[0] || '未配置', shadowed: inherited.has(name) ? files : files.slice(1) }];
}));
const diagnostics = imageDiagnostics(process.env, imageStatus, imageRequest);
const gitValue = args => { try { return execFileSync('git', args, {cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:2000}).trim(); } catch { return null; } };
console.log(JSON.stringify({
  mode: process.env.NODE_ENV,
  loadedFiles: loadedEnvFiles.map(file => file.path),
  projectDirectory: root,
  branch: gitValue(['branch', '--show-current']),
  commit: gitValue(['rev-parse', '--short', 'HEAD']),
  ...diagnostics,
  sources,
  note: '仅检查本地配置，不调用模型、不扣费。不证明密钥权限或账户余额有效。修改配置后请重启本地服务。',
}, null, 2));
