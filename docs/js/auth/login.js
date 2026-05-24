// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 로그인 & 로그아웃
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━

function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });
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

function signInWithKakao() {
  showToast("Kakao 로그인은 준비 중입니다 🔜");
}

function signOut() {
  firebase.auth().signOut().then(() => {
    currentUser = null;
    isLoggedIn = false;
    currentUserFav = null;
    pendingAdVotes = 0;
    adWatchCount = 0;
    cachedTodayFreeVote = null;
    cachedTodayAdVotes = 0;
    activityQueue = [];
    allPostsData = {};
    postDetailViewerUid = null;

    renderNickDisplay();
    updateAuthUI();
    showVotePage();
    showToast("로그아웃되었습니다");
  }).catch(error => {
    showToast("로그아웃 실패: " + error.message);
    console.error(error);
  });
}

function continueAnonymousVote(group) {
  window.pendingVoteGroup = group;
  showVoteLoginModal(group);
}

function loginFromVoteModal(group) {
  window.pendingVoteGroup = group;
  signInWithGoogle();
  closeVoteLoginModal();
}

function loginFromVoteModalKakao(group) {
  window.pendingVoteGroup = group;
  signInWithKakao();
  closeVoteLoginModal();
}
