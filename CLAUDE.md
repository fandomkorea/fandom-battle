# 팬덤배틀 프로젝트 — Claude 참조 문서

## 프로젝트 개요

K-pop 팬덤 투표 + 커뮤니티 SPA (Single Page Application).  
Firebase Realtime Database + Firebase Auth 기반. 배포: GitHub Pages.  
단일 HTML 파일(`docs/index.html`)에 두 탭(투표 / 커뮤니티)이 JS로 전환되는 구조.

---

## 파일 역할

| 파일 | 역할 |
|---|---|
| `docs/index.html` | 유일한 HTML 파일. 모든 UI 뼈대 포함. script는 파일 하단에 순서대로 로드 |
| `docs/js/config.js` | Firebase 설정, `GROUP_META`(그룹 이모지/색상/팬덤명), `ALL_GROUPS`, `db`, `allRankingsData` 전역 선언 |
| `docs/js/auth.js` | Google/Twitter/Apple 로그인, `onAuthStateChanged`, `loadUserAdVotes()`, `loadAuthUserData()`, `updateAuthUI()` |
| `docs/js/voting.js` | 투표 로직, 투표 제한 상수, `loadTodayVotesFromFirebase()`, `proceedWithVote()`, `voteForGroup()` |
| `docs/js/voting-modals.js` | **`init()` 포함 (앱 진입점)**. 광고 보상 모달, 신규가입 `saveAuthUserData()`, 투표 관련 모달 |
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
  likes/{uid}: true                     — 좋아요
  comments/{commentId}/
    content, authorUid, authorNickname, timestamp
    likes/{uid}: true                   — 댓글 좋아요

/group_records/{groupName}             — 그룹별 통계 기록 (read-only)
/monthly_history/{month}              — 월별 랭킹 히스토리
/prize_notice/                        — 경품 공지
```

---

## 중요 규칙 / 패턴

### Firebase 읽기 정책
- **커뮤니티**: `.once()` 사용 (읽기 횟수 절감 목적). `.on()` 절대 사용 금지
- **랭킹**: `.on()` 사용 (실시간 업데이트 필요)
- 나머지: 모두 `.once()`

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

## Firebase 보안 규칙 요약

```
rankings, group_records, monthly_history, prize_notice  → .read: true (공개)
community                                               → .read: true (공개 읽기)
votes, users                                            → .read: auth != null
모든 쓰기                                               → auth != null
community 게시글 수정/삭제                               → authorUid === auth.uid 본인만 가능
```

---

## 자주 수정되는 패턴

### 커뮤니티 게시글 관련 수정
→ `community.js` 메인, `index.html`의 `#postDetailPage` 구조 확인

### 투표/랭킹 관련 수정
→ `voting.js` (로직) + `ranking.js` (렌더링) + `voting-modals.js` (모달)

### 로그인/인증 관련 수정
→ `auth.js` + `voting-modals.js`의 `saveAuthUserData()`

### 페이지 전환/레이아웃 관련 수정
→ `utils.js`의 `showVotePage()` / `showCommunityPage()`

### 팬덤 설정 관련 수정
→ `fandom.js` + `auth.js`의 `loadAuthUserData()`
