// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 무료 투표 후 UI 표시
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

// ── 투표 후 상태 복원 (페이지 로드 시) ──
function restoreVotedState() {
  const group = cachedTodayFreeVote;
  if (!group) return;
  showMyVotedBar(group);
  updateFavBar();
}
