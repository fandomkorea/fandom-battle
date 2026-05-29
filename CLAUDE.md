# 팬덤배틀 프로젝트 — Claude 참조 문서

## 프로젝트 개요

K-pop 팬덤 투표 + 커뮤니티 SPA (Single Page Application).  
Firebase Realtime Database + Firebase Auth 기반. 배포: GitHub Pages.  
단일 HTML 파일(`docs/index.html`)에 두 탭(투표 / 커뮤니티)이 JS로 전환되는 구조.

**프로덕션 도메인**: `https://fandombattle.com`  
**GitHub Pages URL**: `https://lucky-tstore.github.io/fandom-battle/`

---

## 파일 역할

| 파일 | 역할 |
|---|---|
| `docs/index.html` | 유일한 HTML 파일. 모든 UI 뼈대 포함. script는 파일 하단에 순서대로 로드 |
| `docs/js/config.js` | Firebase 설정, `GROUP_META`(그룹 이모지/색상/팬덤명), `ALL_GROUPS`, `db`, `allRankingsData` 전역 선언 |
| `docs/js/auth.js` | Google/Twitter/Apple 로그인, `onAuthStateChanged`, `loadUserAdVotes()`, `loadAuthUserData()`, `updateAuthUI()` |
| `docs/js/voting.js` | 투표 로직, 투표 제한 상수, `loadTodayVotesFromFirebase()`, `proceedWithVote()`, `voteForGroup()` |
| `docs/js/voting-modals.js` | **`init()` 포함 (앱 진입점)**. App Check 초기화, 광고 보상 모달, 신규가입 `saveAuthUserData()`, 투표 관련 모달 |
| `docs/js/ranking.js` | 랭킹 CDN 폴링 (`CF_RANKINGS_WORKER_URL` → `data/rankings.json` 순 폴백), `renderRankings()`, `localVoteUpdate()`, 트렌딩 감지 |
| `docs/js/utils.js` | 페이지 전환 `showVotePage()` / `showCommunityPage()`, `showToast()`, `getMyFav()` / `setMyFav()`, 팬덤바, 공유 |
| `docs/js/fandom.js` | 최애 팬덤 설정/변경 모달, `updatePrimaryFandom()`, `checkFandomWritePermission()` |
| `docs/js/community.js` | 커뮤니티 게시글/댓글 CRUD, `loadCommunityPosts()`, `showPostDetail()`, `toggleLike()`, `toggleCommentLike()` |
| `docs/data/rankings.json` | 랭킹 정적 JSON. GitHub Actions가 5분마다 자동 갱신. CF Worker 미사용 시 클라이언트가 GitHub Pages CDN에서 읽음 |
| `.github/workflows/update-rankings.yml` | 랭킹 자동 갱신 워크플로우 (5분마다 Firebase REST API → `rankings.json` 커밋) |
| `docs/sw.js` | Service Worker. JS/CSS 캐시 우선, HTML·rankings.json 네트워크 우선+캐시 폴백, 오프라인 지원 |
| `docs/manifest.json` | PWA 매니페스트. 홈화면 설치, 테마 색상, 앱 이름 정의 |
| `docs/icon.svg` | PWA 앱 아이콘 (하트+음표 SVG) |
| `cloudflare-worker.js` | Cloudflare Workers 랭킹 프록시 소스 (저장소 루트). Firebase rankings를 60초 캐시로 서빙 |

### 스크립트 로드 순서 (index.html 하단)
```
config.js → auth.js → fandom.js → voting-modals.js → voting.js → ranking.js → utils.js → community.js
```
`init()`은 `voting-modals.js` 안에 있고, HTML `onload`로 호출됨.

---

## 핵심 전역 변수

| 변수 | 선언 위치 | 설명 |
|---|---|---|
| `db` | config.js | Firebase Realtime DB 인스턴스 |
| `currentUser` | auth.js | Firebase user + `customNickname`, `primaryFandom`, `lastFandomChangeTime` 커스텀 필드 포함 |
| `isLoggedIn` | auth.js | boolean |
| `currentUserFav` | auth.js | 현재 유저의 최애 팬덤 string (Firebase `preferences/primaryFandom` 에서 로드) |
| `allRankingsData` | config.js | 전체 랭킹 object `{groupName: voteCount}` |
| `pendingAdVotes` | voting.js | 보유 중인 광고 투표권 수 |
| `cachedTodayFreeVote` | voting.js | 오늘 무료 투표한 그룹 string or null |
| `cachedTodayAdVotes` | voting.js | 오늘 사용한 광고 투표 수 (0-10) |
| `communityPostsLoaded` | community.js | 게시글 로드 성공 여부 플래그 (auth 재시도 판단용) |
| `currentViewingPost` | community.js | 현재 열린 게시글 캐시 `{fandom, postId, authorUid, title}`. 알림 함수에서 재읽기 방지용 |
| `GROUP_META` | config.js | `{groupName: {emoji, color, fandom, kr}}` |

---

## Firebase DB 구조

```
/rankings/{groupName}                    — 그룹별 총 투표 수 (숫자)

/votes/{YYYY-MM-DD}/{uid}               — 무료 투표 기록
  group, timestamp, email

/users/{uid}/
  nickname                              — 커스텀 닉네임
  fandom                                — 레거시 (현재는 preferences/primaryFandom 사용)
  preferences/primaryFandom             — 최애 팬덤 (현재 사용 경로)
  pendingAdVotes                        — 보유 광고 투표권 수
  ad_watch_count_{YYYY-MM-DD}           — 당일 광고 시청 횟수 (max 10)
  ad_votes_used_{YYYY-MM-DD}            — 당일 광고 투표 사용 횟수
  lastFandomChangeTime                  — 마지막 팬덤 변경 timestamp (변경 제한용)
  votingStreak, lastVoteDate            — 투표 스트릭
  activePage                            — 마지막 활성 탭 ('vote' | 'community')

/community/{fandomName}/{postId}/
  title, content, authorUid, authorNickname, timestamp
  imageUrl                              — (선택) Cloudinary 이미지 URL
  isHidden, reportCount
  likesCount                            — 좋아요 수 캐시 (정수, 비용 절감용)
  commentsCount                         — 댓글 수 캐시 (정수, 비용 절감용)
  ※ likes/comments 는 더 이상 community 경로 하위에 없음 → 아래 최상위 경로 사용

/likes/{fandomName}/{postId}/{uid}      — 게시글 좋아요 (값: true)

/comments/{fandomName}/{postId}/{commentId}/
  content, authorUid, authorNickname, timestamp
  isHidden
  likes/{uid}: true                     — 댓글 좋아요
  replies/{replyId}/
    content, authorUid, timestamp

/user_posts/{uid}/{postId}/             — 유저별 작성 게시글 인덱스
  fandom, title, timestamp

/notif_counts/{uid}/                    — 읽지 않은 알림 수

/group_records/{groupName}             — 그룹별 통계 기록 (read-only)
/monthly_history/{month}              — 월별 랭킹 히스토리
/prize_notice/                        — 경품 공지
```

---

## 배포 규칙 ⚠️ 반드시 지킬 것

### 1. JS/CSS 파일 수정 시 버전 쿼리스트링 업데이트 필수

GitHub Pages는 브라우저 캐시를 제어하는 헤더 설정이 불가능하다. 때문에 `?v=` 쿼리스트링으로 캐시를 무력화한다. **JS나 CSS 파일을 수정했다면, `docs/index.html`에서 해당 파일의 `?v=` 값을 반드시 올려야 한다.** 올리지 않으면 유저가 새로고침해도 수정 전 파일을 계속 보게 된다.

```html
<!-- 예시: community.js를 수정했다면 -->
<script src="js/community.js?v=20260609b"></script>  <!-- 이전 -->
<script src="js/community.js?v=20260609c"></script>  <!-- 수정 후 (알파벳 한 칸 올림) -->
```

버전 규칙: `YYYYMMDD` + 알파벳 suffix (`a`, `b`, `c`, ... 같은 날 여러 번 수정 시 올림)

현재 버전 현황 (`docs/index.html` 기준):
| 파일 | 현재 버전 |
|---|---|
| `css/posts.css` | v=20260529b |
| `js/config.js` | v=20260609 |
| `js/auth.js` | v=20260609c |
| `js/fandom.js` | v=20260602a |
| `js/voting-modals.js` | v=20260609c |
| `js/voting.js` | v=20260609c |
| `js/ranking.js` | v=20260610b |
| `js/utils.js` | v=20260529e |
| `js/community.js` | v=20260610a |

> **주의**: 버전 현황 표는 실제 `index.html`과 다를 수 있으므로, 수정 전 반드시 `index.html`에서 직접 확인하고 올릴 것.

### 2. 코드 수정 후 git push 필수

작업 완료 후 반드시 GitHub에 푸시해야 GitHub Pages에 배포된다.

```bash
git add <수정한 파일들>
git commit -m "커밋 메시지"
git push
```

- 커밋 메시지는 한국어로 작성 (예: `feat(community): 댓글 수정 기능 추가`)
- `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` footer 항상 포함
- push 없이 commit만 하면 GitHub Pages에 반영되지 않음

---

## Firebase 비용 절감 규칙 ⚠️

Firebase Realtime Database는 **다운로드 대역폭 기준 과금($1/GB)**이다.  
**핵심 원칙: Firebase는 쓰기·인증 전용. 읽기는 캐시/CDN 우선.**

### 현재 적용된 최적화 효과 (10K DAU 기준)

| 항목 | 이전 | 현재 | 절감 |
|---|---|---|---|
| 랭킹 | `.on()` 실시간 구독 (420MB/일) | CDN JSON 60초 폴링 (0.6MB/일) | **99.9%** |
| 커뮤니티 목록 | `.once()` 매번 (600MB/일) | localStorage 3분 캐시 (300MB/일) | **50%** |
| 게시글 상세 | `.once()` 매번 (60MB/일) | sessionStorage 10분 캐시 (20MB/일) | **67%** |
| 좋아요 리스너 | `.on()` 실시간 (80MB/일) | `.once()` + 로컬 갱신 (20MB/일) | **75%** |
| 댓글 리스너 | `.on()` 실시간 (200MB/일) | `.once()` + 수동 재로드 (60MB/일) | **70%** |
| **Firebase 합계** | **1,380MB/일 → $31.40/월** | **420MB/일 → $2.60/월** | **92%** |

---

### 랭킹 CDN 아키텍처 (ranking.js) ⚠️ 핵심

**현재 구조 (Cloudflare Workers 적용)**:
```
투표 발생 → CF Workers (60초 엣지 캐시, Firebase REST API 직접 읽기)
            → 클라이언트 60초 폴링 → 최대 60초 지연
폴백: CF Workers 실패 시 → GitHub Pages rankings.json CDN (5분 지연)
      CDN 실패 시 → localStorage 캐시
```

- **CF Worker URL**: `https://fandom-rankings.coder-leebeegle2.workers.dev`
- **상수 위치**: `ranking.js` 최상단 `const CF_RANKINGS_WORKER_URL`
- GitHub Actions 워크플로우: `.github/workflows/update-rankings.yml` (5분마다 폴백용 JSON 갱신)
- Firebase reads: **288회/일** (사용자 수와 무관하게 고정)
- `rankings` 경로는 `.read: true` (공개) → CF Worker·Actions에 인증 불필요
- 투표 직후 즉시 반영: `localVoteUpdate(group)` (낙관적 업데이트, ranking.js에 정의)

```javascript
// voting.js — 투표 성공 직후 반드시 호출해야 함
db.ref("rankings/" + group).transaction(cur => (cur || 0) + 1);
localVoteUpdate(group); // 폴링 대기 없이 로컬에서 즉시 +1
```

> **🚨 절대 금지**: `ranking.js`에 `db.ref("rankings").on(...)` 추가 금지.  
> `.on()` 복구 시 → 50K 유저 × 업데이트 횟수 × 2KB = 수백GB/월 비용 폭발.

---

### 커뮤니티 목록 캐시 (community.js)

**localStorage 3분 TTL 캐시** (`_POSTS_CACHE_TTL = 3 * 60 * 1000`)

```javascript
_getCachedPostList(fandom)        // 캐시 읽기 (만료 시 null 반환)
_setCachedPostList(fandom, data)  // 캐시 저장
_invalidatePostListCache(fandom)  // 캐시 무효화 (쓰기 후 호출 필수)
_renderCommunityPostList(fandom, posts) // 캐시/Firebase 공통 렌더 함수
```

- **캐시 히트**: Firebase 읽기 없이 즉시 렌더 (로딩 스피너 없음)
- **캐시 미스/만료**: Firebase `.once()` → 렌더 → 캐시 저장
- **무효화 시점**: `submitPost()` 작성 후 / `deletePost()` 삭제 후 / `refreshCommunityPosts()` 새로고침
- **강제 새로고침**: `_invalidatePostListCache(fandom)` 후 `loadCommunityPosts()` 호출

> **주의**: `loadCommunityPosts()` 내부에서 `.on()` 절대 사용 금지.  
> 새 렌더링 로직 추가 시 `_renderCommunityPostList()` 재활용할 것.

---

### 게시글 상세 캐시 (community.js)

**sessionStorage 10분 TTL 캐시** (키: `pd_${postId}`)

- `showPostDetail()` 진입 시 캐시 확인 → 히트 시 Firebase 읽기 완전 스킵
- 조회수 중복 방지: 기존 `viewed_${postId}` sessionStorage 유지
- **무효화 시점**: `saveEditPost()` 수정 후 `sessionStorage.removeItem('pd_' + postId)`
- 삭제 후에는 상세 페이지 자체를 닫으므로 별도 무효화 불필요

---

### 좋아요/댓글 리스너 규칙

```
좋아요 리스너 → .once() 사용
  초기 상태 1회 로드 후, toggleLike() 성공 시 UI 직접 갱신
  갱신 대상: detail-like-count, postDetailLikeBtn, postDetailLikeHeart,
             stickyLikeHeart, stickyLikeCount, stickyLikeBtn

댓글 리스너 → .once() 사용
  초기 1회 로드 후, 아래 작업 완료 시 loadDetailComments(fandom, postId) 수동 호출:
  - submitDetailComment()  — 댓글 작성
  - submitStickyComment()  — 하단 바 댓글 작성
  - deleteComment()        — 댓글 삭제
  - saveEditComment()      — 댓글 수정
  - toggleCommentLike()    — 댓글 좋아요
```

> **⚠️ 댓글/좋아요 관련 기능 추가 시**: 위의 수동 재로드 패턴을 반드시 지킬 것.  
> `.on()` 리스너가 없으므로 작성/삭제 후 수동 호출 없으면 UI가 갱신되지 않는다.

### 새 댓글 수 폴링 (community.js)

게시글 상세 페이지에서 **30초마다 `commentsCount` 숫자 1개(50바이트)만** 확인해 새 댓글 여부를 표시한다.

```javascript
_startCommentCountPoll(fandom, postId, initialCount) // showPostDetail() 진입 시 자동 호출
_stopCommentCountPoll()                              // closePostDetail() 종료 시 자동 호출
_showNewCommentNotice(fandom, postId, diff)          // "💬 새 댓글 N개 보기 ↓" sticky 버튼 표시
_hideNewCommentNotice()                              // 버튼 제거
```

- **흐름**: 게시글 열기 → `_startCommentCountPoll` → 30초마다 `commentsCount` 읽기 → 증가 감지 시 알림 버튼 → 클릭 시 `loadDetailComments()` + `_hideNewCommentNotice()`
- **기준값 갱신**: `loadDetailComments()` 내부 commentsCallback 마지막에 `_displayedCommentCount = commentCount` 동기화
- **비용**: `community/{fandom}/{postId}/commentsCount` 숫자 1개만 읽음 (`.on()` 없음)

---

### 읽기 정책 전체 요약

| Firebase 경로 | 허용 방식 | 비고 |
|---|---|---|
| `rankings` | **CF Worker / CDN 폴링만** | `.on()` / `.once()` 모두 금지 |
| `community/{fandom}` (목록) | `.once()` + localStorage 캐시 | `limitToLast(30)` 필수 |
| `community/{fandom}/{postId}` (상세) | `.once()` + sessionStorage 캐시 | 10분 TTL |
| `community/{fandom}/{postId}/commentsCount` | `.once()` 30초 폴링 | 숫자 1개만, 새 댓글 감지용 |
| `likes/{fandom}/{postId}` | `.once()` | toggleLike 후 로컬 갱신 |
| `comments/{fandom}/{postId}` | `.once()` | 쓰기 후 수동 재로드 |
| `users/{uid}` | `.once()` | |
| `votes/{date}/{uid}` | `.once()` | |
| `notif_counts/{uid}` | `.on()` ✅ 허용 | 알림 뱃지 실시간 필요 |
| `monthly_history`, `group_records` | `.once()` | |

---

### 게시글 목록 로드 쿼리 제한

- `loadCommunityPosts()`: `.orderByChild('timestamp').limitToLast(30)` 필수
- `loadAllFandomPosts()`: 팬덤당 `limitToLast(50)`, 5분 in-memory 캐시 (`_allFeedLastLoadedAt`)
- 전체 노드를 제한 없이 읽는 코드 절대 추가 금지

---

### 좋아요/댓글 수 (denormalized 카운터)

- `community/{fandom}/{postId}/likesCount` — 정수 캐시. `renderPost()`에서 이 값 우선 사용
- `community/{fandom}/{postId}/commentsCount` — 정수 캐시. 댓글 추가/삭제 시 `.transaction()` 으로 업데이트
- 실제 likes/comments 데이터는 최상위 경로(`/likes/`, `/comments/`)에 분리 저장
- 게시글 목록 로드 시 `likes/` 경로를 별도로 읽지 않아도 됨

---

## 중요 규칙 / 패턴

### 팬덤 캐시 (새로고침 속도)
- `localStorage.setItem('my_fav_group', fandom)` — 새로고침 시 auth 대기 없이 즉시 로드용
- 쓰는 곳: `fandom.js updatePrimaryFandom()`, `auth.js loadAuthUserData()`, `voting-modals.js saveAuthUserData()`
- 읽는 곳: `utils.js showCommunityPage()`, `auth.js onAuthStateChanged`

### 페이지 복원 (새로고침)
- `sessionStorage.getItem('activePage')` — 'vote' | 'community'
- `init()` → `showCommunityPage()` → `localStorage my_fav_group` → `loadCommunityPosts()` 순서

### HTML 주요 ID
```
#votePage / #communityPage          — SPA 탭 전환 (.hidden 클래스)
#postDetailPage                     — 게시글 상세 (communityPage 내부)
#communityFandomSelect              — 팬덤 선택 드롭다운
#communityPostsList                 — 게시글 목록 컨테이너
#postDetailEngagement               — 좋아요/공유 버튼 영역
#postDetailManagement               — 신고/삭제 버튼 영역
#postDetailComments                 — 댓글 영역
#authContainer / #authLoggedIn      — 상단 로그인 상태 UI
#adButtonContainer                  — 상단 광고 버튼
```

### 유틸 함수
- `showToast(msg)` — 하단 알림 표시
- `escHtml(str)` / `escAttr(str)` — XSS 방지 이스케이프 (사용자 입력 렌더링 시 필수)
- `getTodayKey()` — `YYYY-MM-DD` 반환
- `getMyFav()` — `currentUserFav` 반환 (Firebase 기반)

---

## 투표 제한 규칙

```
무료 투표: 하루 1회 (cachedTodayFreeVote)
광고 투표: 하루 최대 10회 (cachedTodayAdVotes, pendingAdVotes)
총합 최대: 11표/일 (MAX_TOTAL_VOTES_PER_DAY)
```

---

## Firebase App Check

봇/스크래퍼의 무단 DB 읽기를 차단하여 대역폭 비용을 방어한다.

- **SDK**: `firebase-app-check-compat.js` (index.html에 로드됨)
- **Provider**: reCAPTCHA v3 (일반, Enterprise 아님)
- **초기화 위치**: `voting-modals.js` → `init()` 함수 내, `firebase.initializeApp()` 직후
- **사이트 키**: `6LdyUgItAAAAAKa2BT84IgauQYdHGDIqTgU0XIUK` (공개값, 코드에 포함됨)
- **로컬 개발**: `localhost`에서는 자동으로 debug token 사용 (`self.FIREBASE_APPCHECK_DEBUG_TOKEN = true`)
- **적용 모드**: ✅ **Enforce 적용됨** (Firebase Console App Check → Realtime Database 상태: 적용됨). 봇/스크래퍼 DB 읽기 완전 차단 중

```javascript
// voting-modals.js init() 내 초기화 코드 구조
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
try {
  firebase.appCheck().activate(
    new firebase.appCheck.ReCaptchaV3Provider('6LdyUgItAAAAAKa2BT84IgauQYdHGDIqTgU0XIUK'),
    true
  );
} catch (e) {
  console.warn('App Check 초기화 실패:', e.message);
}
```

---

## PWA / Service Worker

재방문 로딩 속도 개선 + 오프라인 지원.

- **SW 파일**: `docs/sw.js` (GitHub Pages / 커스텀 도메인 양쪽에서 동일하게 동작)
- **캐시 전략**:
  - `?v=` 버전태그 있는 JS/CSS → **캐시 우선** (버전 바뀌면 새 URL → 자동 갱신)
  - HTML → **네트워크 우선** + 캐시 폴백 (오프라인 시 마지막 방문 화면 표시)
  - `rankings.json` → **네트워크 우선** + 캐시 폴백 (항상 최신 랭킹)
  - Firebase / Google / Cloudinary 등 크로스 오리진 → **SW 개입 없음** (통과)
- **캐시 이름**: `fandom-battle-sw-v1` (SW 자체 수정 시 이 버전 올려야 구 캐시 정리됨)
- **매니페스트**: `docs/manifest.json` — 홈화면 설치, 테마 색상 `#7c4dff`
- **등록 위치**: `docs/index.html` 하단 `<script>` 블록 (`sw.js` 등록)

> **SW 수정 시 주의**: `CACHE_NAME` 버전을 올려야 이전 캐시가 자동 정리됨.  
> JS/CSS는 `?v=` 변경만으로 충분하므로 SW 자체 수정은 캐시 전략 변경 시에만.

---

## Cloudinary (이미지 업로드)

커뮤니티 게시글 이미지는 Cloudinary를 통해 업로드한다.

- **Cloud name**: `dhkgabcme`
- **Upload preset**: `fandom_battle_images` (unsigned preset)
- **업로드 엔드포인트**: `https://api.cloudinary.com/v1_1/dhkgabcme/image/upload`
- **저장 경로**: `community/{postId}` 폴더
- **DB 저장**: `community/{fandom}/{postId}/imageUrl` 에 Cloudinary URL 저장
- **관련 코드**: `community.js` 내 `submitPost()` 함수
- **썸네일 변환**: 게시글 목록에서는 `_getThumbUrl(imageUrl)` 로 `w_300,h_300,c_fill,q_60,f_auto` 변환 적용 (~8KB). 상세 페이지는 원본 URL 그대로 사용

---

## Firebase 보안 규칙 요약

```
rankings, group_records, monthly_history, prize_notice  → .read: true (공개)
community                                               → .read: true (공개 읽기)
likes/$fandom/$postId                                   → .read: true (공개)
comments/$fandom/$postId                                → .read: true (공개)
votes, users                                            → .read: auth != null
모든 쓰기                                               → auth != null
community 게시글 수정/삭제                               → authorUid === auth.uid 본인만 가능
likes/$fandom/$postId/$uid 쓰기                         → $uid === auth.uid 본인만
comments/$fandom/$postId/$commentId 쓰기                → authorUid === auth.uid 본인만 (신규 or 삭제)
```

보안 규칙 원본: `firebase-rules.json`

---

## 자주 수정되는 패턴

### 커뮤니티 게시글 관련 수정
→ `community.js` 메인, `index.html`의 `#postDetailPage` 구조 확인  
→ 게시글 상세 수정 후 `sessionStorage.removeItem('pd_' + postId)` 캐시 무효화 필수

### 커뮤니티 좋아요/댓글 관련 수정
→ DB 경로: `/likes/{fandom}/{postId}/` 및 `/comments/{fandom}/{postId}/`  
→ 카운터 캐시: `community/{fandom}/{postId}/likesCount`, `commentsCount` 도 함께 업데이트해야 함  
→ 댓글 `.on()` 없으므로 쓰기 후 `loadDetailComments(fandom, postId)` 수동 호출 필수

### 투표/랭킹 관련 수정
→ `voting.js` (로직) + `ranking.js` (렌더링) + `voting-modals.js` (모달)  
→ 투표 성공 후 반드시 `localVoteUpdate(group)` 호출 (CDN 폴링 대기 없이 즉시 반영)  
→ `ranking.js`에 `.on()` 추가 금지 — CF Worker / CDN 폴링 아키텍처 유지  
→ CF Worker URL 변경 시: `ranking.js` 상단 `CF_RANKINGS_WORKER_URL` 상수만 교체

### 랭킹 데이터 긴급 수동 갱신
→ GitHub Actions 탭 → `랭킹 데이터 자동 업데이트` → `Run workflow`  
→ 또는 `docs/data/rankings.json` 직접 수정 후 push (임시 방편)  
→ CF Worker는 60초 캐시이므로 최대 60초 후 자동 반영

### 로그인/인증 관련 수정
→ `auth.js` + `voting-modals.js`의 `saveAuthUserData()`

### 페이지 전환/레이아웃 관련 수정
→ `utils.js`의 `showVotePage()` / `showCommunityPage()`

### 팬덤 설정 관련 수정
→ `fandom.js` + `auth.js`의 `loadAuthUserData()`

### 커뮤니티 목록 새 기능 추가 시
→ `_renderCommunityPostList(fandom, posts)` 공통 렌더 함수 활용  
→ 게시글 쓰기/삭제 후 `_invalidatePostListCache(fandom)` 호출 추가 필수
