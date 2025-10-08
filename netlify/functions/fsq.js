// netlify/functions/fsq.js

const fetch = global.fetch;

// ✅ IP Cache + 限制設定
const CACHE_TTL = 5 * 60 * 1000; // IP搜尋結果快取 5 分鐘
const SEARCH_LIMIT = 3;          // 同一 IP 最多次數
const LIMIT_WINDOW = 3 * 60 * 60 * 1000; // 三小時
const cache = new Map();         // IP+查詢字串 → API 回應
const ipSearchLog = new Map();   // IP → [timestamp, timestamp, …]

export async function handler(event) {
  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const queryKey = `${ip}:${event.rawQuery}`;

  // 📝 Step 1：搜尋次數限制
  let logs = ipSearchLog.get(ip) || [];
  // 移除超過3小時的紀錄
  logs = logs.filter(ts => now - ts < LIMIT_WINDOW);
  if (logs.length >= SEARCH_LIMIT) {
    console.log(`🚫 IP ${ip} 超過三小時內 ${SEARCH_LIMIT} 次限制`);
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: '搜尋次數已達上限，請稍後再試' }),
    };
  }

  // ✅ Step 2：IP Cache 命中 → 不重打 API
  const cached = cache.get(queryKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    console.log(`✅ IP Cache hit for ${ip}`);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: cached.body,
    };
  }

  // 🌀 Step 3：沒命中 → 打 Foursquare API
  console.log(`🔸 API fetch for ${ip}`);
  const resp = await fetch(`/.netlify/functions/fsq?${params.toString()}`);

if (resp.status === 429) {
  // 特別處理：IP 超過搜尋上限
  const data = await resp.json();
  alert(data.error || '已達搜尋上限，請稍後再試 🕒');
  return;
}

if (!resp.ok) {
  // 其他錯誤（例如 API Key 錯誤、500）
  const text = await resp.text();
  throw new Error('Proxy error: ' + resp.status + ' ' + text);
}


  const r = await fetch(url.toString(), {
    headers: {
      Authorization: process.env.FSQ_API_KEY,
      Accept: 'application/json',
      'Accept-Language': 'zh-TW',
    },
  });

  const body = await r.text();

  // Step 4：更新 cache
  cache.set(queryKey, { timestamp: now, body });

  // Step 5：記錄這次搜尋時間
  logs.push(now);
  ipSearchLog.set(ip, logs);

  return {
    statusCode: r.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body,
  };
}
