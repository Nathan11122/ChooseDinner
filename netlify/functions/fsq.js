// netlify/functions/fsq.js
export async function handler(event) {
  try {
    const envKey = process.env.FSQ_API_KEY;

    // 1) 先檢查環境變數是否存在
    if (!envKey) {
      return j(500, { ok:false, reason: 'ENV_MISSING', hint: 'FSQ_API_KEY not set on Netlify' });
    }

    // 2) 檢查格式：不能有引號/空白，且應以 fsq 開頭
    const trimmed = envKey.trim();
    if (trimmed !== envKey) {
      return j(500, { ok:false, reason: 'KEY_HAS_WHITESPACE', hint: 'Remove leading/trailing spaces' });
    }
    if (!/^fsq/i.test(envKey)) {
      return j(500, { ok:false, reason: 'NOT_SERVICE_API_KEY', hint: 'Use a Service API Key from "Service API Keys", not OAuth/Legacy' });
    }
    if (/^['"]|['"]$/.test(envKey)) {
      return j(500, { ok:false, reason: 'KEY_WRAPPED_IN_QUOTES', hint: 'Do not include quotes in the value' });
    }

    // 3) 解析參數
    const q = new URLSearchParams(event.queryStringParameters || {});
    const ll = q.get('ll');
    const radius = q.get('radius') || '800';
    const limit = Math.min(50, Math.max(Number(q.get('limit') || 10) * 3, Number(q.get('limit') || 10)));
    const openNow = q.get('open_now') === 'true';

    if (!ll) return j(400, { ok:false, reason:'MISSING_PARAM_LL' });

    // 4) 構造 FSQ URL
    const url = new URL('https://api.foursquare.com/v3/places/search');
    url.searchParams.set('ll', ll);
    url.searchParams.set('radius', radius);
    url.searchParams.set('categories', '13065');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('sort', 'DISTANCE');
    if (openNow) url.searchParams.set('open_now', 'true');

    // 5) 呼叫 FSQ
    const r = await fetch(url.toString(), {
      headers: {
        Authorization: envKey,     // ← 必須是 Service API Key，不能有引號/空白
        Accept: 'application/json',
        'Accept-Language': 'zh-TW',
      },
    });

    const text = await r.text();
    // 把狀態與簡短診斷一起回傳，方便你在 Network 面板直接看到
    return {
      statusCode: r.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: text,
    };
  } catch (err) {
    return j(500, { ok:false, reason:'FUNCTION_ERROR', error: err.message });
  }
}
function j(status, body){ return { statusCode: status, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }; }
