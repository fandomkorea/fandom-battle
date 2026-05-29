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
| `docs/js/ranking.js` | 랭킹 실시간 리슨 (`rankings` 경로 `.on()`), `renderRankings()`, 트렌딩 감지 |
| `docs/js/utils.js` | 페이지 전환 `showVotePage()` / `showCommunityPage()`, `showToast()`, `getMyFav()` / `setMyFav()`, 팬덤바, 공유 |
| `docs/js/fandom.js` | 최애 팬덤 설정/변경 모달, `updatePrimaryFandom()`, `checkFandomWritePermission()` |
| `docs/js/community.js` | 커뮤니티 게시글/댓글 CRUD, `loadCommunityPosts()`, `showPostDetail()`, `toggleLike()`, `toggleCommentLike()` |

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
<script src="js/community.js?v=20260602c"></script>  <!-- 이전 -->
<script src="js/community.js?v=20260602d"></script>  <!-- 수정 후 (알파벳 한 칸 올림) -->
```

버전 규칙: `YYYYMMDD` + 알파벳 suffix (`a`, `b`, `c`, ... 같은 날 여러 번 수정 시 올림)

현재 버전 현황 (`docs/index.html` 기준):
| 파일 | 현재 버전 |
|---|---|
| `css/posts.css` | v=20260529b |
| `js/config.js` | v=20260609 |
| `js/auth.js` | v=20260529j |
| `js/fandom.js` | v=20260602a |
| `js/voting-modals.js` | v=20260602d |
| `js/voting.js` | v=20260529a |
| `js/ranking.js` | v=20260529f |
| `js/utils.js` | v=20260529e |
| `js/community.js` | v=20260602c |

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

Firebase Realtime Database는 **다운로드 대역폭 기준 과금**이다. 읽기 1회가 작아도 대규모 트래픽에선 폭발적으로 늘어난다. 아래 규칙을 반드시 지킬 것.

### 읽기 정책
- **커뮤니티**: `.once()` 만 사용. **`.on()` 절대 사용 금지** (구독 = 변경마다 전체 다운로드)
- **랭킹**: `.on()` 사용 (실시간 업데이트 필수라 예외)
- **나머지**: 모두 `.once()`

### 게시글 목록 로드
- `loadCommunityPosts()` 는 항상 `.orderByChild('timestamp').limitToLast(30)` 적용
- 전체 데이터를 한 번에 읽지 말 것. 페이지네이션 or 제한 쿼리 필수

### 게시글 상세 (`showPostDetail()`)
- 열람 중인 게시글은 `currentViewingPost` 캐시에 저장
- 알림 함수(`sendCommentNotification`, `sendLikeNotification`)에서 게시글 다시 읽기 전 캐시 확인
- 같은 게시글이면 DB 재읽기 없이 캐시 데이터 사용

### 조회수 쓰기 (view count)
- `sessionStorage`로 중복 방지: `viewed_${postId}` 키가 있으면 transaction 생략
- 같은 세션에서 같은 글을 여러 번 열어도 조회수는 1회만 증가

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
- **적용 모드**: 현재 모니터링 모드(metrics 수집). Firebase Console → App Check → API 탭에서 검증률 85%+ 확인 후 Enforce 전환 가능

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

## Cloudinary (이미지 업로드)

커뮤니티 게시글 이미지는 Cloudinary를 통해 업로드한다.

- **Cloud name**: `dhkgabcme`
- **Upload preset**: `fandom_battle_images` (unsigned preset)
- **업로드 엔드포인트**: `https://api.cloudinary.com/v1_1/dhkgabcme/image/upload`
- **저장 경로**: `community/{postId}` 폴더
- **DB 저장**: `community/{fandom}/{postId}/imageUrl` 에 Cloudinary URL 저장
- **관련 코드**: `community.js` 내 `submitPost()` 함수

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

### 커뮤니티 좋아요/댓글 관련 수정
→ DB 경로: `/likes/{fandom}/{postId}/` 및 `/comments/{fandom}/{postId}/`  
→ 카운터 캐시: `community/{fandom}/{postId}/likesCount`, `commentsCount` 도 함께 업데이트해야 함

### 투표/랭킹 관련 수정
→ `voting.js` (로직) + `ranking.js` (렌더링) + `voting-modals.js` (모달)

### 로그인/인증 관련 수정
→ `auth.js` + `voting-modals.js`의 `saveAuthUserData()`

### 페이지 전환/레이아웃 관련 수정
→ `utils.js`의 `showVotePage()` / `showCommunityPage()`

### 팬덤 설정 관련 수정
→ `fandom.js` + `auth.js`의 `loadAuthUserData()`
