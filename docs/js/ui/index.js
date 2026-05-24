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
