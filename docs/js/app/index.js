
// ── 투표 제한 (하루 최대: 무료 1표 + 광고 10표 = 11표) ──
const MAX_FREE_VOTES_PER_DAY = 1;
const MAX_AD_VOTES_PER_DAY = 10;
const MAX_TOTAL_VOTES_PER_DAY = 11; // 무료(1) + 광고(10) 합계
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
function updateCommentFilterTabs(topGroups) {
  const row = document.getElementById("commentFilterRow");
  if (!row) return;
  let html = `<button class="cfilter-btn ${commentFilter==="all"?"active":""}" data-filter="all" onclick="filterComments('all')">전체</button>`;
  topGroups.forEach(g => {
    const meta = GROUP_META[g] || { emoji:"🌟" };
    html += `<button class="cfilter-btn ${commentFilter===g?"active":""}" data-filter="${escAttr(g)}" onclick="filterComments('${escAttr(g)}')">${meta.emoji} ${escHtml(g)}</button>`;
  });
  row.innerHTML = html;
}


let _cdTimer = null; // monthly countdown timer ref

// ── 투표 축하 confetti ──
function showConfetti(baseColor) {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9998;";
  document.body.appendChild(canvas);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");
  const colors = [baseColor || "#7c4dff", "#ff4d8d", "#ffd700", "#4d9eff", "#00e676", "#ff6b35"];
  const pieces = Array.from({ length: 70 }, () => ({
    x: Math.random() * canvas.width,
    y: -12,
    r: Math.random() * 5 + 3,
    vy: Math.random() * 4 + 3,
    vx: (Math.random() - 0.5) * 3,
    tilt: Math.random() * 10 - 5,
    tiltInc: Math.random() * 0.07 + 0.04,
    tiltAngle: 0,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 1
  }));
  let frame = 0;
  const MAX = 90;
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.tiltAngle += p.tiltInc;
      p.y += p.vy;
      p.x += p.vx;
      p.tilt = Math.sin(p.tiltAngle) * 11;
      if (frame > MAX * 0.6) p.alpha = Math.max(0, p.alpha - 0.04);
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    frame++;
    if (frame < MAX) requestAnimationFrame(draw);
    else canvas.remove();
  })();
}

// ── 내 최애 그룹으로 스크롤 ──
function scrollToMyGroup(group) {
  const target = group || getMyFav() || cachedTodayFreeVote;
  if (!target) { showToast("먼저 최애 그룹을 설정해봐! 💜"); return; }

  let el = document.querySelector(`.rank-item[data-group="${CSS.escape(target)}"]`);

  // 엘리먼트를 찾지 못했으면 (투표 0인 경우) 모든 그룹을 표시하고 다시 찾기
  if (!el) {
    if (!showAllRankings) {
      showAllRankings = true;
      if (allRankingsData) renderRankings(allRankingsData);
      // 렌더링 후 다시 찾기
      setTimeout(() => {
        el = document.querySelector(`.rank-item[data-group="${CSS.escape(target)}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("highlight-flash");
          setTimeout(() => el.classList.remove("highlight-flash"), 1800);
          showToast(`✨ ${target} 팬덤을 찾았어! 여기야 💜`);
        }
      }, 100);
    } else {
      showToast("랭킹을 불러오는 중이에요. 잠시 후 다시 시도해봐!");
    }
    return;
  }

  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("highlight-flash");
  setTimeout(() => el.classList.remove("highlight-flash"), 1800);
}

// ── 오늘 투표권 상태 업데이트 ──
function updateTodayVoteDisplay() {
  const el = document.getElementById("todayVoteDisplay");
  if (!el) return;
  el.style.display = "none"; // 오늘 투표 표시 숨기기
}

// ── 투표 가이드 배너 표시 ──
function showVoteGuideBanner() {
  const banner = document.getElementById("voteGuideBanner");
  if (!banner) return;
  // 오늘 이미 투표했으면 배너 숨기기
  if (cachedTodayFreeVote) {
    banner.style.display = "none";
  } else {
    banner.style.display = "block";
  }
}

// ── 실시간 투표 활동 피드 ──
const MAX_ACTIVITY_ITEMS = 5;
let activityQueue = [];
let activityLastRendered = 0;

function addActivity(group) {
  const meta = GROUP_META[group] || { emoji: "🌟" };
  activityQueue.unshift({ group, emoji: meta.emoji, time: Date.now() });
  if (activityQueue.length > MAX_ACTIVITY_ITEMS) activityQueue.pop();
  renderActivityFeed();
}

function renderActivityFeed() {
  const now = Date.now();
  // 10초 이상 된 항목은 제거
  activityQueue = activityQueue.filter(a => now - a.time < 10000);

  const feedEl = document.getElementById("activityFeed");
  const listEl = document.getElementById("activityList");
  if (!feedEl || !listEl) return;

  if (activityQueue.length === 0) {
    feedEl.style.display = "none";
    return;
  }

  feedEl.style.display = "block";
  listEl.innerHTML = activityQueue.map((a, i) => `
    <div class="activity-item" style="animation:slideUp 0.3s ease">
      <span class="activity-emoji">${a.emoji}</span>
      <span class="activity-text">${escHtml(a.group)} 투표 중! 🔥</span>
    </div>
  `).join("");
}

// ── 랭킹 실시간 리슨 ──
let lastRankingData = null;
let trendingData = {}; // 최근 투표 속도 추적

function updateTrending() {
  // 매 업데이트마다 trending 점수 감소 (최대 12초)
  Object.keys(trendingData).forEach(group => {
    trendingData[group]--;
    if (trendingData[group] <= 0) delete trendingData[group];
  });
}

function isTrending(group) {
  return trendingData[group] && trendingData[group] > 5;
}

function listenRankings() {
  db.ref("rankings").on("value", snap => {
    allRankingsData = snap.val() || {};

    // 첫 로드 시 스켈레톤 제거
    if (!lastRankingData) {
      const skeletonEl = document.getElementById("skeletonLoader");
      if (skeletonEl) skeletonEl.remove();
    }

    // 매번 투표 상태 확인해서 배너 표시/숨김
    showVoteGuideBanner();

    // 변화가 있는 그룹 감지해서 activity 추가
    if (lastRankingData) {
      Object.entries(allRankingsData).forEach(([group, votes]) => {
        const oldVotes = lastRankingData[group] || 0;
        if (votes > oldVotes) {
          // 새로운 투표 있음
          const diff = votes - oldVotes;
          trendingData[group] = Math.min(10, (trendingData[group] || 0) + diff);
          for (let i = 0; i < diff; i++) {
            setTimeout(() => addActivity(group), i * 200);
          }
        }
      });
    }

    lastRankingData = { ...allRankingsData };
    updateTrending();
    updateTodayVoteDisplay();
    renderRankings(allRankingsData);
    updatePageTitle(allRankingsData);
  });
}

function updatePageTitle(data) {
  const sorted = Object.entries(data).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) { document.title = "⚔️ 팬덤배틀 - 아이돌 팬덤 파워 월간 랭킹"; return; }
  const [leader] = sorted[0];
  const meta = GROUP_META[leader] || { emoji: "👑" };
  document.title = `${meta.emoji} ${leader} 1위 · 팬덤배틀`;
}

function toggleAllRankings() {
  showAllRankings = !showAllRankings;
  if (allRankingsData) renderRankings(allRankingsData);
}

let rankingSearchQuery = "";
function filterRankings(query) {
  rankingSearchQuery = query.toLowerCase().trim();
  if (allRankingsData) renderRankings(allRankingsData);
}

function renderRankings(data) {
  const el = document.getElementById("rankingList");
  const myVotedGroup = cachedTodayFreeVote;       // 오늘 투표한 그룹명 or null
  const alreadyVoted = !!myVotedGroup;
  const myFavGroup = getMyFav();

  // 전체 그룹 정렬 (투표수 내림차순)
  const allEntries = ALL_GROUPS.map(g => [g, data[g] || 0]).sort((a, b) => b[1] - a[1]);
  const totalVotes = allEntries.reduce((s, [, v]) => s + v, 0);

  // 총 참여자 수 업데이트
  const tvEl = document.getElementById("totalVotesEl");
  if (tvEl) tvEl.textContent = totalVotes.toLocaleString();

  // 투표 후 상태바 갱신
  if (alreadyVoted) restoreVotedState();
  const isAdPending = pendingAdVotes > 0; // 광고로부터 얻은 투표권이 있는지 확인

  // 검색 필터 적용
  const filtered = rankingSearchQuery
    ? allEntries.filter(([g]) => g.toLowerCase().includes(rankingSearchQuery) || (GROUP_META[g]?.fandom?.toLowerCase().includes(rankingSearchQuery)))
    : allEntries;

  const withVotes = filtered.filter(([, v]) => v > 0);
  const zeroVotes = filtered.filter(([, v]) => v === 0);

  const rankNums = ["", "👑", "🥈", "🥉"];
  const rankClasses = ["", "gold", "silver", "bronze"];

  // 1위 그룹의 투표수 가져오기
  const firstPlaceVotes = withVotes.length > 0 ? withVotes[0][1] : 0;

  // 상위 3팀의 투표 격차가 작은지 확인 (경쟁이 뜨거운지)
  const isCloseRace = withVotes.length >= 3 &&
    firstPlaceVotes > 0 &&
    (firstPlaceVotes - withVotes[2][1]) < (firstPlaceVotes * 0.15); // 15% 이내

  const renderRow = (group, votes, rank, faded = false) => {
    const meta = GROUP_META[group] || { emoji: "🌟", color: "#7c4dff", fandom: "" };
    const isFav = group === myFavGroup;
    const isVoted = myVotedGroup === group;
    const isFirst = rank === 1 && votes > 0;
    const pct = totalVotes ? Math.round(votes / totalVotes * 100) : 0;

    // ★ 한글 + 영문 이름 표시
    const displayName = meta.kr ? `${meta.kr} (${group})` : group;

    // 1위까지의 거리 계산
    let distanceBar = "";
    if (!isFirst && votes > 0 && firstPlaceVotes > 0) {
      const gap = firstPlaceVotes - votes;
      distanceBar = `<div style="margin-top:6px;font-size:.73rem;color:var(--primary);margin-bottom:4px;font-weight:700">🎯 1위까지 <span style="color:var(--pink);font-size:.8rem">${gap.toLocaleString()}표</span> 남음!</div>`;
    }

    const rec = groupRecords[group];
    const recBadge = rec && rec.wins ? `<span class="record-badge">🏆 ${rec.wins}회</span>` : "";
    const trendingBadge = isTrending(group) ? `<span class="record-badge" style="background:rgba(255,107,53,0.2);color:#ff6b35;animation:pulse 1s infinite">🔥 핫</span>` : "";
    const closeRaceApplies = isCloseRace && rank <= 3;
    const closeRaceBadge = closeRaceApplies ? `<span class="close-race-badge">⚡경쟁 중</span>` : "";
    const votedBadge = isVoted ? `<span class="my-voted-badge">✅ 내 투표</span>` : "";
    const firstCrown = isFirst ? `<span class="rank-first-crown">1위</span>` : "";
    const fadedStyle = faded ? 'style="opacity:0.5"' : "";
    return `
      <div class="rank-item ${isFirst ? "rank-first" : ""} ${closeRaceApplies ? "close-race" : ""} ${isVoted ? "my-voted" : ""} ${isFav ? "my-fav-rank" : ""}" data-group="${escAttr(group)}" ${fadedStyle}>
        <div class="rank-num ${rankClasses[rank] || ""}">${rankNums[rank] || rank}</div>
        <div class="rank-emoji">${meta.emoji}</div>
        <div class="rank-info">
          <div class="rank-name">${isFav ? '<span class="my-fav-star">⭐</span>' : ""}${escHtml(displayName)}${firstCrown}${votedBadge}${closeRaceBadge}${trendingBadge}${recBadge}</div>
          ${meta.fandom ? `<div class="rank-fandom">${escHtml(meta.fandom)}</div>` : ""}
          <div class="rank-vote-meta">
            <div class="rank-pct-bar-wrap">
              <div class="rank-pct-bar" style="width:${pct}%;background:${meta.color}"></div>
            </div>
            <span class="rank-pct-label">${pct}%</span>
          </div>
          ${distanceBar}
        </div>
        <div class="rank-right">
          <div class="rank-votes">${fmtVotes(votes)}</div>
          <button class="vote-rank-btn ${isVoted ? "voted" : ""} ${isAdPending ? "ad-active" : ""}"
            onclick="voteForGroup('${escAttr(group)}')"
            ${(pendingAdVotes === 0 && !canUseFreeVote()) ? "disabled" : ""}>
            ${isAdPending ? "⚡ 추가 투표!" : isVoted ? "✅ 투표함" : meta.emoji + " 투표"}
          </button>
        </div>
      </div>`;
  };

  // 댓글 필터 탭에 상위 그룹 반영 (상위 5팀까지)
  updateCommentFilterTabs(withVotes.slice(0, 5).map(([g]) => g));

  let html = "";

  if (withVotes.length === 0) {
    // 첫 달 / 초기화 직후 — 안내 + 상위 10개만 노출
    const INITIAL_SHOW = 10;
    html = `<div class="ranking-empty-hint">
      <div style="font-size:1.6rem;margin-bottom:8px">🎯</div>
      <p style="margin-bottom:8px;font-weight:700">아직 이번 달 투표가 없어요!</p>
      <p style="font-size:.77rem;line-height:1.5">
        누구나 참여 가능! 😍<br>
        하루 1표 무료 · 광고시청 시 최대 10표<br>
        <strong>첫 번째 투표의 주인공이 되어봐! 💜</strong>
      </p>
    </div>`;
    const initial = allEntries.slice(0, showAllRankings ? allEntries.length : INITIAL_SHOW);
    html += initial.map(([g, v], i) => renderRow(g, v, i + 1)).join("");
    if (!showAllRankings && allEntries.length > INITIAL_SHOW) {
      html += `<div class="rank-show-more">
        <button class="show-all-btn" onclick="toggleAllRankings()">▼ 전체 ${allEntries.length - INITIAL_SHOW}개 그룹 더보기</button>
      </div>`;
    } else if (showAllRankings) {
      html += `<div class="rank-show-more"><button class="show-all-btn" onclick="toggleAllRankings()">▲ 접기</button></div>`;
    }
  } else {
    html = withVotes.map(([g, v], i) => renderRow(g, v, i + 1)).join("");

    if (showAllRankings) {
      html += zeroVotes.map(([g, v], i) => renderRow(g, v, withVotes.length + i + 1, true)).join("");
      if (zeroVotes.length) html += `<div class="rank-show-more"><button class="show-all-btn" onclick="toggleAllRankings()">▲ 접기</button></div>`;
    } else if (zeroVotes.length) {
      html += `<div class="rank-show-more">
        <button class="show-all-btn" onclick="toggleAllRankings()">▼ 아직 투표 없는 그룹 ${zeroVotes.length}개 보기</button>
      </div>`;
    }
  }

  // ★ 그룹 추천 메시지 추가
  html += `<div style="margin-top:28px;padding:20px;border-top:1px solid var(--border);text-align:center;color:var(--muted)">
    <div style="font-size:1.2rem;margin-bottom:8px">💜</div>
    <div style="font-weight:700;margin-bottom:6px">찾는 팬덤이 없다면?</div>
    <div style="font-size:.85rem;line-height:1.5;margin-bottom:12px">
      좋아하는 그룹을 추천해주세요!<br>
      더 많은 팬들과 응원할 수 있어요 ✨
    </div>
  </div>`;

  el.innerHTML = html;
}


// ── 월 우승 기록 로드 ──
function loadMonthlyHistory() {
  db.ref("monthly_history").limitToLast(6).once("value", snap => {
    const data = snap.val();
    const sec = document.getElementById("historySection");
    const list = document.getElementById("historyList");
    if (!data || !sec || !list) return;
    const items = Object.entries(data).sort((a, b) => b[0].localeCompare(a[0]));
    list.innerHTML = items.map(([month, h]) => {
      const meta = GROUP_META[h.winner] || { emoji: "🌟" };
      return `<div class="monthly-winner-item">
        <div class="mw-month">${h.monthLabel || month}</div>
        <div class="rank-emoji" style="font-size:1.3rem">${meta.emoji}</div>
        <div class="mw-info">
          <div class="mw-winner">🏆 ${escHtml(h.winner)}</div>
          <div class="mw-votes">${(h.votes||0).toLocaleString()}표 · 1위</div>
        </div>
        <div style="font-size:.72rem;color:var(--gold)">포토카드 증정</div>
      </div>`;
    }).join("");
    sec.style.display = "block";
  });
}


// (loadHistory 제거됨 → loadMonthlyHistory 로 대체)

// ── 공유 ──
const SITE_URL = "https://fandomkorea.github.io/fandom-battle/";

function getShareText() {
  const myGroup = cachedTodayFreeVote;
  const now = new Date();
  const monthStr = (now.getMonth() + 1) + "월";
  const title = `🏆 ${monthStr} 팬덤 파워 랭킹 — 팬덤배틀`;
  const myTag = myGroup ? myGroup.replace(/\s/g, "") : "";
  const shareUrl = myGroup ? `${SITE_URL}?ref=${encodeURIComponent(myGroup)}` : SITE_URL;
  const text = myGroup
    ? `나는 ${myGroup}에 투표했어! 100만원 포토카드 주인공을 만들자! #팬덤배틀 #${myTag} #팬덤파워랭킹`
    : `${monthStr} 팬덤 파워 랭킹 진행 중! 100만원 포토카드 내 최애한테! #팬덤배틀 #팬덤파워랭킹`;
  return { title, text, url: shareUrl };
}

function handleShareRef() {
  const params = new URLSearchParams(location.search);
  const ref = params.get("ref");
  if (ref) {
    setTimeout(() => scrollToMyGroup(ref), 1200);
    showToast(`친구 초대감사! ${escHtml(ref)} 팬덤을 보고 있어요 💜`);
  }
}

async function shareNative() {
  const { title, text, url } = getShareText();
  if (navigator.share) {
    try {
      await navigator.share({ title, text: text + "\n" + url });
      return;
    } catch (e) { /* 취소 시 무시 */ }
  }
  // fallback: 클립보드 복사
  try {
    await navigator.clipboard.writeText(url);
    showToast("링크 복사됨! 친구한테 공유해줘 💜");
  } catch {
    // 구형 브라우저 fallback
    const ta = document.createElement("textarea");
    ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast("링크 복사됨! 💜");
  }
}

function shareKakao() {
  const { text, url } = getShareText();
  // Kakao SDK 없이 카카오톡 URL 스킴 + 웹 fallback
  const kakaoShareUrl = "https://sharer.kakao.com/talk/friends/picker/link?app_key=undefined&validation_action=default&validation_params={}";
  // 실용적 방법: 카카오 오픈채팅 or 링크 공유
  // navigator.share가 있으면 카카오도 목록에 뜸
  if (navigator.share) {
    navigator.share({ title: "팬덤배틀", text: text.replace(/#\S+/g, "").trim(), url });
    return;
  }
  // 없으면 링크 복사
  shareNative();
}

function shareToX() {
  const { text, url } = getShareText();
  const tweetText = text + " 👉 " + url;
  window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(tweetText), "_blank", "width=600,height=400");
}

// ── 관리자 ──
function setupAdmin() {
  document.getElementById("adminPanel").style.display = "block";
  // 현재 공지 불러오기
  db.ref("prize_notice").once("value", snap => {
    const el = document.getElementById("adminPrizeNotice");
    if (el && snap.val()) el.value = snap.val();
  });
}

async function adminSavePrizeNotice() {
  const notice = document.getElementById("adminPrizeNotice").value.trim();
  await db.ref("prize_notice").set(notice);
  adminMsg("✅ 공지 저장됨!");
}

async function adminCloseMonth() {
  if (!allRankingsData) { adminMsg("랭킹 데이터 없음"); return; }
  const sorted = Object.entries(allRankingsData).sort((a, b) => b[1] - a[1]);
  if (!sorted.length || sorted[0][1] === 0) { adminMsg("투표 데이터가 없어요"); return; }
  const [winner, votes] = sorted[0];
  const now = new Date();
  const monthKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  const monthLabel = now.getFullYear() + "년 " + (now.getMonth() + 1) + "월";

  // 월 우승 기록 저장
  await db.ref("monthly_history/" + monthKey).set({ winner, votes, monthLabel });

  // 그룹 역대 우승 횟수 업데이트
  const recSnap = await db.ref("group_records/" + winner).once("value");
  const rec = recSnap.val() || { wins: 0 };
  await db.ref("group_records/" + winner).set({ wins: (rec.wins || 0) + 1 });

  adminMsg(`🏆 ${monthLabel} 우승: ${winner} (${votes.toLocaleString()}표) 저장 완료! 이제 랭킹 초기화하세요.`);
  loadMonthlyHistory();
}

async function adminResetRankings() {
  if (!confirm("이달 랭킹을 초기화할까요? (월 마감 후 실행하세요)")) return;
  const updates = {};
  ALL_GROUPS.forEach(g => { updates[g] = 0; });
  await db.ref("rankings").set(updates);
  adminMsg("🔄 랭킹 초기화 완료 — 새 달 투표 시작!");
}

function adminMsg(msg) { document.getElementById("adminMsg").textContent = msg; }

function buildCommentSelect() {
  const sel = document.getElementById("commentGroup");
  if (!sel) return;
  const myFav = getMyFav();
  sel.innerHTML = ALL_GROUPS.map(g => `<option value="${escAttr(g)}">${escHtml(g)}</option>`).join("");
  if (myFav && ALL_GROUPS.includes(myFav)) sel.value = myFav;
}

// ── 응원 댓글 ──
const BAD = ["시발","씨발","병신","개새","지랄","fuck","shit","bitch"];
function filterBad(t) { return BAD.some(w => t.toLowerCase().includes(w)); }

function anonName() {
  // ★ 로그인 여부에 따라 다르게 처리
  if (isLoggedIn && currentUser) {
    // Firebase에서 사용자 닉네임 사용
    return currentUser.customNickname || currentUser.uid.slice(0, 8);
  } else {
    // 비로그인: localStorage 사용 (Firebase에 저장할 수 없음)
    const key = "my_anon_name";
    let name = localStorage.getItem(key);
    if (!name) {
      name = "팬#" + Math.floor(Math.random()*9000+1000);
      localStorage.setItem(key, name);
    }
    return name;
  }
}

function renderNickDisplay() {
  const el = document.getElementById("nickDisplay");
  if (!el) return;
  const name = anonName();
  el.innerHTML = `닉네임: <strong>${escHtml(name)}</strong> <button class="nick-change-btn" onclick="changeNick()">바꾸기</button>`;
}

function changeNick() {
  if (!isLoggedIn || !currentUser) {
    // 비로그인 사용자: localStorage에서 변경
    const cur = anonName();
    const next = prompt("새 닉네임을 입력하세요 (최대 10자)", cur);
    if (!next) return;
    const trimmed = next.trim().slice(0, 10);
    if (!trimmed) return;
    localStorage.setItem("my_anon_name", trimmed);
    showToast(`닉네임이 "${trimmed}"(으)로 변경됐어! 💜`);
    renderNickDisplay();
  } else {
    // 로그인 사용자: Firebase에서 변경
    const cur = currentUser.customNickname || currentUser.uid.slice(0, 8);
    const next = prompt("새 닉네임을 입력하세요 (최대 10자)", cur);
    if (!next) return;
    const trimmed = next.trim().slice(0, 10);
    if (!trimmed) return;

    // Firebase에 저장
    db.ref(`users/${currentUser.uid}`).update({ nickname: trimmed })
      .then(() => {
        currentUser.customNickname = trimmed;
        showToast(`닉네임이 "${trimmed}"(으)로 변경됐어! 💜`);
        renderNickDisplay();
        updateAuthUI();
      })
      .catch(err => {
        showToast("닉네임 변경 실패: " + err.message);
      });
  }
}
// ── 그룹 역대 전적 ──
let groupRecords = {};
function loadGroupRecords() {
  db.ref("group_records").once("value", snap => {
    groupRecords = snap.val() || {};
    if (allRankingsData) renderRankings(allRankingsData);
  });
}

// ── 내 투표 기록 ──
// ★ Firebase만 사용하므로 로컬 히스토리는 불필요
function recordVote(group) {
  // Firebase에 이미 저장됨 (votes/{date}/{uid})
  // 로컬 히스토리 저장 안 함
}

function getMyVotingHistory() {
  // ★ Firebase만 사용하므로 로컬 히스토리는 불필요
  // TODO: Firebase에서 투표 히스토리를 비동기로 로드하는 기능이 필요하면 추가
  return {};
}

let showDetailedHistory = false;
function toggleMyVotingHistory() {
  showDetailedHistory = !showDetailedHistory;
  renderMyVotingHistory();
}

function renderMyVotingHistory() {
  const section = document.getElementById("myVotingHistorySection");
  const list = document.getElementById("myVotingHistoryList");
  if (!section || !list) return;

  const history = getMyVotingHistory();
  const sortedDates = Object.keys(history).sort().reverse();

  if (sortedDates.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";

  if (!showDetailedHistory) {
    // 최근 5일만 표시
    const recent = sortedDates.slice(0, 5);
    list.innerHTML = recent.map(date => {
      const group = history[date];
      const meta = GROUP_META[group] || { emoji: "🌟" };
      return `
        <div style="padding:8px;background:rgba(124,77,255,0.05);border-radius:8px;margin-bottom:6px;font-size:.78rem">
          <span style="color:var(--muted)">${date}</span> — <span>${meta.emoji} ${escHtml(group)}</span>
        </div>`;
    }).join("");
  } else {
    // 모든 날짜 표시
    list.innerHTML = sortedDates.map(date => {
      const group = history[date];
      const meta = GROUP_META[group] || { emoji: "🌟" };
      return `
        <div style="padding:8px;background:rgba(124,77,255,0.05);border-radius:8px;margin-bottom:6px;font-size:.78rem">
          <span style="color:var(--muted)">${date}</span> — <span>${meta.emoji} ${escHtml(group)}</span>
        </div>`;
    }).join("");
  }
}

// ── 내 최애 그룹 ──
function getMyFav() {
  // ★ Firebase 기반: currentUserFav 사용
  return currentUserFav;
}
function setMyFav(g) {
  // ★ localStorage 제거 - Firebase 기반으로 완전 마이그레이션
  currentUserFav = g; // 전역 변수에도 설정

  // Firebase에 저장 (다른 기기에서 로그인 시 복구용) - preferences/primaryFandom으로 통일
  if (isLoggedIn && currentUser && db) {
    db.ref(`users/${currentUser.uid}`).update({
      "preferences/primaryFandom": g
    });
    console.log(`[DEBUG setMyFav] Firebase에 저장됨: ${g}`);
  }

  renderFavChip();
  updateQuickAccessBtn();
  updateFavBar(); // 하단 바 업데이트
}

// ── 팀 빠른접근 버튼 업데이트 ──
function updateQuickAccessBtn() {
  const btn = document.getElementById("quickAccessBtn");
  // ★ getMyFav() 제거: Firebase 기반의 currentUserFav 사용
  const fav = currentUserFav;
  console.log(`[DEBUG updateQuickAccessBtn] fav=${fav}`);
  if (!btn) return;
  if (!fav) {
    btn.style.display = "none";
    return;
  }
  const meta = GROUP_META[fav] || { emoji: "🌟" };
  document.getElementById("quickAccessEmoji").textContent = meta.emoji;
  document.getElementById("quickAccessText").textContent = `${fav}로 스크롤`;
  btn.style.display = "inline-flex";
}

// ── 내 팀으로 스크롤 (빠른접근) ──
function scrollToMyTeam() {
  const fav = getMyFav();
  if (!fav) {
    showToast("먼저 최애 그룹을 설정해봐! 💜");
    return;
  }
  scrollToMyGroup(fav);
}

function renderFavChip() {
  const area = document.getElementById("favChipArea");
  console.log(`[DEBUG renderFavChip] area found:`, !!area, `area=`, area);
  if (!area) {
    console.log(`[DEBUG renderFavChip] favChipArea 요소를 찾을 수 없음`);
    return;
  }
  const fav = currentUserFav; // Firebase 기반으로 변경
  console.log(`[DEBUG renderFavChip] currentUserFav=${fav}`);
  if (!fav) {
    area.innerHTML = "";
    console.log(`[DEBUG renderFavChip] fav가 없어서 innerHTML 초기화`);
    return;
  }
  const meta = GROUP_META[fav] || { emoji:"🌟" };

  // ★ 한글 + 영문 이름 표시
  const displayName = meta.kr ? `${meta.kr} (${fav})` : fav;

  area.innerHTML = `
    <div class="fav-chip" onclick="scrollToMyGroup('${escAttr(fav)}')" title="클릭 시 내 팀으로 이동">${meta.emoji} ${escHtml(displayName)}</div>
    <div class="fav-chip" onclick="openFavPicker()" title="팬덤 변경" style="margin-left:4px;font-size:.65rem;padding:3px 9px">✏️ 변경</div>`;
  updateQuickAccessBtn();
}

// ── 하단 팬덤 선택 바 업데이트 ──
function updateFavBar() {
  let bar = document.getElementById("favBar");
  const fav = currentUserFav; // Firebase 기반으로 변경

  // 바가 없으면 생성
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "favBar";
    bar.className = "fav-bar";
    document.body.appendChild(bar);
  }

  // ★ 그룹 이름 표시
  let displayName = ''; // 하단 바 왼쪽용 (한글 + 영문)
  let shortName = '';   // 버튼용 (그룹명만)
  if (fav) {
    const meta = GROUP_META[fav] || { emoji: "🌟", fandom: fav };
    displayName = meta.kr ? `${meta.kr} (${fav})` : fav;
    shortName = meta.kr || fav; // ★ 버튼용 그룹명만
  }

  // 팬덤 선택 여부에 따라 내용 업데이트
  let leftContent, centerContent, rightContent;

  if (fav) {
    const meta = GROUP_META[fav] || { emoji: "🌟", fandom: fav };

    // ★ 현재 순위 계산 및 표시
    let rankBadge = '';
    if (allRankingsData) {
      const votes = allRankingsData[fav] || 0;
      const allEntries = ALL_GROUPS.map(g => [g, allRankingsData[g] || 0]).sort((a, b) => b[1] - a[1]);
      const rank = allEntries.findIndex(([g]) => g === fav) + 1;

      if (votes > 0) {
        const rankEmoji = rank === 1 ? "👑" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🎯";
        rankBadge = `<span style="font-size:0.7rem;color:var(--gold);font-weight:700;margin-left:6px">${rankEmoji} ${rank}위</span>`;
      }
    }

    leftContent = `<span class="fav-bar-text">${meta.emoji} ${displayName}${rankBadge}</span>`;
    centerContent = `<button class="fav-bar-btn" onclick="openFavPicker()" style="font-size:0.65rem;padding:6px 10px">변경</button>`;
  } else {
    leftContent = `<span class="fav-bar-text">💜 내 최애 그룹을 설정하면 더 편해요!</span>`;
    centerContent = `<button class="fav-bar-btn" onclick="openFavPicker()">팬덤 선택</button>`;
  }

  // 버튼 상태 결정 (★ 최애팬덤 빠른 투표 버튼)
  let rightButton = '';
  if (isLoggedIn && fav) {
    const freeVoteCount = getTodayFreeVoteCount();
    const adVoteCount = getTodayAdVoteCount();
    const totalVoteCount = getTodayVoteCount();
    const canVote = canUseFreeVote() || (pendingAdVotes > 0 && adVoteCount < MAX_AD_VOTES_PER_DAY);

    // ★ 모든 투표를 사용한 경우 축하 메시지
    if (totalVoteCount >= MAX_TOTAL_VOTES_PER_DAY) {
      rightButton = `<span style="font-size:0.85rem;color:var(--gold);font-weight:700">🏆 11표 완투! 내일 또 와줘!</span>`;
    }
    // ★ 투표권이 있으면 활성화 버튼 (무료 또는 광고)
    else if (canVote) {
      rightButton = `<button class="fav-bar-ad-btn show ready" onclick="voteForGroup('${escAttr(fav)}')">🎁 ${escHtml(shortName)}에 빠른 투표하기</button>`;
    }
    // ★ 투표권이 없으면 비활성화 버튼
    else if (adWatchCount < MAX_AD_VOTES_PER_DAY) {
      rightButton = `<button class="fav-bar-ad-btn" onclick="showToast('투표권을 먼저 획득해주세요! 광고를 시청하면 투표권이 생겨요 🎁')" disabled style="opacity:0.5;cursor:not-allowed">🎁 ${escHtml(shortName)}에 빠른 투표하기</button>`;
    }
    // ★ 광고 10회 완료
    else {
      rightButton = `<span style="font-size:0.85rem;color:var(--gold)">✨ 내일 투표권이 생겨요!</span>`;
    }
  }

  // 레이아웃: [팀 변경] | [버튼]
  rightContent = rightButton ? rightButton : '';

  bar.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;flex:1">
      ${leftContent}
      ${centerContent}
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      ${rightContent}
    </div>
  `;
}

function showFavBar() {
  updateFavBar();
}

function openFavPicker() {
  // 로그인 필수 확인
  if (!isLoggedIn) {
    showToast("💜 팬덤을 선택하려면 먼저 로그인하세요!");
    showVoteLoginModal(null); // 로그인 모달 표시 (팬덤 선택용)
    return;
  }

  if (document.getElementById("favPicker")) return;
  const myFav = getMyFav();
  const overlay = document.createElement("div");
  overlay.id = "favPicker";
  overlay.className = "fav-picker";
  overlay.onclick = e => { if (e.target === overlay) closeFavPicker(); };

  // ESC 키로도 닫기
  const handleEsc = (e) => {
    if (e.key === "Escape") {
      closeFavPicker();
      document.removeEventListener("keydown", handleEsc);
    }
  };
  document.addEventListener("keydown", handleEsc);

  const grid = ALL_GROUPS.map(g => {
    const meta = GROUP_META[g] || { emoji:"🌟" };
    // ★ 한글 + 영문 이름 표시
    const displayName = meta.kr ? `${meta.kr} (${g})` : g;
    return `<button class="fav-picker-btn ${myFav===g?"selected":""}" onclick="pickFav('${escAttr(g)}')">
      <span class="fp-emoji">${meta.emoji}</span>
      <span class="fp-name">${escHtml(displayName)}</span>
    </button>`;
  }).join("");
  overlay.innerHTML = `<div class="fav-picker-sheet">
    <div class="fav-picker-title">💜 내 최애 그룹은?<button class="fav-picker-close" onclick="closeFavPicker()">✕</button></div>
    <div class="fav-picker-grid">${grid}</div>
  </div>`;
  document.body.appendChild(overlay);

  // 모바일 뒤로가기 처리: 모달 열릴 때 history에 entry 추가
  window.history.pushState({ modal: "favPicker" }, null, null);

  // 모달이 닫힐 때 popstate 이벤트 제거를 위한 준비
  const handleFavPopstate = () => {
    closeFavPicker();
    window.removeEventListener("popstate", handleFavPopstate);
  };
  window.addEventListener("popstate", handleFavPopstate);
}

function closeFavPicker() { document.getElementById("favPicker")?.remove(); }

async function pickFav(group) {
  // 최애팬덤 변경도 changePrimaryFandom()과 동일하게 처리
  await changePrimaryFandom(group);
  closeFavPicker();
}


// ── 유틸 ──
function fmtVotes(n) {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, "") + "만";
  return n.toLocaleString();
}
function escHtml(s) { if (!s) return ""; return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function escAttr(s) { if (!s) return ""; return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
function showToast(msg) {
  const t = document.getElementById("toast"); t.textContent = msg;
  t.classList.add("show"); clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 2500);
}

// ★ 팬덤 설정 팝업
function showFandomSetupPopup() {
  if (document.getElementById("fandomSetupPopup")) return;

  const overlay = document.createElement("div");
  overlay.id = "fandomSetupPopup";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  overlay.innerHTML = `
    <div style="
      background: var(--bg);
      border: 2px solid var(--primary);
      border-radius: 20px;
      padding: 40px 30px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    ">
      <div style="font-size: 2.5rem; margin-bottom: 16px">💜</div>
      <div style="font-size: 1.3rem; font-weight: 700; margin-bottom: 12px; color: var(--text)">팬덤을 설정하고 시작하세요!</div>
      <div style="font-size: 0.9rem; color: var(--muted); margin-bottom: 28px; line-height: 1.6">
        최애 팬덤을 설정하면<br>
        더 편리한 투표 경험을 할 수 있어요 ✨
      </div>
      <div style="display: flex; gap: 12px; flex-direction: column">
        <button onclick="signInWithGoogle(); document.getElementById('fandomSetupPopup')?.remove();" style="
          padding: 14px 24px;
          background: var(--primary);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
          🔍 로그인하고 팬덤 설정하기
        </button>
        <button onclick="document.getElementById('fandomSetupPopup')?.remove()" style="
          padding: 12px 24px;
          background: transparent;
          color: var(--primary);
          border: 1px solid var(--primary);
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        " onmouseover="this.style.background='rgba(124,77,255,0.1)'" onmouseout="this.style.background='transparent'">
          지금은 건너뛰기
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

function closeFandomSetupPopup() {
  const popup = document.getElementById("fandomSetupPopup");
  if (popup) popup.remove();
}

// ── 팬덤 변경 핸들러 ──
function handleFandomChange() {
  const selectedFandom = document.getElementById("communityFandomSelect").value;
  if (selectedFandom) {
    changePrimaryFandom(selectedFandom);
  }
}

// ── 페이지 전환 함수 ──
function showVotePage() {
  const votePage = document.getElementById("votePage");
  const communityPage = document.getElementById("communityPage");

  if (votePage) votePage.classList.remove("hidden");
  if (communityPage) communityPage.classList.remove("show");

  document.querySelectorAll(".nav-tab").forEach((tab, i) => {
    tab.classList.toggle("active", i === 0);
  });

  // ★ Firebase에 저장 (비동기, 에러 무시)
  if (isLoggedIn && currentUser && db) {
    db.ref(`users/${currentUser.uid}`).update({ activePage: "vote" }).catch(() => {});
  }
}

function showCommunityPage() {
  // Firebase에서 마지막 정렬 모드 로드
  loadLastSortMode();

  const votePage = document.getElementById("votePage");
  const communityPage = document.getElementById("communityPage");

  if (votePage) votePage.classList.add("hidden");
  if (communityPage) communityPage.classList.add("show");

  document.querySelectorAll(".nav-tab").forEach((tab, i) => {
    tab.classList.toggle("active", i === 1);
  });

  // ★ Firebase에 저장 (비동기, 에러 무시)
  if (isLoggedIn && currentUser && db) {
    db.ref(`users/${currentUser.uid}`).update({ activePage: "community" }).catch(() => {});
  }

  // 팬덤 드롭다운 초기화
  const select = document.getElementById("communityFandomSelect");

  if (!select) {
    console.error("[ERROR] communityFandomSelect 요소를 찾을 수 없음");
    return;
  }

  console.log("[DEBUG] GROUP_META 존재?", !!GROUP_META);
  console.log("[DEBUG] GROUP_META 타입:", typeof GROUP_META);
  console.log("[DEBUG] select.options.length:", select.options.length);

  // 팬덤 목록이 없으면 채우기
  if (select.options.length <= 1) {
    if (GROUP_META && typeof GROUP_META === 'object') {
      console.log("[DEBUG] GROUP_META 옵션 추가 시작...");
      const groupNames = Object.keys(GROUP_META);
      console.log("[DEBUG] 추가할 팬덤 수:", groupNames.length);

      groupNames.forEach(groupName => {
        const meta = GROUP_META[groupName];
        const option = document.createElement("option");
        option.value = groupName;
        option.textContent = `${meta.emoji} ${groupName}`;
        select.appendChild(option);
        console.log("[DEBUG] 옵션 추가됨:", groupName);
      });
      console.log("[DEBUG] 총 옵션 개수:", select.options.length);
    } else {
      console.error("[ERROR] GROUP_META가 객체가 아님");
    }
  }

  // 최애팬덤이 있으면 자동 선택
  if (currentUserFav) {
    console.log("[DEBUG] currentUserFav 설정 중:", currentUserFav);
    select.value = currentUserFav;
    console.log("[DEBUG] select.value 설정됨:", select.value);
  } else {
    console.log("[DEBUG] currentUserFav가 비어있음");
  }

  // 선택된 팬덤이 있으면 게시물 로드 (최애팬덤 여부와 상관없이)
  if (select.value) {
    loadCommunityPosts();
  }
}

// ── 커뮤니티 게시물 새로고침 ──
function refreshCommunityPosts() {
  const selectedFandom = document.getElementById("communityFandomSelect").value;
  if (!selectedFandom) {
    showToast("팬덤을 선택해주세요");
    return;
  }

  // 게시물 목록 초기화 후 다시 로드
  showToast("🔄 게시물을 새로고침 중입니다...");
  loadCommunityPosts();
}

// ── 커뮤니티 초기화 ──
function initCommunityPage() {
  // showCommunityPage()에서 처리하므로 여기서는 비움
}

// 현재 활성 리스너 추적
let currentCommunityListener = null;

// ── 게시물 상세 모달 리스너 저장소 ──
let postDetailListeners = {
  likes: null,
  comments: null,
  views: null
};

// ── 댓글 모달 리스너 저장소 ──
let commentsModalListener = null;

// ── 커뮤니티 포스트 리스너 저장소 ──
let postListListeners = [];

// 포스트 리스너 정리 함수
function clearPostListListeners() {
  postListListeners.forEach(listener => {
    if (listener && listener.ref && listener.callback) {
      listener.ref.off("value", listener.callback);
    }
  });
  postListListeners = [];
}

// ── 커뮤니티 게시물 로드 (실시간 리스너) ──
function loadCommunityPosts() {
  const selectedFandom = document.getElementById("communityFandomSelect").value;
  if (!selectedFandom) {
    document.getElementById("communityPostsList").innerHTML = `
      <div class="community-empty">
        <div class="community-empty-icon">👆</div>
        <div class="community-empty-text">위에서 팬덤을 선택하면<br>커뮤니티 게시물을 볼 수 있어요!</div>
      </div>
    `;
    return;
  }

  // 기존 리스너 해제 (포스트 리스트 + 메인 리스너)
  clearPostListListeners();
  if (currentCommunityListener) {
    db.ref(currentCommunityListener).off("value");
  }

  // 로딩 상태 표시
  const postsList = document.getElementById("communityPostsList");
  postsList.innerHTML = `
    <div class="community-empty">
      <div class="spinner" style="display:inline-block;margin-bottom:12px"></div>
      <div class="community-empty-text">게시물을 불러오는 중...</div>
    </div>
  `;

  // Firebase 실시간 리스너
  currentCommunityListener = `community/${selectedFandom}`;
  db.ref(currentCommunityListener).on("value", snap => {
    const posts = snap.val() || {};

    // ★ 헤더 업데이트는 먼저 실행 (게시물 유무와 상관없이)
    const fandomHeader = document.getElementById("communityHeaderInfo");
    const fandomMeta = GROUP_META[selectedFandom];
    if (fandomMeta) {
      document.getElementById("communityHeaderEmoji").textContent = fandomMeta.emoji;
      document.getElementById("communityHeaderFandom").textContent = selectedFandom;
      document.getElementById("communityHeaderText").textContent = selectedFandom;
      fandomHeader.style.display = "block";
    }

    if (Object.keys(posts).length === 0) {
      postsList.innerHTML = `
        <div class="community-empty">
          <div class="community-empty-icon">✨</div>
          <div class="community-empty-text">아직 게시물이 없어요<br>첫 번째 게시물을 작성해보세요!</div>
        </div>
      `;
      return;
    }

    // 최신순으로 정렬
    const sortedPosts = Object.entries(posts)
      .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

    postsList.innerHTML = "";

    let visibleIndex = 0;
    sortedPosts.forEach(([postId, post]) => {
      if (!post.isHidden) {
        const postEl = renderPost(selectedFandom, postId, post, visibleIndex);
        postsList.appendChild(postEl);
        visibleIndex++;
      }
    });

    // 드롭다운 값 초기화 및 정렬 적용
    const sortDropdown = document.getElementById("sortDropdown");
    if (sortDropdown) {
      sortDropdown.value = currentSortMode;
    }
    sortCommunityPosts(currentSortMode);
  });
}

// ── 검색 & 정렬 섹션 토글 ──
function toggleSearchSort() {
  const section = document.getElementById("searchSortSection");
  const isVisible = section.style.display !== "none";

  section.style.display = isVisible ? "none" : "block";
}

// ── 게시물 검색/필터 ──
function filterCommunityPosts() {
  const searchText = document.getElementById("communitySearchInput").value.toLowerCase();
  const postItems = document.querySelectorAll(".post-item");
  let visibleCount = 0;

  if (!searchText.trim()) {
    postItems.forEach(item => item.style.display = "block");
    return;
  }

  postItems.forEach(item => {
    const title = item.querySelector(".post-title")?.textContent.toLowerCase() || "";
    const content = item.querySelector(".post-content")?.textContent.toLowerCase() || "";

    const isMatch = title.includes(searchText) || content.includes(searchText);
    item.style.display = isMatch ? "block" : "none";
    if (isMatch) visibleCount++;
  });

  // 검색 결과 없음 메시지 표시
  let emptyMsg = document.getElementById("searchEmptyMsg");
  if (visibleCount === 0) {
    if (!emptyMsg) {
      const postsList = document.getElementById("communityPostsList");
      emptyMsg = document.createElement("div");
      emptyMsg.id = "searchEmptyMsg";
      emptyMsg.style.cssText = "text-align:center;padding:40px 20px;color:var(--muted);background:rgba(124,77,255,0.04);border:1px dashed var(--border);border-radius:12px;margin:16px 0;font-size:0.9rem";
      emptyMsg.innerHTML = `<div style="font-size:2rem;margin-bottom:12px">🔍</div><div>"<strong>${escHtml(searchText)}</strong>"에 대한 검색 결과가 없어요</div>`;
      postsList.appendChild(emptyMsg);
    }
    emptyMsg.style.display = "block";
  } else if (emptyMsg) {
    emptyMsg.style.display = "none";
  }
}

// ── 게시물 정렬 ──
let currentSortMode = "latest";

function changeSortMode(mode) {
  currentSortMode = mode;
  sortCommunityPosts(mode);

  // Firebase에 저장
  if (isLoggedIn && currentUser && db) {
    db.ref(`users/${currentUser.uid}/preferences/lastSortMode`).set(mode).catch(e => {
      console.error("정렬 모드 저장 실패:", e);
    });
  }
}

// Firebase에서 마지막 정렬 모드 로드
async function loadLastSortMode() {
  if (!isLoggedIn || !currentUser || !db) {
    currentSortMode = "latest";
    return;
  }

  try {
    const snap = await db.ref(`users/${currentUser.uid}/preferences/lastSortMode`).once("value");
    currentSortMode = snap.val() || "latest";
  } catch (e) {
    console.error("정렬 모드 로드 실패:", e);
    currentSortMode = "latest";
  }
}

function sortCommunityPosts(mode) {
  currentSortMode = mode;

  // 게시물 재정렬
  const postsList = document.getElementById("communityPostsList");
  const posts = Array.from(document.querySelectorAll(".post-item"));

  posts.sort((a, b) => {
    if (mode === "latest") {
      // 최신순: timestamp 내림차순
      const timeA = parseInt(a.getAttribute("data-timestamp") || 0);
      const timeB = parseInt(b.getAttribute("data-timestamp") || 0);
      return timeB - timeA;
    } else if (mode === "popular") {
      // 인기순: 좋아요 수 내림차순
      const likesA = parseInt(a.getAttribute("data-likes") || 0);
      const likesB = parseInt(b.getAttribute("data-likes") || 0);
      return likesB - likesA;
    } else if (mode === "best") {
      // 베스트: 좋아요(40%) + 조회수(60%)
      const likesA = parseInt(a.getAttribute("data-likes") || 0);
      const likesB = parseInt(b.getAttribute("data-likes") || 0);
      const viewsA = parseInt(a.getAttribute("data-views") || 0);
      const viewsB = parseInt(b.getAttribute("data-views") || 0);
      const scoreA = likesA * 0.4 + viewsA * 0.6;
      const scoreB = likesB * 0.4 + viewsB * 0.6;
      return scoreB - scoreA;
    }
  });

  // 정렬된 순서대로 다시 추가
  posts.forEach(post => {
    postsList.appendChild(post);
  });
}

// ── 상대 시간 계산 ──
function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('ko-KR', {month:'short', day:'numeric'});
}

// ── 게시물 렌더링 ──
// ── 게시물 목록 아이템 렌더링 (컴팩트 리스트) ──
function renderPost(fandom, postId, post, index) {
  const timeStr = getRelativeTime(post.timestamp);
  const postNumber = index + 1; // 1부터 시작하는 순번

  const postEl = document.createElement("div");
  postEl.className = "post-item post-list-compact";
  postEl.setAttribute("data-timestamp", post.timestamp || 0);
  postEl.setAttribute("data-postid", postId);
  postEl.setAttribute("data-likes", post.likes || 0);
  postEl.setAttribute("data-views", post.views || 0);
  postEl.setAttribute("onclick", `showPostDetail('${escAttr(fandom)}', '${escAttr(postId)}'); event.stopPropagation()`);
  postEl.style.cursor = "pointer";
  // 사진 여부 확인
  const hasImage = post.imageUrl ? '📷' : '';

  postEl.innerHTML = `
    <div class="post-list-left">
      <div class="post-title-row">
        <div class="post-list-title">${escHtml(post.title)}</div>
        <div class="post-list-indicators">
          <span class="post-comment-badge">💬 <span id="comment-count-${postId}">0</span></span>
          ${hasImage ? `<span class="post-image-badge">📷</span>` : ''}
        </div>
      </div>
      <div class="post-meta-row-mobile">
        <span class="post-list-meta">👤 <span id="author-${postId}">${escHtml(post.authorName)}</span></span>
        <span class="post-list-meta-divider">·</span>
        <span class="post-list-meta">📅 ${timeStr}</span>
        <span class="post-list-meta-divider">·</span>
        <span class="post-list-meta">👁️ <span id="view-count-${postId}">${post.views || 0}</span></span>
        <span class="post-list-meta-divider">·</span>
        <span class="post-list-meta">❤️ <span id="like-count-${postId}">0</span></span>
      </div>
    </div>
  `;

  // 배지는 게시물 목록에서 표시하지 않음 (간결성)

  // 좋아요 리스너 설정 (포스트 리스트용)
  loadLikesForPostList(fandom, postId);

  // 댓글 개수 업데이트
  updateCommentCount(fandom, postId);

  // 조회수 리스너 설정 (포스트 리스트용)
  loadViewsForPostList(fandom, postId);

  return postEl;
}

// ── 게시물 상세 페이지 열기 ──
async function showPostDetail(fandom, postId) {
  // History API로 URL 상태 저장
  window.history.pushState({
    page: "postDetail",
    fandom: fandom,
    postId: postId
  }, null, `#postDetail/${fandom}/${postId}`);

  // 페이지 표시
  document.getElementById("communityPage").classList.add("hidden");
  document.getElementById("votePage").classList.add("hidden");
  const detailPage = document.getElementById("postDetailPage");
  detailPage.style.display = "flex";
  detailPage.scrollTop = 0;

  try {
    // 게시물 데이터 로드
    const snap = await db.ref(`community/${fandom}/${postId}`).once("value");
    if (!snap.exists()) {
      showToast("게시물을 찾을 수 없어요");
      return;
    }

    const post = snap.val();
    const isAuthor = isLoggedIn && currentUser && post.authorUid === currentUser.uid;
    const timeStr = getRelativeTime(post.timestamp);

    // 조회수 증가
    const currentViews = post.views || 0;
    await db.ref(`community/${fandom}/${postId}/views`).set(currentViews + 1);

    // 제목 설정
    document.getElementById("postDetailTitle").textContent = escHtml(post.title);

    // 메타 정보 설정
    const metaHTML = `
      <span class="post-author">👤 ${escHtml(post.authorName)}</span>
      <span class="post-date">📅 ${timeStr}</span>
    `;
    document.getElementById("postDetailMeta").innerHTML = metaHTML;

    // 내용 설정
    document.getElementById("postDetailContent").textContent = post.content;

    // 참여 버튼 설정 (좋아요, 댓글)
    const engagementHTML = `
      <button class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(255,100,100,0.1) 0%,rgba(255,140,140,0.05) 100%);border:1px solid rgba(255,100,100,0.2);position:relative;overflow:hidden;border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);cursor:pointer" onclick="toggleLike('${escAttr(fandom)}', '${escAttr(postId)}'); event.stopPropagation()" onmouseover="this.style.background='linear-gradient(135deg,rgba(255,100,100,0.18) 0%,rgba(255,140,140,0.12) 100%)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(255,100,100,0.2)';this.style.borderColor='rgba(255,100,100,0.4)'" onmouseout="this.style.background='linear-gradient(135deg,rgba(255,100,100,0.1) 0%,rgba(255,140,140,0.05) 100%)';this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='rgba(255,100,100,0.2)'">
        <span style="font-size:1rem;display:inline-block;transition:transform 0.3s">❤️</span>
        <span style="font-weight:700;color:var(--text);font-size:0.9rem">좋아요</span>
        <span id="detail-like-count-${postId}" style="background:rgba(255,100,100,0.2);padding:2px 8px;border-radius:12px;font-size:0.8rem;font-weight:700;color:rgb(255,100,100);transition:all 0.2s">0</span>
      </button>
      <button class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(100,180,255,0.1) 0%,rgba(140,200,255,0.05) 100%);border:1px solid rgba(100,180,255,0.2);border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);cursor:pointer" onclick="document.getElementById('postDetailCommentsList').scrollIntoView({behavior:'smooth'}); event.stopPropagation()" onmouseover="this.style.background='linear-gradient(135deg,rgba(100,180,255,0.18) 0%,rgba(140,200,255,0.12) 100%)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(100,180,255,0.2)';this.style.borderColor='rgba(100,180,255,0.4)'" onmouseout="this.style.background='linear-gradient(135deg,rgba(100,180,255,0.1) 0%,rgba(140,200,255,0.05) 100%)';this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='rgba(100,180,255,0.2)'">
        <span style="font-size:1rem;display:inline-block;transition:transform 0.3s">💬</span>
        <span style="font-weight:700;color:var(--text);font-size:0.9rem">댓글</span>
        <span id="detail-comment-count-${postId}" style="background:rgba(100,180,255,0.2);padding:2px 8px;border-radius:12px;font-size:0.8rem;font-weight:700;color:rgb(100,180,255);transition:all 0.2s">0</span>
      </button>
    `;
    document.getElementById("postDetailEngagement").innerHTML = engagementHTML;

    // 관리 버튼 설정 (수정, 삭제, 신고)
    let managementHTML = '';
    if (isAuthor) {
      managementHTML = `
        <button class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(100,200,100,0.1) 0%,rgba(140,220,140,0.05) 100%);border:1px solid rgba(100,200,100,0.2);border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);color:var(--text);cursor:pointer" onclick="editPost('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(post.title)}', '${escAttr(post.content)}'); event.stopPropagation()" onmouseover="this.style.background='linear-gradient(135deg,rgba(100,200,100,0.18) 0%,rgba(140,220,140,0.12) 100%)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(100,200,100,0.2)';this.style.borderColor='rgba(100,200,100,0.4)'" onmouseout="this.style.background='linear-gradient(135deg,rgba(100,200,100,0.1) 0%,rgba(140,220,140,0.05) 100%)';this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='rgba(100,200,100,0.2)'"><span style="font-size:1rem">✏️</span><span style="font-weight:700">수정</span></button>
        <button class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(255,100,100,0.15) 0%,rgba(255,120,120,0.05) 100%);border:1px solid rgba(255,100,100,0.3);border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);color:rgb(255,100,100);cursor:pointer" onclick="confirmDeletePost('${escAttr(fandom)}', '${escAttr(postId)}'); closePostDetail(); event.stopPropagation()" onmouseover="this.style.background='linear-gradient(135deg,rgba(255,100,100,0.25) 0%,rgba(255,120,120,0.15) 100%)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(255,100,100,0.25)';this.style.borderColor='rgba(255,100,100,0.5)'" onmouseout="this.style.background='linear-gradient(135deg,rgba(255,100,100,0.15) 0%,rgba(255,120,120,0.05) 100%)';this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='rgba(255,100,100,0.3)'"><span style="font-size:1rem">🗑️</span><span style="font-weight:700">삭제</span></button>
      `;
    } else {
      managementHTML = `
        <button class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(255,150,50,0.1) 0%,rgba(255,170,80,0.05) 100%);border:1px solid rgba(255,150,50,0.2);border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);grid-column:span 2;cursor:pointer" onclick="reportPost('${escAttr(fandom)}', '${escAttr(postId)}'); event.stopPropagation()" onmouseover="this.style.background='linear-gradient(135deg,rgba(255,150,50,0.18) 0%,rgba(255,170,80,0.12) 100%)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(255,150,50,0.2)';this.style.borderColor='rgba(255,150,50,0.4)'" onmouseout="this.style.background='linear-gradient(135deg,rgba(255,150,50,0.1) 0%,rgba(255,170,80,0.05) 100%)';this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='rgba(255,150,50,0.2)'"><span style="font-size:1rem">🚩</span><span style="font-weight:700;color:var(--text)">신고</span></button>
      `;
    }
    document.getElementById("postDetailManagement").innerHTML = managementHTML;

    // 좋아요 수 업데이트 (리스너 저장)
    const likesCallback = (snap) => {
      const likes = snap.val() || {};
      const likeCount = Object.keys(likes).length;
      const el = document.getElementById(`detail-like-count-${postId}`);
      if (el) el.textContent = likeCount;
    };
    const likesRef = db.ref(`community/${fandom}/${postId}/likes`);
    likesRef.on("value", likesCallback);
    postDetailListeners.likes = { ref: likesRef, callback: likesCallback };

    // 댓글 섹션 설정
    const commentsHTML = `
      <div style="margin-top:12px">
        <h3 style="font-size:1rem;font-weight:700;color:var(--text);margin-bottom:16px;display:flex;align-items:center;gap:8px;margin-top:4px"><span>💬</span> 댓글</h3>
        <div id="postDetailCommentsList" style="margin-bottom:20px;max-height:350px;overflow-y:auto"></div>

        ${isLoggedIn ? `
          <div style="background:linear-gradient(135deg,rgba(124,77,255,0.08) 0%,rgba(100,150,255,0.05) 100%);border:1.5px solid rgba(124,77,255,0.25);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
            <textarea id="detail-comment-input-${postId}" placeholder="따뜻한 댓글을 남겨보세요..." style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit;font-size:0.95rem;resize:none;min-height:90px;transition:all 0.2s" onmouseover="this.style.borderColor='rgba(124,77,255,0.5)'" onmouseout="this.style.borderColor='var(--border)'" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'" maxlength="500" oninput="document.getElementById('char-count-${postId}').textContent = this.value.length"></textarea>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:0.75rem;color:var(--muted)">최대 <span id="char-count-${postId}">0</span>/500자</span>
              <button onclick="submitDetailComment('${escAttr(fandom)}', '${escAttr(postId)}'); event.stopPropagation()" style="padding:11px 24px;background:linear-gradient(135deg,var(--primary) 0%,rgba(124,77,255,0.85) 100%);border:none;border-radius:8px;color:#fff;font-weight:700;font-family:inherit;cursor:pointer;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);box-shadow:0 4px 12px rgba(124,77,255,0.35);font-size:0.9rem;position:relative;overflow:hidden" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 20px rgba(124,77,255,0.45)';this.style.background='linear-gradient(135deg,var(--primary) 0%,rgba(124,77,255,0.9) 100%)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(124,77,255,0.35)';this.style.background='linear-gradient(135deg,var(--primary) 0%,rgba(124,77,255,0.85) 100%)'">💬 댓글 작성</button>
            </div>
          </div>
        ` : `<div style="text-align:center;padding:16px;background:linear-gradient(135deg,rgba(124,77,255,0.1) 0%,rgba(100,150,255,0.05) 100%);border:1px solid rgba(124,77,255,0.2);border-radius:12px;color:var(--muted);font-size:0.9rem"><span style="font-size:1rem">🔐</span> 댓글을 작성하려면 로그인해주세요</div>`}
      </div>
    `;
    document.getElementById("postDetailComments").innerHTML = commentsHTML;

    // 댓글 로드
    loadDetailComments(fandom, postId);

  } catch (e) {
    console.error("게시물 로드 실패:", e);
    showToast("게시물을 불러올 수 없어요");
  }
}

// ── 게시물 상세 페이지 닫기 ──
function closePostDetail() {
  // 페이지 숨김
  document.getElementById("postDetailPage").style.display = "none";

  // 커뮤니티 페이지 표시
  document.getElementById("communityPage").classList.remove("hidden");
  document.getElementById("communityPage").classList.add("show");

  // 게시물 상세 페이지의 모든 Firebase 리스너 정리
  Object.values(postDetailListeners).forEach(listener => {
    if (listener && listener.ref && listener.callback) {
      listener.ref.off("value", listener.callback);
    }
  });
  postDetailListeners = { likes: null, comments: null, views: null };

  // 뒤로가기 시뮬레이션 (popstate 이벤트에서 호출된 경우 제외)
  if (!window.popstateActive) {
    window.history.back();
  }
}

// ── 상세 페이지에서 댓글 로드 ──
function loadDetailComments(fandom, postId) {
  const commentsList = document.getElementById("postDetailCommentsList");

  const commentsCallback = (snap) => {
    const comments = snap.val() || {};
    commentsList.innerHTML = "";
    let commentCount = 0;

    if (Object.keys(comments).length === 0) {
      commentsList.innerHTML = '<div style="text-align:center;padding:12px;color:var(--muted);font-size:0.9rem">댓글이 없어요</div>';
    } else {
      Object.entries(comments).forEach(([commentId, comment]) => {
        if (comment.isHidden) return;
        commentCount++;

        const isCommentAuthor = isLoggedIn && currentUser && comment.authorUid === currentUser.uid;
        const timeStr = getRelativeTime(comment.timestamp);

        const commentEl = document.createElement("div");
        commentEl.style.cssText = "padding:12px 14px;background:linear-gradient(135deg,rgba(124,77,255,0.08) 0%,rgba(100,150,255,0.04) 100%);border:1px solid rgba(124,77,255,0.15);border-radius:10px;margin-bottom:10px;font-size:0.9rem;transition:all 0.2s";
        commentEl.onmouseover = function() {
          this.style.background = 'linear-gradient(135deg,rgba(124,77,255,0.12) 0%,rgba(100,150,255,0.08) 100%)';
          this.style.borderColor = 'rgba(124,77,255,0.25)';
        };
        commentEl.onmouseout = function() {
          this.style.background = 'linear-gradient(135deg,rgba(124,77,255,0.08) 0%,rgba(100,150,255,0.04) 100%)';
          this.style.borderColor = 'rgba(124,77,255,0.15)';
        };
        commentEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <span style="font-weight:700;color:var(--text);font-size:0.95rem">${escHtml(comment.authorName)}</span>
                ${isCommentAuthor ? `<span style="background:linear-gradient(135deg,rgba(124,77,255,0.3) 0%,rgba(100,150,255,0.2) 100%);color:var(--primary);font-size:0.7rem;padding:2px 6px;border-radius:4px;font-weight:600">작성자</span>` : ''}
              </div>
              <div style="font-size:0.75rem;color:var(--muted)">${timeStr}</div>
            </div>
            ${isCommentAuthor ? `<button onclick="deleteComment('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}'); event.stopPropagation()" style="font-size:0.75rem;background:rgba(255,100,100,0.1);border:1px solid rgba(255,100,100,0.3);color:rgb(255,100,100);cursor:pointer;padding:5px 10px;border-radius:6px;font-weight:600;transition:all 0.2s;white-space:nowrap" onmouseover="this.style.background='rgba(255,100,100,0.2)';this.style.borderColor='rgba(255,100,100,0.5)'" onmouseout="this.style.background='rgba(255,100,100,0.1)';this.style.borderColor='rgba(255,100,100,0.3)'">삭제</button>` : ''}
          </div>
          <div style="color:var(--text);line-height:1.6;word-break:break-word">${escHtml(comment.content)}</div>
        `;
        commentsList.appendChild(commentEl);
      });
    }

    // 댓글 수 업데이트
    const countEl = document.getElementById(`detail-comment-count-${postId}`);
    if (countEl) countEl.textContent = commentCount;
  };

  // 리스너 등록 및 저장
  const commentsRef = db.ref(`community/${fandom}/${postId}/comments`);
  commentsRef.on("value", commentsCallback);
  postDetailListeners.comments = { ref: commentsRef, callback: commentsCallback };
}

// ── 상세 페이지에서 댓글 작성 ──
async function submitDetailComment(fandom, postId) {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    return;
  }

  const textarea = document.getElementById(`detail-comment-input-${postId}`);
  const content = textarea.value.trim();

  if (!content) {
    showToast("댓글 내용을 입력해주세요");
    return;
  }

  try {
    const commentId = db.ref().push().key;
    await db.ref(`community/${fandom}/${postId}/comments/${commentId}`).set({
      content,
      authorUid: currentUser.uid,
      authorName: currentUser.customNickname || currentUser.displayName || "익명",
      timestamp: Date.now(),
      isHidden: false
    });
    textarea.value = "";
    showToast("댓글이 작성됐어요!");
  } catch (e) {
    console.error("댓글 작성 실패:", e);
    showToast("댓글 작성에 실패했어요");
  }
}

// ── 댓글 모달 열기 ──
function showCommentsModal(fandom, postId) {
  const modal = document.getElementById("commentsModal");
  modal.style.display = "flex";

  // 댓글 목록 로드
  const commentsList = document.getElementById("commentsModalList");
  commentsList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">댓글을 불러오는 중...</div>';

  // 기존 리스너 정리
  if (commentsModalListener && commentsModalListener.ref && commentsModalListener.callback) {
    commentsModalListener.ref.off("value", commentsModalListener.callback);
  }

  // 댓글 리스너 설정
  const commentsModalCallback = (snap) => {
    const comments = snap.val() || {};
    commentsList.innerHTML = "";

    if (Object.keys(comments).length === 0) {
      commentsList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">댓글이 없어요. 첫 댓글을 남겨보세요!</div>';
    } else {
      Object.entries(comments).forEach(([commentId, comment]) => {
        if (comment.isHidden) return;

        const isCommentAuthor = isLoggedIn && currentUser && comment.authorUid === currentUser.uid;
        const timeStr = getRelativeTime(comment.timestamp);

        const commentEl = document.createElement("div");
        commentEl.style.cssText = "padding:12px;background:rgba(124,77,255,0.05);border-radius:8px;margin-bottom:8px";
        commentEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
            <div>
              <span style="font-weight:700;color:var(--text);font-size:0.9rem">${escHtml(comment.authorName)}</span>
              <div style="font-size:0.75rem;color:var(--muted);margin-top:2px">${timeStr}</div>
            </div>
            ${isCommentAuthor ? `<button onclick="deleteComment('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}'); event.stopPropagation()" style="font-size:0.7rem;background:rgba(255,77,77,0.1);border:1px solid rgba(255,77,77,0.3);color:var(--pink);cursor:pointer;padding:4px 8px;border-radius:4px">삭제</button>` : ''}
          </div>
          <div style="color:var(--text);font-size:0.9rem;line-height:1.5">${escHtml(comment.content)}</div>
        `;
        commentsList.appendChild(commentEl);
      });
    }
  };

  // 리스너 등록 및 저장
  const commentsRef = db.ref(`community/${fandom}/${postId}/comments`);
  commentsRef.on("value", commentsModalCallback);
  commentsModalListener = { ref: commentsRef, callback: commentsModalCallback };

  // 댓글 입력 섹션 업데이트
  const inputSection = document.getElementById("commentsModalInput");
  if (isLoggedIn) {
    inputSection.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <textarea id="modal-comment-input" placeholder="댓글을 입력해주세요..." style="width:100%;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;font-size:0.9rem;resize:none;min-height:60px" maxlength="500"></textarea>
        <button onclick="submitCommentFromModal('${escAttr(fandom)}', '${escAttr(postId)}'); event.stopPropagation()" style="padding:12px;background:var(--primary);border:none;border-radius:8px;color:#fff;font-weight:700;font-family:inherit;cursor:pointer">댓글 작성</button>
      </div>
    `;
  } else {
    inputSection.innerHTML = '<div style="text-align:center;padding:16px;background:rgba(124,77,255,0.1);border-radius:8px;color:var(--muted);font-size:0.9rem">댓글을 작성하려면 로그인해주세요</div>';
  }
}

// ── 댓글 모달 닫기 ──
function closeCommentsModal() {
  const modal = document.getElementById("commentsModal");
  modal.style.display = "none";

  // 리스너 정리
  if (commentsModalListener && commentsModalListener.ref && commentsModalListener.callback) {
    commentsModalListener.ref.off("value", commentsModalListener.callback);
    commentsModalListener = null;
  }
}

// ── 모달에서 댓글 작성 ──
async function submitCommentFromModal(fandom, postId) {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    return;
  }

  const textarea = document.getElementById("modal-comment-input");
  const content = textarea.value.trim();

  if (!content) {
    showToast("댓글 내용을 입력해주세요");
    return;
  }

  try {
    const commentId = db.ref().push().key;
    await db.ref(`community/${fandom}/${postId}/comments/${commentId}`).set({
      content,
      authorUid: currentUser.uid,
      authorName: currentUser.customNickname || currentUser.displayName || "익명",
      timestamp: Date.now(),
      isHidden: false
    });
    textarea.value = "";
    showToast("댓글이 작성됐어요!");
  } catch (e) {
    console.error("댓글 작성 실패:", e);
    showToast("댓글 작성에 실패했어요");
  }
}

// ── 댓글 개수 업데이트 ──
function updateCommentCount(fandom, postId) {
  const commentCountEl = document.getElementById(`comment-count-${postId}`);
  if (!commentCountEl) return;

  const commentCountCallback = (snap) => {
    const comments = snap.val() || {};
    const count = Object.keys(comments).filter(id => !comments[id].isHidden).length;
    if (commentCountEl) commentCountEl.textContent = count;
  };

  const commentsRef = db.ref(`community/${fandom}/${postId}/comments`);
  commentsRef.on("value", commentCountCallback);
  postListListeners.push({ ref: commentsRef, callback: commentCountCallback });
}

// ── 게시물 삭제 확인 ──
function confirmDeletePost(fandom, postId) {
  if (confirm("정말 이 게시물을 삭제하시겠어요?\n삭제하면 댓글도 함께 사라져요.")) {
    deletePost(fandom, postId);
  }
}

// ── 게시물 작성 폼 ──
function showPostCreateForm() {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    document.getElementById("authContainer").style.display = "block";
    return;
  }

  const selectedFandom = document.getElementById("communityFandomSelect").value;
  if (!selectedFandom) {
    showToast("먼저 팬덤을 선택해주세요");
    return;
  }

  // 권한 체크: 자신의 팬덤에서만 작성 가능 + 24시간 제약 확인
  if (!canWritePost(selectedFandom)) {
    return;
  }

  // 입력값 초기화
  document.getElementById("postTitle").value = "";
  document.getElementById("postContent").value = "";
  document.getElementById("postTitleCount").textContent = "0";
  document.getElementById("postContentCount").textContent = "0";

  // 선택된 팬덤명 표시
  const fandomGroup = GROUP_META[selectedFandom];
  document.getElementById("postCreateFandom").textContent = `${fandomGroup ? fandomGroup.emoji : ""} ${selectedFandom}`;

  // 제목 글자수 카운팅
  document.getElementById("postTitle").oninput = () => {
    document.getElementById("postTitleCount").textContent = document.getElementById("postTitle").value.length;
  };

  // 내용 글자수 카운팅
  document.getElementById("postContent").oninput = () => {
    document.getElementById("postContentCount").textContent = document.getElementById("postContent").value.length;
  };

  // 모달 표시
  const modal = document.getElementById("postCreateModal");
  modal.style.display = "flex";

  // 포커스 설정
  setTimeout(() => {
    document.getElementById("postTitle").focus();
  }, 100);
}

// 모달 상태 추적
let modalHistoryState = null;

function openPostCreateModal() {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    return;
  }

  // 팬덤 확인
  const selectedFandom = document.getElementById("communityFandomSelect").value || currentUser.primaryFandom;
  if (!selectedFandom) {
    showToast("팬덤을 먼저 선택해주세요");
    return;
  }

  // 모달 초기화
  document.getElementById("postTemplate").value = "free";
  document.getElementById("postTitle").value = "";
  document.getElementById("postContent").value = "";
  document.getElementById("postTitleCount").textContent = "0";
  document.getElementById("postContentCount").textContent = "0";
  document.getElementById("scheduleTemplate").style.display = "none";

  // 팬덤 표시
  document.getElementById("postCreateFandom").textContent = selectedFandom;

  // 모달 표시
  document.getElementById("postCreateModal").style.display = "flex";
  document.getElementById("postTitle").focus();

  // 뒤로가기 처리: history에 상태 추가
  modalHistoryState = history.length;
  history.pushState({modal: 'postCreate'}, '', '');
}

function closePostCreateModal() {
  document.getElementById("postCreateModal").style.display = "none";
}

// 모달 외부 클릭 시 닫기
document.addEventListener("click", (e) => {
  const modal = document.getElementById("postCreateModal");
  if (e.target === modal) {
    closePostCreateModal();
  }
});

// ESC 키로 모달 닫기
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("postCreateModal");
    if (modal.style.display === "flex") {
      closePostCreateModal();
    }
  }
});

// ── 이미지 미리보기 ──
function previewImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  // 이미지 크기 제한: 300KB
  const MAX_SIZE = 300 * 1024; // 300KB
  if (file.size > MAX_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    showToast(`파일이 너무 커요! (${sizeMB}MB)\n300KB 이하 이미지를 선택해주세요`);
    document.getElementById("postImage").value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const container = document.getElementById("imagePreviewContainer");
    container.innerHTML = `
      <div style="position:relative;display:inline-block">
        <img src="${e.target.result}" style="max-width:100%;border-radius:8px;max-height:200px">
        <button onclick="removeImage()" style="position:absolute;top:8px;right:8px;background:#ff4d4d;border:none;color:#fff;border-radius:50%;width:32px;height:32px;cursor:pointer;font-weight:700;font-size:1rem">✕</button>
      </div>
    `;
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  document.getElementById("postImage").value = "";
  document.getElementById("imagePreviewContainer").innerHTML = "";
}

// ── 배지 시스템 ──
async function addUserBadge(uid, badgeType) {
  if (!db) return;
  try {
    const badges = await db.ref(`users/${uid}/badges`).once("value");
    const currentBadges = badges.val() || [];

    if (!currentBadges.includes(badgeType)) {
      currentBadges.push(badgeType);
      await db.ref(`users/${uid}/badges`).set(currentBadges);
    }
  } catch (e) {
    console.error("배지 추가 실패:", e);
  }
}

async function getUserBadges(uid) {
  if (!db) return [];
  try {
    const badges = await db.ref(`users/${uid}/badges`).once("value");
    return badges.val() || [];
  } catch (e) {
    return [];
  }
}

function getBadgeDisplay(badgeType) {
  const badges = {
    "info-provider": { emoji: "📅", label: "정보 제공자", color: "rgba(124, 77, 255, 0.3)" }
  };
  return badges[badgeType] || null;
}

// ── 게시글 템플릿 업데이트 ──
function updatePostTemplate() {
  const template = document.getElementById("postTemplate").value;
  const scheduleTemplate = document.getElementById("scheduleTemplate");
  const titleInput = document.getElementById("postTitle");

  if (template === "schedule") {
    scheduleTemplate.style.display = "block";
  } else {
    scheduleTemplate.style.display = "none";
  }

  const placeholders = {
    free: "게시물 제목을 입력해주세요",
    schedule: "[일정] 공연명을 입력해주세요",
    fanart: "[팬아트] 작품 제목을 입력해주세요",
    news: "[뉴스] 제목을 입력해주세요",
    qna: "[Q&A] 질문을 입력해주세요"
  };
  titleInput.placeholder = placeholders[template] || "게시물 제목을 입력해주세요";
}

// ── 게시물 저장 ──
async function submitPost() {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    return;
  }

  const template = document.getElementById("postTemplate").value;
  let title = document.getElementById("postTitle").value.trim();
  let content = document.getElementById("postContent").value.trim();
  const selectedFandom = document.getElementById("communityFandomSelect").value;
  let isSchedule = false;

  // 일정 템플릿 처리
  if (template === "schedule") {
    const scheduleTitle = document.getElementById("scheduleTitle").value.trim();
    const scheduleDate = document.getElementById("scheduleDate").value;
    const scheduleLocation = document.getElementById("scheduleLocation").value.trim();
    const schedulePrice = document.getElementById("schedulePrice").value.trim();
    const scheduleLink = document.getElementById("scheduleLink").value.trim();

    if (!scheduleTitle || !scheduleDate) {
      showToast("공연명과 날짜를 입력해주세요");
      return;
    }

    isSchedule = true;
    if (!title) title = `[일정] ${scheduleTitle}`;

    // 일정 정보를 content에 자동 생성
    const dateObj = new Date(scheduleDate);
    const formattedDate = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

    const scheduleInfo = `📅 **${scheduleTitle}**\n\n🗓️ 날짜: ${formattedDate}\n${scheduleLocation ? `📍 장소: ${scheduleLocation}\n` : ""}${schedulePrice ? `💰 가격: ${schedulePrice}\n` : ""}${scheduleLink ? `🎫 [예매하기](${scheduleLink})\n` : ""}---\n\n${content}`;
    content = scheduleInfo;
  }

  if (!title) {
    showToast("제목을 입력해주세요");
    return;
  }
  if (!content || content === "---\n\n") {
    showToast("내용을 입력해주세요");
    return;
  }

  const submitBtn = event.target;
  submitBtn.disabled = true;
  submitBtn.textContent = "작성 중...";

  try {
    const postId = db.ref().push().key;

    // 게시물 저장
    const postData = {
      title,
      content,
      authorUid: currentUser.uid,
      authorName: currentUser.customNickname || currentUser.displayName || "익명",
      timestamp: Date.now(),
      isHidden: false,
      reportCount: 0,
      views: 0,
      type: template, // 게시글 유형 저장
      isSchedule: isSchedule // 일정 여부
    };

    await db.ref(`community/${selectedFandom}/${postId}`).set(postData);

    // 일정 게시글이면 "정보 제공자" 배지 부여
    if (isSchedule) {
      await addUserBadge(currentUser.uid, "info-provider");
      showToast("✅ 게시물이 작성되었어요! 📅 정보 제공자 배지를 획득했습니다!");
    } else {
      showToast("✅ 게시물이 작성되었어요!");
    }
    closePostCreateModal();

    showToast("✅ 게시물이 작성되었어요!");
    closePostCreateModal();
  } catch (error) {
    showToast("게시물 작성 실패: " + error.message);
    console.error(error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "작성하기";
  }
}

// ── 게시물 수정 ──
async function editPost(fandom, postId, title, content) {
  const newTitle = prompt("제목을 수정해주세요:", title);
  if (newTitle === null || newTitle.trim() === "") return;

  const newContent = prompt("내용을 수정해주세요:", content);
  if (newContent === null || newContent.trim() === "") return;

  try {
    await db.ref(`community/${fandom}/${postId}`).update({
      title: newTitle.trim(),
      content: newContent.trim()
    });
    showToast("✅ 게시물이 수정되었어요!");
  } catch (error) {
    showToast("수정 실패: " + error.message);
    console.error(error);
  }
}

// ── 게시물 삭제 ──
async function deletePost(fandom, postId) {
  if (!confirm("정말 삭제하시겠어요? 복구할 수 없습니다.")) return;

  try {
    // Database에서 게시물 삭제
    await db.ref(`community/${fandom}/${postId}`).remove();
    showToast("✅ 게시물이 삭제되었어요");
  } catch (error) {
    showToast("삭제 실패: " + error.message);
    console.error(error);
  }
}

// ── 게시물 전체 내용 보기 ──
function showFullContent(postId, content) {
  const modal = document.getElementById("fullContentModal");
  const textEl = document.getElementById("fullContentText");
  textEl.textContent = content;
  modal.style.display = "flex";
}

function closeFullContentModal() {
  document.getElementById("fullContentModal").style.display = "none";
}

// 모달 외부 클릭 시 닫기
document.addEventListener("click", (e) => {
  const modal = document.getElementById("fullContentModal");
  if (modal && e.target === modal) {
    closeFullContentModal();
  }
});

// ESC 키로 모달 닫기
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("fullContentModal");
    if (modal && modal.style.display === "flex") {
      closeFullContentModal();
    }
  }
});

// ── 좋아요 토글 ──
async function toggleLike(fandom, postId) {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인 후 좋아요를 할 수 있습니다");
    return;
  }

  const likeRef = db.ref(`community/${fandom}/${postId}/likes/${currentUser.uid}`);
  const snapshot = await likeRef.once("value");

  if (snapshot.exists()) {
    // 좋아요 취소
    await likeRef.remove();
  } else {
    // 좋아요 추가
    await likeRef.set(true);
  }

  // 좋아요 수 업데이트 및 data-likes 속성 갱신
  const likesSnap = await db.ref(`community/${fandom}/${postId}/likes`).once("value");
  const likeCount = Object.keys(likesSnap.val() || {}).length;

  const postEl = document.querySelector(`[data-postid="${postId}"]`);
  if (postEl) {
    postEl.setAttribute("data-likes", likeCount);
  }

  loadLikes(fandom, postId);
}

// ── 좋아요 수 로드 ──
function loadLikes(fandom, postId) {
  db.ref(`community/${fandom}/${postId}/likes`).on("value", snap => {
    const likes = snap.val() || {};
    const likeCount = Object.keys(likes).length;
    const likeCountEl = document.getElementById(`like-count-${postId}`);
    if (likeCountEl) {
      likeCountEl.textContent = likeCount;
    }
  });
}

// ── 조회수 로드 ──
function loadViews(fandom, postId) {
  const viewsCallback = (snap) => {
    const viewCount = snap.val() || 0;
    const viewCountEl = document.getElementById(`view-count-${postId}`);
    if (viewCountEl) {
      viewCountEl.textContent = viewCount;
    }
  };

  const viewsRef = db.ref(`community/${fandom}/${postId}/views`);
  viewsRef.on("value", viewsCallback);
  postDetailListeners.views = { ref: viewsRef, callback: viewsCallback };
}

// ── 포스트 리스트용 좋아요 로드 (리스너 추적) ──
function loadLikesForPostList(fandom, postId) {
  const likeCountEl = document.getElementById(`like-count-${postId}`);
  if (!likeCountEl) return;

  const likesCallback = (snap) => {
    const likes = snap.val() || {};
    const likeCount = Object.keys(likes).length;
    if (likeCountEl) {
      likeCountEl.textContent = likeCount;
    }
  };

  const likesRef = db.ref(`community/${fandom}/${postId}/likes`);
  likesRef.on("value", likesCallback);
  postListListeners.push({ ref: likesRef, callback: likesCallback });
}

// ── 포스트 리스트용 조회수 로드 (리스너 추적) ──
function loadViewsForPostList(fandom, postId) {
  const viewCountEl = document.getElementById(`view-count-${postId}`);
  if (!viewCountEl) return;

  const viewsCallback = (snap) => {
    const viewCount = snap.val() || 0;
    if (viewCountEl) {
      viewCountEl.textContent = viewCount;
    }
  };

  const viewsRef = db.ref(`community/${fandom}/${postId}/views`);
  viewsRef.on("value", viewsCallback);
  postListListeners.push({ ref: viewsRef, callback: viewsCallback });
}

// ── 댓글 로드 ──
function loadComments(fandom, postId) {
  const commentsList = document.getElementById(`comments-list-${postId}`);
  if (!commentsList) return;

  db.ref(`community/${fandom}/${postId}/comments`).on("value", snap => {
    const comments = snap.val() || {};
    commentsList.innerHTML = "";

    Object.entries(comments).forEach(([commentId, comment]) => {
      if (comment.isHidden) return;

      const commentDate = new Date(comment.timestamp);
      const timeStr = commentDate.toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'});
      const isCommentAuthor = isLoggedIn && currentUser && comment.authorUid === currentUser.uid;

      const commentEl = document.createElement("div");
      commentEl.style.cssText = "padding:8px;background:rgba(124,77,255,0.05);border-radius:6px;margin-bottom:8px;font-size:0.9rem";
      commentEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-weight:600;color:var(--text)">${escHtml(comment.authorName)}</span>
          <span style="font-size:0.75rem;color:var(--muted)">${timeStr}</span>
        </div>
        <div style="color:var(--text);margin-bottom:6px">${escHtml(comment.content)}</div>
        ${isCommentAuthor ? `<button onclick="deleteComment('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}'); event.stopPropagation()" style="font-size:0.75rem;background:none;border:none;color:var(--pink);cursor:pointer;padding:0">삭제</button>` : ''}
      `;
      commentsList.appendChild(commentEl);
    });
  });
}

// ── 댓글 작성 ──
async function submitComment(fandom, postId) {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인 후 댓글을 작성할 수 있습니다");
    return;
  }

  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();

  if (!content) {
    showToast("댓글 내용을 입력해주세요");
    return;
  }

  try {
    const commentId = db.ref().push().key;
    await db.ref(`community/${fandom}/${postId}/comments/${commentId}`).set({
      content,
      authorUid: currentUser.uid,
      authorName: currentUser.customNickname || currentUser.displayName || "익명",
      timestamp: Date.now(),
      isHidden: false
    });
    input.value = "";
    showToast("💬 댓글이 등록되었어요!");

    // 게시물 목록의 댓글 수 업데이트
    setTimeout(() => {
      updateCommentCount(fandom, postId);
    }, 300);
  } catch (error) {
    showToast("댓글 작성 실패: " + error.message);
    console.error(error);
  }
}

// ── 댓글 삭제 ──
async function deleteComment(fandom, postId, commentId) {
  if (!confirm("댓글을 삭제하시겠어요?")) return;

  try {
    await db.ref(`community/${fandom}/${postId}/comments/${commentId}`).remove();
    showToast("댓글이 삭제되었어요");
  } catch (error) {
    showToast("삭제 실패: " + error.message);
    console.error(error);
  }
}

// ── 게시물 신고 ──
async function reportPost(fandom, postId) {
  if (!isLoggedIn) {
    showToast("로그인 후 신고할 수 있습니다");
    return;
  }

  const reason = prompt("신고 사유를 선택하세요:\n1. 부적절한 내용\n2. 스팸\n3. 광고\n4. 욕설");
  if (!reason) return;

  try {
    // 기존 신고 데이터 조회
    const snap = await db.ref(`reports/${postId}`).once("value");
    const reportData = snap.val() || { reports: [], count: 0 };

    // 중복 신고 확인
    if (reportData.reports.some(r => r.uid === currentUser.uid)) {
      showToast("이미 신고한 게시물입니다");
      return;
    }

    // 신고 추가
    reportData.reports.push({
      uid: currentUser.uid,
      timestamp: Date.now(),
      reason: reason
    });
    reportData.count = reportData.reports.length;

    // 신고 저장
    await db.ref(`reports/${postId}`).set(reportData);

    // 3회 이상 신고 시 게시물 숨김
    if (reportData.count >= 3) {
      await db.ref(`community/${fandom}/${postId}/isHidden`).set(true);
      showToast("✅ 신고가 접수되었습니다 (게시물이 숨겨졌습니다)");
    } else {
      showToast(`✅ 신고가 접수되었습니다 (${reportData.count}/3)`);
    }
  } catch (error) {
    showToast("신고 실패: " + error.message);
    console.error(error);
  }
}

// ── 모달 뒤로가기 처리 ──
window.addEventListener('popstate', (e) => {
  if (e.state && e.state.page === 'postDetail') {
    window.popstateActive = true;
    closePostDetail();
    window.popstateActive = false;
  } else if (e.state && e.state.modal === 'postCreate') {
    // popstate 이벤트 발생 - 모달이 열려 있으면 닫기
    closePostCreateModal();
  }
});

