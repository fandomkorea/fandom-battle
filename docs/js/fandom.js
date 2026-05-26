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

// ── 팬덤 변경 성공 모달 ──
function showFandomChangeSuccessModal(fandom, emoji) {
  return new Promise((resolve) => {
    const existing = document.getElementById("fandomChangeSuccessModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "fandomChangeSuccessModal";
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
      text-align: center;
    `;

    content.innerHTML = `
      <div style="font-size: 3.5rem; margin-bottom: 16px; animation: bounce 0.6s ease-in-out">✅</div>

      <h2 style="
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text);
        margin-bottom: 8px;
        background: linear-gradient(135deg, #4ade80, #22c55e);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      ">${emoji} ${fandom}로 변경되었어요!</h2>

      <p style="
        color: var(--muted);
        font-size: 0.95rem;
        margin-bottom: 28px;
        line-height: 1.6;
      ">최애팬덤이 성공적으로 변경되었습니다</p>

      <div style="
        background: linear-gradient(135deg, rgba(74, 222, 128, 0.1), rgba(34, 197, 94, 0.05));
        border-left: 3px solid #4ade80;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 28px;
        text-align: left;
      ">
        <div style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 12px">
          <span style="font-size: 1.2rem">📝</span>
          <div>
            <div style="font-weight: 600; color: var(--text); font-size: 0.95rem">게시글 작성</div>
            <div style="color: var(--muted); font-size: 0.85rem">24시간 후부터 가능</div>
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: flex-start">
          <span style="font-size: 1.2rem">🗳️</span>
          <div>
            <div style="font-weight: 600; color: var(--text); font-size: 0.95rem">투표</div>
            <div style="color: var(--muted); font-size: 0.85rem">48시간 후부터 가능</div>
          </div>
        </div>
      </div>

      <button id="fandomChangeSuccessClose" style="
        width: 100%;
        padding: 14px 24px;
        background: linear-gradient(135deg, var(--primary) 0%, rgba(124, 77, 255, 0.85) 100%);
        border: none;
        border-radius: 12px;
        color: #fff;
        font-weight: 700;
        font-size: 0.95rem;
        cursor: pointer;
        transition: all 0.3s ease;
      " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 20px rgba(124, 77, 255, 0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">
        확인
      </button>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    document.getElementById("fandomChangeSuccessClose").onclick = () => {
      modal.remove();
      resolve();
    };

    // ESC 키로 닫기
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve();
      }
    };
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

    // ★ 랭킹 하이라이트 즉시 갱신 (my-fav-rank 클래스 반영)
    if (allRankingsData) renderRankings(allRankingsData);

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

    // 팬덤 변경 성공 모달 표시
    await showFandomChangeSuccessModal(newFandom, emoji);
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
  const lastChangeTime = currentUser.lastFandomChangeTime || 0;
  const hoursPassedSinceChange = (now - lastChangeTime) / (1000 * 60 * 60);

  // 디버그 로그
  console.log(`[DEBUG canWritePost] lastFandomChangeTime: ${lastChangeTime}, hoursPassedSinceChange: ${hoursPassedSinceChange.toFixed(2)}`);

  if (hoursPassedSinceChange < 24 && lastChangeTime > 0) {
    const remainingMilliseconds = (24 * 60 * 60 * 1000) - (hoursPassedSinceChange * 60 * 60 * 1000);
    const hoursLeft = Math.floor(remainingMilliseconds / (60 * 60 * 1000));
    const minutesLeft = Math.floor((remainingMilliseconds % (60 * 60 * 1000)) / (60 * 1000));
    const secondsLeft = Math.floor((remainingMilliseconds % (60 * 1000)) / 1000);

    showPostRestrictionModal(hoursLeft, minutesLeft, secondsLeft);
    return false;
  }

  return true;
}

// ── 팬덤 변경 후 24시간 제약 모달 ──
function showPostRestrictionModal(hoursLeft, minutesLeft, secondsLeft = 0) {
  const existing = document.getElementById("postRestrictionModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "postRestrictionModal";
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
    border: 1.5px solid rgba(255, 193, 7, 0.3);
    border-radius: 20px;
    padding: 40px;
    max-width: 420px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(255, 193, 7, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    animation: modalSlideIn 0.3s ease-out;
    text-align: center;
  `;

  content.innerHTML = `
    <div style="font-size: 3.5rem; margin-bottom: 16px; animation: pulse 1s ease-in-out infinite">⏳</div>

    <h2 style="
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 12px;
      background: linear-gradient(135deg, #ffc107, #ff9800);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    ">게시글 작성 제약 중</h2>

    <p style="color: rgba(255, 255, 255, 0.7); font-size: 0.95rem; margin-bottom: 24px; line-height: 1.6;">
      팬덤을 변경한 후 게시글 작성이 제한돼요.<br>
      <strong id="postTimerDisplay" style="font-size: 1.1rem; color: #ffc107">${hoursLeft}시간 ${minutesLeft}분 ${secondsLeft}초</strong> 후부터<br>
      작성할 수 있어요.
    </p>

    <div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
      <div style="font-size: 2rem; font-weight: 700; color: #ffc107;" id="postTimerLarge">
        ${hoursLeft}시간 ${minutesLeft}분 ${secondsLeft}초
      </div>
    </div>

    <button id="postRestrictionClose" style="
      width: 100%;
      padding: 12px 24px;
      background: linear-gradient(135deg, #7c4dff 0%, #651fff 100%);
      border: none;
      border-radius: 10px;
      color: white;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(124, 77, 255, 0.3);
    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(124, 77, 255, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(124, 77, 255, 0.3)'">
      확인했어요
    </button>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  // 실시간 타이머 업데이트
  let currentSeconds = hoursLeft * 3600 + minutesLeft * 60 + secondsLeft;
  const timerInterval = setInterval(() => {
    currentSeconds--;
    if (currentSeconds < 0) {
      clearInterval(timerInterval);
      modal.remove();
      return;
    }
    const h = Math.floor(currentSeconds / 3600);
    const m = Math.floor((currentSeconds % 3600) / 60);
    const s = currentSeconds % 60;
    const timerDisplay = document.getElementById("postTimerDisplay");
    const timerLarge = document.getElementById("postTimerLarge");
    if (timerDisplay) {
      timerDisplay.textContent = `${h}시간 ${m}분 ${s}초`;
    }
    if (timerLarge) {
      timerLarge.textContent = `${h}시간 ${m}분 ${s}초`;
    }
  }, 1000);

  document.getElementById("postRestrictionClose").onclick = () => {
    clearInterval(timerInterval);
    modal.remove();
  };

  modal.onclick = (e) => {
    if (e.target === modal) {
      clearInterval(timerInterval);
      modal.remove();
    }
  };
}

// ── 투표 가능 여부 (팬덤 변경 후 48시간 제약) ──
function canVoteAfterFandomChange() {
  if (!isLoggedIn || !currentUser) return true; // 로그인 안 한 사람은 제약 없음

  const now = Date.now();
  const lastChangeTime = currentUser.lastFandomChangeTime || 0;
  const hoursPassedSinceChange = (now - lastChangeTime) / (1000 * 60 * 60);

  if (hoursPassedSinceChange < 48 && lastChangeTime > 0) {
    const remainingMilliseconds = (48 * 60 * 60 * 1000) - (now - lastChangeTime);
    const hoursLeft = Math.floor(remainingMilliseconds / (1000 * 60 * 60));
    const minutesLeft = Math.floor((remainingMilliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const secondsLeft = Math.floor((remainingMilliseconds % (1000 * 60)) / 1000);

    showVoteRestrictionModal(hoursLeft, minutesLeft, secondsLeft);
    return false;
  }

  return true;
}

// ── 투표 제약 모달 ──
function showVoteRestrictionModal(hoursLeft, minutesLeft, secondsLeft = 0) {
  const existing = document.getElementById("voteRestrictionModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "voteRestrictionModal";
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
    border: 1.5px solid rgba(255, 77, 141, 0.3);
    border-radius: 20px;
    padding: 40px;
    max-width: 420px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(255, 77, 141, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    animation: modalSlideIn 0.3s ease-out;
    text-align: center;
  `;

  content.innerHTML = `
    <div style="font-size: 3rem; margin-bottom: 16px">⏳</div>

    <h2 style="
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 8px;
      background: linear-gradient(135deg, #ff4d8d, #ff6b9d);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    ">투표 제약 중</h2>

    <p style="color: rgba(255, 255, 255, 0.7); font-size: 0.95rem; margin-bottom: 28px; line-height: 1.6;">
      팬덤을 변경한 후 투표를 할 수 없어요.<br>
      <strong id="voteTimerDisplay" style="font-size: 1.1rem; color: #ff77b5">${hoursLeft}시간 ${minutesLeft}분 ${secondsLeft}초</strong> 후에<br>
      투표할 수 있어요.
    </p>

    <div style="
      background: linear-gradient(135deg, rgba(255, 77, 141, 0.1), rgba(255, 107, 157, 0.05));
      border-left: 3px solid #ff4d8d;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 28px;
      text-align: left;
    ">
      <div style="display: flex; gap: 8px; align-items: flex-start">
        <span style="font-size: 1.2rem">ℹ️</span>
        <div>
          <div style="font-weight: 600; color: var(--text); font-size: 0.95rem">팬덤 변경 후 제약</div>
          <div style="color: var(--muted); font-size: 0.85rem; margin-top: 4px">보안을 위해 팬덤 변경 후 48시간 동안 투표가 제한됩니다</div>
        </div>
      </div>
    </div>

    <button id="voteRestrictionClose" style="
      width: 100%;
      padding: 14px 24px;
      background: linear-gradient(135deg, var(--primary) 0%, rgba(124, 77, 255, 0.85) 100%);
      border: none;
      border-radius: 12px;
      color: #fff;
      font-weight: 700;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.3s ease;
      font-family: inherit;
    " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 20px rgba(124,77,255,0.4)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">
      확인
    </button>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  // 실시간 타이머 업데이트
  let currentSeconds = hoursLeft * 3600 + minutesLeft * 60 + secondsLeft;
  const timerInterval = setInterval(() => {
    currentSeconds--;
    if (currentSeconds < 0) {
      clearInterval(timerInterval);
      modal.remove();
      return;
    }
    const h = Math.floor(currentSeconds / 3600);
    const m = Math.floor((currentSeconds % 3600) / 60);
    const s = currentSeconds % 60;
    const timerDisplay = document.getElementById("voteTimerDisplay");
    if (timerDisplay) {
      timerDisplay.textContent = `${h}시간 ${m}분 ${s}초`;
    }
  }, 1000);

  document.getElementById("voteRestrictionClose").onclick = () => {
    clearInterval(timerInterval);
    modal.remove();
  };

  modal.onclick = (e) => {
    if (e.target === modal) {
      clearInterval(timerInterval);
      modal.remove();
    }
  };
}

