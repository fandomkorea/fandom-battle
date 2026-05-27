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
    pendingAdVotes = 0;
    adWatchCount = 0; // ★ 광고 시청 횟수도 초기화
    cachedTodayFreeVote = null;
    cachedTodayAdVotes = 0;

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

      await loadUserAdVotes(); // Firebase에서 광고 투표권 로드 (닉네임도 함께 로드)
      // loadUserAdVotes() 내에서 updateAuthUI()를 호출하므로 여기서는 안 함

      // ★ 팬덤 설정 팝업 닫기
      closeFandomSetupPopup();
    } else {
      currentUser = null;
      isLoggedIn = false;
      pendingAdVotes = 0;
      adWatchCount = 0; // ★ 광고 시청 횟수도 초기화
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

// ── Firebase에서 광고 투표권 로드 ──
async function loadUserAdVotes() {
  if (!currentUser) return;

  try {
    const snap = await db.ref(`users/${currentUser.uid}/pendingAdVotes`).once("value");
    pendingAdVotes = snap.val() || 0;

    // ★ 광고 시청 횟수 로드 (일일 리셋)
    const today = getTodayKey();
    const adWatchSnap = await db.ref(`users/${currentUser.uid}/ad_watch_count_${today}`).once("value");
    adWatchCount = adWatchSnap.val() || 0;

    // ★ 최애팬덤은 loadAuthUserData()에서 처리됨 (preferences/primaryFandom)

    // 오늘의 투표 정보도 함께 로드
    await loadTodayVotesFromFirebase();

    // ★ 사용자 닉네임/팬덤 로드
    await new Promise((resolve) => loadAuthUserData(resolve));

    updateFavBar(); // 로드 후 팬덤 선택 바 업데이트
    updateAuthUI(); // ★ 닉네임 표시 업데이트

    // ★ 새로고침 시 커뮤니티 페이지 복원
    // communityPostsLoaded가 false이면 init() → loadCommunityPosts()가 실패한 것 → 재시도
    const activePage = sessionStorage.getItem('activePage') || currentUser?.activePage || "vote";
    if (activePage === "community" && currentUserFav) {
      const select = document.getElementById("communityFandomSelect");
      if (select && typeof communityPostsLoaded !== 'undefined' && !communityPostsLoaded) {
        if (!select.value) select.value = currentUserFav;
        if (typeof loadCommunityPosts === "function") loadCommunityPosts();
      }
    }

    // ★ 투표권 로드 후 랭킹 다시 렌더링 (버튼 활성화 상태 업데이트)
    if (allRankingsData) {
      renderRankings(allRankingsData);
    }
  } catch (e) {
    console.error("광고 투표권 로드 실패:", e);
    pendingAdVotes = 0;
    adWatchCount = 0;
    cachedTodayFreeVote = null;
    cachedTodayAdVotes = 0;
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
    const adVotes = getTodayAdVoteCount();
    const totalVotes = getTodayVoteCount();
    const remainingFree = MAX_FREE_VOTES_PER_DAY - freeVotes;
    const remainingAd = MAX_AD_VOTES_PER_DAY - adVotes;
    const remainingTotal = MAX_TOTAL_VOTES_PER_DAY - totalVotes;

    // ★ 투표권 정보 텍스트 (무료 1개 + 광고권)
    const availableVotes = (canUseFreeVote() ? 1 : 0) + pendingAdVotes; // 사용 가능한 투표권
    const voteInfo = `${nickname} · ${totalVotes}/11표 | 투표권: ${availableVotes}개`;
    document.getElementById("userDisplayName").textContent = voteInfo;

    // ★ 상단 광고 버튼 렌더링
    const adButtonContainer = document.getElementById("adButtonContainer");
    if (adButtonContainer) {
      let adButton = '';

      // 모든 투표를 사용한 경우
      if (totalVotes >= MAX_TOTAL_VOTES_PER_DAY) {
        adButton = `<span style="font-size:0.75rem;color:var(--gold);font-weight:700">✨ 내일 투표권이 생겨요!</span>`;
      }
      // 광고 시청을 10회 이상 한 경우
      else if (adWatchCount >= MAX_AD_VOTES_PER_DAY) {
        adButton = `<span style="font-size:0.75rem;color:var(--gold);font-weight:700">🎁 광고 10회 완료!</span>`;
      }
      // ★ 광고 시청 버튼 (항상 표시 - 투표권 여부 관계없이)
      else if (totalVotes < MAX_TOTAL_VOTES_PER_DAY && adWatchCount < MAX_AD_VOTES_PER_DAY) {
        adButton = `<button style="padding:6px 10px;font-size:0.75rem;border-radius:6px;border:1px solid var(--primary);background:rgba(124,77,255,0.2);color:var(--primary);cursor:pointer;transition:all 0.15s;white-space:nowrap" onclick="watchAdWithLoginCheck()">🎁 광고 보고 투표권 획득</button>`;
      }

      adButtonContainer.innerHTML = adButton;
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

