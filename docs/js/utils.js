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
  if (!area) return;
  const fav = currentUserFav; // Firebase 기반으로 변경
  if (!fav) {
    area.innerHTML = "";
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

  // 초기 그리드 렌더링
  const renderGrid = (searchQuery = "") => {
    const filtered = ALL_GROUPS.filter(g => {
      const meta = GROUP_META[g] || { emoji:"🌟" };
      const displayName = meta.kr ? `${meta.kr} ${g}` : g;
      const searchLower = searchQuery.toLowerCase();
      return displayName.toLowerCase().includes(searchLower);
    });

    return filtered.map(g => {
      const meta = GROUP_META[g] || { emoji:"🌟" };
      const displayName = meta.kr ? `${meta.kr} (${g})` : g;
      return `<button class="fav-picker-btn ${myFav===g?"selected":""}" onclick="pickFav('${escAttr(g)}')">
        <span class="fp-emoji">${meta.emoji}</span>
        <span class="fp-name">${escHtml(displayName)}</span>
      </button>`;
    }).join("");
  };

  const initialGrid = renderGrid();
  overlay.innerHTML = `<div class="fav-picker-sheet">
    <div class="fav-picker-title">💜 내 최애 그룹은?<button class="fav-picker-close" onclick="closeFavPicker()">✕</button></div>
    <input type="text" id="fandomSearchInput" placeholder="🔍 팬덤 검색... (예: NCT, 뉴진스)" style="
      width: 100%;
      padding: 10px 14px;
      margin-bottom: 14px;
      border: 1.5px solid rgba(124,77,255,0.3);
      border-radius: 10px;
      background: rgba(124,77,255,0.08);
      color: var(--text);
      font-family: inherit;
      font-size: 0.9rem;
      outline: none;
      transition: all 0.2s;
      box-sizing: border-box;
    " />
    <div class="fav-picker-grid" id="fandomGrid">${initialGrid}</div>
  </div>`;
  document.body.appendChild(overlay);

  // 검색 입력 이벤트
  const searchInput = document.getElementById("fandomSearchInput");
  const gridContainer = document.getElementById("fandomGrid");

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value;
    gridContainer.innerHTML = renderGrid(query);

    // 검색어 입력 중 포커스 유지
    searchInput.focus();
  });

  // 자동 포커스
  setTimeout(() => searchInput.focus(), 100);

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
        <button onclick="document.getElementById('fandomSetupPopup')?.remove(); showVoteLoginModal(null);" style="
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
  const pageTitle = document.querySelector("header h1");
  const liveBadge = document.getElementById("liveBadge");

  if (votePage) votePage.classList.remove("hidden");
  if (communityPage) communityPage.classList.remove("show");

  // 상단 제목을 원래대로 복원
  if (pageTitle) {
    pageTitle.textContent = "⚔️ 팬덤배틀";
  }

  // LIVE 배지 표시
  if (liveBadge) liveBadge.style.display = "block";

  document.querySelectorAll(".nav-tab").forEach((tab, i) => {
    tab.classList.toggle("active", i === 0);
  });

  sessionStorage.setItem('activePage', 'vote');
  if (isLoggedIn && currentUser && db) {
    db.ref(`users/${currentUser.uid}`).update({ activePage: "vote" }).catch(() => {});
  }
}

function showCommunityPage() {
  // Firebase에서 마지막 정렬 모드 로드
  loadLastSortMode();

  const votePage = document.getElementById("votePage");
  const communityPage = document.getElementById("communityPage");
  const communityHeaderInfo = document.getElementById("communityHeaderInfo");
  const pageTitle = document.querySelector("header h1");
  const liveBadge = document.getElementById("liveBadge");

  if (votePage) votePage.classList.add("hidden");
  if (communityPage) communityPage.classList.add("show");
  if (communityHeaderInfo) communityHeaderInfo.style.display = "none"; // 커뮤니티 헤더 숨기기

  // 상단 제목을 커뮤니티 이름으로 변경
  if (pageTitle && currentUserFav && GROUP_META[currentUserFav]) {
    const meta = GROUP_META[currentUserFav];
    pageTitle.textContent = `${meta.emoji} ${currentUserFav} 커뮤니티`;
  }

  // LIVE 배지 숨기기
  if (liveBadge) liveBadge.style.display = "none";

  document.querySelectorAll(".nav-tab").forEach((tab, i) => {
    tab.classList.toggle("active", i === 1);
  });

  sessionStorage.setItem('activePage', 'community');
  if (isLoggedIn && currentUser && db) {
    db.ref(`users/${currentUser.uid}`).update({ activePage: "community" }).catch(() => {});
  }

  // 팬덤 드롭다운 초기화
  const select = document.getElementById("communityFandomSelect");

  if (!select) {
    console.error("[ERROR] communityFandomSelect 요소를 찾을 수 없음");
    return;
  }

  // 팬덤 목록이 없으면 채우기
  if (select.options.length <= 1) {
    if (GROUP_META && typeof GROUP_META === 'object') {
      const groupNames = Object.keys(GROUP_META);
      groupNames.forEach(groupName => {
        const meta = GROUP_META[groupName];
        const option = document.createElement("option");
        option.value = groupName;
        option.textContent = `${meta.emoji} ${groupName}`;
        select.appendChild(option);
      });
    } else {
      console.error("[ERROR] GROUP_META가 객체가 아님");
    }
  }

  // 최애팬덤이 있으면 자동 선택 (Firebase auth 미완료면 localStorage 캐시 사용)
  const favToUse = currentUserFav || localStorage.getItem('my_fav_group');
  if (favToUse) {
    select.value = favToUse;
  }

  // 선택된 팬덤이 있으면 게시물 로드 (최애팬덤 여부와 상관없이)
  if (select.value) {
    loadCommunityPosts();
  }
}

