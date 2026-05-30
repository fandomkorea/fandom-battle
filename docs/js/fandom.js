// ── 팬덤 변경 확인 모달 ──
function showFandomChangeConfirmModal(fandom, emoji, currentFandom = null) {
  return new Promise((resolve) => {
    const existing = document.getElementById("fandomChangeModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "fandomChangeModal";
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;z-index:10000;backdrop-filter:blur(5px)`;

    const content = document.createElement("div");
    content.style.cssText = `background:linear-gradient(135deg,rgba(18,12,36,0.99) 0%,rgba(26,16,46,0.99) 100%);border:1.5px solid rgba(124,77,255,0.3);border-radius:20px;padding:36px 28px 28px;max-width:380px;width:90%;box-shadow:0 20px 60px rgba(124,77,255,0.22),inset 0 1px 0 rgba(255,255,255,0.07);animation:modalSlideIn 0.28s ease-out;position:relative`;

    // 현재 → 새 팬덤 전환 시각화
    const currentMeta = currentFandom ? (GROUP_META[currentFandom] || {}) : null;
    const transitionHtml = currentFandom
      ? `<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px;padding:14px 10px;background:rgba(255,255,255,0.04);border-radius:14px;border:1px solid rgba(255,255,255,0.07)">
           <div style="text-align:center;flex:1;min-width:0">
             <div style="font-size:1.8rem;margin-bottom:4px">${currentMeta.emoji || '💜'}</div>
             <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${currentFandom}</div>
           </div>
           <div style="font-size:1.2rem;color:rgba(124,77,255,0.55);flex-shrink:0;font-weight:700">→</div>
           <div style="text-align:center;flex:1;min-width:0">
             <div style="font-size:1.8rem;margin-bottom:4px">${emoji}</div>
             <div style="font-size:0.72rem;color:var(--primary);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fandom}</div>
           </div>
         </div>`
      : `<div style="font-size:2.6rem;text-align:center;margin-bottom:14px;animation:bounce 0.6s ease-in-out">${emoji}</div>`;

    content.innerHTML = `
      <button id="fandomChangeModalClose" style="position:absolute;top:12px;right:13px;background:none;border:none;color:rgba(255,255,255,0.28);font-size:1.2rem;cursor:pointer;line-height:1;padding:6px 8px;border-radius:6px;transition:all 0.18s" onmouseover="this.style.color='rgba(255,255,255,0.65)';this.style.background='rgba(255,255,255,0.07)'" onmouseout="this.style.color='rgba(255,255,255,0.28)';this.style.background='none'">✕</button>

      <div style="text-align:center;margin-bottom:18px">
        ${transitionHtml}
        <h2 style="font-size:1.2rem;font-weight:700;color:var(--text);margin-bottom:5px;background:linear-gradient(135deg,var(--primary),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${fandom}(으)로 변경할까요?</h2>
        <p style="color:var(--muted);font-size:0.83rem;margin:0">변경하면 아래 제약이 생겨요</p>
      </div>

      <div style="background:rgba(255,193,7,0.07);border:1px solid rgba(255,193,7,0.22);border-radius:12px;padding:13px 15px;margin-bottom:22px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:9px">
          <span style="font-size:0.95rem;flex-shrink:0">📝</span>
          <span style="font-weight:600;color:var(--text);font-size:0.86rem">게시글 작성</span>
          <span style="margin-left:auto;color:rgba(255,193,7,0.9);font-size:0.78rem;font-weight:700;white-space:nowrap;background:rgba(255,193,7,0.12);padding:2px 8px;border-radius:8px">24시간 후</span>
        </div>
        <div style="height:1px;background:rgba(255,255,255,0.05)"></div>
        <div style="display:flex;align-items:center;gap:9px">
          <span style="font-size:0.95rem;flex-shrink:0">🗳️</span>
          <span style="font-weight:600;color:var(--text);font-size:0.86rem">투표</span>
          <span style="margin-left:auto;color:rgba(255,193,7,0.9);font-size:0.78rem;font-weight:700;white-space:nowrap;background:rgba(255,193,7,0.12);padding:2px 8px;border-radius:8px">48시간 후</span>
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <button id="fandomChangeCancel" style="flex:1;padding:13px 14px;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.1);border-radius:12px;color:rgba(255,255,255,0.52);font-weight:600;font-size:0.88rem;cursor:pointer;transition:all 0.2s;font-family:inherit" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='var(--text)'" onmouseout="this.style.background='rgba(255,255,255,0.06)';this.style.color='rgba(255,255,255,0.52)'">취소</button>
        <button id="fandomChangeConfirm" style="flex:1.3;padding:13px 14px;background:linear-gradient(135deg,var(--primary) 0%,rgba(100,55,215,0.9) 100%);border:none;border-radius:12px;color:#fff;font-weight:700;font-size:0.88rem;cursor:pointer;box-shadow:0 6px 16px rgba(124,77,255,0.38);transition:all 0.2s;font-family:inherit" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 10px 24px rgba(124,77,255,0.5)'" onmouseout="this.style.transform='';this.style.boxShadow='0 6px 16px rgba(124,77,255,0.38)'">변경하기</button>
      </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    if (!document.getElementById("fandomChangeModalStyles")) {
      const style = document.createElement("style");
      style.id = "fandomChangeModalStyles";
      style.textContent = `
        @keyframes modalSlideIn { from { opacity:0; transform:scale(0.95) translateY(18px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes bounce { 0%,100% { transform:scale(1) } 50% { transform:scale(1.1) } }
      `;
      document.head.appendChild(style);
    }

    // 공통 닫기 헬퍼 (리스너 정리 일원화)
    const closeModal = (result) => {
      document.removeEventListener("keydown", handleEsc);
      modal.remove();
      resolve(result);
    };

    document.getElementById("fandomChangeConfirm").addEventListener("click", () => closeModal(true));
    document.getElementById("fandomChangeCancel").addEventListener("click", () => closeModal(false));
    document.getElementById("fandomChangeModalClose").addEventListener("click", () => closeModal(false));

    const handleEsc = (e) => { if (e.key === "Escape") closeModal(false); };
    document.addEventListener("keydown", handleEsc);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(false); });
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
      ">최애팬덤이 성공적으로 변경되었습니다 🎉</p>

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

// ── 타 팬덤 커뮤니티 글쓰기 시도 모달 ──
function showWrongFandomModal(myFandom, selectedFandom) {
  const existing = document.getElementById("wrongFandomModal");
  if (existing) existing.remove();

  const myMeta = GROUP_META[myFandom] || {};
  const selectedMeta = GROUP_META[selectedFandom] || {};

  const modal = document.createElement("div");
  modal.id = "wrongFandomModal";
  modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;z-index:10000;backdrop-filter:blur(5px)`;

  const content = document.createElement("div");
  content.style.cssText = `background:linear-gradient(135deg,rgba(18,12,36,0.99) 0%,rgba(26,16,46,0.99) 100%);border:1.5px solid rgba(255,99,99,0.3);border-radius:20px;padding:32px 28px 28px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(255,77,77,0.12),inset 0 1px 0 rgba(255,255,255,0.07);animation:modalSlideIn 0.28s ease-out;text-align:center;position:relative`;

  content.innerHTML = `
    <div style="font-size:2.6rem;margin-bottom:14px">✍️</div>
    <h2 style="font-size:1.1rem;font-weight:700;color:var(--text);margin-bottom:8px">글쓰기 권한 없음</h2>
    <p style="color:var(--muted);font-size:0.85rem;line-height:1.7;margin-bottom:20px">
      <strong style="color:rgba(255,255,255,0.8)">${escHtml(selectedMeta.emoji || '')} ${escHtml(selectedFandom)}</strong> 커뮤니티는<br>읽기만 가능해요.<br>
      게시글은 내 팬덤 커뮤니티에서만 쓸 수 있어요.
    </p>
    <div style="background:rgba(124,77,255,0.08);border:1px solid rgba(124,77,255,0.22);border-radius:12px;padding:13px 16px;margin-bottom:24px;display:flex;align-items:center;gap:12px;text-align:left">
      <span style="font-size:1.6rem;flex-shrink:0">${escHtml(myMeta.emoji || '💜')}</span>
      <div style="min-width:0">
        <div style="font-size:0.7rem;color:var(--muted);margin-bottom:2px">내 팬덤 커뮤니티</div>
        <div style="font-size:0.9rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(myFandom)}</div>
      </div>
      <span style="margin-left:auto;font-size:0.7rem;color:var(--primary);font-weight:700;white-space:nowrap;flex-shrink:0">여기서만 ✍️</span>
    </div>
    <div style="display:flex;gap:10px">
      <button id="wrongFandomClose" style="flex:1;padding:12px 10px;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.1);border-radius:12px;color:rgba(255,255,255,0.5);font-weight:600;font-size:0.85rem;cursor:pointer;font-family:inherit;transition:all 0.2s" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">닫기</button>
      <button id="wrongFandomGoMy" style="flex:1.5;padding:12px 10px;background:linear-gradient(135deg,var(--primary) 0%,rgba(100,55,215,0.9) 100%);border:none;border-radius:12px;color:#fff;font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(124,77,255,0.35);transition:all 0.2s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">내 커뮤니티로 이동</button>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  const close = () => {
    document.removeEventListener("keydown", handleEsc);
    modal.remove();
  };

  document.getElementById("wrongFandomClose").addEventListener("click", close);
  document.getElementById("wrongFandomGoMy").addEventListener("click", () => {
    close();
    if (typeof selectFandomTab === 'function') selectFandomTab(myFandom);
  });

  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  const handleEsc = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", handleEsc);
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

  // 처음 팬덤 설정이면 확인 모달 없이 바로 진행
  const isFirstTimeSetting = !currentUser.primaryFandom;
  const emoji = GROUP_META[newFandom]?.emoji || "💜";
  if (!isFirstTimeSetting) {
    const confirmed = await showFandomChangeConfirmModal(newFandom, emoji, currentUser.primaryFandom);
    if (!confirmed) return;
  }

  try {
    const now = Date.now();
    const updateData = { "preferences/primaryFandom": newFandom };
    if (!isFirstTimeSetting) {
      updateData.lastFandomChangeTime = now; // 기존 팬덤이 있을 때만 변경 시간 기록
    }

    await db.ref(`users/${currentUser.uid}`).update(updateData);

    currentUser.primaryFandom = newFandom;
    currentUser.lastFandomChangeTime = isFirstTimeSetting ? null : now;
    currentUserFav = newFandom; // Firebase에서 읽어온 것처럼 동기화

    // ★ localStorage도 업데이트 (getMyFav() 호출 시 최신 값 사용)
    localStorage.setItem("my_fav_group", newFandom);

    // 화면 갱신
    renderFavChip(); // 하단 팬덤 표시 업데이트

    // ★ 랭킹 하이라이트 즉시 갱신 (my-fav-rank 클래스 반영)
    if (allRankingsData) renderRankings(allRankingsData);

    updateFavBar(); // 하단 바 업데이트

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

    // ★ 카테고리 개요 뷰로 로드
    if (typeof loadFandomCategoryOverview === 'function') loadFandomCategoryOverview(newFandom);
    else loadCommunityPosts();

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

  // 팬덤 미설정이면 팬덤 선택 안내
  if (!currentUser.primaryFandom) {
    showToast("💜 팬덤을 먼저 설정해주세요! 하단 '팬덤 선택' 버튼을 눌러보세요.");
    return false;
  }

  // 자신의 팬덤이 아니면 작성 불가
  if (selectedFandom !== currentUser.primaryFandom) {
    showWrongFandomModal(currentUser.primaryFandom, selectedFandom);
    return false;
  }

  // 팬덤 변경 후 24시간 이내 작성 불가
  const now = Date.now();
  const lastChangeTime = currentUser.lastFandomChangeTime || 0;
  const hoursPassedSinceChange = (now - lastChangeTime) / (1000 * 60 * 60);

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

    <p style="color: rgba(255, 255, 255, 0.7); font-size: 0.9rem; margin-bottom: 16px; line-height: 1.6;">
      팬덤 변경 후 아래 시간이 지나야<br>게시글을 쓸 수 있어요.
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
    const timerLarge = document.getElementById("postTimerLarge");
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

// ── 그룹 추가 요청 모달 ──
function showGroupRequestModal() {
  const existing = document.getElementById("groupRequestModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "groupRequestModal";
  modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:20000;backdrop-filter:blur(5px);padding:16px;box-sizing:border-box`;
  modal.onclick = (e) => { if (e.target === modal) closeGroupRequestModal(); };

  modal.innerHTML = `
    <div style="background:linear-gradient(180deg,rgba(18,12,36,0.99) 0%,rgba(26,16,46,0.99) 100%);border:1.5px solid rgba(124,77,255,0.3);border-radius:20px;padding:0;width:100%;max-width:400px;box-shadow:0 24px 64px rgba(0,0,0,0.5),0 0 40px rgba(124,77,255,0.1);overflow:hidden">
      <div style="background:linear-gradient(135deg,rgba(124,77,255,0.2) 0%,rgba(100,200,255,0.12) 100%);padding:22px 24px;border-bottom:1px solid rgba(124,77,255,0.2);display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:1.4rem">🎤</span>
          <h2 style="font-size:1.05rem;font-weight:800;color:var(--text);margin:0">아이돌 추가 요청</h2>
        </div>
        <button onclick="closeGroupRequestModal()" style="background:none;border:none;color:rgba(255,255,255,0.35);font-size:1.4rem;cursor:pointer;padding:4px 8px;border-radius:6px;transition:all 0.2s;line-height:1" onmouseover="this.style.color='rgba(255,255,255,0.7)'" onmouseout="this.style.color='rgba(255,255,255,0.35)'">✕</button>
      </div>
      <div style="padding:24px;display:flex;flex-direction:column;gap:16px">
        <p style="font-size:0.82rem;color:var(--muted);margin:0;line-height:1.6;background:rgba(124,77,255,0.07);border:1px solid rgba(124,77,255,0.15);border-radius:10px;padding:12px 14px">
          요청하신 내용은 관리자 검토 후 추가될 수 있어요.<br>승인까지 시간이 걸릴 수 있어요 💜
        </p>
        <div>
          <label style="display:block;font-size:0.72rem;font-weight:700;color:rgba(124,77,255,0.85);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">🇰🇷 한글 이름</label>
          <input id="reqKrName" type="text" maxlength="30" placeholder="예: 방탄소년단"
            style="width:100%;padding:11px 14px;background:rgba(124,77,255,0.08);border:1.5px solid rgba(124,77,255,0.2);border-radius:10px;color:var(--text);font-family:inherit;font-size:0.95rem;outline:none;transition:all 0.2s;box-sizing:border-box"
            onfocus="this.style.borderColor='rgba(124,77,255,0.7)';this.style.boxShadow='0 0 0 3px rgba(124,77,255,0.15)'"
            onblur="this.style.borderColor='rgba(124,77,255,0.2)';this.style.boxShadow='none'">
        </div>
        <div>
          <label style="display:block;font-size:0.72rem;font-weight:700;color:rgba(124,77,255,0.85);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">🌐 영어 이름</label>
          <input id="reqEnName" type="text" maxlength="50" placeholder="예: BTS"
            style="width:100%;padding:11px 14px;background:rgba(124,77,255,0.08);border:1.5px solid rgba(124,77,255,0.2);border-radius:10px;color:var(--text);font-family:inherit;font-size:0.95rem;outline:none;transition:all 0.2s;box-sizing:border-box"
            onfocus="this.style.borderColor='rgba(124,77,255,0.7)';this.style.boxShadow='0 0 0 3px rgba(124,77,255,0.15)'"
            onblur="this.style.borderColor='rgba(124,77,255,0.2)';this.style.boxShadow='none'">
        </div>
        <div style="display:flex;gap:10px;margin-top:4px">
          <button onclick="closeGroupRequestModal()" style="flex:1;padding:13px;background:transparent;border:1.5px solid rgba(255,255,255,0.12);border-radius:10px;color:rgba(255,255,255,0.45);font-weight:600;font-family:inherit;cursor:pointer;transition:all 0.2s;font-size:0.9rem" onmouseover="this.style.borderColor='rgba(255,255,255,0.25)';this.style.color='var(--text)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.12)';this.style.color='rgba(255,255,255,0.45)'">취소</button>
          <button id="submitGroupRequestBtn" onclick="submitGroupRequest()" style="flex:1.4;padding:13px;background:linear-gradient(135deg,var(--primary) 0%,rgba(100,55,215,0.9) 100%);border:none;border-radius:10px;color:#fff;font-weight:700;font-family:inherit;cursor:pointer;transition:all 0.2s;font-size:0.9rem;box-shadow:0 6px 16px rgba(124,77,255,0.35)" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 10px 24px rgba(124,77,255,0.5)'" onmouseout="this.style.transform='';this.style.boxShadow='0 6px 16px rgba(124,77,255,0.35)'">요청하기</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const handleEsc = (e) => { if (e.key === "Escape") closeGroupRequestModal(); };
  document.addEventListener("keydown", handleEsc);
  modal._handleEsc = handleEsc;

  setTimeout(() => document.getElementById("reqKrName")?.focus(), 100);
}

function closeGroupRequestModal() {
  const modal = document.getElementById("groupRequestModal");
  if (!modal) return;
  if (modal._handleEsc) document.removeEventListener("keydown", modal._handleEsc);
  modal.remove();
}

async function submitGroupRequest() {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    return;
  }

  const krName = document.getElementById("reqKrName")?.value.trim();
  const enName = document.getElementById("reqEnName")?.value.trim();

  if (!krName) { showToast("한글 이름을 입력해주세요"); document.getElementById("reqKrName")?.focus(); return; }
  if (!enName) { showToast("영어 이름을 입력해주세요"); document.getElementById("reqEnName")?.focus(); return; }

  const btn = document.getElementById("submitGroupRequestBtn");
  if (btn) { btn.disabled = true; btn.textContent = "요청 중..."; }

  try {
    await db.ref("group_requests").push({
      krName,
      enName,
      requestedBy: currentUser.uid,
      requestedByNickname: currentUser.customNickname || currentUser.displayName || "익명",
      timestamp: Date.now(),
      status: "pending"
    });

    closeGroupRequestModal();
    showToast("✅ 요청이 접수됐어요! 검토 후 추가해드릴게요 💜");
  } catch (e) {
    console.error("그룹 요청 실패:", e);
    showToast("요청 전송에 실패했어요. 다시 시도해주세요");
    if (btn) { btn.disabled = false; btn.textContent = "요청하기"; }
  }
}

