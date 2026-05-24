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

// Kakao 로그인 (현재 스텁)
function signInWithKakao() {
  showToast("Kakao 로그인은 준비 중입니다 🔜");
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

// 로그인 상태 감시
function setupAuthListener() {
  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      isLoggedIn = true;
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
      currentUser.lastFandomChangeTime = data.lastFandomChangeTime || 0; // 마지막 팬덤 변경 시간

      // ★ 투표 스트릭 데이터 로드
      currentUser.votingStreak = data.votingStreak || 0;
      currentUser.lastVoteDate = data.lastVoteDate || null;
      currentUser.activePage = data.activePage || "vote";

      console.log(`[DEBUG setupAuthListener] 사용자 데이터 로드:`, {
        primaryFandom: currentUser.primaryFandom,
        currentUserFav,
        lastFandomChangeTime: currentUser.lastFandomChangeTime,
        votingStreak: currentUser.votingStreak,
        lastVoteDate: currentUser.lastVoteDate,
        activePage: currentUser.activePage
      });
    }
    if (callback) callback();
  }).catch(err => {
    console.error("Failed to load user data:", err);
    if (callback) callback();
  });
}

// ── 팬덤 변경 확인 모달 (고급 디자인) ──
function showFandomChangeConfirmModal(fandom, emoji) {
  return new Promise((resolve) => {
    const existing = document.getElementById("fandomChangeModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "fandomChangeModal";
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
    content.style.cssText = `
      background: linear-gradient(135deg, rgba(20, 15, 40, 0.98) 0%, rgba(30, 20, 50, 0.98) 100%);
      border: 1.5px solid rgba(124, 77, 255, 0.3);
      border-radius: 20px;
      padding: 40px;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(124, 77, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      animation: modalSlideIn 0.3s ease-out;
    `;

    content.innerHTML = `
      <div style="text-align: center">
        <div style="font-size: 3rem; margin-bottom: 16px; animation: bounce 0.6s ease-in-out">${emoji}</div>

        <h2 style="
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
          background: linear-gradient(135deg, var(--primary), var(--pink));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        ">${fandom}로 변경할까요?</h2>

        <p style="
          color: var(--muted);
          font-size: 0.95rem;
          margin-bottom: 28px;
          line-height: 1.6;
        ">팬덤을 변경하면 일시적인 제약이 생깁니다</p>

        <div style="
          background: linear-gradient(135deg, rgba(124, 77, 255, 0.1), rgba(255, 77, 141, 0.05));
          border-left: 3px solid var(--primary);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 28px;
          text-align: left;
        ">
          <div style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 12px">
            <span style="font-size: 1.2rem">📝</span>
            <div>
              <div style="font-weight: 600; color: var(--text); font-size: 0.95rem">게시글 작성</div>
              <div style="color: var(--muted); font-size: 0.85rem">24시간 동안 작성 불가</div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: flex-start">
            <span style="font-size: 1.2rem">🗳️</span>
            <div>
              <div style="font-weight: 600; color: var(--text); font-size: 0.95rem">투표</div>
              <div style="color: var(--muted); font-size: 0.85rem">48시간 동안 투표 불가</div>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; justify-content: center">
          <button id="fandomChangeCancel" style="
            flex: 1;
            padding: 14px 24px;
            background: rgba(124, 77, 255, 0.1);
            border: 1.5px solid rgba(124, 77, 255, 0.3);
            border-radius: 12px;
            color: var(--text);
            font-weight: 600;
            font-size: 0.95rem;
            cursor: pointer;
            transition: all 0.3s ease;
          " onmouseover="this.style.background='rgba(124, 77, 255, 0.2)';this.style.borderColor='rgba(124, 77, 255, 0.5)'" onmouseout="this.style.background='rgba(124, 77, 255, 0.1)';this.style.borderColor='rgba(124, 77, 255, 0.3)'">
            취소
          </button>
          <button id="fandomChangeConfirm" style="
            flex: 1;
            padding: 14px 24px;
            background: linear-gradient(135deg, var(--primary) 0%, rgba(124, 77, 255, 0.85) 100%);
            border: none;
            border-radius: 12px;
            color: #fff;
            font-weight: 700;
            font-size: 0.95rem;
            cursor: pointer;
            box-shadow: 0 8px 20px rgba(124, 77, 255, 0.4);
            transition: all 0.3s ease;
          " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 12px 28px rgba(124, 77, 255, 0.5)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 8px 20px rgba(124, 77, 255, 0.4)'">
            변경하기
          </button>
        </div>
      </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    if (!document.getElementById("fandomChangeModalStyles")) {
      const style = document.createElement("style");
      style.id = "fandomChangeModalStyles";
      style.textContent = `
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `;
      document.head.appendChild(style);
    }

    const confirmBtn = document.getElementById("fandomChangeConfirm");
    const cancelBtn = document.getElementById("fandomChangeCancel");

    confirmBtn.addEventListener("click", () => {
      modal.remove();
      resolve(true);
    });

    cancelBtn.addEventListener("click", () => {
      modal.remove();
      resolve(false);
    });

    const handleEsc = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", handleEsc);
        modal.remove();
        resolve(false);
      }
    };
    document.addEventListener("keydown", handleEsc);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        document.removeEventListener("keydown", handleEsc);
        modal.remove();
        resolve(false);
      }
    });
  });
}

// ── 팬덤 변경 (24시간 + 48시간 투표 제약) ──
async function changePrimaryFandom(newFandom) {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    return;
  }

  if (!newFandom || !GROUP_META[newFandom]) {
    showToast("올바른 팬덤을 선택해주세요");
    return;
  }

  // 같은 팬덤으로 변경하려는 경우
  if (currentUser.primaryFandom === newFandom) {
    showToast("이미 선택된 팬덤입니다");
    return;
  }

  // 변경 전 확인 메시지 (커스텀 모달)
  const emoji = GROUP_META[newFandom]?.emoji || "💜";
  const confirmed = await showFandomChangeConfirmModal(newFandom, emoji);

  if (!confirmed) return;

  try {
    const now = Date.now();
    await db.ref(`users/${currentUser.uid}`).update({
      "preferences/primaryFandom": newFandom,
      lastFandomChangeTime: now
    });

    currentUser.primaryFandom = newFandom;
    currentUser.lastFandomChangeTime = now;
    currentUserFav = newFandom; // Firebase에서 읽어온 것처럼 동기화

    // ★ localStorage도 업데이트 (getMyFav() 호출 시 최신 값 사용)
    localStorage.setItem("my_fav_group", newFandom);

    console.log(`[DEBUG] 팬덤 변경됨: ${newFandom}, currentUserFav=${currentUserFav}`);

    // 화면 갱신
    console.log(`[DEBUG] renderFavChip() 호출 전`);
    renderFavChip(); // 하단 팬덤 표시 업데이트
    console.log(`[DEBUG] renderFavChip() 호출 후, favChipArea:`, document.getElementById("favChipArea")?.innerHTML);

    console.log(`[DEBUG] updateFavBar() 호출 전`);
    updateFavBar(); // 하단 바 업데이트
    console.log(`[DEBUG] updateFavBar() 호출 후, favBar:`, document.getElementById("favBar")?.innerHTML.substring(0, 100));

    // ★ 커뮤니티 페이지 재로드 (팬덤 변경 반영)
    // showCommunityPage() 내에서 loadCommunityPosts()가 호출되므로, 여기서는 호출하지 않음
    document.getElementById("communityFandomSelect").value = newFandom;

    // 커뮤니티 페이지로 이동
    const votePage = document.getElementById("votePage");
    const communityPage = document.getElementById("communityPage");
    if (votePage) votePage.classList.add("hidden");
    if (communityPage) communityPage.classList.add("show");

    document.querySelectorAll(".nav-tab").forEach((tab, i) => {
      tab.classList.toggle("active", i === 1);
    });

    // Firebase에 활성 페이지 저장
    if (isLoggedIn && currentUser && db) {
      db.ref(`users/${currentUser.uid}`).update({ activePage: "community" }).catch(() => {});
    }

    // ★ loadCommunityPosts() 호출 (showCommunityPage() 대신)
    loadCommunityPosts();
    console.log(`[DEBUG] 커뮤니티 페이지 로드 완료`);

    showToast(`✅ ${emoji} ${newFandom}으로 변경되었습니다!\n게시글: 24시간 후 | 투표: 48시간 후`);
  } catch (e) {
    console.error("팬덤 변경 실패:", e);
    showToast("팬덤 변경에 실패했어요");
  }
}

// ── 팬덤 변경 가능 여부 확인 ──
function canChangeFandom() {
  if (!isLoggedIn || !currentUser) return false;
  // 언제든 변경 가능 (변경 후 제약이 생김)
  return true;
}

// ── 게시글 작성 가능 여부 (팬덤 제약) ──
function canWritePost(selectedFandom) {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    return false;
  }

  // 자신의 팬덤이 아니면 작성 불가
  if (selectedFandom !== currentUser.primaryFandom) {
    showToast(`❌ ${currentUser.primaryFandom} 커뮤니티에서만 게시글을 작성할 수 있어요!`);
    return false;
  }

  // 팬덤 변경 후 24시간 이내 작성 불가
  const now = Date.now();
  const hoursPassedSinceChange = (now - currentUser.lastFandomChangeTime) / (1000 * 60 * 60);

  if (hoursPassedSinceChange < 24) {
    const hoursLeft = Math.ceil(24 - hoursPassedSinceChange);
    showToast(`⏳ 팬덤 변경 후 ${hoursLeft}시간 후부터 게시글을 작성할 수 있어요`);
    return false;
  }

  return true;
}

// ── 투표 가능 여부 (팬덤 변경 후 48시간 제약) ──
function canVoteAfterFandomChange() {
  if (!isLoggedIn || !currentUser) return true; // 로그인 안 한 사람은 제약 없음

  const now = Date.now();
  const hoursPassedSinceChange = (now - currentUser.lastFandomChangeTime) / (1000 * 60 * 60);

  if (hoursPassedSinceChange < 48) {
    const hoursLeft = Math.ceil(48 - hoursPassedSinceChange);
    showToast(`⏳ 팬덤 변경 후 ${hoursLeft}시간 후부터 투표할 수 있어요`);
    return false;
  }

  return true;
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

  // ★ update() 사용: 기존 데이터는 유지하고 필요한 부분만 업데이트
  const userData = {
    nickname: nickname,
    fandom: fandom || "",
    "preferences/primaryFandom": fandom || "", // ★ 통합된 경로로 저장
    createdAt: Date.now()
  };

  db.ref(`users/${currentUser.uid}`).update(userData) // ★ set → update로 변경
    .then(() => {
      console.log(`[DEBUG] 사용자 정보 저장 완료: ${nickname}, primaryFandom=${fandom}`);
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
        <button onclick="loginFromVoteModalKakao('${escAttr(group)}')" style="width: 100%; padding: 16px 12px; background: #ffe812; border: none; border-radius: 8px; color: #000; font-weight: 700; font-size: 1rem; font-family: inherit; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.12)">
          <svg width="20" height="20" viewBox="0 0 200 200" style="fill: #000"><text x="100" y="130" font-size="140" font-weight="900" text-anchor="middle" font-family="sans-serif">K</text></svg>
          <span>Kakao로 로그인</span>
