/**
 * 没配 AI 时的数据集机器翻译：专名占位、标题对照、引号与粗体修复、分块、失败回退
 *
 *   npx tsx scripts/regression/translate-dataset.test.ts
 *
 * 不联网：Google 翻译用假的 fetch 代替（按原样返回，只把剩下的汉字换成 X）。
 */
import '../lib/server-only-stub';
import assert from 'node:assert/strict';

async function main(): Promise<void> {
  const { protectTerms, restoreTerms, fixStraightQuotes, repairMarkup, chunkText, translateZhToVi, clearTranslateCache } =
    await import('../../lib/ai/translate');

  // ── 专名换占位符，再换回汉越音 ────────────────────────────
  const src = '武曲天府坐夫妻宫，入福德；同宫只在丑、未，不在亥、子。妻子、儿女。本宫 · 夫妻：贪狼化权（庙旺）';
  const p = protectTerms(src);
  assert.ok(!/武曲|天府|夫妻宫|福德|贪狼|化权|庙旺/.test(p.text), `专名都应被占位：${p.text}`);
  assert.ok(p.text.includes('妻子、儿女'), '普通词「妻子」里的「子」不能当地支换掉');
  const back = restoreTerms(p.text, p.terms);
  for (const v of ['Vũ Khúc', 'Thiên Phủ', 'cung Phu Thê', 'cung Phúc Đức', 'Sửu', 'Mùi', 'Hợi', 'Tý', 'Tham Lang', 'Hoá Quyền', '(Miếu Vượng)']) {
    assert.ok(back.includes(v), `应还原出 ${v}：${back}`);
  }

  // ── 引号、粗体、标题 ─────────────────────────────────────
  assert.equal(fixStraightQuotes('" Toàn Thư " nói về Thiên Phủ"tình yêu", nghĩa là'), '"Toàn Thư" nói về Thiên Phủ "tình yêu", nghĩa là');
  assert.equal(fixStraightQuotes('không có ngoặc'), 'không có ngoặc');
  assert.equal(fixStraightQuotes('lẻ " một dấu'), 'lẻ " một dấu');
  assert.equal(repairMarkup('** [Tổng quan] **'), '**【Tổng quan】**');
  assert.equal(repairMarkup('**[Tổng quan]**'), '**【Tổng quan】**');
  assert.equal(repairMarkup('xem ** Vũ Khúc **.'), 'xem **Vũ Khúc**.');

  // ── 分块：不超长、不丢字 ─────────────────────────────────
  const long = Array.from({ length: 40 }, (_, i) => `第${i}段。`.repeat(30)).join('\n');
  const chunks = chunkText(long, 500);
  assert.ok(chunks.every(c => c.length <= 500));
  assert.equal(chunks.join('\n').replace(/\n/g, ''), long.replace(/\n/g, ''));

  // ── 整体：假 Google 接口 ─────────────────────────────────
  let calls = 0;
  const sent: string[] = [];
  const fakeFetch = (async (_url: string, init?: RequestInit) => {
    calls++;
    const q = new URLSearchParams(String(init?.body)).get('q') ?? '';
    sent.push(q);
    const translated = q.replace(/[一-鿿]+/g, 'X');
    return new Response(JSON.stringify([[[translated, q]]]), { status: 200 });
  }) as typeof fetch;

  clearTranslateCache();
  const text = '**【感情总览】**\n\n你在感情上直接。\n\n**【核心论断】**\n\n武曲坐夫妻宫，《全书》说「宜迟娶」。\n**【没见过的标题】**\n内容。';
  const vi = await translateZhToVi(text, { cacheKey: 'k1', fetchImpl: fakeFetch });
  assert.ok(vi);
  assert.ok(vi.startsWith('**【Tổng quan tình cảm】**'), '已知标题直接给越南文');
  assert.ok(vi.includes('**【Luận đoán cốt lõi】**'));
  assert.ok(!sent.some(q => q.includes('感情总览') || q.includes('核心论断')), '已知标题不送去翻译');
  assert.ok(vi.includes('Vũ Khúc') && vi.includes('cung Phu Thê'), vi);
  assert.ok(vi.includes('**【X】**'), '未知标题照常翻译并修回格式');

  // 缓存：同一个 key 不再请求
  const before = calls;
  assert.equal(await translateZhToVi(text, { cacheKey: 'k1', fetchImpl: fakeFetch }), vi);
  assert.equal(calls, before);

  // 失败：返回 null，不抛
  const origError = console.error;
  console.error = () => {};
  try {
    const failing = (async () => new Response('busy', { status: 429 })) as unknown as typeof fetch;
    assert.equal(await translateZhToVi('武曲坐命。', { fetchImpl: failing }), null);
    const weird = (async () => new Response('{"oops":1}', { status: 200 })) as unknown as typeof fetch;
    assert.equal(await translateZhToVi('武曲坐命。', { fetchImpl: weird }), null);
  } finally {
    console.error = origError;
  }

  console.log('translate-dataset: OK');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
