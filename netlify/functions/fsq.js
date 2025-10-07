// netlify/functions/fsq.js
export async function handler(event, context) {
  try {
    const params = new URLSearchParams(event.queryStringParameters || {});
    const ll = params.get('ll'); // "lat,lng"
    const radius = params.get('radius') || '800';
    const limit = Number(params.get('limit') || 10);
    const open_now = params.get('open_now') === 'true';

    if (!ll) {
      return json(400, { error: 'Missing required parameter: ll (latitude,longitude)' });
    }

    // 構造 Foursquare Places Search URL
    const url = new URL('https://api.foursquare.com/v3/places/search');
    url.searchParams.set('ll', ll);
    url.searchParams.set('radius', radius);
    url.searchParams.set('categories', '13065'); // Restaurants
    // 多抓一些再前端篩
    url.searchParams.set('limit', String(Math.min(50, Math.max(limit * 3, limit))));
    url.searchParams.set('sort', 'DISTANCE');
    if (open_now) url.searchParams.set('open_now', 'true');

    const r = await fetch(url.toString(), {
      headers: {
        Authorization: process.env.FSQ_API_KEY,   // ← 環境變數
        Accept: 'application/json',
        'Accept-Language': 'zh-TW',
      },
    });

    const text = await r.text();
    return {
      statusCode: r.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // 同網域呼叫通常不需要 CORS；若要跨網域，可打開下行
        // 'Access-Control-Allow-Origin': '*',
      },
      body: text,
    };
  } catch (err) {
    console.error('Foursquare API proxy error:', err);
    return json(500, { error: 'Internal Server Error', details: err.message });
  }
}

function json(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(obj),
  };
}
