import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProjectEnv } from '../server/env.mjs';
import { imageRequest, imageStatus } from '../server/image.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const production = process.argv.includes('--production');
process.env.NODE_ENV = production ? 'production' : 'development';
const names = ['GUIDE_IMAGE_ENABLED', 'IMAGE_API_BASE', 'IMAGE_MODEL', 'IMAGE_API_KEY', 'DASHSCOPE_API_KEY'];
const inherited = new Set(names.filter(name => Object.hasOwn(process.env, name)));
const { loadedEnvFiles } = loadProjectEnv(root, !production);
const sources = Object.fromEntries(names.map(name => {
  const files = loadedEnvFiles.filter(file => Object.hasOwn(file.env, name)).map(file => file.path);
  return [name, { effective: inherited.has(name) ? '进程环境变量' : files[0] || '未配置', shadowed: inherited.has(name) ? files : files.slice(1) }];
}));
const status = imageStatus();
let endpoint = null;
let protocol = null;
try {
  const request = imageRequest({name:'配置检查'});
  const parsed = new URL(request.url);
  endpoint = parsed.origin + parsed.pathname; // No userinfo, query, or API key in output.
  protocol = request.kind;
} catch {}
console.log(JSON.stringify({
  mode: process.env.NODE_ENV,
  loadedFiles: loadedEnvFiles.map(file => file.path),
  image: status,
  endpoint,
  protocol,
  sources,
  note: '仅检查本地配置，不调用模型、不扣费。不证明密钥权限或账户余额有效。修改配置后请重启本地服务。',
}, null, 2));
