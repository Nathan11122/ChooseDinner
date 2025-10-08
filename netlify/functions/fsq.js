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

    // ✅ 使用正式的 Foursquare Places API URL（新版是 places-api.foursquare.com）
    const url = new URL('https://places-api.foursquare.com/places/search');
    url.searchParams.set('ll', ll);
    url.searchParams.set('radius', radius);
    url.searchParams.set('categories', '13065'); // 13065 = Restaurants
    url.searchParams.set('limit', String(Math.min(50, Math.max(limit * 3, limit))));
    url.searchParams.set('sort', 'DISTANCE');
    if (open_now) url.searchParams.set('open_now', 'true');

    // ✅ header 要記得加 Bearer + 版本參數
    const r = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${process.env.FSQ_API_KEY}`, // ✅ 加上 Bearer
        Accept: 'application/json',
        'X-Places-API-Version': '2025-06-17', // ✅ 必要參數
        'Accept-Language': 'zh-TW',
      },
    });

    const text = await r.text();
    return {
      statusCode: r.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // 如果你前端跟 Netlify function 不同網域，要開這行
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
