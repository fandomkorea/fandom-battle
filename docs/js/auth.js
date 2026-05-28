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
    const voteInfo = `${nickname} · 투표권: ${availableVotes}개`;
    document.getElementById("userDisplayName").textContent = voteInfo;

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
      currentUser.lastFandomChangeTime = data.lastFandomChangeTime || 0; // 마지막 팬덤 변경 시간

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

