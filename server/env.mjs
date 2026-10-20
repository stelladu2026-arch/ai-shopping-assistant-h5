import nextEnv from '@next/env';

// Match Next.js priority: process env > .env.<mode>.local > .env.local > .env.<mode> > .env.
export function loadProjectEnv(root, dev = process.env.NODE_ENV !== 'production') {
  return nextEnv.loadEnvConfig(root, dev, {
    info() {},
    error() { console.error('配置文件读取失败，请检查文件格式和读取权限。'); },
  });
}
