// ── 투표 제한 (무료 1표/일 + 구매한 투표권) ──
const MAX_FREE_VOTES_PER_DAY = 1;
let pendingPaidVotes = 0; // 구매한 미사용 투표권 개수

function getTodayKey()      { return new Date().toISOString().slice(0, 10); }

// ── Firebase 캐시 변수 ──
let cachedTodayFreeVote = null;   // 오늘 무료 투표한 그룹 or null

// ── 투표 상태 함수들 (Firebase 기반) ──
function getTodayFreeVoteCount()  { return cachedTodayFreeVote ? 1 : 0; } // 무료 투표 사용 여부 (0 or 1)
function getTodayVoteCount()      { return getTodayFreeVoteCount(); } // 오늘 사용한 무료 투표
function canUseFreeVote()         { return getTodayFreeVoteCount() === 0; } // 무료 투표 가능 여부
function canUsePaidVotes()        { return pendingPaidVotes > 0; } // 구매 투표권 사용 가능 여부

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
  const nextPeriod = new Date(now);
  nextPeriod.setDate(nextPeriod.getDate() + 14);
  const monthStr = (nextPeriod.getMonth() + 1) + "월";
  const dateStr = nextPeriod.getDate() + "일";
  el.textContent = `${monthStr} ${dateStr} 마감`;
}

function startBiweeklyCountdown() {
  if (_cdTimer) clearInterval(_cdTimer);
  function update() {
    const el = document.getElementById("countdownEl");
    if (!el) return;
    const now = new Date();

    // 다음 2주 마감 시간 (14일 뒤의 자정)
    const endOfPeriod = new Date(now);
    endOfPeriod.setDate(endOfPeriod.getDate() + 14);
    endOfPeriod.setHours(0, 0, 0, 0);

    const diff = endOfPeriod - now;
    if (diff <= 0) { el.innerHTML = "투표 마감! 개표 중입니다."; clearInterval(_cdTimer); return; }
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
      showVoteCompleteModal("free", group, meta.emoji, streak);
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

  // ★ 구매한 투표권 사용 가능할 때 (무료 투표 사용 후)
  if (canUsePaidVotes()) {
    try {
      // 구매 투표권 차감
      pendingPaidVotes -= 1;
      await savePendingPaidVotes();

      recordVote(group); // 로컬 히스토리 기록
      addActivity(group);

      // Firebase에 투표 기록 (비동기)
      db.ref("rankings/" + group).transaction(cur => (cur || 0) + 1);

      showVoteCompleteModal("paid", group, meta.emoji, pendingPaidVotes);

      renderMyVotingHistory();
      showMyVotedBar(cachedTodayFreeVote);
      updateFavBar();
      updateAuthUI();
    } catch (e) {
      console.error("구매 투표 저장 실패:", e);
      showToast("⚠️ 투표 저장에 실패했습니다. 다시 시도해주세요.");
    }
    return;
  }

  // ★ 무료 투표 이미 사용, 투표권 없는 경우
  if (!canUseFreeVote() && !canUsePaidVotes()) {
    showToast(`💳 오늘 무료 투표를 사용했어요! 투표권을 구매하면 더 투표할 수 있어요 🎁`);
    updateFavBar();
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

  // 무료 투표 사용한 경우
  if (!canUseFreeVote()) {
    if (pendingPaidVotes > 0) {
      sub += `  💳 구매 투표권 ${pendingPaidVotes}개 남음`;
    } else {
      sub += `<br style="height:4px"> ⏰ 내일 ${h}시간 ${m}분 후 무료 투표 가능`;
    }
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

// ── 투표권 구매 버튼 클릭 ──
function openVotePurchase() {
  if (!isLoggedIn) {
    showToast("🔐 로그인 후 투표권을 구매할 수 있어요!");
    showVoteLoginModal(null);
    return;
  }
  showVotePurchaseModal();
}

// ── 투표 후 상태 복원 (페이지 로드 시) ──
function restoreVotedState() {
  const group = cachedTodayFreeVote;
  if (!group) return;
  showMyVotedBar(group);
  updateFavBar();
}

// ── Firebase에 구매 투표권 저장 ──
async function savePendingPaidVotes() {
  if (!currentUser) return;

  try {
    await db.ref(`users/${currentUser.uid}/pendingPaidVotes`).set(pendingPaidVotes);
  } catch (e) {
    console.error("구매 투표권 저장 실패:", e);
    showToast("⚠️ 데이터 저장에 실패했습니다. 다시 시도하세요.");
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

