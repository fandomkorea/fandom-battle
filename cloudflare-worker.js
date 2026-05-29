/**
 * 팬픽 — Cloudflare Workers 랭킹 CDN 프록시
 *
 * 역할: Firebase Realtime DB rankings를 60초 캐시로 서빙
 * 효과: 랭킹 업데이트 지연 6분(GitHub Actions) → 최대 60초
 *
 * 배포 방법:
 *   1. https://dash.cloudflare.com 에서 Workers 생성
 *   2. 이 파일 내용 붙여넣기
 *   3. 배포 후 받은 URL을 ranking.js의 CF_RANKINGS_WORKER_URL 에 입력
 *
 * Firebase rankings는 .read: true (공개) → 별도 인증 불필요
 */

const FIREBASE_RANKINGS_URL =
  'https://fandom-battle-92aa8-default-rtdb.firebaseio.com/rankings.json';

const CACHE_SECONDS = 60; // 60초 캐시 (GitHub Actions 5분 → 60초로 단축)

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Cloudflare 엣지 캐시 확인
    const cacheKey = new Request(FIREBASE_RANKINGS_URL, { method: 'GET' });
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      return new Response(cached.body, {
        headers: { ...corsHeaders, 'X-Cache': 'HIT' },
      });
    }

    // 캐시 미스 → Firebase REST API 읽기 (rankings는 공개)
    try {
      const firebaseRes = await fetch(FIREBASE_RANKINGS_URL);
      if (!firebaseRes.ok) throw new Error(`Firebase HTTP ${firebaseRes.status}`);
      const body = await firebaseRes.text();

      const response = new Response(body, { headers: corsHeaders });

      // 60초 엣지 캐시 저장
      const cacheResponse = new Response(body, {
        headers: {
          ...corsHeaders,
          'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
        },
      });
      ctx.waitUntil(cache.put(cacheKey, cacheResponse));

      return new Response(body, {
        headers: { ...corsHeaders, 'X-Cache': 'MISS' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: corsHeaders,
      });
    }
  },
};
