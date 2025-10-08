// netlify/functions/fsq.js

// ✅ 設定
const fetch = global.fetch;
const CACHE_TTL      = 5 * 60 * 1000;         // IP+查詢 快取 5 分鐘
const SEARCH_LIMIT   = 3;                      // 同一 IP 最多 3 次
const LIMIT_WINDOW   = 3 * 60 * 60 * 1000;     // 三小時
const FSQ_ENDPOINT   = 'https://places-api.foursquare.com/places/search';
const FSQ_API_VER    = '2025-06-17';           // 官方建議傳版本日期

// 🧠 記憶體快取（Netlify Functions 熱啟動期間可保留）
const cache = new Map();        // key = `${ip}:${queryString}` → { timestamp, body, status }
const ipSearchLog = new Map();  // key = ip → [timestamp, timestamp, …]

export async function handler(event) {
  try {
    const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();

    // ---- 解析查詢參數 ----
    const params = new URLSearchParams(event.queryStringParameters || {});
    const queryString = params.toString();
    const cacheKey = `${ip}:${queryString}`;

    // ---- 1) 三小時 3 次限制 ----
    let logs = ipSearchLog.get(ip) || [];
    logs = logs.filter(ts => now - ts < LIMIT_WINDOW);
    if (logs.length >= SEARCH_LIMIT) {
      return json(429, { error: `已達搜尋上限（${SEARCH_LIMIT} 次 / 3 小時），請稍後再試 🕒` });
    }

    // ---- 2) IP+參數 快取命中 ----
    const cached = cache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL) {
      return {
        statusCode: cached.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: cached.body,
      };
    }

    // ---- 3) 直連 Foursquare 上游 API ----
    const url = new URL(FSQ_ENDPOINT);
    // 只要有帶入的參數就原樣轉給上游（ll、radius、categories、limit、sort、open_now…）
    for (const [k, v] of params) url.searchParams.set(k, v);

    const r = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${process.env.FSQ_API_KEY}`, // ← 記得在 Netlify 設定環境變數
        Accept: 'application/json',
        'X-Places-API-Version': FSQ_API_VER,
        'Accept-Language': 'zh-TW',
      },
    });

    const bodyText = await r.text();

    // ---- 4) 寫入快取（無論 200 或非 200，都可短暫快取避免連續打爆）----
    cache.set(cacheKey, { timestamp: now, body: bodyText, status: r.status });

    // ---- 5) 記錄這次搜尋（只對成功或 4xx/5xx 一律記次，避免洗爆）----
    logs.push(now);
    ipSearchLog.set(ip, logs);

    return {
      statusCode: r.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // 可選：把上游的 rate-limit header 轉發回前端觀察
        'X-RateLimit-Limit': r.headers.get('X-RateLimit-Limit') || '',
        'X-RateLimit-Remaining': r.headers.get('X-RateLimit-Remaining') || '',
        'X-RateLimit-Reset': r.headers.get('X-RateLimit-Reset') || '',
      },
      body: bodyText,
    };
  } catch (err) {
    console.error('Foursquare API proxy error:', err);
    return json(502, {
      errorType: err.name || 'ProxyError',
      errorMessage: err.message || String(err),
    });
  }
}

// ---- 小工具 ----
function json(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(obj),
  };
}
