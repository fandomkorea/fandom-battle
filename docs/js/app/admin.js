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
