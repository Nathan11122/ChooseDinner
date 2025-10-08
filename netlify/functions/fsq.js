// netlify/functions/fsq.js
export async function handler(event) {
  try {
    const raw = process.env.FSQ_API_KEY;
    if (!raw) return J(500, { ok:false, reason:'ENV_MISSING', hint:'FSQ_API_KEY not set' });

    const key = raw.trim();
    if (key !== raw) return J(500, { ok:false, reason:'KEY_HAS_WHITESPACE', hint:'Remove leading/trailing spaces' });
    if (/^['"]|['"]$/.test(key)) return J(500, { ok:false, reason:'KEY_WRAPPED_IN_QUOTES', hint:'No quotes around key' });

    // 參數
    const q = new URLSearchParams(event.queryStringParameters || {});
    const ll = q.get('ll'); if (!ll) return J(400, { ok:false, reason:'MISSING_PARAM_LL' });
    const radius = q.get('radius') || '800';
    const limitIn = Number(q.get('limit') || 10);
    const limit = Math.min(50, Math.max(limitIn*3, limitIn));
    const openNow = q.get('open_now') === 'true';

    const url = new URL('https://api.foursquare.com/v3/places/search');
    url.searchParams.set('ll', ll);
    url.searchParams.set('radius', radius);
    url.searchParams.set('categories', '13065');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('sort', 'DISTANCE');
    if (openNow) url.searchParams.set('open_now', 'true');

    // 呼叫 FSQ
    const r = await fetch(url.toString(), {
      headers: { Authorization: key, Accept: 'application/json', 'Accept-Language': 'zh-TW' }
    });
    const bodyText = await r.text();

    const mask = (s) => s ? `${s.slice(0,6)}…(${s.length})` : 'n/a';
    const debug = { ok: r.ok, fsq_status: r.status, env_key_mask: mask(key) };

    // 讓你在 Network/Response 直接看到診斷 + 真實 FSQ 回應
    let payload;
    try { payload = JSON.parse(bodyText); } catch { payload = { raw: bodyText }; }
    return J(r.status, { debug, ...payload });

  } catch (e) {
    return J(500, { ok:false, reason:'FUNCTION_ERROR', error: e.message });
  }
}
function J(status, obj){ return { statusCode: status, headers:{'Content-Type':'application/json; charset=utf-8'}, body: JSON.stringify(obj) }; }
