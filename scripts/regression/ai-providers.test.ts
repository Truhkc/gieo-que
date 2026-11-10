/**
 * Nhiều nhà cung cấp + tự chuyển khi lỗi, và API riêng của người xem (chặn SSRF).
 * Không gọi mạng: fetch được thay bằng bản giả.
 */
import '../lib/server-only-stub';
import assert from 'node:assert/strict';

const sse = (frames: string[]) => new Response(new ReadableStream({
  start(c) {
    for (const f of frames) c.enqueue(new TextEncoder().encode(`data: ${f}\n\n`));
    c.close();
  },
}), { status: 200 });
const openaiFrame = (text: string) => JSON.stringify({ choices: [{ delta: { content: text } }] });

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  let out = '';
  for await (const piece of gen) out += piece;
  return out;
}

async function main(): Promise<void> {
  const { resolveProviders, streamChatWithFallback } = await import('../../lib/ai/provider');
  const { isPrivateAddress, assertPublicHttpsUrl, readUserProvider, UserProviderError, userStreamError } =
    await import('../../lib/ai/user-provider');

  // ── 1. Danh sách nhà cung cấp ──
  for (const k of Object.keys(process.env)) if (k.startsWith('AI_') || k.startsWith('ANTHROPIC_') || k.startsWith('DEEPSEEK_')) delete process.env[k];
  Object.assign(process.env, {
    AI_PROVIDERS: 'anthropic, my-gemini, broken, anthropic',
    ANTHROPIC_API_KEY: 'sk-ant-xxxxxxxx',
    ANTHROPIC_BASE_URL: 'https://api.shopaikey.com/',
    AI_MY_GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    AI_MY_GEMINI_API_KEY: 'gm-xxxxxxxx',
    AI_MY_GEMINI_MODEL: 'gemini-2.5-flash',
    AI_BROKEN_BASE_URL: 'https://example.com/v1', // thiếu key và model → bị bỏ qua
  });
  const list = resolveProviders();
  assert.ok(list.ok);
  if (!list.ok) return;
  assert.deepEqual(list.providers.map(p => p.id), ['anthropic', 'my-gemini'], 'đúng thứ tự, bỏ mục hỏng và mục trùng');
  assert.equal(list.providers[0].baseUrl, 'https://api.shopaikey.com');
  assert.equal(list.providers[1].kind, 'openai');

  delete process.env.AI_PROVIDERS;
  process.env.AI_PROVIDER = 'anthropic';
  const single = resolveProviders();
  assert.ok(single.ok && single.providers.length === 1 && single.providers[0].id === 'anthropic', 'không có AI_PROVIDERS thì như cũ');

  process.env.AI_PROVIDERS = 'nothing';
  const none = resolveProviders();
  assert.ok(!none.ok && none.reason.vi.includes('AI_NOTHING_API_KEY'), 'không còn mục nào thì báo rõ thiếu gì');

  // ── 2. Tự chuyển khi lỗi trước chữ đầu tiên ──
  const a = { id: 'a', kind: 'openai' as const, baseUrl: 'https://a.example/v1', apiKey: 'k', model: 'm' };
  const b = { ...a, id: 'b', baseUrl: 'https://b.example/v1' };
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  const silence = console.error;
  console.error = () => {};
  try {
    globalThis.fetch = (async (url: string) => {
      calls.push(url);
      return url.startsWith('https://a.') ? new Response('{"error":"no credit"}', { status: 402 }) : sse([openaiFrame('xin '), openaiFrame('chào'), '[DONE]']);
    }) as typeof fetch;
    assert.equal(await collect(streamChatWithFallback([a, b], { system: 's', messages: [{ role: 'user', content: 'q' }] })), 'xin chào');
    assert.deepEqual(calls, ['https://a.example/v1/chat/completions', 'https://b.example/v1/chat/completions']);

    // Đã ra chữ rồi mới đứt → không ghép sang model khác
    calls.length = 0;
    globalThis.fetch = (async (url: string) => {
      calls.push(url);
      return sse([openaiFrame('nửa câu'), JSON.stringify({ error: { message: 'boom' } })]);
    }) as typeof fetch;
    let partial = '';
    await assert.rejects(async () => {
      for await (const p of streamChatWithFallback([a, b], { system: 's', messages: [{ role: 'user', content: 'q' }] })) partial += p;
    });
    assert.equal(partial, 'nửa câu');
    assert.equal(calls.length, 1, 'không được thử provider thứ hai sau khi đã phát chữ');

    // Tất cả đều hỏng → ném lỗi của cái cuối
    globalThis.fetch = (async () => new Response('x', { status: 500 })) as typeof fetch;
    await assert.rejects(collect(streamChatWithFallback([a, b], { system: 's', messages: [] })), /responded 500/);

    // API riêng: không theo redirect
    let redirectMode: RequestRedirect | undefined;
    globalThis.fetch = (async (_u: string, init: RequestInit) => { redirectMode = init.redirect; return sse(['[DONE]']); }) as typeof fetch;
    await collect(streamChatWithFallback([{ ...a, untrusted: true }], { system: 's', messages: [] }));
    assert.equal(redirectMode, 'error');
  } finally {
    globalThis.fetch = realFetch;
    console.error = silence;
  }

  // ── 3. Chặn SSRF ──
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '192.0.2.5']) {
    assert.ok(isPrivateAddress(ip), `${ip} phải bị coi là nội bộ`);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '192.0.78.9', '2606:4700::1111']) {
    assert.ok(!isPrivateAddress(ip), `${ip} là địa chỉ công khai`);
  }
  for (const url of ['http://api.openai.com/v1', 'https://localhost/v1', 'https://127.0.0.1/v1', 'https://[::1]/v1',
    'https://10.0.0.5/v1', 'https://169.254.169.254/latest', 'https://api.example.com:8443/v1', 'https://u:p@api.example.com/v1',
    'https://metadata.internal/v1', 'https://intranet/v1', 'not a url']) {
    await assert.rejects(assertPublicHttpsUrl(url), UserProviderError, `phải chặn ${url}`);
  }
  assert.equal(await assertPublicHttpsUrl('https://8.8.8.8/v1/'), 'https://8.8.8.8/v1');

  // ── 4. Kiểm tra dữ liệu người xem gửi ──
  assert.equal(await readUserProvider({}), null);
  await assert.rejects(readUserProvider({ provider: { kind: 'x', baseUrl: 'https://8.8.8.8', apiKey: 'sk-12345678', model: 'm' } }), UserProviderError);
  await assert.rejects(readUserProvider({ provider: { kind: 'openai', baseUrl: 'https://8.8.8.8', apiKey: 'short', model: 'm' } }), UserProviderError);
  await assert.rejects(readUserProvider({ provider: { kind: 'openai', baseUrl: 'https://8.8.8.8', apiKey: 'sk-12345678', model: 'bad model;' } }), UserProviderError);
  const own = await readUserProvider({ provider: { kind: 'anthropic', baseUrl: 'https://8.8.8.8/', apiKey: ' sk-12345678 ', model: 'claude-sonnet-5-5' } });
  assert.deepEqual(own, { id: 'user', kind: 'anthropic', baseUrl: 'https://8.8.8.8', apiKey: 'sk-12345678', model: 'claude-sonnet-5-5', untrusted: true });

  const msg = userStreamError(new Error('upstream user (m) responded 401: {"error":"sk-secret"}'), 'vi');
  assert.ok(msg.includes('401') && msg.includes('key sai'), msg);
  assert.ok(!msg.includes('sk-secret'), 'không được lộ body upstream');

  console.log('ai-providers: ok');
}

main().catch(err => { console.error(err); process.exit(1); });
