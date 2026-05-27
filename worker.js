// Cloudflare Worker - CORS 代理，转发请求到 api.cphone.vip
// 部署: npx wrangler deploy worker.js

export default {
  async fetch(request) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    // 转发到 cphone.vip
    const url = new URL(request.url);
    const targetUrl = 'https://api.cphone.vip' + url.pathname + url.search;

    const modified = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow',
    });

    const resp = await fetch(modified);

    // 加上 CORS 头
    const headers = new Headers(resp.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Expose-Headers', '*');

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    });
  }
};
