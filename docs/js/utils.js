// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 유틸리티 함수들
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Toast 메시지 표시
function showToast(message) {
  const existing = document.querySelector(".toast.show");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 상대 시간 표시 ("5분 전" 형식)
function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

// 오늘의 키값 (YYYY-MM-DD)
function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

// 투표권 계산 함수들
function getTodayFreeVoteCount() {
  return cachedTodayFreeVote ? 1 : 0;
}

function getTodayAdVoteCount() {
  return cachedTodayAdVotes;
}

function getTodayVoteCount() {
  return getTodayFreeVoteCount() + getTodayAdVoteCount();
}

function canUseFreeVote() {
  return getTodayFreeVoteCount() === 0;
}

function canUseAdVotes() {
  return getTodayAdVoteCount() < MAX_AD_VOTES_PER_DAY && pendingAdVotes > 0;
}

function getRemainingAdVotes() {
  return MAX_AD_VOTES_PER_DAY - getTodayAdVoteCount();
}

// 최애팬덤 조회
function getMyFav() {
  return currentUserFav;
}

// 최애팬덤 설정
function setMyFav(fandom) {
  if (!fandom || !GROUP_META[fandom]) return;
  currentUserFav = fandom;
}

// 닉네임 설정
function anonName() {
  if (isLoggedIn && currentUser && currentUser.customNickname) {
    return currentUser.customNickname;
  }
  return localStorage.getItem("my_nick") || "익명";
}

// 최애팬덤 변경 가능 여부 확인
function canChangeFandom() {
  if (!isLoggedIn || !currentUser) return true;

  const lastChange = currentUser.lastFandomChangeTime || 0;
  const now = Date.now();
  return now - lastChange > 24 * 60 * 60 * 1000;
}

// 게시글 작성 가능 여부 확인
function canWritePost(selectedFandom) {
  if (!isLoggedIn || !currentUser) return false;

  // 자신의 팬덤에서만 작성 가능
  if (currentUser.primaryFandom !== selectedFandom) {
    return false;
  }

  // 팬덤 변경 후 24시간 제약
  const lastChange = currentUser.lastFandomChangeTime || 0;
  const now = Date.now();
  const canWrite = now - lastChange > 24 * 60 * 60 * 1000;

  return canWrite;
}

// 투표 가능 여부 확인 (팬덤 변경 후 48시간)
function canVoteAfterFandomChange() {
  if (!isLoggedIn || !currentUser) return true;

  const lastChange = currentUser.lastFandomChangeTime || 0;
  const now = Date.now();
  return now - lastChange > 48 * 60 * 60 * 1000;
}

// 팬덤 설정 팝업 표시/숨김
function showFandomSetupPopup() {
  const popup = document.getElementById("fandomSetupPopup");
  if (popup) popup.style.display = "flex";
}

function closeFandomSetupPopup() {
  const popup = document.getElementById("fandomSetupPopup");
  if (popup) popup.style.display = "none";
}

// 색상 설정
function applyGroupColor(group) {
  const meta = GROUP_META[group];
  if (meta && meta.color) {
    document.documentElement.style.setProperty("--primary", meta.color);
  }
}

// 쿼리 파라미터 처리
function getShareRef() {
  const params = new URLSearchParams(location.search);
  return params.get("ref");
}

function handleShareRef() {
  const ref = getShareRef();
  if (ref) {
    setTimeout(() => scrollToMyGroup(ref), 500);
  }
}
