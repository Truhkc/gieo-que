/**
 * 倪师原话检索：生成文件与语料同步、检索结果确实贴着本盘、预算不超
 *
 *   npx tsx scripts/regression/tianji-knowledge.test.ts          # 断言
 *   npx tsx scripts/regression/tianji-knowledge.test.ts --print  # 顺便打印检索结果
 */
import '../lib/server-only-stub';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateChart } from '../../lib/ziwei/algorithm';

async function main(): Promise<void> {
  const { TIANJI_CORPUS } = await import('../../lib/ai/tianji-corpus.generated');
  const { selectKnowledge, detectFocus } = await import('../../lib/ai/knowledge');
  const { sanitizeChart } = await import('../../lib/ziwei/chart-input');
  const { buildInterpretSystem } = await import('../../lib/ai/prompts');
  const { buildChartContext } = await import('../../lib/ziwei/chart-context');

  // 1. 生成文件与 jsonl 逐条一致（语料更新后忘了重跑生成器，这里会挂）
  const jsonl = readFileSync(new URL('../../docs/tianji-ziwei/entries.jsonl', import.meta.url), 'utf8')
    .split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  assert.equal(TIANJI_CORPUS.length, jsonl.length, '条数不一致：请重跑 npx tsx scripts/build-tianji-corpus.ts');
  jsonl.forEach((r, i) => {
    assert.equal(TIANJI_CORPUS[i].q, r.quote, `第 ${i + 1} 条原话不一致：请重跑生成器`);
    assert.equal(TIANJI_CORPUS[i].t, r.t_hms);
  });
  assert.ok(TIANJI_CORPUS.every(e => /^\d+[上下]$/.test(e.l)), '每条都要能对上讲次');

  // 2. 问题 → 重点宫位
  assert.deepEqual(detectFocus('Hôn nhân của tôi thế nào?'), ['夫妻']);
  assert.deepEqual(detectFocus('事业和财运'), ['官禄', '财帛']);
  assert.deepEqual(detectFocus('Tóm tắt lá số'), []);

  const chart = sanitizeChart(JSON.parse(JSON.stringify(
    generateChart({ year: 1990, month: 5, day: 9, hour: 3, gender: 'male' }),
  )));
  const ming = chart.palaces.find(p => p.branch === chart.mingGongBranch)!;
  const mingStars = (ming.stars.some(s => s.type === 'major')
    ? ming.stars.filter(s => s.type === 'major').map(s => s.name)
    : ming.borrowedStars ?? []);

  // 3. 检索结果贴着本盘：命宫主星有原话、命宫条目在、预算守住、确定性
  const plain = selectKnowledge([chart]);
  assert.ok(plain.entries.length >= 20, `检索太少：${plain.entries.length}`);
  assert.ok(plain.entries.reduce((n, e) => n + e.q.length, 0) <= 9000);
  assert.ok(plain.entries.some(e => e.b === '02-palaces' && e.h2.startsWith('命宫')), '应含命宫条目');
  for (const s of mingStars) {
    assert.ok(plain.entries.some(e => e.b === '01-stars' && e.h2.includes(s)), `应含命宫主星 ${s} 的原话`);
  }
  assert.deepEqual(selectKnowledge([chart]).entries, plain.entries, '同盘同问应得同一批条目');

  // 4. 问婚姻时，夫妻宫条目明显增多
  const marriage = selectKnowledge([chart], { question: 'Hôn nhân của tôi thế nào?' });
  const fuqi = (r: typeof plain) => r.entries.filter(e => e.h2.startsWith('夫妻')).length;
  assert.ok(fuqi(marriage) >= 8 && fuqi(marriage) > fuqi(plain), `夫妻宫条目：${fuqi(plain)} → ${fuqi(marriage)}`);

  // 5. 出处只从语料来：提示词里每个（《天纪》x y）都真实存在
  const system = buildInterpretSystem(buildChartContext(chart), marriage.text);
  const cited = [...system.matchAll(/《天纪》(\d+[上下]) (\d\d:\d\d:\d\d)/g)];
  assert.ok(cited.length >= marriage.entries.length);
  const real = new Set(TIANJI_CORPUS.map(e => `${e.l} ${e.t}`));
  for (const m of cited) assert.ok(real.has(`${m[1]} ${m[2]}`), `提示词里有不存在的出处 ${m[0]}`);

  if (process.argv.includes('--print')) {
    console.log('命宫:', mingStars.join('、'), '| focus', marriage.focus, '| entries', marriage.entries.length);
    console.log(marriage.text);
  }
  console.log(`tianji-knowledge: ok（${plain.entries.length} 条 / 问婚姻 ${marriage.entries.length} 条）`);
}

main().catch(err => { console.error(err); process.exit(1); });
