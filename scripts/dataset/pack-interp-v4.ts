/**
 * scripts/dataset/pack-interp-v4 —— 把上游「13 维解读数据集 v4.0」重新打包成每天一个 brotli 对象
 *
 *   npx tsx scripts/dataset/pack-interp-v4.ts --out D:/ziwei-interp            # 全部 1950–2026
 *   npx tsx scripts/dataset/pack-interp-v4.ts --out D:/ziwei-interp --years 1990-1990
 *
 * 选项
 *   --out DIR        输出根目录（必填）。对象写到 DIR/v4/YYYY/YYYY-MM-DD.json.br
 *   --cache DIR      下载缓存目录，默认 DIR/_download
 *   --years A-B      年份范围，默认 1950-2026
 *   --jobs N         同时处理几年，默认 3
 *   --keep           处理完保留下载的 .zst（默认删掉，省 161MB）
 *
 * 需要 Node ≥ 22.15（zlib 自带 zstd）。上游文件用 --long=27 压的，解压时把 windowLogMax 放到 27。
 * 可以中途打断再跑：已完成的年份（DIR/v4/YYYY/_done.json 存在）会跳过，下载也会校验 SHA-256 后复用。
 *
 * 为什么不直接放上游的 zstd 文件：一年一个文件、解压后 700MB，serverless 里查一张盘
 * 等于每次解压 700MB。按天拆开后每个对象约 146KB（24 张盘），一次 GET + 一次 brotli 解压就够。
 *
 * 跑完会写 DIR/v4/index.json：每年的天数、对象总字节数，以及全部合计。
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable, type Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import * as zlib from 'node:zlib';
import {
  INTERP_DATASET, INTERP_TOPICS, interpObjectPath,
  type InterpChartEntry, type InterpDayPack,
} from '../../lib/ziwei/interp-dataset';

const RELEASE = `https://github.com/Renhuai123/ziwei-doushu/releases/download/${INTERP_DATASET.tag}`;
const brotli = promisify(zlib.brotliCompress);

interface Args { out: string; cache: string; from: number; to: number; jobs: number; keep: boolean }

function parseArgs(argv: string[]): Args {
  const get = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const out = get('--out');
  if (!out) throw new Error('缺少 --out DIR');
  const [from, to] = (get('--years') ?? `${INTERP_DATASET.firstYear}-${INTERP_DATASET.lastYear}`)
    .split('-').map(Number);
  if (!(from >= INTERP_DATASET.firstYear && to <= INTERP_DATASET.lastYear && from <= to)) {
    throw new Error(`--years 需在 ${INTERP_DATASET.firstYear}-${INTERP_DATASET.lastYear} 之内`);
  }
  return {
    out, from, to,
    cache: get('--cache') ?? join(out, '_download'),
    jobs: Math.max(1, Number(get('--jobs') ?? 3)),
    keep: argv.includes('--keep'),
  };
}

interface ManifestFile { year: number; charts: number; zstBytes: number; sha256: string }

async function fetchManifest(): Promise<Map<number, ManifestFile>> {
  const res = await fetch(`${RELEASE}/MANIFEST.json`);
  if (!res.ok) throw new Error(`MANIFEST.json HTTP ${res.status}`);
  const m = await res.json() as { releaseTag: string; files: ManifestFile[] };
  if (m.releaseTag !== INTERP_DATASET.tag) throw new Error(`MANIFEST 的 tag 是 ${m.releaseTag}`);
  return new Map(m.files.map(f => [f.year, f]));
}

async function sha256File(path: string): Promise<string> {
  const h = createHash('sha256');
  for await (const chunk of createReadStream(path)) h.update(chunk as Buffer);
  return h.digest('hex');
}

/** 下载某年的 .zst 到缓存目录；已有且校验通过就复用 */
async function download(year: number, meta: ManifestFile, cache: string): Promise<string> {
  const file = join(cache, `year-${year}.jsonl.zst`);
  if (existsSync(file) && (await stat(file)).size === meta.zstBytes && await sha256File(file) === meta.sha256) {
    return file;
  }
  const res = await fetch(`${RELEASE}/year-${year}.jsonl.zst`);
  if (!res.ok || !res.body) throw new Error(`year-${year} HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createWriteStream(file));
  const sha = await sha256File(file);
  if (sha !== meta.sha256) throw new Error(`year-${year} SHA-256 不符：${sha}`);
  return file;
}

/** @types/node 20 还没有 zstd 的声明，运行时 Node ≥ 22.15 才有 */
function createZstd(): Transform {
  const z = zlib as unknown as {
    createZstdDecompress?: (o: { params: Record<number, number> }) => Transform;
    constants: { ZSTD_d_windowLogMax?: number };
  };
  if (!z.createZstdDecompress || z.constants.ZSTD_d_windowLogMax === undefined) {
    throw new Error(`当前 Node ${process.version} 没有内置 zstd，请用 Node ≥ 22.15`);
  }
  // 上游用 zstd --long=27 压缩，窗口放到 2^27 才解得开
  return z.createZstdDecompress({ params: { [z.constants.ZSTD_d_windowLogMax]: 27 } });
}

interface UpstreamRow {
  k: string; y: number; m: number; d: number; h: number; g: string; ms: string;
  c: Record<string, string>;
}

const SLOTS_PER_DAY = 24;

async function writeDay(outRoot: string, date: string, charts: Record<string, InterpChartEntry>): Promise<number> {
  const n = Object.keys(charts).length;
  if (n !== SLOTS_PER_DAY) throw new Error(`${date} 只有 ${n} 张盘，应为 ${SLOTS_PER_DAY}`);
  const pack: InterpDayPack = { v: INTERP_DATASET.packVersion, tag: INTERP_DATASET.tag, d: date, charts };
  const raw = Buffer.from(JSON.stringify(pack));
  // q9 + 16MB 窗口：比 q11 大 7%，但快 40 倍（q11 每天 2 秒，全量要十几个小时）
  const br = await brotli(raw, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 9,
      [zlib.constants.BROTLI_PARAM_LGWIN]: 24,
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
    },
  });
  await writeFile(join(outRoot, interpObjectPath(date)), br);
  return br.length;
}

interface YearStats { year: number; days: number; charts: number; bytes: number }

async function packYear(year: number, file: string, outRoot: string): Promise<YearStats> {
  await mkdir(join(outRoot, INTERP_DATASET.prefix, String(year)), { recursive: true });
  const zstd = createZstd();
  const rl = createInterface({ input: createReadStream(file).pipe(zstd), crlfDelay: Infinity });

  // 上游按日期排好序，但不依赖这一点：凑满 24 张就落盘，同一天再出现就报错
  const open = new Map<string, Record<string, InterpChartEntry>>();
  const done = new Set<string>();
  const stats: YearStats = { year, days: 0, charts: 0, bytes: 0 };

  for await (const line of rl) {
    if (!line) continue;
    const row = JSON.parse(line) as UpstreamRow;
    const date = row.k.slice(0, 10);
    const slot = `${row.h}-${row.g}`;
    if (row.k !== `${date}-${slot}` || row.y !== year) throw new Error(`键不合预期：${row.k}`);
    if (done.has(date)) throw new Error(`${date} 在文件里出现了两段`);
    const c: InterpChartEntry['c'] = {};
    for (const t of INTERP_TOPICS) if (typeof row.c[t] === 'string') c[t] = row.c[t];
    const day = open.get(date) ?? {};
    day[slot] = { ms: row.ms ?? '', c };
    open.set(date, day);
    stats.charts++;
    if (Object.keys(day).length === SLOTS_PER_DAY) {
      stats.bytes += await writeDay(outRoot, date, day);
      stats.days++;
      open.delete(date);
      done.add(date);
    }
  }
  if (open.size > 0) throw new Error(`${year} 有 ${open.size} 天不满 24 张盘：${[...open.keys()].slice(0, 3)}`);
  return stats;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.cache, { recursive: true });
  const manifest = await fetchManifest();
  const years = Array.from({ length: args.to - args.from + 1 }, (_, i) => args.from + i);
  const results: YearStats[] = [];
  const t0 = Date.now();

  const queue = [...years];
  async function worker(): Promise<void> {
    for (let year = queue.shift(); year !== undefined; year = queue.shift()) {
      const doneFile = join(args.out, INTERP_DATASET.prefix, String(year), '_done.json');
      if (existsSync(doneFile)) {
        results.push(JSON.parse(await readFile(doneFile, 'utf8')) as YearStats);
        console.log(`${year} 已完成，跳过`);
        continue;
      }
      const meta = manifest.get(year);
      if (!meta) throw new Error(`MANIFEST 里没有 ${year}`);
      const ty = Date.now();
      const file = await download(year, meta, args.cache);
      const stats = await packYear(year, file, args.out);
      if (stats.charts !== meta.charts) throw new Error(`${year} 盘数 ${stats.charts} ≠ MANIFEST ${meta.charts}`);
      await writeFile(doneFile, JSON.stringify(stats));
      if (!args.keep) await rm(file);
      results.push(stats);
      console.log(`${year}: ${stats.days} 天，${(stats.bytes / 2 ** 20).toFixed(1)} MiB，` +
        `${((Date.now() - ty) / 1000).toFixed(0)}s`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(args.jobs, years.length) }, worker));

  results.sort((a, b) => a.year - b.year);
  const total = results.reduce((s, r) => ({ days: s.days + r.days, charts: s.charts + r.charts, bytes: s.bytes + r.bytes }),
    { days: 0, charts: 0, bytes: 0 });
  await writeFile(join(args.out, INTERP_DATASET.prefix, 'index.json'), JSON.stringify({
    tag: INTERP_DATASET.tag, packVersion: INTERP_DATASET.packVersion, ...total, years: results,
  }, null, 1));
  console.log(`合计 ${total.days} 天 / ${total.charts} 张盘 / ${(total.bytes / 2 ** 30).toFixed(2)} GiB，` +
    `平均每天 ${(total.bytes / Math.max(1, total.days) / 1024).toFixed(0)} KiB，用时 ${((Date.now() - t0) / 60000).toFixed(1)} 分钟`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
