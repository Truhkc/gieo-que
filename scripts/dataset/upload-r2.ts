/**
 * scripts/dataset/upload-r2 —— 把 pack-interp-v4 的产物传到 Cloudflare R2 私有桶
 *
 *   R2_ACCOUNT_ID=… R2_BUCKET=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \
 *     npx tsx scripts/dataset/upload-r2.ts --dir D:/ziwei-interp [--jobs 16] [--years 1990-1990]
 *
 * 这里要用**可写**的 R2 API 令牌（Object Read & Write，只授权这一个桶）；
 * 线上 Vercel 的环境变量另配一个**只读**令牌。密钥只从环境变量读，不要写进命令历史以外的任何文件。
 *
 * 断点续传：已传成功的键记在 DIR/v4/_uploaded.txt，重跑时跳过。
 * 约 28,124 个对象，按 R2 计费属 Class A 操作（免费额度每月 100 万次）。
 */
import { createHash } from 'node:crypto';
import { appendFile, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { INTERP_DATASET } from '../../lib/ziwei/interp-dataset';
import { r2ObjectUrl, signS3Request } from '../../lib/storage/r2-sigv4';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const dir = arg('--dir');
  if (!dir) throw new Error('缺少 --dir（pack-interp-v4 的 --out）');
  const jobs = Math.max(1, Number(arg('--jobs') ?? 16));
  const [from, to] = (arg('--years') ?? `${INTERP_DATASET.firstYear}-${INTERP_DATASET.lastYear}`).split('-').map(Number);

  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('需要环境变量 R2_ACCOUNT_ID / R2_BUCKET / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY');
  }
  const creds = { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY };

  const root = join(dir, INTERP_DATASET.prefix);
  const logFile = join(root, '_uploaded.txt');
  const uploaded = new Set(existsSync(logFile) ? (await readFile(logFile, 'utf8')).split('\n').filter(Boolean) : []);

  const keys: string[] = [];
  for (let y = from; y <= to; y++) {
    const yearDir = join(root, String(y));
    if (!existsSync(join(yearDir, '_done.json'))) {
      console.warn(`${y} 还没打包完（缺 _done.json），跳过`);
      continue;
    }
    for (const f of (await readdir(yearDir)).filter(f => f.endsWith('.json.br')).sort()) {
      keys.push(`${INTERP_DATASET.prefix}/${y}/${f}`);
    }
  }
  if (existsSync(join(root, 'index.json'))) keys.push(`${INTERP_DATASET.prefix}/index.json`);

  const todo = keys.filter(k => !uploaded.has(k));
  console.log(`共 ${keys.length} 个对象，已传 ${keys.length - todo.length}，本次要传 ${todo.length}`);

  let done = 0;
  let bytes = 0;
  const t0 = Date.now();
  const queue = [...todo];

  async function put(key: string): Promise<void> {
    const body = await readFile(join(dir!, key));
    const url = r2ObjectUrl(R2_ACCOUNT_ID!, R2_BUCKET!, key);
    const contentType = key.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    for (let attempt = 1; ; attempt++) {
      const headers = signS3Request({
        method: 'PUT', url, region: 'auto',
        headers: { 'content-type': contentType },
        payloadSha256: createHash('sha256').update(body).digest('hex'),
      }, creds);
      const res = await fetch(url, { method: 'PUT', headers, body });
      if (res.ok) break;
      const msg = `${key} → HTTP ${res.status} ${(await res.text()).slice(0, 200)}`;
      // 4xx（除 429）多半是令牌或桶名不对，重试没用
      if (attempt >= 5 || (res.status < 500 && res.status !== 429)) throw new Error(msg);
      console.warn(`重试 ${attempt}：${msg}`);
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
    }
    await appendFile(logFile, `${key}\n`);
    done++;
    bytes += body.length;
    if (done % 500 === 0 || done === todo.length) {
      const s = (Date.now() - t0) / 1000;
      console.log(`${done}/${todo.length}，${(bytes / 2 ** 20).toFixed(0)} MiB，${(bytes / 2 ** 20 / s).toFixed(1)} MiB/s`);
    }
  }

  await Promise.all(Array.from({ length: jobs }, async () => {
    for (let k = queue.shift(); k !== undefined; k = queue.shift()) await put(k);
  }));
  console.log('完成');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
