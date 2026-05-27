// ── 투표권 구매 모달 ──
const VOTE_PACKAGES = [
  { id: 'pack_s',  votes: 5,  price: 500,   label: '소형',  emoji: '🌱', color: '#4d9eff', desc: '가볍게 시작!',       perVote: '100원/개' },
  { id: 'pack_m',  votes: 12, price: 1000,  label: '중형',  emoji: '⭐', color: '#7c4dff', desc: '가장 인기!',         perVote: '약 83원/개' },
  { id: 'pack_l',  votes: 40, price: 3000,  label: '대형',  emoji: '🔥', color: '#ff4d8d', desc: '열혈 팬을 위해!',    perVote: '75원/개' },
];

function showVotePurchaseModal() {
  const existing = document.getElementById("votePurchaseModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "votePurchaseModal";
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.75); display: flex; align-items: center;
    justify-content: center; z-index: 10000; backdrop-filter: blur(6px);
    padding: 16px; box-sizing: border-box;
  `;

  const packagesHtml = VOTE_PACKAGES.map((pkg, i) => `
    <div style="
      background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
      border: 1.5px solid ${pkg.color}44;
      border-radius: 16px; padding: 20px 16px; text-align: center;
      transition: all 0.2s; cursor: pointer; position: relative;
      ${i === 1 ? `box-shadow: 0 0 0 2px ${pkg.color}; border-color: ${pkg.color};` : ''}
    "
    onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px ${pkg.color}44'"
    onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='${i===1?`0 0 0 2px ${pkg.color}`:'none'}'"
    onclick="purchaseVotePackage('${pkg.id}')">
      ${i === 1 ? `<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:${pkg.color};color:#fff;font-size:0.7rem;font-weight:800;padding:3px 12px;border-radius:20px;white-space:nowrap">✨ 인기</div>` : ''}
      <div style="font-size:2rem;margin-bottom:8px">${pkg.emoji}</div>
      <div style="font-size:1rem;font-weight:800;color:#fff;margin-bottom:4px">${pkg.label}</div>
      <div style="font-size:2rem;font-weight:900;color:${pkg.color};line-height:1.1">${pkg.votes}<span style="font-size:1rem;font-weight:600">개</span></div>
      <div style="font-size:0.75rem;color:rgba(255,255,255,0.5);margin:4px 0 12px">${pkg.perVote}</div>
      <div style="background:${pkg.color};color:#fff;border-radius:10px;padding:8px 0;font-weight:800;font-size:0.95rem">
        ${pkg.price.toLocaleString()}원
      </div>
      <div style="font-size:0.72rem;color:rgba(255,255,255,0.45);margin-top:6px">${pkg.desc}</div>
    </div>
  `).join('');

  modal.innerHTML = `
    <div style="
      background: linear-gradient(160deg, rgba(18,12,40,0.99) 0%, rgba(28,18,55,0.99) 100%);
      border: 1.5px solid rgba(124,77,255,0.35);
      border-radius: 24px; padding: 32px 24px 28px;
      max-width: 440px; width: 100%;
      box-shadow: 0 24px 80px rgba(124,77,255,0.3), inset 0 1px 0 rgba(255,255,255,0.07);
      animation: modalSlideIn 0.3s ease-out;
    ">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:2.8rem;margin-bottom:8px">💳</div>
        <h2 style="
          font-size:1.4rem;font-weight:800;margin:0 0 6px;
          background:linear-gradient(135deg,#ff4d8d,#7c4dff);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
        ">투표권 구매</h2>
        <p style="color:rgba(255,255,255,0.5);font-size:0.85rem;margin:0">
          무료 투표 외에 추가로 투표할 수 있어요 💜
        </p>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">
        ${packagesHtml}
      </div>

      <div style="
        background:rgba(255,255,255,0.04);border-radius:12px;
        padding:12px 14px;margin-bottom:20px;
        display:flex;gap:8px;align-items:center
      ">
        <span style="font-size:1.1rem">🔒</span>
        <span style="font-size:0.78rem;color:rgba(255,255,255,0.45);line-height:1.5">
          토스페이먼츠로 안전하게 결제돼요.<br>결제 후 즉시 투표권이 지급됩니다.
        </span>
      </div>

      <button onclick="document.getElementById('votePurchaseModal').remove()" style="
        width:100%;padding:13px;background:rgba(255,255,255,0.07);
        border:1px solid rgba(255,255,255,0.1);border-radius:12px;
        color:rgba(255,255,255,0.5);font-size:0.9rem;cursor:pointer;
        font-family:inherit;transition:all 0.15s
      " onmouseover="this.style.background='rgba(255,255,255,0.12)'"
         onmouseout="this.style.background='rgba(255,255,255,0.07)'">
        닫기
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function purchaseVotePackage(packageId) {
  // TODO: 토스페이먼츠 연동 후 실제 결제 연결 예정
  const pkg = VOTE_PACKAGES.find(p => p.id === packageId);
  if (!pkg) return;

  const modal = document.getElementById("votePurchaseModal");
  if (modal) modal.remove();

  showComingSoonModal(pkg);
}

function showComingSoonModal(pkg) {
  const existing = document.getElementById("comingSoonModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "comingSoonModal";
  modal.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.75);display:flex;align-items:center;
    justify-content:center;z-index:10001;backdrop-filter:blur(6px);
    padding:16px;box-sizing:border-box;
  `;

  modal.innerHTML = `
    <div style="
      background:linear-gradient(160deg,rgba(18,12,40,0.99),rgba(28,18,55,0.99));
      border:1.5px solid rgba(255,193,7,0.4);border-radius:24px;
      padding:40px 28px;max-width:360px;width:100%;text-align:center;
      box-shadow:0 24px 80px rgba(255,193,7,0.2);
      animation:modalSlideIn 0.3s ease-out;
    ">
      <div style="font-size:3.5rem;margin-bottom:16px">🛠️</div>
      <h2 style="
        font-size:1.4rem;font-weight:800;margin:0 0 10px;
        background:linear-gradient(135deg,#ffc107,#ff9800);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
      ">결제 준비 중이에요!</h2>
      <p style="color:rgba(255,255,255,0.6);font-size:0.9rem;line-height:1.7;margin:0 0 8px">
        <strong style="color:#ffc107">${pkg.emoji} ${pkg.label} (${pkg.votes}개 / ${pkg.price.toLocaleString()}원)</strong><br>
        곧 결제 기능이 오픈돼요!<br>
        조금만 기다려주세요 🙏
      </p>
      <p style="color:rgba(255,255,255,0.35);font-size:0.78rem;margin:0 0 24px">
        오픈 시 알림을 받고 싶으시다면<br>사이트를 즐겨찾기 해두세요 ⭐
      </p>
      <button id="comingSoonClose" style="
        width:100%;padding:13px;
        background:linear-gradient(135deg,#ffc107,#ff9800);
        border:none;border-radius:12px;color:#1a1a1a;
        font-weight:800;font-size:0.95rem;cursor:pointer;font-family:inherit;
        transition:all 0.2s
      " onmouseover="this.style.transform='translateY(-2px)'"
         onmouseout="this.style.transform='translateY(0)'">
        확인했어요!
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("comingSoonClose").onclick = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ── 투표 완료 모달 ──
function showVoteCompleteModal(type, group, emoji, param3, param4) {
  const existing = document.getElementById("voteCompleteModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "voteCompleteModal";
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  `;

  const content = document.createElement("div");

  if (type === "free") {
    // 무료 투표 완료
    const streak = param3;
    const streakDisplay = streak > 1 ? `🔥 ${streak}일 연속 투표 중!` : "";

    content.style.cssText = `
      background: linear-gradient(135deg, rgba(20, 15, 40, 0.98) 0%, rgba(30, 20, 50, 0.98) 100%);
      border: 1.5px solid rgba(77, 158, 255, 0.4);
      border-radius: 20px;
      padding: 40px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(77, 158, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      animation: modalSlideIn 0.3s ease-out;
      text-align: center;
    `;

    content.innerHTML = `
      <div style="font-size: 3.5rem; margin-bottom: 12px">✅</div>

      <h2 style="
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text);
        margin-bottom: 8px;
        background: linear-gradient(135deg, #4d9eff, #77b3ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      ">투표 완료!</h2>

      <p style="color: rgba(255, 255, 255, 0.7); font-size: 0.95rem; margin-bottom: 24px; line-height: 1.6;">
        <strong style="font-size: 1.2rem; color: var(--blue)">${emoji} ${group}</strong>에 투표했어요!<br>
        <span style="font-size: 0.9rem">1등을 향해 파이팅! 💪</span>
      </p>

      ${streakDisplay ? `
      <div style="background: linear-gradient(135deg, rgba(255, 77, 141, 0.15) 0%, rgba(255, 107, 157, 0.1) 100%); border: 1.5px solid rgba(255, 77, 141, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <div style="font-size: 1.3rem; font-weight: 700; color: var(--pink)">${streakDisplay}</div>
      </div>
      ` : ``}

      <button id="voteCompleteClose" style="
        width: 100%;
        padding: 14px 24px;
        background: linear-gradient(135deg, var(--blue) 0%, rgba(77, 158, 255, 0.85) 100%);
        border: none;
        border-radius: 12px;
        color: #fff;
        font-weight: 700;
        font-size: 0.95rem;
        cursor: pointer;
        transition: all 0.3s ease;
        font-family: inherit;
      " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 20px rgba(77,158,255,0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">
        다음 투표하기
      </button>
    `;
  } else if (type === "paid") {
    // 구매 투표권 사용 완료
    const remaining = param3;

    content.style.cssText = `
      background: linear-gradient(135deg, rgba(20, 15, 40, 0.98) 0%, rgba(30, 20, 50, 0.98) 100%);
      border: 1.5px solid rgba(255, 77, 141, 0.4);
      border-radius: 20px;
      padding: 40px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(255, 77, 141, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      animation: modalSlideIn 0.3s ease-out;
      text-align: center;
    `;

    content.innerHTML = `
      <div style="font-size: 3.5rem; margin-bottom: 12px">🎉</div>

      <h2 style="
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text);
        margin-bottom: 8px;
        background: linear-gradient(135deg, #ff4d8d, #7c4dff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      ">투표 완료!</h2>

      <p style="color: rgba(255, 255, 255, 0.7); font-size: 0.95rem; margin-bottom: 24px; line-height: 1.6;">
        <strong style="font-size: 1.2rem; color: var(--pink)">${emoji} ${group}</strong>에 투표했어요!<br>
        <span style="font-size: 0.9rem">남은 투표권: <strong style="color: var(--pink)">${remaining}개</strong></span>
      </p>

      <button id="voteCompleteClose" style="
        width: 100%;
        padding: 14px 24px;
        background: linear-gradient(135deg, #ff4d8d 0%, #7c4dff 100%);
        border: none;
        border-radius: 12px;
        color: #fff;
        font-weight: 700;
        font-size: 0.95rem;
        cursor: pointer;
        transition: all 0.3s ease;
        font-family: inherit;
      " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 20px rgba(255,77,141,0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">
        계속 투표하기 💜
      </button>
    `;
  }

  modal.appendChild(content);
  document.body.appendChild(modal);

  // 타이머: 2.5초 후 자동 닫기
  const autoCloseTimer = setTimeout(() => {
    modal.remove();
  }, 2500);

  document.getElementById("voteCompleteClose").onclick = () => {
    clearTimeout(autoCloseTimer);
    modal.remove();
  };

  modal.onclick = (e) => {
    if (e.target === modal) {
      clearTimeout(autoCloseTimer);
      modal.remove();
    }
  };
}

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

  // 모바일 뒤로가기 처리: 모달 열릴 때 history에 entry 추가
  window.history.pushState({ modal: "authSetupModal" }, null, null);

  // 모달이 닫힐 때 popstate 이벤트 제거를 위한 준비
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
      // 이름에 포함되거나 시작하거나, 한 글자만 입력했을 때만 첫 글자 비교
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

  if (!fandom) {
    showToast("💜 최애 팬덤을 선택해주세요!");
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
  currentUser.primaryFandom = fandom; // ★ primaryFandom도 설정
  currentUserFav = fandom; // ★ 전역 변수도 설정
  if (fandom) localStorage.setItem('my_fav_group', fandom); // ★ 새로고침 시 즉시 로드용 캐시

  // ★ update() 사용: 기존 데이터는 유지하고 필요한 부분만 업데이트
  const userData = {
    nickname: nickname,
    fandom: fandom || "",
    "preferences/primaryFandom": fandom || "", // ★ 통합된 경로로 저장
    createdAt: Date.now()
  };

  db.ref(`users/${currentUser.uid}`).update(userData) // ★ set → update로 변경
    .then(() => {
      // ★ setMyFav() 호출 제거 - 이미 위에서 설정함
      document.getElementById("authSetupModal")?.remove();
      updateAuthUI();
      renderFavChip(); // 팬덤 표시 업데이트
      updateFavBar(); // 하단 바 업데이트
      showToast(`👤 ${nickname}님 정보가 저장되었어요! 💜`);

      // 로그인 완료 - 투표는 사용자가 직접 선택하도록 (자동 투표 제거)
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
        <button onclick="loginFromVoteModalTwitter('${escAttr(group)}')" style="width: 100%; padding: 16px 12px; background: #000; border: none; border-radius: 8px; color: #fff; font-weight: 700; font-size: 1rem; font-family: inherit; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.3)">
          <i class="fab fa-x-twitter" style="font-size: 1.3rem"></i>
          <span>X로 로그인</span>
        </button>
        <button onclick="loginFromVoteModalApple('${escAttr(group)}')" style="width: 100%; padding: 16px 12px; background: #000; border: none; border-radius: 8px; color: #fff; font-weight: 700; font-size: 1rem; font-family: inherit; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.3)">
          <i class="fab fa-apple" style="font-size: 1.3rem"></i>
          <span>Apple ID로 로그인</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 배경 클릭으로 모달 닫기
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeVoteLoginModal();
    }
  });

  // ESC 키로 모달 닫기
  const handleEsc = (e) => {
    if (e.key === "Escape") {
      closeVoteLoginModal();
      document.removeEventListener("keydown", handleEsc);
    }
  };
  document.addEventListener("keydown", handleEsc);

  // 모바일 뒤로가기 처리: 모달 열릴 때 history에 entry 추가
  window.history.pushState({ modal: "voteLoginModal" }, null, null);

  // 모달이 닫힐 때 popstate 이벤트 제거를 위한 준비
  const handlePopstate = () => {
    closeVoteLoginModal();
    window.removeEventListener("popstate", handlePopstate);
  };
  window.addEventListener("popstate", handlePopstate);
}

// 로그인 모달 닫기
function closeVoteLoginModal() {
  const modal = document.getElementById("voteLoginModal");
  if (modal) modal.remove();
}

// 실제 투표 진행 (로그인 모달 닫은 후)
async function proceedWithVote(group) {
  const meta = GROUP_META[group] || { emoji: "🌟" };

  const already = await checkUserVotedToday();
  if (already) {
    showToast(`💳 투표권을 구매하면 더 많이 투표할 수 있어요!`);
    return;
  }

  // 첫 무료 투표
  db.ref("rankings/" + group).transaction(cur => (cur || 0) + 1);
  await recordUserVote(group);
  recordVote(group);
  addActivity(group);
  const streak = updateVotingStreak();
  const streakMsg = streak > 1 ? `🔥 ${streak}일 연속 투표 중!` : "";
  showToast(meta.emoji + " " + group + " 투표 완료! 1등을 향해!" + (streakMsg ? " " + streakMsg : ""));
  showConfetti(meta.color);
  if (allRankingsData) {
    allRankingsData[group] = (allRankingsData[group] || 0) + 1;
    renderRankings(allRankingsData);
  }
  renderMyVotingHistory();
  showMyVotedBar(group);
}

function init() {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();

    // 최애팬덤 로드
    getMyFav();

    setupAuthListener();
    listenRankings();
    listenBannerConfig();
    listenPrizeNotice();
    loadGroupRecords();
    loadMonthlyHistory();
    renderFavChip();
    renderMyVotingHistory();
    updateTodayVoteDisplay();
    buildCommentSelect();
    startBiweeklyCountdown();
    setMonthLabel();
    renderNickDisplay();
    handleShareRef();
    restoreVotedState(); // 페이지 로드 시 투표 상태 복원
    setTimeout(showFavBar, 1500);
    if (isAdmin) {
      const pw = prompt("관리자 패스워드:");
      db.ref('admin_config/pw').once('value').then(snap => {
        if (snap.val() && pw === snap.val()) setupAdmin();
        else alert("패스워드가 틀렸습니다.");
      });
    }

    // ★ 마지막 활성 페이지 복원 (sessionStorage 우선, Firebase 보조)
    const activePage = sessionStorage.getItem('activePage') || "vote";
    if (activePage === "community") {
      showCommunityPage();
    } else {
      showVotePage();
    }
  } catch (e) {
    console.error(e);
  }
}

