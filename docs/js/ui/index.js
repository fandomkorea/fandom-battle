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

