let pendingAdVotes = 0; // 광고로부터 얻은 미사용 투표권 개수
let adWatchCount = 0; // ★ 광고 시청 횟수 (0-10)

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

  // ★ 팬덤 변경 후 48시간 제약 확인
  if (!canVoteAfterFandomChange()) {
    return;
  }

  // ★ 무료 투표가 아직 남아있으면 먼저 무료 투표 (우선순위 1)
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
      updateAuthUI(); // ★ 닉네임 옆 투표권 정보 업데이트

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

    // listenRankings()에서 자동으로 Firebase 데이터 감지 후 renderRankings() 호출
    return;
  }

  // ★ 광고 투표 사용 가능할 때 (무료 투표 사용 후, 대기 중인 광고 투표권이 있을 때)
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
      updateAuthUI(); // ★ 닉네임 옆 투표권 정보 업데이트
    } catch (e) {
      console.error("광고 투표 저장 실패:", e);
      showToast("⚠️ 투표 저장에 실패했습니다. 다시 시도해주세요.");
    }

    // listenRankings()에서 자동으로 Firebase 데이터 감지 후 renderRankings() 호출
    return;
  }

  // ★ 이미 모든 투표를 사용한 경우
  if (getTodayVoteCount() >= MAX_TOTAL_VOTES_PER_DAY) {
    showToast(`🏆 오늘 최대 투표 11표를 모두 사용했어요! 내일 또 와줘 💜`);
    updateFavBar();
    return;
  }

  // ★ 광고 투표권이 없는 경우
  if (getTodayAdVoteCount() < MAX_AD_VOTES_PER_DAY && pendingAdVotes === 0) {
    showToast(`📺 광고를 보고 투표권을 얻어보세요! 광고 1회 = 투표권 9개 🎁`);
    return;
  }

  // 기타 경우
  updateFavBar();
}

// ── 투표 후 상단 바 표시 ──
function showMyVotedBar(group) {
  const bar = document.getElementById("myVotedBar");
  const msgEl = document.getElementById("myVotedMsg");
  const subEl = document.getElementById("myVotedSub");
  if (!bar || !msgEl || !subEl || !group) return;
  const meta = GROUP_META[group] || { emoji: "🌟" };
  const rankData = allRankingsData || {};
  const total = Object.values(rankData).reduce((s, v) => s + v, 0);
  const myVotes = rankData[group] || 0;
  const pct = total ? Math.round(myVotes / total * 100) : 0;
  const streak = getVotingStreak();

  // 현재 순위 계산
  const sorted = Object.entries(rankData).sort((a, b) => b[1] - a[1]);
  const myRank = sorted.findIndex(([g]) => g === group) + 1;

  // 순위별 감성 메시지
  let msg, sub;
  const streakDisplay = streak > 1 ? ` 🔥 ${streak}일 연속!` : "";
  if (myRank === 1 && myVotes > 0) {
    msg = `👑 ${meta.emoji} ${group} 현재 1위! 이 기세 유지하자!${streakDisplay}`;
    sub = `현재 ${pct}% (${myVotes.toLocaleString()}표) · 친구 불러서 격차 벌리자! 💪`;
  } else if (myRank === 2 || myRank === 3) {
    const leader = sorted[0];
    const gap = leader ? (leader[1] - myVotes) : 0;
    msg = `🔥 ${meta.emoji} ${group} ${myRank}위! 1위까지 ${gap.toLocaleString()}표 차이!${streakDisplay}`;
    sub = `현재 ${pct}% · 지금 공유해서 역전 노려봐! 📢`;
  } else if (myVotes === 0 || total === 0) {
    msg = `${meta.emoji} ${group} 투표 완료! 첫 표를 던졌어!${streakDisplay}`;
    sub = `친구한테도 알려서 우리 팀 1위 만들자! 💜`;
  } else {
    msg = `${meta.emoji} ${group} 투표 완료! 현재 ${myRank}위 · ${pct}%${streakDisplay}`;
    sub = `${myVotes.toLocaleString()}표 · 친구 불러서 순위 올리자! 🚀`;
  }

  // 내일 투표 가능 시간
  const now = new Date(); const next = new Date(now);
  next.setDate(next.getDate() + 1); next.setHours(0, 0, 0, 0);
  const diff = next - now;
  const h = Math.floor(diff / 3600000); const m = Math.floor((diff % 3600000) / 60000);
  const todayCount = getTodayVoteCount();

  // 모든 투표를 사용한 경우 특별 메시지
  if (todayCount >= MAX_TOTAL_VOTES_PER_DAY) {
    sub = `🏆 오늘 최대 투표 ${MAX_TOTAL_VOTES_PER_DAY}/${MAX_TOTAL_VOTES_PER_DAY}표 모두 사용! 대단해! 💪`;
    sub += `<br style="height:4px"> ⏰ 내일 ${h}시간 ${m}분 후 다시 투표할 수 있어요!`;
  } else {
    sub += `  ⏰ ${h}시간 ${m}분 후 재투표`;
  }

  msgEl.textContent = msg;
  subEl.textContent = sub;

  // 팬덤 선택 바 업데이트 (광고 버튼 상태 포함)
  updateFavBar();

  // 친구 초대 권유 배너
  let shareCtaEl = document.getElementById("shareCtaBar");
  if (!shareCtaEl) {
    shareCtaEl = document.createElement("div");
    shareCtaEl.id = "shareCtaBar";
    shareCtaEl.style.cssText = "margin-top:10px;padding:10px 12px;border-radius:10px;background:linear-gradient(135deg,rgba(255,77,141,0.12),rgba(124,77,255,0.1));border:1px solid rgba(255,77,141,0.3);font-size:.8rem;text-align:center;color:var(--pink);font-weight:700;cursor:pointer;transition:all 0.15s";
    shareCtaEl.onclick = shareNative;
    bar.insertBefore(shareCtaEl, bar.lastElementChild);
  }
  shareCtaEl.innerHTML = `🌟 지금 공유하면 우리 팀이 1위 될 확률 UP! 친구들을 초대해봐 ${meta.emoji} 💪`;

  bar.style.display = "block";
}

// ── 광고 버튼 항상 표시 ──
function showAdButtonAlways() {
  const adCtaEl = document.getElementById("adVoteCta");
  if (!adCtaEl) return;

  adCtaEl.innerHTML = `📺 광고보기 • 9표 투표하기`;
  adCtaEl.disabled = false;
  adCtaEl.onclick = watchAdWithLoginCheck;
  adCtaEl.style.display = "flex";
}

// ── 로그인 여부 확인 후 광고 시청 ──
function watchAdWithLoginCheck() {
  if (!isLoggedIn) {
    showToast("🔐 광고를 보시려면 로그인이 필요합니다!");
    showVoteLoginModal(null); // 로그인 모달만 띄우기
    return;
  }

  // 기존 광고 시청 로직
  watchAd();
}

// ── 광고 시청 → 추가 투표권 ──
function watchAd() {
  // 총 투표를 모두 사용한 경우 광고 시청 불가
  if (getTodayVoteCount() >= MAX_TOTAL_VOTES_PER_DAY) {
    showToast(`🏆 오늘 최대 투표 11표를 모두 사용했어요! 내일 또 와줘 💜`);
    return;
  }

  // ★ 광고를 10번 이상 본 경우
  if (adWatchCount >= MAX_AD_VOTES_PER_DAY) {
    showToast(`🎁 광고 시청은 하루 최대 10회까지 가능해요! (현재: ${adWatchCount}회 시청, ${pendingAdVotes}개 투표권 보유)`);
    return;
  }

  if (document.getElementById("adModal")) return;

  const modal = document.createElement("div");
  modal.id = "adModal";
  modal.className = "ad-modal-overlay";
  let sec = 30; // ⭐ 30초로 변경

  modal.innerHTML = `
    <div class="ad-modal-box">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="ad-modal-title" style="margin:0">📺 광고 시청 중...</div>
        <button onclick="document.getElementById('adModal')?.remove()" style="background:none;border:none;color:var(--muted);font-size:1.5rem;cursor:pointer;padding:0;line-height:1">✕</button>
      </div>
      <div class="ad-modal-desc">광고를 보면 투표권 9개를 드려요!<br>광고 1회당 투표권 9개 (하루 최대 10회 = 90개)</div>
      <div class="ad-countdown-wrap">
        <div class="ad-countdown-ring" id="adRing"></div>
        <div class="ad-countdown-circle" id="adCircle">${sec}</div>
      </div>
      <div class="ad-mock-content">
        🎵 K-POP 팬이라면 주목!<br>
        <span style="opacity:.6;font-size:.72rem">여기에 실제 광고가 표시됩니다</span>
      </div>
      <button class="ad-skip-btn" id="adSkipBtn" disabled>⏳ ${sec}초 후 투표권 받기</button>
    </div>`;
  document.body.appendChild(modal);

  const timer = setInterval(() => {
    sec--;
    const circle = document.getElementById("adCircle");
    const btn = document.getElementById("adSkipBtn");
    if (circle) circle.textContent = sec;
    if (sec <= 0) {
      clearInterval(timer);
      const ring = document.getElementById("adRing");
      if (ring) { ring.style.animation = "none"; ring.style.borderColor = "#ffd700"; ring.style.borderTopColor = "#ffd700"; }
      if (circle) { circle.textContent = "🎁"; circle.style.color = "#ffd700"; }
      if (btn) {
        btn.disabled = false;
        btn.textContent = "✅ 투표권 받기!";
        btn.classList.add("ready");
        btn.onclick = claimAdReward;
      }
    } else {
      if (btn) btn.textContent = `⏳ ${sec}초 후 투표권 받기`;
    }
  }, 1000);
}

async function claimAdReward() {
  document.getElementById("adModal")?.remove();
  pendingAdVotes += 1; // 투표권 1개 획득 (광고 1회 = 1표)
  adWatchCount += 1; // ★ 광고 시청 횟수 증가
  await savePendingAdVotes(); // Firebase 저장
  await saveAdWatchCount(); // ★ 광고 시청 횟수 저장
  showToast(`🎁 투표권 획득! (누적: ${pendingAdVotes}개, 광고: ${adWatchCount}/10회) 아래에서 팀을 선택해서 투표하세요! ⬇️`);

  // 팬덤 선택 바 업데이트
  updateFavBar();
  updateAuthUI(); // ★ 닉네임 옆 투표권 정보 업데이트

  // ★ 투표권 획득 후 랭킹 버튼 상태 업데이트 (활성화)
  if (allRankingsData) {
    renderRankings(allRankingsData);
  }

  // 랭킹으로 자동 스크롤
  setTimeout(() => {
    const ranking = document.getElementById("rankingList");
    if (ranking) ranking.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 300);

  showMyVotedBar(cachedTodayFreeVote);
}

// ── 투표 후 상태 복원 (페이지 로드 시) ──
function restoreVotedState() {
  const group = cachedTodayFreeVote;
  if (!group) return;
  showMyVotedBar(group);
  updateFavBar(); // 광고 바 상태 복원
  // Firebase에서의 로드는 setupAuthListener()에서 처리됨
}

// ── Firebase에 광고 투표권 저장 ──
async function savePendingAdVotes() {
  if (!currentUser) return;

  try {
    await db.ref(`users/${currentUser.uid}/pendingAdVotes`).set(pendingAdVotes);
  } catch (e) {
    console.error("광고 투표권 저장 실패:", e);
    showToast("⚠️ 데이터 저장에 실패했습니다. 다시 시도하세요.");
  }
}

// ★ Firebase에 광고 시청 횟수 저장 (일일 리셋) ──
async function saveAdWatchCount() {
  if (!currentUser) return;

  try {
    const today = getTodayKey();
    await db.ref(`users/${currentUser.uid}/ad_watch_count_${today}`).set(adWatchCount);
  } catch (e) {
    console.error("광고 시청 횟수 저장 실패:", e);
    showToast("⚠️ 광고 횟수 저장에 실패했습니다. 다시 시도하세요.");
  }
}

// ── 댓글 필터 탭을 상위 그룹으로 업데이트 ──
