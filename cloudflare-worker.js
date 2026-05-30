/**
 * 팬픽 — Cloudflare Workers 랭킹 CDN 프록시
 *
 * 역할: Firebase Realtime DB rankings를 60초 캐시로 서빙
 * 효과: 랭킹 업데이트 지연 6분(GitHub Actions) → 최대 60초
 *
 * 배포 방법:
 *   1. https://dash.cloudflare.com 에서 Workers 생성
 *   2. 이 파일 내용 붙여넣기
 *   3. Worker 설정 → Variables and Secrets → FIREBASE_DB_SECRET 추가
 *      (Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 데이터베이스 비밀번호)
 *   4. 배포 후 받은 URL을 ranking.js의 CF_RANKINGS_WORKER_URL 에 입력
 *
 * 현재 배포 URL: https://fanpick-rankings.coder-leebeegle2.workers.dev
 *
 * App Check Enforce 환경에서 REST API 접근 시 DB Secret으로 인증 필요
 */

const FIREBASE_BASE_URL =
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

    // Firebase URL에 DB Secret 인증 추가 (App Check Enforce 우회)
    const FIREBASE_RANKINGS_URL = env.FIREBASE_DB_SECRET
      ? `${FIREBASE_BASE_URL}?auth=${env.FIREBASE_DB_SECRET}`
      : FIREBASE_BASE_URL;

    // Cloudflare 엣지 캐시 확인 (캐시 키는 인증 파라미터 제외한 URL 사용)
    const cacheKey = new Request(FIREBASE_BASE_URL, { method: 'GET' });
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      return new Response(cached.body, {
        headers: { ...corsHeaders, 'X-Cache': 'HIT' },
      });
    }

    // 캐시 미스 → Firebase REST API 읽기
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
