// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 광고 투표 & 광고 시청
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
    showVoteLoginModal(null);
    return;
  }

  watchAd();
}

// ── 광고 시청 → 추가 투표권 ──
function watchAd() {
  // 총 투표를 모두 사용한 경우 광고 시청 불가
  if (getTodayVoteCount() >= MAX_TOTAL_VOTES_PER_DAY) {
    showToast(`🏆 오늘 최대 투표 11표를 모두 사용했어요! 내일 또 와줘 💜`);
    return;
  }

  // 광고를 10번 이상 본 경우
  if (adWatchCount >= MAX_AD_VOTES_PER_DAY) {
    showToast(`🎁 광고 시청은 하루 최대 10회까지 가능해요! (현재: ${adWatchCount}회 시청, ${pendingAdVotes}개 투표권 보유)`);
    return;
  }

  if (document.getElementById("adModal")) return;

  const modal = document.createElement("div");
  modal.id = "adModal";
  modal.className = "ad-modal-overlay";
  let sec = 30;

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

// ── 광고 보상 받기 ──
async function claimAdReward() {
  document.getElementById("adModal")?.remove();
  pendingAdVotes += 1;
  adWatchCount += 1;
  await savePendingAdVotes();
  await saveAdWatchCount();
  showToast(`🎁 투표권 획득! (누적: ${pendingAdVotes}개, 광고: ${adWatchCount}/10회) 아래에서 팀을 선택해서 투표하세요! ⬇️`);

  // 팬덤 선택 바 업데이트
  updateFavBar();
  updateAuthUI();

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

// ── Firebase에 광고 시청 횟수 저장 ──
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
