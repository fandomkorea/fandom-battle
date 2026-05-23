# 팬덤배틀 투표 시스템 수정 기록

## 📋 문제 상황
- **버그**: 광고 2회 시청 후 투표 시 "11/10" 표시 + 광고 버튼 비활성화
- **원인**: 무료 투표(1표)와 광고 투표(10표)를 구분하지 않고 모두 합산하여 처리
- **결과**: MAX_VOTES_PER_DAY=10으로 설정되어 총 11표 사용 불가능

## 🔧 수정 사항

### 1. 상수 및 함수 정의 변경 (라인 1264-1282)

**이전:**
```javascript
const MAX_VOTES_PER_DAY = 10;
function getTodayVoteCount() { return (getMyVote() ? 1 : 0) + getExtraVotes(); }
function canVoteMore() { return getTodayVoteCount() < MAX_VOTES_PER_DAY; }
```

**변경 후:**
```javascript
const MAX_FREE_VOTES_PER_DAY = 1;        // 무료 투표: 1표/일
const MAX_AD_VOTES_PER_DAY = 10;         // 광고 투표: 10표/일
const MAX_TOTAL_VOTES_PER_DAY = 11;      // 총계: 11표/일

// 새로운 함수들
function getTodayFreeVoteCount()  { return getMyVote() ? 1 : 0; }
function getTodayAdVoteCount()    { return getExtraVotes(); }
function getTodayVoteCount()      { return getTodayFreeVoteCount() + getTodayAdVoteCount(); }
function canUseFreeVote()         { return getTodayFreeVoteCount() === 0; }
function canUseAdVotes()          { return getTodayAdVoteCount() < MAX_AD_VOTES_PER_DAY && pendingAdVotes > 0; }
function getRemainingAdVotes()    { return MAX_AD_VOTES_PER_DAY - getTodayAdVoteCount(); }
```

### 2. voteForGroup() 함수 수정 (라인 1360-1443)

**변경 내용:**
- 광고 투표와 무료 투표를 완전히 분리한 로직
- 우선순위: 광고 투표 > 무료 투표
- 각 투표 타입별로 별도의 메시지 출력

**핵심 흐름:**
```
1. 광고 투표 가능? → 광고 투표 실행
   - Toast: "광고투표 X/10표 🎉"
   
2. 무료 투표 가능? → 무료 투표 실행
   - Toast: "무료 투표 완료! 1등을 향해!"
   
3. 총 11표 사용 완료? → 축하 메시지
   
4. 투표권 없음? → 광고 시청 권유
```

### 3. watchAd() 함수 수정 (라인 1540-1570)

**변경 내용:**
- 이전: `canVoteMore()` 체크 (MAX_VOTES_PER_DAY=10 기준)
- 변경: 
  - 총 투표 11표 완료 시에만 광고 시청 불가
  - 광고 10회 시청(90개 투표권) 도달 시에만 광고 시청 불가

```javascript
// 총 투표를 모두 사용한 경우 광고 시청 불가
if (getTodayVoteCount() >= MAX_TOTAL_VOTES_PER_DAY) { ... }

// 광고를 10번 이상 본 경우
const adWatchCount = Math.floor(pendingAdVotes / 9);
if (adWatchCount >= MAX_AD_VOTES_PER_DAY) { ... }
```

### 4. showMyVotedBar() 함수 수정 (라인 1490-1491)

**변경:**
- `MAX_VOTES_PER_DAY` → `MAX_TOTAL_VOTES_PER_DAY` (11로 변경)
- 모든 투표 사용 시 메시지 업데이트

### 5. updateFavBar() 함수 완전 재설계 (라인 2433-2456)

**변경 전 로직 (문제):**
- 무료 투표 우선순위가 가장 높아서 광고 투표권이 있어도 무료 투표 버튼만 표시

**변경 후 로직 (수정):**
1. **모든 투표 완료** → 축하 메시지 "🏆 11표 완투!"
2. **광고 투표권 있음** → 광고 투표 버튼 "🎁 투표권 X개"
3. **무료 투표 가능** → 무료 투표 버튼 "🎁 무료 투표"
4. **둘 다 없음** → 광고 시청 버튼 "📺 광고 시청"

```javascript
if (totalVoteCount >= MAX_TOTAL_VOTES_PER_DAY) {
  // 축하 메시지
} else if (pendingAdVotes > 0 && adVoteCount < MAX_AD_VOTES_PER_DAY) {
  // 광고 투표 버튼 (우선순위 1)
} else if (canUseFreeVote()) {
  // 무료 투표 버튼 (우선순위 2)
} else {
  // 광고 시청 버튼 (우선순위 3)
}
```

## ✅ 수정 후 예상 동작

### 시나리오 1: 광고 2회 시청 후 투표
1. 광고 시청 1회: `pendingAdVotes = 9`
2. 광고 시청 2회: `pendingAdVotes = 18`
3. 투표 클릭:
   - `canUseAdVotes()` = true (0 < 10 && 18 > 0)
   - 광고 투표 실행
   - extra_votes = 1, pendingAdVotes = 17
   - Toast: "광고투표 1/10표 🎉 (남은 투표권: 17개)"
   - 팬덤 바 버튼: "🎁 투표권 17개 · 투표하기"

### 시나리오 2: 광고 10회 시청 후 추가 시청 시도
1. pendingAdVotes = 90 (9 × 10회)
2. adWatchCount = 10
3. 광고 시청 버튼 클릭:
   - "🎁 광고 시청은 하루 최대 10회까지 가능해요!"

### 시나리오 3: 무료 1 + 광고 10 = 11표 모두 사용
1. 투표 상태: free=1, ad=10
2. 팬덤 바: "🏆 11표 완투! 내일 또 와줘!"
3. 광고 버튼 클릭 불가

## 📊 데이터 구조

```
로컬스토리지:
- voted_group_YYYY-MM-DD: "TeamName"           # 무료 투표 (null = 미사용)
- extra_votes_YYYY-MM-DD: "0-10"               # 광고 투표 개수

메모리:
- pendingAdVotes: 0-90                         # 아직 사용하지 않은 광고 투표권 (9의 배수)

Firebase:
- rankings/{team}: 1,234                       # 총 투표수 (free + ad 합산)
- users/{uid}/pendingAdVotes: 0-90             # 동기화용 저장소
```

## 🧪 테스트 체크리스트

- [ ] 광고 시청 후 투표 가능한지 확인
- [ ] 광고 투표 10회 후 더 이상 투표 불가인지 확인
- [ ] 무료 투표 후 광고 투표 가능한지 확인
- [ ] 팬덤 선택 바의 버튼 상태가 올바르게 변경되는지 확인
- [ ] Toast 메시지가 올바르게 표시되는지 확인
- [ ] 다른 기기에서 로그인할 때 투표권 동기화 확인
- [ ] Firebase 랭킹 데이터가 올바르게 업데이트되는지 확인

## 🔒 보안 포인트

✅ 무료 투표는 Firebase의 votes/{date}/{uid}로 기록 (한 번만 가능)
✅ 광고 투표는 extra_votes로 제한 (최대 10회)
✅ pendingAdVotes는 Firebase에서 관리하여 다중 기기 동기화
✅ 모든 투표는 Firebase transaction으로 안전하게 증가

## 📝 주의사항

⚠️ localStorage의 `extra_votes_`는 투표 완료 후 자동으로 증가합니다.
⚠️ `pendingAdVotes`는 광고 시청 시 +9, 투표 시 -1로 감소합니다.
⚠️ 일일 자정(00:00)을 기준으로 localStorage 키가 변경되어 자동 리셋됩니다.
