// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 팬덤/닉네임 설정
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 닉네임/팬덤 설정 모달 표시
function showAuthSetupModal() {
  if (document.getElementById("authSetupModal")) return;

  const modal = document.createElement("div");
  modal.id = "authSetupModal";
  modal.className = "auth-setup-modal";

  modal.innerHTML = `
    <div class="auth-setup-box">
      <div class="auth-setup-title">👤 내 정보 설정하기</div>

      <div class="auth-setup-section">
        <label class="auth-setup-label">📝 닉네임 (댓글에 표시됨)</label>
        <input type="text" id="authNicknameInput" class="auth-setup-input" placeholder="좋아하는 닉네임을 입력하세요" maxlength="12" />
      </div>

      <div class="auth-setup-section">
        <label class="auth-setup-label">💜 내 최애 팬덤</label>
        <div id="authFandomSearch">
          <input type="text" id="authFandomSearchInput" class="auth-setup-input" placeholder="팬덤 검색... (N, BTS, aes 등)" oninput="filterAuthFandoms(this.value)" />
          <div class="auth-fandom-search-hint">💡 팬덤 이름이나 첫글자로 검색하세요</div>
        </div>
        <div class="auth-fandom-grid" id="authFandomGrid"></div>
      </div>

      <div class="auth-setup-buttons">
        <button class="auth-setup-btn-skip" onclick="closeAuthSetupModal()">건너뛰기</button>
        <button class="auth-setup-btn-ok" onclick="confirmAuthSetup()">완료</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("authNicknameInput").focus();

  // 초기 그리드 렌더링
  renderAuthFandomGrid(ALL_GROUPS);

  // 배경 클릭으로 모달 닫기
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeAuthSetupModal();
    }
  });

  // ESC 키로 모달 닫기
  const handleAuthEsc = (e) => {
    if (e.key === "Escape") {
      closeAuthSetupModal();
      document.removeEventListener("keydown", handleAuthEsc);
    }
  };
  document.addEventListener("keydown", handleAuthEsc);

  // 모바일 뒤로가기 처리
  window.history.pushState({ modal: "authSetupModal" }, null, null);

  const handleAuthPopstate = () => {
    closeAuthSetupModal();
    window.removeEventListener("popstate", handleAuthPopstate);
  };
  window.addEventListener("popstate", handleAuthPopstate);
}

// 팬덤 검색 필터링
function filterAuthFandoms(query) {
  const searchInput = query.toLowerCase().trim();

  let filtered;
  if (!searchInput) {
    filtered = ALL_GROUPS;
  } else {
    filtered = ALL_GROUPS.filter(group => {
      const groupLower = group.toLowerCase();
      return groupLower.includes(searchInput) ||
             groupLower.startsWith(searchInput) ||
             (searchInput.length === 1 && group.charAt(0).toLowerCase() === searchInput.charAt(0));
    });
  }

  renderAuthFandomGrid(filtered, searchInput);
}

// 팬덤 그리드 렌더링
function renderAuthFandomGrid(groups, highlight = "") {
  const grid = document.getElementById("authFandomGrid");
  if (!grid) return;

  if (groups.length === 0) {
    grid.className = "auth-fandom-grid empty";
    grid.innerHTML = `<div class="auth-fandom-empty-msg">검색 결과가 없어요 😢</div>`;
    return;
  }

  grid.className = "auth-fandom-grid";
  grid.innerHTML = groups.map(g => {
    const meta = GROUP_META[g] || { emoji: "🌟" };
    const displayName = highlight ? highlightSearchText(g, highlight) : escHtml(g);
    return `<button class="auth-fandom-btn" onclick="selectAuthFandom('${escAttr(g)}')" data-fandom="${escAttr(g)}">
      ${meta.emoji} <span>${displayName}</span>
    </button>`;
  }).join("");
}

// 검색어 하이라이팅
function highlightSearchText(text, search) {
  if (!search) return escHtml(text);
  const regex = new RegExp(`(${search})`, "gi");
  return escHtml(text).replace(regex, '<span class="auth-fandom-highlight">$1</span>');
}

function selectAuthFandom(fandom) {
  document.querySelectorAll(".auth-fandom-btn").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.fandom === fandom);
  });
}

function confirmAuthSetup() {
  const nickname = document.getElementById("authNicknameInput").value.trim();
  const selectedBtn = document.querySelector(".auth-fandom-btn.selected");
  const fandom = selectedBtn ? selectedBtn.dataset.fandom : null;

  if (!nickname) {
    showToast("닉네임을 입력해주세요!");
    return;
  }

  saveAuthUserData(nickname, fandom);
}

function closeAuthSetupModal() {
  document.getElementById("authSetupModal")?.remove();
  updateAuthUI();
  showToast("👤 닉네임 설정을 건너뛰었어요!");
}

// Firebase에 사용자 데이터 저장
function saveAuthUserData(nickname, fandom) {
  if (!currentUser || !db) return;

  currentUser.customNickname = nickname;
  currentUser.customFandom = fandom;
  currentUser.primaryFandom = fandom;
  currentUserFav = fandom;

  const userData = {
    nickname: nickname,
    fandom: fandom || "",
    "preferences/primaryFandom": fandom || "",
    createdAt: Date.now()
  };

  db.ref(`users/${currentUser.uid}`).update(userData)
    .then(() => {
      console.log(`[DEBUG] 사용자 정보 저장 완료: ${nickname}, primaryFandom=${fandom}`);
      document.getElementById("authSetupModal")?.remove();
      updateAuthUI();
      renderFavChip();
      updateFavBar();
      showToast(`👤 ${nickname}님 정보가 저장되었어요! 💜`);
      window.pendingVoteGroup = null;
    })
    .catch(err => {
      showToast("저장 실패: " + err.message);
      console.error(err);
    });
}

// 투표 시 로그인 모달 표시
function showVoteLoginModal(group) {
  if (document.getElementById("voteLoginModal")) return;

  const modal = document.createElement("div");
  modal.id = "voteLoginModal";
  modal.className = "auth-setup-modal";

  const meta = GROUP_META[group] || { emoji: "🌟" };

  modal.innerHTML = `
    <div class="auth-setup-box" style="text-align: center; max-width: 360px;">
      <div style="font-size: 2.4rem; margin-bottom: 16px;">${meta.emoji}</div>
      <div class="auth-setup-title" style="font-size: 1.3rem; margin-bottom: 12px;">${escHtml(group)}에 투표하시나요?</div>
      <div style="font-size: 0.88rem; color: var(--muted); margin-bottom: 28px; line-height: 1.6;">
        로그인 후 투표할 수 있어요!<br>
        휴대폰·PC 등 여러 기기에서<br>부정 투표를 방지합니다! 🔐
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button onclick="loginFromVoteModal('${escAttr(group)}')" style="width: 100%; padding: 16px 12px; background: #fff; border: 1px solid #dadce0; border-radius: 8px; color: #202124; font-weight: 700; font-size: 1rem; font-family: inherit; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.1)">
          <i class="fab fa-google" style="font-size: 1.3rem"></i>
          <span>Google로 로그인</span>
        </button>
        <button onclick="loginFromVoteModalKakao('${escAttr(group)}')" style="width: 100%; padding: 16px 12px; background: #ffe812; border: none; border-radius: 8px; color: #000; font-weight: 700; font-size: 1rem; font-family: inherit; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.12)">
          <svg width="20" height="20" viewBox="0 0 200 200" style="fill: #000"><text x="100" y="130" font-size="140" font-weight="900" text-anchor="middle" font-family="sans-serif">K</text></svg>
          <span>Kakao로 로그인</span>
        </button>
      </div>

      <button onclick="closeVoteLoginModal()" style="width: 100%; padding: 12px; margin-top: 12px; background: transparent; border: 1px solid rgba(124,77,255,0.2); border-radius: 8px; color: var(--muted); font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: all 0.2s;">
        닫기
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeVoteLoginModal();
    }
  });

  const handleEsc = (e) => {
    if (e.key === "Escape") {
      closeVoteLoginModal();
      document.removeEventListener("keydown", handleEsc);
    }
  };
  document.addEventListener("keydown", handleEsc);
}

function closeVoteLoginModal() {
  document.getElementById("voteLoginModal")?.remove();
}
