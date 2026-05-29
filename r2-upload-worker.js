/**
 * 팬픽 — Cloudflare R2 이미지 업로드/삭제 Worker
 *
 * 역할: Firebase ID 토큰 검증 후 R2 버킷에 이미지 저장/삭제
 * 비용: 대역폭 0원 (R2 핵심 장점), 저장 $0.015/GB
 *
 * 배포 방법:
 *   1. Cloudflare Dashboard → R2 → 버킷 'fandom-battle-images' 생성 → 공개 접근 활성화
 *   2. Workers → 새 Worker 'fandom-upload' 생성 → 이 파일 내용 붙여넣기
 *   3. Worker 설정 → 바인딩 추가:
 *      - R2 버킷: 변수명 R2_BUCKET, 버킷 fandom-battle-images
 *   4. Worker 설정 → 환경 변수 추가:
 *      - PUBLIC_R2_URL: R2 버킷 공개 URL (예: https://pub-abc123.r2.dev)
 *   5. 배포 후 community.js의 R2_UPLOAD_WORKER_URL 에 Worker URL 입력
 *
 * 엔드포인트:
 *   PUT  /{key}  — 이미지 업로드 (X-Firebase-Token 헤더 필수)
 *   DELETE /{key} — 이미지 삭제  (X-Firebase-Token 헤더 필수)
 */

const FIREBASE_API_KEY = 'AIzaSyAzUVrCc7-gmdYyXu0wFBm8XRi-1OHb2r4';
const ALLOWED_ORIGINS = [
  'https://fandombattle.com',
  'https://lucky-tstore.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

// Firebase ID 토큰 검증 → uid 반환
async function verifyFirebaseToken(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  const data = await res.json();
  if (data.error || !data.users?.[0]) throw new Error('유효하지 않은 토큰');
  return data.users[0].localId; // Firebase uid
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Firebase-Token',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // PUT / DELETE 만 허용
    if (!['PUT', 'DELETE'].includes(request.method)) {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    // Firebase ID 토큰 검증
    const idToken = request.headers.get('X-Firebase-Token');
    if (!idToken) {
      return new Response('X-Firebase-Token 헤더가 필요합니다', { status: 401, headers: corsHeaders });
    }

    let uid;
    try {
      uid = await verifyFirebaseToken(idToken);
    } catch (e) {
      return new Response('인증 실패: ' + e.message, { status: 403, headers: corsHeaders });
    }

    // URL path → R2 object key
    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.slice(1)); // "community/{uid}/{timestamp}.webp"

    // 보안: 업로드 경로가 본인 uid를 포함해야 함 (타인 경로 접근 방지)
    if (!key.includes(uid)) {
      return new Response('본인 경로에만 업로드할 수 있습니다', { status: 403, headers: corsHeaders });
    }

    // ── 업로드 ──
    if (request.method === 'PUT') {
      await env.R2_BUCKET.put(key, request.body, {
        httpMetadata: { contentType: 'image/webp' },
      });
      const publicUrl = `${env.PUBLIC_R2_URL}/${key}`;
      return new Response(JSON.stringify({ url: publicUrl, key }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 삭제 ──
    if (request.method === 'DELETE') {
      await env.R2_BUCKET.delete(key);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
