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