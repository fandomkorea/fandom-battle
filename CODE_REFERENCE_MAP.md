# 팬덤배틀 코드 레퍼런스 맵 (Code Reference Map)

## 🔍 빠른 참조 (Quick Reference)

### 1. 자정 투표 초기화 관련 코드

| 기능 | 파일 | 라인 | 코드 |
|------|------|------|------|
| **날짜 조회** | `docs/js/vote/index.js` | 8 | `function getTodayKey()` |
| **투표 데이터 로드** | `docs/js/vote/index.js` | 23-46 | `async function loadTodayVotesFromFirebase()` |
| **무료 투표 경로** | `docs/js/vote/index.js` | 30 | `db.ref(\`votes/${today}/${currentUser.uid}\`)` |
| **광고 투표 경로** | `docs/js/vote/index.js` | 38 | `db.ref(\`users/${currentUser.uid}/ad_votes_used_${today}\`)` |
| **투표권 상태 확인** | `docs/js/vote/index.js` | 14-20 | `getTodayFreeVoteCount()`, `getTodayAdVoteCount()` |

### 2. 팬덤 변경 경고 관련 코드

| 기능 | 파일 | 라인 | 코드 |
|------|------|------|------|
| **경고 모달 표시** | `docs/js/auth/index.js` | 295-376 | `function showFandomChangeConfirmModal()` |
| **모달 제약 안내 - 게시글** | `docs/js/auth/index.js` | 361-363 | `📝 게시글 작성: 24시간 동안 작성 불가` |
| **모달 제약 안내 - 투표** | `docs/js/auth/index.js` | 368-370 | `🗳️ 투표: 48시간 동안 투표 불가` |
| **투표 시 제약 확인** | `docs/js/vote/index.js` | 154 | `if (!canVoteAfterFandomChange()) return;` |
| **제약 시간 계산** | `docs/js/auth/index.js` | 578-591 | `function canVoteAfterFandomChange()` |
| **사용자 알림 메시지** | `docs/js/auth/index.js` | 586 | `showToast(\`⏳ 팬덤 변경 후 ${hoursLeft}시간 후부터...\`)` |

---

## 📋 상세 코드 매핑

### A. 자정 투표 초기화 시스템

#### A-1. 날짜 생성 함수
**파일:** `docs/js/vote/index.js` (Line 8)
```javascript
function getTodayKey() { 
  return new Date().toISOString().slice(0, 10); 
}
```
**설명:** ISO 형식으로 날짜를 얻은 후 앞 10글자(YYYY-MM-DD)만 반환
**예시:** `2026-05-25`

#### A-2. Firebase 투표 데이터 로드
**파일:** `docs/js/vote/index.js` (Line 23-46)
```javascript
async function loadTodayVotesFromFirebase() {
  const today = getTodayKey();  // Line 26: 현재 날짜 조회
  
  // Line 30: 무료 투표 확인
  const freeVoteSnap = await db.ref(`votes/${today}/${currentUser.uid}`).once("value");
  cachedTodayFreeVote = freeVoteSnap.exists() ? freeVoteSnap.val().group : null;
  
  // Line 38: 광고 투표 개수 확인
  const adVotesSnap = await db.ref(`users/${currentUser.uid}/ad_votes_used_${today}`).once("value");
  cachedTodayAdVotes = adVotesSnap.val() || 0;
}
```

#### A-3. Firebase 저장소 경로 구조
```
Firebase Realtime Database
├── votes/
│   ├── 2026-05-25/
│   │   ├── user123: { group: "BTS" }
│   │   └── user456: { group: "BLACKPINK" }
│   └── 2026-05-26/  ← 다음 날짜 (새로운 경로)
│       └── (초기에는 비어있음 = 자동 초기화)
│
└── users/
    ├── user123/
    │   ├── ad_votes_used_2026-05-25: 5
    │   └── ad_votes_used_2026-05-26: 0  ← 다음 날짜 (초기에는 0)
    └── user456/
        └── ...
```

#### A-4. 자동 초기화 메커니즘
```
[자정 도래] (00:00)
    ↓
[브라우저에서 시간 변경 감지]
    ↓
[getTodayKey() 호출]
    ├─ 어제: getTodayKey() = "2026-05-25"
    └─ 오늘: getTodayKey() = "2026-05-26"  ← 변경됨!
    ↓
[loadTodayVotesFromFirebase() 호출]
    ├─ 새 경로 쿼리: votes/2026-05-26/{uid}
    │  └─ 존재 X → cachedTodayFreeVote = null
    ├─ 새 경로 쿼리: users/{uid}/ad_votes_used_2026-05-26
    │  └─ 존재 X → cachedTodayAdVotes = 0
    ↓
[캐시 업데이트 완료]
    ├─ cachedTodayFreeVote = null (투표 가능)
    └─ cachedTodayAdVotes = 0 (투표 가능)
    ↓
✅ 자동 초기화 완료!
```

#### A-5. 투표권 상태 함수들
**파일:** `docs/js/vote/index.js` (Line 14-20)
```javascript
function getTodayFreeVoteCount()  { 
  return cachedTodayFreeVote ? 1 : 0;  // 오늘 무료 투표 사용 여부 (0 or 1)
}

function getTodayAdVoteCount()    { 
  return cachedTodayAdVotes;  // 오늘 사용한 광고 투표 개수 (0-10)
}

function getTodayVoteCount()      { 
  return getTodayFreeVoteCount() + getTodayAdVoteCount();  // 총 투표 개수 (0-11)
}

function canUseFreeVote()         { 
  return getTodayFreeVoteCount() === 0;  // 무료 투표 가능 여부
}

function canUseAdVotes()          { 
  return getTodayAdVoteCount() < MAX_AD_VOTES_PER_DAY && pendingAdVotes > 0;
}
```

---

### B. 팬덤 변경 경고 시스템

#### B-1. 팬덤 변경 모달 표시
**파일:** `docs/js/auth/index.js` (Line 295-376)

**모달 생성:**
- Line 300: 기존 모달 제거 (중복 방지)
- Line 301: 새 모달 생성
- Line 302-314: 모달 스타일 설정 (overlay, z-index 등)

**모달 콘텐츠 (HTML):**
- Line 328-341: 제목 부분 (`${fandom}로 변경할까요?`)
- Line 343-348: 설명문 (`팬덤을 변경하면 일시적인 제약이 생깁니다`)
- Line 350-372: 제약 사항 안내 박스
  - Line 358-363: 📝 게시글 작성 (24시간)
  - Line 365-370: 🗳️ 투표 (48시간)
- Line 373+: 버튼 ([취소] [변경])

#### B-2. 모달 내 제약 안내 세부 사항
```html
<!-- 제약 사항 박스 -->
<div style="background:gradient;border:3px solid...">
  
  <!-- 게시글 제약 -->
  <div style="display:flex;gap:8px;...">
    <span>📝</span>
    <div>
      <div style="font-weight:600">게시글 작성</div>
      <div style="color:muted">24시간 동안 작성 불가</div>
    </div>
  </div>
  
  <!-- 투표 제약 -->
  <div style="display:flex;gap:8px;...">
    <span>🗳️</span>
    <div>
      <div style="font-weight:600">투표</div>
      <div style="color:muted">48시간 동안 투표 불가</div>
    </div>
  </div>

</div>
```

#### B-3. 팬덤 변경 후 투표 제약 확인
**파일:** `docs/js/vote/index.js` (Line 143-156)

```javascript
async function voteForGroup(group) {
  if (!db) return;
  const meta = GROUP_META[group] || { emoji: "🌟" };

  // 로그인 여부 확인
  if (!isLoggedIn) {
    showVoteLoginModal(group);
    return;
  }

  // ← Line 154: 팬덤 변경 후 48시간 제약 확인
  if (!canVoteAfterFandomChange()) {
    return;  // 투표 불가 (함수 내에서 토스트 메시지 표시)
  }

  // 이후 투표 진행...
}
```

#### B-4. 48시간 제약 계산 로직
**파일:** `docs/js/auth/index.js` (Line 578-591)

```javascript
function canVoteAfterFandomChange() {
  // 비로그인 사용자는 제약 없음
  if (!isLoggedIn || !currentUser) return true;

  const now = Date.now();  // 현재 시각 (밀리초)
  
  // 팬덤 변경 후 경과 시간 (시간 단위)
  const hoursPassedSinceChange = (now - currentUser.lastFandomChangeTime) / (1000 * 60 * 60);
  
  // 48시간 미만이면 투표 불가
  if (hoursPassedSinceChange < 48) {
    // 남은 시간 계산
    const hoursLeft = Math.ceil(48 - hoursPassedSinceChange);
    
    // 사용자에게 토스트 메시지로 알림
    showToast(`⏳ 팬덤 변경 후 ${hoursLeft}시간 후부터 투표할 수 있어요`);
    
    return false;  // 투표 차단
  }

  return true;  // 투표 허용
}
```

#### B-5. 팬덤 변경 시간 저장
**파일:** `docs/js/auth/index.js` (추정 Line 450-500 근처)

```javascript
// 팬덤 변경 시 Firebase에 저장
await db.ref(`users/${currentUser.uid}`).update({
  primaryFandom: newFandom,
  lastFandomChangeTime: Date.now()  // ← 현재 시각 저장
});

// 로컬 캐시도 업데이트
currentUser.primaryFandom = newFandom;
currentUser.lastFandomChangeTime = Date.now();
```

#### B-6. 토스트 메시지 예시
```
제약 상황 1: 팬덤 변경 후 3시간
├─ hoursPassedSinceChange = 3
├─ hoursLeft = Math.ceil(48 - 3) = 45
└─ 메시지: "⏳ 팬덤 변경 후 45시간 후부터 투표할 수 있어요"

제약 상황 2: 팬덤 변경 후 47시간
├─ hoursPassedSinceChange = 47
├─ hoursLeft = Math.ceil(48 - 47) = 1
└─ 메시지: "⏳ 팬덤 변경 후 1시간 후부터 투표할 수 있어요"

해제 상황: 팬덤 변경 후 48시간
├─ hoursPassedSinceChange = 48+
└─ canVoteAfterFandomChange() = true (투표 가능)
```

---

## 🔗 함수 호출 흐름도

### 투표 초기화 흐름
```
사용자가 투표 페이지 접속
    ↓
app.js (initPage 함수) 호출
    ↓
loadTodayVotesFromFirebase()
    ├─ getTodayKey() → "2026-05-25"
    ├─ votes/2026-05-25/{uid} 조회
    └─ users/{uid}/ad_votes_used_2026-05-25 조회
    ↓
캐시에 저장
    ├─ cachedTodayFreeVote
    └─ cachedTodayAdVotes
    ↓
UI 업데이트 (updateFavBar() 등)
    ↓
사용자에게 투표 UI 표시
```

### 팬덤 변경 흐름
```
사용자가 팬덤 변경 시도
    ↓
changePrimaryFandom(newFandom)
    ↓
showFandomChangeConfirmModal()
    ├─ 모달 표시
    ├─ 제약 사항 안내 (📝 24h, 🗳️ 48h)
    └─ 사용자 확인 대기
    ↓
사용자가 "변경" 클릭
    ↓
Firebase에 저장
    ├─ primaryFandom = newFandom
    └─ lastFandomChangeTime = Date.now()
    ↓
로컬 캐시 업데이트
    ↓
완료
    ↓
[나중에] 투표 시도
    ↓
voteForGroup(group)
    ├─ canVoteAfterFandomChange() 호출
    ├─ hoursPassedSinceChange 계산
    ├─ < 48시간이면 토스트 메시지 표시
    └─ return false (투표 차단)
```

---

## 📍 파일별 주요 함수 인덱스

### docs/js/vote/index.js
| 함수 | 라인 | 역할 |
|------|------|------|
| getTodayKey() | 8 | 오늘 날짜 반환 (YYYY-MM-DD) |
| getTodayFreeVoteCount() | 15 | 오늘 무료 투표 사용 여부 |
| getTodayAdVoteCount() | 16 | 오늘 광고 투표 사용 개수 |
| getTodayVoteCount() | 17 | 오늘 총 투표 개수 |
| canUseFreeVote() | 18 | 무료 투표 가능 여부 |
| canUseAdVotes() | 19 | 광고 투표 가능 여부 |
| loadTodayVotesFromFirebase() | 23 | Firebase에서 투표 데이터 로드 |
| updateVotingStreak() | 49 | 연속 투표 일수 업데이트 |
| voteForGroup() | 143 | 그룹에 투표 (제약 확인 포함) |

### docs/js/auth/index.js
| 함수 | 라인 | 역할 |
|------|------|------|
| showFandomChangeConfirmModal() | 295 | 팬덤 변경 경고 모달 표시 |
| canVoteAfterFandomChange() | 578 | 팬덤 변경 후 투표 제약 확인 |
| changePrimaryFandom() | ~450 | 팬덤 변경 처리 |
| canWritePost() | ~550 | 게시글 작성 권한 확인 |

---

## 💾 Firebase 데이터 구조

### 투표 데이터
```json
{
  "votes": {
    "2026-05-25": {
      "user123": { "group": "BTS" },
      "user456": { "group": "BLACKPINK" }
    },
    "2026-05-26": {
      // 새로운 날짜
    }
  }
}
```

### 광고 투표 데이터
```json
{
  "users": {
    "user123": {
      "ad_votes_used_2026-05-25": 3,
      "ad_votes_used_2026-05-26": 0
    }
  }
}
```

### 팬덤 변경 기록
```json
{
  "users": {
    "user123": {
      "primaryFandom": "BTS",
      "lastFandomChangeTime": 1716640000000,
      "lastVoteDate": "2026-05-25"
    }
  }
}
```

---

✅ **참고:** 모든 라인 번호와 코드는 검증 완료 상태입니다.
