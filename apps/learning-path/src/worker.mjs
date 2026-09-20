import { buildRequest, validateResponse, recommendation } from './diagnosis.mjs';

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname !== '/api/diagnose') return json({ error: '見つかりません。' }, 404);
    if (request.method !== 'POST') return json({ error: 'POST を使用してください。' }, 405);
    if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json({ error: 'このサイトから実行してください。' }, 403);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'JSON が必要です。' }, 415);
    let input;
    try {
      const reader = request.body?.getReader();
      if (!reader) return json({ error: '入力が必要です。' }, 400);
      const chunks = []; let length = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 16000) { await reader.cancel(); return json({ error: '入力が長すぎます。' }, 413); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      input = JSON.parse(new TextDecoder().decode(bytes));
    } catch { return json({ error: '入力を読み取れませんでした。' }, 400); }
    let payload;
    try { payload = buildRequest(input?.problemId, input?.work); }
    catch (error) { return json({ error: error.message }, 400); }
    if (!env.TYPESAFE_API_KEY) return json({ error: 'API キーが未設定です。管理者に連絡してください。' }, 503);
    if (!env.RATE_LIMITER || !env.GLOBAL_LIMITER) return json({ error: '利用制限の設定が未完了です。' }, 503);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) return json({ error: '実行が続いています。1分ほど待ってからお試しください。' }, 429);
    const global = await env.GLOBAL_LIMITER.limit({ key: 'all' });
    if (!global.success) return json({ error: 'ただいま混み合っています。1分ほど待ってからお試しください。' }, 429);
    const id = crypto.randomUUID();
    const started = performance.now();
    try {
      const upstream = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST', headers: { Authorization: `Bearer ${env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(25000)
      });
      if (!upstream.ok) {
        console.log(JSON.stringify({ id, event: 'jev_error', status: upstream.status }));
        return json({ error: `Jev API がエラーを返しました（${upstream.status}）。時間をおいて再実行してください。`, id }, 502);
      }
      const data = await upstream.json();
      const answer = validateResponse(data, payload);
      const elapsedMs = Math.round(performance.now() - started);
      const tokens = data.usage?.input_tokens;
      const costUsd = data.model === 'jev-1.13.0' && Number.isInteger(tokens) && tokens >= 0 ? tokens * 0.042 / 1e6 : null;
      console.log(JSON.stringify({ id, event: 'diagnosis', problemId: input.problemId, choice: answer.choice, elapsedMs, costUsd, usage: data.usage }));
      return json({ id, recommendation: recommendation(answer), answer, request: payload, response: data, elapsedMs, costUsd });
    } catch (error) {
      console.log(JSON.stringify({ id, event: 'request_failed', type: error.name }));
      return json({ error: error.name === 'TimeoutError' ? '応答が25秒以内に届きませんでした。もう一度お試しください。' : '判定結果を取得できませんでした。もう一度お試しください。', id }, 502);
    }
  }
};
