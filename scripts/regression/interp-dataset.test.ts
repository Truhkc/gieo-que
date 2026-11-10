/**
 * 13 维解读数据集：取键、对象路径、R2 签名、查询回退、提示词拼接
 *
 *   npx tsx scripts/regression/interp-dataset.test.ts
 *
 * 不联网、不依赖真实数据。若设了 ZIWEI_INTERP_DIR 且其中有 1990 年的对象，
 * 额外用真数据核对 1990-05-09 卯时男命的「感情」维度。
 */
import '../lib/server-only-stub';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import { buildInterpKey, interpObjectPath, isInterpTopic, type InterpDayPack } from '../../lib/ziwei/interp-dataset';
import { signS3Request } from '../../lib/storage/r2-sigv4';

async function main(): Promise<void> {
  const { lookupInterp, clearInterpCache, loaderFromEnv } = await import('../../lib/ai/interp-dataset');
  const { buildInterpretSystem } = await import('../../lib/ai/prompts');

  // ── 1. 取键 ────────────────────────────────────────────────
  const k = buildInterpKey({ year: 1990, month: 5, day: 9, hour: 3, gender: 'male' });
  assert.ok(k.ok);
  assert.equal(k.key.key, '1990-05-09-3-male', '与上游 k 字段同格式');
  assert.equal(k.key.slot, '3-male');
  assert.equal(k.key.path, 'v4/1990/1990-05-09.json.br');
  assert.equal(interpObjectPath('2026-12-31'), 'v4/2026/2026-12-31.json.br');

  assert.ok(buildInterpKey({ year: 1950, month: 1, day: 1, hour: 0, gender: 'female' }).ok, '首日');
  assert.ok(buildInterpKey({ year: 2026, month: 12, day: 31, hour: 11, gender: 'male' }).ok, '末日');
  assert.ok(buildInterpKey({ year: 2000, month: 2, day: 29, hour: 0, gender: 'male' }).ok, '闰日');

  const reason = (b: Parameters<typeof buildInterpKey>[0]) => {
    const r = buildInterpKey(b);
    return r.ok ? 'ok' : r.reason;
  };
  assert.equal(reason({ year: 1949, month: 12, day: 31, hour: 11, gender: 'male' }), 'out-of-range');
  assert.equal(reason({ year: 2027, month: 1, day: 1, hour: 0, gender: 'male' }), 'out-of-range');
  assert.equal(reason({ year: 1990, month: 2, day: 30, hour: 0, gender: 'male' }), 'invalid', '不存在的日期');
  assert.equal(reason({ year: 1990, month: 2, day: 29, hour: 0, gender: 'male' }), 'invalid', '非闰年 2/29');
  assert.equal(reason({ year: 1990, month: 5, day: 9, hour: 12, gender: 'male' }), 'invalid', '时辰越界');
  assert.equal(reason({ year: 1990, month: 5, day: 9, hour: 2.5, gender: 'male' }), 'invalid');
  assert.equal(reason({ year: 1990, month: 5, day: 9, hour: 3, gender: 'x' }), 'invalid');
  assert.equal(reason({ year: NaN, month: 5, day: 9, hour: 3, gender: 'male' }), 'invalid');

  assert.ok(isInterpTopic('love') && isInterpTopic('parents'));
  assert.ok(!isInterpTopic('marriage') && !isInterpTopic(undefined));

  // ── 2. SigV4：AWS 文档「GET Object」示例向量 ──────────────
  const sig = signS3Request({
    method: 'GET', url: 'https://examplebucket.s3.amazonaws.com/test.txt', region: 'us-east-1',
    headers: { range: 'bytes=0-9' },
    payloadSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    now: new Date('2013-05-24T00:00:00Z'),
  }, { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' });
  assert.ok(sig.authorization.endsWith('Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41'));
  assert.ok(sig.authorization.includes('SignedHeaders=host;range;x-amz-content-sha256;x-amz-date'));

  // ── 3. 查询与回退（内存假数据源） ──────────────────────────
  const birth = { year: 1990, month: 5, day: 9, hour: 3, gender: 'male' };
  const pack: InterpDayPack = {
    v: 1, tag: 'v4.0-13d', d: '1990-05-09',
    charts: {
      '3-male': { ms: '天府', c: { love: '**【感情总览】**\n测试正文', career: '事业正文' } },
      '3-female': { ms: '天府', c: { love: '女命正文' } },
    },
  };
  const packed = brotliCompressSync(Buffer.from(JSON.stringify(pack)));
  let calls = 0;
  const loader = async (path: string) => {
    calls++;
    return path === 'v4/1990/1990-05-09.json.br' ? packed : null;
  };

  clearInterpCache();
  const hit = await lookupInterp(birth, 'love', { loader });
  assert.ok(hit.ok);
  assert.equal(hit.text, '**【感情总览】**\n测试正文');
  assert.equal(hit.mainStar, '天府');
  assert.equal(calls, 1);

  // 同一天的其他维度、其他性别走缓存，不再读对象
  assert.ok((await lookupInterp(birth, 'career', { loader })).ok);
  const female = await lookupInterp({ ...birth, gender: 'female' }, 'love', { loader });
  assert.ok(female.ok && female.text === '女命正文');
  assert.equal(calls, 1, '当天 24 张盘一次读入缓存');

  // 维度缺失 / 时辰缺失 / 整天缺失 → missing
  const noTopic = await lookupInterp(birth, 'health', { loader });
  assert.deepEqual([noTopic.ok, !noTopic.ok && noTopic.reason], [false, 'missing']);
  const noSlot = await lookupInterp({ ...birth, hour: 4 }, 'love', { loader });
  assert.equal(!noSlot.ok && noSlot.reason, 'missing');
  const noDay = await lookupInterp({ ...birth, day: 10 }, 'love', { loader });
  assert.equal(!noDay.ok && noDay.reason, 'missing');

  // 范围外、不合法：不碰数据源
  calls = 0;
  const out = await lookupInterp({ ...birth, year: 1949 }, 'love', { loader });
  assert.equal(!out.ok && out.reason, 'out-of-range');
  const bad = await lookupInterp({ ...birth, gender: '?' }, 'love', { loader });
  assert.equal(!bad.ok && bad.reason, 'invalid');
  assert.equal(calls, 0);

  // 没配数据源
  const none = await lookupInterp(birth, 'love', { loader: null });
  assert.equal(!none.ok && none.reason, 'not-configured');
  assert.equal(loaderFromEnv({} as NodeJS.ProcessEnv), null);

  // 数据源报错、对象损坏、对象日期对不上 → error，且不抛出、不缓存
  clearInterpCache();
  const origError = console.error;
  console.error = () => {};
  try {
    const boom = await lookupInterp(birth, 'love', { loader: async () => { throw new Error('网络断了'); } });
    assert.equal(!boom.ok && boom.reason, 'error');
    const corrupt = await lookupInterp(birth, 'love', { loader: async () => Buffer.from('不是 brotli') });
    assert.equal(!corrupt.ok && corrupt.reason, 'error');
    const wrongDay = brotliCompressSync(Buffer.from(JSON.stringify({ ...pack, d: '1990-05-10' })));
    const mismatch = await lookupInterp(birth, 'love', { loader: async () => wrongDay });
    assert.equal(!mismatch.ok && mismatch.reason, 'error');
  } finally {
    console.error = origError;
  }
  assert.ok((await lookupInterp(birth, 'love', { loader })).ok, '出错之后恢复正常');

  // ── 4. 提示词：有原文时作为第一依据放进去，没有就不出现 ────────
  const withData = buildInterpretSystem('（命盘）', '（知识库）', { label: '感情婚姻', text: 'DATASET-BODY' });
  assert.ok(withData.includes('主要依据'));
  assert.ok(withData.includes('〔原文开始〕\nDATASET-BODY\n〔原文结束〕'));
  assert.ok(withData.indexOf('DATASET-BODY') < withData.indexOf('（知识库）'), '原文排在知识库前面');
  assert.ok(!buildInterpretSystem('（命盘）', '（知识库）').includes('〔原文开始〕'));

  // ── 5. 可选：真数据 ────────────────────────────────────────
  const dir = process.env.ZIWEI_INTERP_DIR;
  if (dir && existsSync(join(dir, 'v4/1990/1990-05-09.json.br'))) {
    clearInterpCache();
    const real = await lookupInterp(birth, 'love');
    assert.ok(real.ok, '真数据 1990-05-09-3-male 应能查到');
    assert.ok(real.text.includes('【感情总览】'));
    console.log(`  （真数据：${real.key.key} love ${real.text.length} 字）`);
  }

  console.log('interp-dataset: OK');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
