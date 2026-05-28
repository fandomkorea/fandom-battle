// ── 인증 상태 관리 ──
let auth = null;
let currentUser = null;
let isLoggedIn = false;
let currentUserFav = null; // 사용자의 최애 팬덤

// Google 로그인
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  // 기존 로그인된 계정이 자동으로 나타나도록 설정
  provider.setCustomParameters({
    prompt: 'select_account' // 계정 선택 화면 표시 (기존 계정 포함)
  });
  firebase.auth().signInWithPopup(provider)
    .then(result => {
      currentUser = result.user;
      isLoggedIn = true;
      syncVotesWithServer();
      // 모달 띄우기 전에 기존 닉네임 확인
      loadAuthUserData(() => {
        if (!currentUser.customNickname) {
          showAuthSetupModal();
        } else {
          updateAuthUI();
          showToast(`👤 ${currentUser.customNickname}님 환영합니다!`);

          // 투표 대기 중이면 투표 진행
          if (window.pendingVoteGroup) {
            const group = window.pendingVoteGroup;
            window.pendingVoteGroup = null;
            setTimeout(() => voteForGroup(group), 500);
          }
        }
      });
    })
    .catch(error => {
      showToast("Google 로그인 실패: " + error.message);
      console.error(error);
    });
}

// X (Twitter) 로그인
function signInWithTwitter() {
  const provider = new firebase.auth.TwitterAuthProvider();
  firebase.auth().signInWithPopup(provider)
    .then(result => {
      currentUser = result.user;
      isLoggedIn = true;
      syncVotesWithServer();
      loadAuthUserData(() => {
        if (!currentUser.customNickname) {
          showAuthSetupModal();
        } else {
          updateAuthUI();
          showToast(`👤 ${currentUser.customNickname}님 환영합니다!`);

          // 투표 대기 중이면 투표 진행
          if (window.pendingVoteGroup) {
            const group = window.pendingVoteGroup;
            window.pendingVoteGroup = null;
            setTimeout(() => voteForGroup(group), 500);
          }
        }
      });
    })
    .catch(error => {
      showToast("X 로그인 실패: " + error.message);
      console.error(error);
    });
}

// Apple ID 로그인
function signInWithApple() {
  const provider = new firebase.auth.OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');

  firebase.auth().signInWithPopup(provider)
    .then(result => {
      currentUser = result.user;
      isLoggedIn = true;
      syncVotesWithServer();
      loadAuthUserData(() => {
        if (!currentUser.customNickname) {
          showAuthSetupModal();
        } else {
          updateAuthUI();
          showToast(`👤 ${currentUser.customNickname}님 환영합니다!`);

          // 투표 대기 중이면 투표 진행
          if (window.pendingVoteGroup) {
            const group = window.pendingVoteGroup;
            window.pendingVoteGroup = null;
            setTimeout(() => voteForGroup(group), 500);
          }
        }
      });
    })
    .catch(error => {
      showToast("Apple ID 로그인 실패: " + error.message);
      console.error(error);
    });
}

// 로그아웃
function signOut() {
  firebase.auth().signOut().then(() => {
    currentUser = null;
    isLoggedIn = false;

    // ★ Firebase 기반으로 변경 - currentUserFav 초기화
    currentUserFav = null;

    // 캐시 초기화
    pendingPaidVotes = 0;
    cachedTodayFreeVote = null;

    // ★ localStorage 제거 (Firebase로 마이그레이션 완료)
    // localStorage.removeItem("my_fav_group"); ← 더 이상 필요 없음

    updateAuthUI();
    updateFavBar();
    showToast("로그아웃되었어요! 👋");
  }).catch(error => {
    showToast("로그아웃 실패: " + error.message);
  });
}

// 익명으로 투표 계속
function continueAnonymousVote(group) {
  isLoggedIn = false;
  currentUser = null;
  document.getElementById("voteLoginModal")?.remove();
  updateAuthUI();
  // 실제 투표 진행
  proceedWithVote(group);
}

// 투표 모달에서 로그인
function loginFromVoteModal(group) {
  document.getElementById("voteLoginModal")?.remove();
  window.pendingVoteGroup = group; // 투표 그룹 저장
  signInWithGoogle();
}

function loginFromVoteModalKakao(group) {
  document.getElementById("voteLoginModal")?.remove();
  window.pendingVoteGroup = group;
  signInWithKakao();
}

function loginFromVoteModalTwitter(group) {
  document.getElementById("voteLoginModal")?.remove();
  window.pendingVoteGroup = group;
  signInWithTwitter();
}

function loginFromVoteModalApple(group) {
  document.getElementById("voteLoginModal")?.remove();
  window.pendingVoteGroup = group;
  signInWithApple();
}

// 로그인 상태 감시
function setupAuthListener() {
  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      isLoggedIn = true;

      // ★ 커뮤니티 게시물 조기 로드: auth 완료 즉시 재시도
      // (init()의 loadCommunityPosts가 permission-denied로 실패했을 경우 여기서 재시도)
      const _cachedFandom = localStorage.getItem('my_fav_group');
      if (sessionStorage.getItem('activePage') === 'community' && _cachedFandom) {
        const _sel = document.getElementById('communityFandomSelect');
        if (_sel && typeof communityPostsLoaded !== 'undefined' && !communityPostsLoaded) {
          if (!_sel.value) _sel.value = _cachedFandom;
          if (typeof loadCommunityPosts === 'function') loadCommunityPosts();
        }
      }

      await loadUserVotes(); // Firebase에서 투표권 로드 (닉네임도 함께 로드)
      // loadUserVotes() 내에서 updateAuthUI()를 호출하므로 여기서는 안 함

      // ★ 팬덤 설정 팝업 닫기
      closeFandomSetupPopup();
    } else {
      currentUser = null;
      isLoggedIn = false;
      pendingPaidVotes = 0;
      updateAuthUI(); // 로그아웃 경로에서만 여기서 호출
      updateFavBar();

      // ★ 팬덤 설정하지 않았으면 팝업 띄우기
      setTimeout(() => {
        if (!isLoggedIn && !getMyFav()) {
          showFandomSetupPopup();
        }
      }, 500);
    }
  });
}

// ── Firebase에서 투표 데이터 로드 ──
async function loadUserVotes() {
  if (!currentUser) return;

  try {
    const today = getTodayKey();

    const [userSnap, freeVoteSnap] = await Promise.all([
      db.ref(`users/${currentUser.uid}`).once("value"),
      db.ref(`votes/${today}/${currentUser.uid}`).once("value")
    ]);

    const data = userSnap.val() || {};

    // 구매 투표권
    pendingPaidVotes = data.pendingPaidVotes || 0;

    // 무료 투표 기록
    cachedTodayFreeVote = freeVoteSnap.exists() ? freeVoteSnap.val().group : null;

    // 닉네임 / 팬덤
    currentUser.customNickname = data.nickname || null;
    currentUser.customFandom = data.fandom || null;
    currentUser.primaryFandom = data.preferences?.primaryFandom || null;
    currentUserFav = data.preferences?.primaryFandom || null;
    if (currentUserFav) localStorage.setItem('my_fav_group', currentUserFav);
    currentUser.lastFandomChangeTime = data.lastFandomChangeTime || 0;
    currentUser.votingStreak = data.votingStreak || 0;
    currentUser.lastVoteDate = data.lastVoteDate || null;
    currentUser.activePage = data.activePage || "vote";

    updateFavBar();
    updateAuthUI();

    // ★ 새로고침 시 커뮤니티 페이지 복원
    const activePage = sessionStorage.getItem('activePage') || currentUser?.activePage || "vote";
    if (activePage === "community" && currentUserFav) {
      const select = document.getElementById("communityFandomSelect");
      if (select && typeof communityPostsLoaded !== 'undefined' && !communityPostsLoaded) {
        if (!select.value) select.value = currentUserFav;
        if (typeof loadCommunityPosts === "function") loadCommunityPosts();
      }
    }

    // ★ 투표권 로드 후 랭킹 다시 렌더링
    if (allRankingsData) {
      renderRankings(allRankingsData);
    }

    // ★ 알림 로드
    if (typeof loadNotifications === 'function') loadNotifications();
  } catch (e) {
    console.error("투표 데이터 로드 실패:", e);
    pendingPaidVotes = 0;
    cachedTodayFreeVote = null;
  }
}

// UI 업데이트
function updateAuthUI() {
  const container = document.getElementById("authContainer");
  const loggedIn = document.getElementById("authLoggedIn");

  if (!container || !loggedIn) return;

  if (isLoggedIn && currentUser) {
    container.style.display = "block"; // 로그인 후에만 표시
    loggedIn.style.display = "flex";
    const nickname = currentUser.customNickname || "👤 사용자";

    // ★ 투표 정보 계산
    const freeVotes = getTodayFreeVoteCount();
    const availableVotes = (canUseFreeVote() ? 1 : 0) + pendingPaidVotes; // 사용 가능한 투표권
    const nameEl = document.getElementById("userDisplayName");
    nameEl.innerHTML = '';
    const nickSpan = document.createElement('span');
    nickSpan.textContent = nickname;
    nickSpan.style.cssText = 'cursor:pointer;border-bottom:1px dashed rgba(124,77,255,0.45);color:var(--primary);flex-shrink:0';
    nickSpan.title = '닉네임 변경';
    nickSpan.onclick = () => showNicknameChangeModal();
    const voteSpan = document.createElement('span');
    voteSpan.textContent = ` · 투표권: ${availableVotes}개`;
    voteSpan.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.75';
    nameEl.appendChild(nickSpan);
    nameEl.appendChild(voteSpan);

    // ★ 상단 구매 버튼 렌더링
    const adButtonContainer = document.getElementById("adButtonContainer");
    if (adButtonContainer) {
      adButtonContainer.innerHTML = `<button style="padding:6px 10px;font-size:0.75rem;border-radius:6px;border:1px solid var(--primary);background:rgba(124,77,255,0.2);color:var(--primary);cursor:pointer;transition:all 0.15s;white-space:nowrap" onclick="openVotePurchase()">💳 투표권 구매</button>`;
    }
  } else {
    container.style.display = "none"; // 로그인 전에는 숨김
    loggedIn.style.display = "none";
  }
}

// 사용자가 오늘 투표했는지 확인
async function checkUserVotedToday() {
  if (!isLoggedIn || !currentUser) {
    return cachedTodayFreeVote; // 익명: localStorage 사용
  }

  const today = getTodayKey();
  const snap = await db.ref(`votes/${today}/${currentUser.uid}`).once("value");
  return snap.exists() ? snap.val().group : null;
}

// 투표 기록 저장
async function recordUserVote(group) {
  if (isLoggedIn && currentUser) {
    const today = getTodayKey();
    const record = {
      group: group,
      timestamp: Date.now(),
      email: currentUser.email
    };
    // Firebase에 저장
    await db.ref(`votes/${today}/${currentUser.uid}`).set(record);
    // localStorage에도 저장 (UI와 getTodayVoteCount()에서 사용)
    cachedTodayFreeVote = group; // Firebase에 저장됨
  } else {
    // 익명: localStorage 사용
    cachedTodayFreeVote = group; // Firebase에 저장됨
  }
}

// localStorage 투표를 서버로 동기화 (로그인 시)
async function syncVotesWithServer() {
  if (!isLoggedIn || !currentUser) return;

  const history = JSON.parse(localStorage.getItem("my_voting_history") || "{}");
  const promises = [];

  Object.entries(history).forEach(([date, group]) => {
    promises.push(
      db.ref(`votes/${date}/${currentUser.uid}`).set({
        group: group,
        timestamp: Date.now(),
        migrated: true
      }).catch(err => console.log("Sync error for", date, err))
    );
  });

  await Promise.all(promises).catch(err => console.error("Sync failed:", err));
}

// Firebase에서 사용자 데이터 로드
function loadAuthUserData(callback) {
  if (!currentUser || !db) {
    if (callback) callback();
    return;
  }

  db.ref(`users/${currentUser.uid}`).once("value", snap => {
    if (snap.exists()) {
      const data = snap.val();
      currentUser.customNickname = data.nickname || null;
      currentUser.customFandom = data.fandom || null;
      // ★ 경로 수정: preferences/primaryFandom에서 읽기
      currentUser.primaryFandom = data.preferences?.primaryFandom || null; // 기본 팬덤
      currentUserFav = data.preferences?.primaryFandom || null; // ← Firebase에서 읽은 팬덤을 전역 변수에도 설정
      // ★ localStorage 캐시 업데이트 (새로고침 시 즉시 로드를 위해)
      if (currentUserFav) localStorage.setItem('my_fav_group', currentUserFav);
      currentUser.lastFandomChangeTime = data.lastFandomChangeTime || 0;
      currentUser.lastNicknameChangeTime = data.lastNicknameChangeTime || 0;

      // ★ 투표 스트릭 데이터 로드
      currentUser.votingStreak = data.votingStreak || 0;
      currentUser.lastVoteDate = data.lastVoteDate || null;
      currentUser.activePage = data.activePage || "vote";

    }
    if (callback) callback();
  }).catch(err => {
    console.error("Failed to load user data:", err);
    if (callback) callback();
  });
}

// ── 닉네임 변경 모달 ──
function showNicknameChangeModal() {
  if (!isLoggedIn || !currentUser) { showToast("로그인이 필요해요"); return; }

  const existing = document.getElementById('nicknameChangeModal');
  if (existing) existing.remove();

  const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
  const lastChange = currentUser.lastNicknameChangeTime || 0;
  const cooldownRemaining = (lastChange + COOLDOWN_MS) - Date.now();
  const onCooldown = cooldownRemaining > 0;
  const currentNick = currentUser.customNickname || '';

  const modal = document.createElement('div');
  modal.id = 'nicknameChangeModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;z-index:10000;backdrop-filter:blur(5px)';

  const cooldownInfoHtml = onCooldown
    ? `<div style="background:rgba(255,193,7,0.07);border:1px solid rgba(255,193,7,0.22);border-radius:10px;padding:11px 14px;margin-bottom:16px;font-size:0.8rem;color:rgba(255,193,7,0.9);line-height:1.5">⏳ 닉네임 변경은 30일마다 1회 가능해요<br>다음 변경 가능일: ${_formatDate(lastChange + COOLDOWN_MS)}</div>`
    : `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:11px 14px;margin-bottom:16px;font-size:0.8rem;color:var(--muted);line-height:1.5">ℹ️ 변경 후 30일간 재변경 불가 · 2~12자</div>`;

  modal.innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(18,12,36,0.99) 0%,rgba(26,16,46,0.99) 100%);border:1.5px solid rgba(124,77,255,0.3);border-radius:20px;padding:32px 24px 24px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(124,77,255,0.22);animation:modalSlideIn 0.28s ease-out;position:relative">
      <button id="nickModalClose" style="position:absolute;top:12px;right:13px;background:none;border:none;color:rgba(255,255,255,0.28);font-size:1.2rem;cursor:pointer;padding:6px 8px;border-radius:6px">✕</button>
      <h2 style="font-size:1.15rem;font-weight:700;margin:0 0 20px;text-align:center;background:linear-gradient(135deg,var(--primary),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">✏️ 닉네임 변경</h2>
      <div style="margin-bottom:14px">
        <div style="font-size:0.78rem;color:var(--muted);margin-bottom:6px">현재 닉네임</div>
        <div id="nickCurrentDisplay" style="padding:10px 14px;background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(255,255,255,0.08);font-size:0.9rem;color:var(--text)"></div>
      </div>
      ${cooldownInfoHtml}
      <div style="margin-bottom:20px">
        <div style="font-size:0.78rem;color:var(--muted);margin-bottom:6px">새 닉네임</div>
        <input id="nicknameChangeInput" type="text" maxlength="12" placeholder="2~12자 입력" ${onCooldown ? 'disabled' : ''} style="width:100%;box-sizing:border-box;padding:12px 14px;background:rgba(255,255,255,${onCooldown ? '0.03' : '0.07'});border-radius:10px;border:1.5px solid rgba(124,77,255,${onCooldown ? '0.1' : '0.3'});color:${onCooldown ? 'rgba(255,255,255,0.3)' : 'var(--text)'};font-size:0.92rem;font-family:inherit;outline:none" />
        <div id="nicknameCharCount" style="text-align:right;font-size:0.72rem;color:var(--muted);margin-top:4px">0 / 12</div>
      </div>
      <div style="display:flex;gap:10px">
        <button id="nickModalCancel" style="flex:1;padding:13px;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.1);border-radius:12px;color:rgba(255,255,255,0.52);font-weight:600;font-size:0.88rem;cursor:pointer;font-family:inherit">취소</button>
        <button id="nicknameChangeSubmitBtn" ${onCooldown ? 'disabled' : ''} style="flex:1.3;padding:13px;background:${onCooldown ? 'rgba(124,77,255,0.2)' : 'linear-gradient(135deg,var(--primary) 0%,rgba(100,55,215,0.9) 100%)'};border:none;border-radius:12px;color:${onCooldown ? 'rgba(255,255,255,0.3)' : '#fff'};font-weight:700;font-size:0.88rem;cursor:${onCooldown ? 'not-allowed' : 'pointer'};box-shadow:${onCooldown ? 'none' : '0 6px 16px rgba(124,77,255,0.38)'};font-family:inherit">변경하기</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('nickCurrentDisplay').textContent = currentNick || '(닉네임 없음)';

  const closeModal = () => {
    document.removeEventListener('keydown', handleEsc);
    modal.remove();
  };
  document.getElementById('nickModalClose').onclick = closeModal;
  document.getElementById('nickModalCancel').onclick = closeModal;
  document.getElementById('nicknameChangeSubmitBtn').onclick = submitNicknameChange;
  const handleEsc = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', handleEsc);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  const input = document.getElementById('nicknameChangeInput');
  const counter = document.getElementById('nicknameCharCount');
  if (input) {
    input.addEventListener('input', () => { counter.textContent = `${input.value.length} / 12`; });
    if (!onCooldown) setTimeout(() => input.focus(), 80);
  }
}

function _formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

async function submitNicknameChange() {
  const input = document.getElementById('nicknameChangeInput');
  if (!input) return;
  const newNickname = input.value.trim();
  if (newNickname.length < 2) { showToast('닉네임은 2자 이상이어야 해요'); return; }
  if (newNickname === currentUser.customNickname) { showToast('현재 닉네임과 동일해요'); return; }

  const btn = document.getElementById('nicknameChangeSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = '변경 중...'; }

  try {
    const now = Date.now();
    await db.ref(`users/${currentUser.uid}`).update({
      nickname: newNickname,
      lastNicknameChangeTime: now
    });
    currentUser.customNickname = newNickname;
    currentUser.lastNicknameChangeTime = now;
    updateAuthUI();
    document.getElementById('nicknameChangeModal')?.remove();
    showToast(`✅ 닉네임이 "${newNickname}"로 변경됐어요!`);
  } catch (e) {
    console.error('닉네임 변경 실패:', e);
    showToast('닉네임 변경에 실패했어요. 다시 시도해주세요');
    if (btn) { btn.disabled = false; btn.textContent = '변경하기'; }
  }
}

