/**
 * scripts/build-tianji-corpus —— docs/tianji-ziwei/entries.jsonl → lib/ai/tianji-corpus.generated.ts
 *
 *   npx tsx scripts/build-tianji-corpus.ts
 *
 * 为什么生成 TS 而不是运行时 readFileSync：docs/ 不在 Next 的产物追踪范围里，
 * 部署到 serverless 后 fs 读不到；打成模块就跟着路由一起进包。
 *
 * 讲次（2上、5上…）不在 jsonl 里，从各讲 md 文件头的「BV… 第 NP」反查。
 * 语料更新后重跑本脚本；scripts/regression/tianji-corpus-sync.test.ts 会核对两边是否一致。
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const DIR = join(ROOT, 'docs/tianji-ziwei');
const OUT = join(ROOT, 'lib/ai/tianji-corpus.generated.ts');

interface Row {
  book: string; h2: string; h3: string; quote: string;
  t_hms: string; note: string; bvid: string; part: number;
}

// 「BV1KJsLekEfA 第 3P」→ 2上
const lectureOf = new Map<string, string>();
for (const f of readdirSync(DIR).filter(f => f.endsWith('.md') && /^\d/.test(f))) {
  const head = readFileSync(join(DIR, f), 'utf8').slice(0, 400);
  const m = head.match(/(BV[0-9A-Za-z]+) 第 (\d+)P/);
  if (!m) throw new Error(`${f}: 文件头找不到「BV… 第 NP」`);
  lectureOf.set(`${m[1]}#${m[2]}`, f.replace(/\.md$/, '').replace(/_补充\d$/, ''));
}

/** 只留「勘误：…」——那是讲解内容层面的更正；「已按裁决改正」是字幕修字，对模型没用 */
function erratum(note: string): string | undefined {
  const i = note.indexOf('勘误：');
  if (i < 0) return undefined;
  return note.slice(i + 3).replace(/详见\s*docs\/勘误\.md/, '').replace(/[〕\s。]+$/, '').trim() + '。';
}

const rows: Row[] = readFileSync(join(DIR, 'entries.jsonl'), 'utf8')
  .split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

const out = rows.map(r => {
  const lecture = lectureOf.get(`${r.bvid}#${r.part}`);
  if (!lecture) throw new Error(`找不到 ${r.bvid} P${r.part} 对应的讲次`);
  const n = erratum(r.note);
  return { b: r.book, h2: r.h2, h3: r.h3, q: r.quote, l: lecture, t: r.t_hms, bv: r.bvid, p: r.part, ...(n ? { n } : {}) };
});

writeFileSync(OUT, `/** 自动生成 · 勿手改 · 来源：docs/tianji-ziwei/entries.jsonl（CC BY-NC-SA 4.0，见该目录 LICENSE.md）
 *  生成器：scripts/build-tianji-corpus.ts
 *  字段：b=册 h2/h3=册目 q=倪师原话 l=讲次 t=视频时间 bv/p=B 站视频与分 P n=勘误
 */
export interface TianjiEntry {
  b: string; h2: string; h3: string; q: string;
  l: string; t: string; bv: string; p: number; n?: string;
}

export const TIANJI_CORPUS: readonly TianjiEntry[] = ${JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n{')};
`);
console.log(`wrote ${out.length} entries → ${OUT}`);
