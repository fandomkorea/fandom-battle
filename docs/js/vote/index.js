// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 투표 시스템 (핵심)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━

let pendingAdVotes = 0; // 광고로부터 얻은 미사용 투표권 개수
let adWatchCount = 0; // 광고 시청 횟수 (0-10)

function getTodayKey()      { return new Date().toISOString().slice(0, 10); }

// ── Firebase 캐시 변수 ──
let cachedTodayFreeVote = null;   // 오늘 무료 투표한 그룹 or null
let cachedTodayAdVotes = 0;       // 오늘 사용한 광고 투표 개수 (0-10)

// ── 투표 상태 함수들 (Firebase 기반) ──
function getTodayFreeVoteCount()  { return cachedTodayFreeVote ? 1 : 0; } // 무료 투표 사용 여부 (0 or 1)
function getTodayAdVoteCount()    { return cachedTodayAdVotes; } // 광고 투표 사용 개수 (0-10)
function getTodayVoteCount()      { return getTodayFreeVoteCount() + getTodayAdVoteCount(); } // 총 투표 개수 (0-11)
function canUseFreeVote()         { return getTodayFreeVoteCount() === 0; } // 무료 투표 가능 여부
function canUseAdVotes()          { return getTodayAdVoteCount() < MAX_AD_VOTES_PER_DAY && pendingAdVotes > 0; } // 광고 투표 가능 여부
function getRemainingAdVotes()    { return MAX_AD_VOTES_PER_DAY - getTodayAdVoteCount(); } // 남은 광고 투표권 개수

// ── Firebase에서 오늘의 투표 데이터 로드 ──
async function loadTodayVotesFromFirebase() {
  if (!isLoggedIn || !currentUser || !db) return;

  const today = getTodayKey();

  // 1. 무료 투표 확인 (votes/{date}/{uid} 존재하는지 확인)
  try {
    const freeVoteSnap = await db.ref(`votes/${today}/${currentUser.uid}`).once("value");
    cachedTodayFreeVote = freeVoteSnap.exists() ? freeVoteSnap.val().group : null;
  } catch (e) {
    console.error("무료 투표 로드 실패:", e);
  }

  // 2. 광고 투표 개수 확인 (users/{uid}/ad_votes_used_{date})
  try {
    const adVotesSnap = await db.ref(`users/${currentUser.uid}/ad_votes_used_${today}`).once("value");
    cachedTodayAdVotes = adVotesSnap.val() || 0;
  } catch (e) {
    console.error("광고 투표 로드 실패:", e);
    cachedTodayAdVotes = 0;
  }

  console.log(`오늘 투표 로드: 무료=${cachedTodayFreeVote}, 광고=${cachedTodayAdVotes}`);
}

// ── 투표 스트릭 (연속 투표 일수) ──
async function updateVotingStreak() {
  if (!isLoggedIn || !currentUser || !db) return 0; // 비로그인: 스트릭 계산 안 함

  const today = getTodayKey();

  try {
    const snap = await db.ref(`users/${currentUser.uid}`).once("value");
    const data = snap.val() || {};
    const lastVoteDate = data.lastVoteDate;
    const currentStreak = data.votingStreak || 0;

    if (lastVoteDate === today) {
      // 오늘 이미 투표함
      return currentStreak;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    let newStreak = 0;
    if (lastVoteDate === yesterdayKey) {
      // 어제 투표했음 → 스트릭 계속
      newStreak = currentStreak + 1;
    } else {
      // 어제 투표 안함 → 스트릭 초기화
      newStreak = 1;
    }

    // Firebase에 저장
    await db.ref(`users/${currentUser.uid}`).update({
      votingStreak: newStreak,
      lastVoteDate: today
    });

    console.log(`[DEBUG updateVotingStreak] 스트릭 업데이트: ${newStreak}일`);
    return newStreak;
  } catch (e) {
    console.error("투표 스트릭 업데이트 실패:", e);
    return 0;
  }
}

function getVotingStreak() {
  if (!isLoggedIn || !currentUser) return 0; // 비로그인: 스트릭 없음

  const today = getTodayKey();
  const lastVoteDate = currentUser.lastVoteDate; // Firebase에서 로드됨
  const streak = currentUser.votingStreak || 0; // Firebase에서 로드됨

  // 오늘 투표하지 않았고 어제도 투표하지 않았으면 스트릭 0
  if (lastVoteDate !== today && lastVoteDate !== new Date(Date.now() - 86400000).toISOString().slice(0, 10)) {
    return 0;
  }
  return streak;
}

// ── 월 라벨 & 카운트다운 ──
function setMonthLabel() {
  const el = document.getElementById("monthLabel");
  if (!el) return;
  const now = new Date();
  el.textContent = (now.getMonth() + 1) + "월";
}

function startMonthlyCountdown() {
  if (_cdTimer) clearInterval(_cdTimer);
  function update() {
    const el = document.getElementById("countdownEl");
    if (!el) return;
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
    const diff = endOfMonth - now;
    if (diff <= 0) { el.innerHTML = "이번 달 투표 마감!"; clearInterval(_cdTimer); return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.innerHTML = `마감까지 ` + (d > 0 ? `<span>${d}일</span> ` : "") + `<span>${h}시간</span> <span>${m}분</span> <span>${s}초</span>`;
  }
  update();
  _cdTimer = setInterval(update, 1000);
}

// ── 상품 공지 리슨 ──
function listenPrizeNotice() {
  db.ref("prize_notice").on("value", snap => {
    const notice = snap.val() || "";
    const el = document.getElementById("prizeNotice");
    if (el) el.textContent = notice ? "📢 " + notice : "";
  });
}

// ── 투표 (그룹 선택) ──
async function voteForGroup(group) {
  if (!db) return;
  const meta = GROUP_META[group] || { emoji: "🌟" };

  // 비로그인 상태면 로그인 모달 띄우기
  if (!isLoggedIn) {
    showVoteLoginModal(group);
    return;
  }

  // 팬덤 변경 후 48시간 제약 확인
  if (!canVoteAfterFandomChange()) {
    return;
  }

  // 무료 투표가 아직 남아있으면 먼저 무료 투표 (우선순위 1)
  if (canUseFreeVote()) {
    try {
      // Firebase에 무료 투표 기록
      await recordUserVote(group);

      // 캐시 업데이트
      cachedTodayFreeVote = group;

      recordVote(group); // 로컬 히스토리 기록
      addActivity(group);
      const streak = updateVotingStreak();
      const streakMsg = streak > 1 ? `🔥 ${streak}일 연속 투표 중!` : "";
      showToast(meta.emoji + " " + group + " 무료 투표 완료! 1등을 향해!" + (streakMsg ? " " + streakMsg : ""));
      showConfetti(meta.color);

      // Firebase에 투표 기록 (비동기)
      db.ref("rankings/" + group).transaction(cur => (cur || 0) + 1);

      renderMyVotingHistory();
      showMyVotedBar(group);
      updateFavBar(); // 광고 바 업데이트
      updateAuthUI(); // 닉네임 옆 투표권 정보 업데이트

      // 투표 가이드 배너 숨기기
      const banner = document.getElementById("voteGuideBanner");
      if (banner) banner.style.display = "none";
      // 댓글 그룹 자동 선택
      const sel = document.getElementById("commentGroup");
      if (sel) sel.value = group;
    } catch (e) {
      console.error("무료 투표 저장 실패:", e);
      showToast("⚠️ 투표 저장에 실패했습니다. 다시 시도해주세요.");
    }

    return;
  }

  // 광고 투표 사용 가능할 때 (무료 투표 사용 후, 대기 중인 광고 투표권이 있을 때)
  if (canUseAdVotes()) {
    // Firebase에 광고 투표 기록
    const today = getTodayKey();
    const newAdVoteCount = cachedTodayAdVotes + 1;

    try {
      // Firebase에 광고 투표 개수 저장
      await db.ref(`users/${currentUser.uid}/ad_votes_used_${today}`).set(newAdVoteCount);

      // 캐시 업데이트
      cachedTodayAdVotes = newAdVoteCount;

      // 광고 투표권 차감
      pendingAdVotes -= 1;
      await savePendingAdVotes();

      recordVote(group); // 로컬 히스토리 기록
      addActivity(group);

      // Firebase에 투표 기록 (비동기)
      db.ref("rankings/" + group).transaction(cur => (cur || 0) + 1);

      const remaining = pendingAdVotes;
      showToast(`${meta.emoji} ${group} 광고 투표 완료! 광고투표 ${newAdVoteCount}/10표 🎉 ${remaining > 0 ? `(남은 투표권: ${remaining}개)` : ""}`);

      renderMyVotingHistory();
      showMyVotedBar(cachedTodayFreeVote);
      updateFavBar(); // 광고 바 상태 업데이트 (남은 투표권 표시)
      updateAuthUI(); // 닉네임 옆 투표권 정보 업데이트
    } catch (e) {
      console.error("광고 투표 저장 실패:", e);
      showToast("⚠️ 투표 저장에 실패했습니다. 다시 시도해주세요.");
    }

    return;
  }

  // 이미 모든 투표를 사용한 경우
  if (getTodayVoteCount() >= MAX_TOTAL_VOTES_PER_DAY) {
    showToast(`🏆 오늘 최대 투표 11표를 모두 사용했어요! 내일 또 와줘 💜`);
    updateFavBar();
    return;
  }

  // 광고 투표권이 없는 경우
  if (getTodayAdVoteCount() < MAX_AD_VOTES_PER_DAY && pendingAdVotes === 0) {
    showToast(`📺 광고를 보고 투표권을 얻어보세요! 광고 1회 = 투표권 9개 🎁`);
    return;
  }

  // 기타 경우
  updateFavBar();
}
