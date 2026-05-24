function confirmDeletePost(fandom, postId) {
  if (confirm("정말 이 게시물을 삭제하시겠어요?\n삭제하면 댓글도 함께 사라져요.")) {
    deletePost(fandom, postId);
  }
}

// ── 게시물 작성 폼 ──
function showPostCreateForm() {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    document.getElementById("authContainer").style.display = "block";
    return;
  }

  const selectedFandom = document.getElementById("communityFandomSelect").value;
  if (!selectedFandom) {
    showToast("먼저 팬덤을 선택해주세요");
    return;
  }

  // 권한 체크: 자신의 팬덤에서만 작성 가능 + 24시간 제약 확인
  if (!canWritePost(selectedFandom)) {
    return;
  }

  // 입력값 초기화
  document.getElementById("postTitle").value = "";
  document.getElementById("postContent").value = "";
  document.getElementById("postTitleCount").textContent = "0";
  document.getElementById("postContentCount").textContent = "0";

  // 선택된 팬덤명 표시
  const fandomGroup = GROUP_META[selectedFandom];
  document.getElementById("postCreateFandom").textContent = `${fandomGroup ? fandomGroup.emoji : ""} ${selectedFandom}`;

  // 제목 글자수 카운팅
  document.getElementById("postTitle").oninput = () => {
    document.getElementById("postTitleCount").textContent = document.getElementById("postTitle").value.length;
  };

  // 내용 글자수 카운팅
  document.getElementById("postContent").oninput = () => {
    document.getElementById("postContentCount").textContent = document.getElementById("postContent").value.length;
  };

  // 모달 표시
  const modal = document.getElementById("postCreateModal");
  modal.style.display = "flex";

  // 포커스 설정
  setTimeout(() => {
    document.getElementById("postTitle").focus();
  }, 100);
}

// 모달 상태 추적
let modalHistoryState = null;

function openPostCreateModal() {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    return;
  }

  // 팬덤 확인
  const selectedFandom = document.getElementById("communityFandomSelect").value || currentUser.primaryFandom;
  if (!selectedFandom) {
    showToast("팬덤을 먼저 선택해주세요");
    return;
  }

  // 모달 초기화
  document.getElementById("postTemplate").value = "free";
  document.getElementById("postTitle").value = "";
  document.getElementById("postContent").value = "";
  document.getElementById("postTitleCount").textContent = "0";
  document.getElementById("postContentCount").textContent = "0";
  document.getElementById("scheduleTemplate").style.display = "none";

  // 팬덤 표시
  document.getElementById("postCreateFandom").textContent = selectedFandom;

  // 모달 표시
  document.getElementById("postCreateModal").style.display = "flex";
  document.getElementById("postTitle").focus();

  // 뒤로가기 처리: history에 상태 추가
  modalHistoryState = history.length;
  history.pushState({modal: 'postCreate'}, '', '');
}

function closePostCreateModal() {
  document.getElementById("postCreateModal").style.display = "none";
}

// 모달 외부 클릭 시 닫기
document.addEventListener("click", (e) => {
  const modal = document.getElementById("postCreateModal");
  if (e.target === modal) {
    closePostCreateModal();
  }
});

// ESC 키로 모달 닫기
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("postCreateModal");
    if (modal.style.display === "flex") {
      closePostCreateModal();
    }
  }





});

// ── 이미지 미리보기 ──
function previewImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  // 이미지 크기 제한: 300KB
  const MAX_SIZE = 300 * 1024; // 300KB
  if (file.size > MAX_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    showToast(`파일이 너무 커요! (${sizeMB}MB)\n300KB 이하 이미지를 선택해주세요`);
    document.getElementById("postImage").value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const container = document.getElementById("imagePreviewContainer");
    container.innerHTML = `
      <div style="position:relative;display:inline-block">
        <img src="${e.target.result}" style="max-width:100%;border-radius:8px;max-height:200px">
        <button onclick="removeImage()" style="position:absolute;top:8px;right:8px;background:#ff4d4d;border:none;color:#fff;border-radius:50%;width:32px;height:32px;cursor:pointer;font-weight:700;font-size:1rem">✕</button>
      </div>
    `;
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  document.getElementById("postImage").value = "";
  document.getElementById("imagePreviewContainer").innerHTML = "";
}

// ── 배지 시스템 ──
async function addUserBadge(uid, badgeType) {
  if (!db) return;
  try {
    const badges = await db.ref(`users/${uid}/badges`).once("value");
    const currentBadges = badges.val() || [];

    if (!currentBadges.includes(badgeType)) {
      currentBadges.push(badgeType);
      await db.ref(`users/${uid}/badges`).set(currentBadges);
    }
  } catch (e) {
    console.error("배지 추가 실패:", e);
  }
}

async function getUserBadges(uid) {
  if (!db) return [];
  try {
    const badges = await db.ref(`users/${uid}/badges`).once("value");
    return badges.val() || [];
  } catch (e) {
    return [];
  }
}

function getBadgeDisplay(badgeType) {
  const badges = {
    "info-provider": { emoji: "📅", label: "정보 제공자", color: "rgba(124, 77, 255, 0.3)" }
  };
  return badges[badgeType] || null;
}

// ── 게시글 템플릿 업데이트 ──
function updatePostTemplate() {
  const template = document.getElementById("postTemplate").value;
  const scheduleTemplate = document.getElementById("scheduleTemplate");
  const titleInput = document.getElementById("postTitle");

  if (template === "schedule") {
    scheduleTemplate.style.display = "block";
  } else {
    scheduleTemplate.style.display = "none";
  }

  const placeholders = {
    free: "게시물 제목을 입력해주세요",
    schedule: "[일정] 공연명을 입력해주세요",
    fanart: "[팬아트] 작품 제목을 입력해주세요",
    news: "[뉴스] 제목을 입력해주세요",
    qna: "[Q&A] 질문을 입력해주세요"
  };
  titleInput.placeholder = placeholders[template] || "게시물 제목을 입력해주세요";
}

// ── 게시물 저장 ──
async function submitPost() {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    return;
  }

  const template = document.getElementById("postTemplate").value;
  let title = document.getElementById("postTitle").value.trim();
  let content = document.getElementById("postContent").value.trim();
  const selectedFandom = document.getElementById("communityFandomSelect").value;
  let isSchedule = false;

  // 일정 템플릿 처리
  if (template === "schedule") {
    const scheduleTitle = document.getElementById("scheduleTitle").value.trim();
    const scheduleDate = document.getElementById("scheduleDate").value;
    const scheduleLocation = document.getElementById("scheduleLocation").value.trim();
    const schedulePrice = document.getElementById("schedulePrice").value.trim();
    const scheduleLink = document.getElementById("scheduleLink").value.trim();

    if (!scheduleTitle || !scheduleDate) {
      showToast("공연명과 날짜를 입력해주세요");
      return;
    }

    isSchedule = true;
    if (!title) title = `[일정] ${scheduleTitle}`;

    // 일정 정보를 content에 자동 생성
    const dateObj = new Date(scheduleDate);
    const formattedDate = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

    const scheduleInfo = `📅 **${scheduleTitle}**\n\n🗓️ 날짜: ${formattedDate}\n${scheduleLocation ? `📍 장소: ${scheduleLocation}\n` : ""}${schedulePrice ? `💰 가격: ${schedulePrice}\n` : ""}${scheduleLink ? `🎫 [예매하기](${scheduleLink})\n` : ""}---\n\n${content}`;
    content = scheduleInfo;
  }

  if (!title) {
    showToast("제목을 입력해주세요");
    return;
  }
  if (!content || content === "---\n\n") {
    showToast("내용을 입력해주세요");
    return;
  }

  const submitBtn = event.target;
  submitBtn.disabled = true;
  submitBtn.textContent = "작성 중...";

  try {
    const postId = db.ref().push().key;

    // 게시물 저장
    const postData = {
      title,
      content,
      authorUid: currentUser.uid,
      authorName: currentUser.customNickname || currentUser.displayName || "익명",
      timestamp: Date.now(),
      isHidden: false,
      reportCount: 0,
      views: 0,
      type: template, // 게시글 유형 저장
      isSchedule: isSchedule // 일정 여부
    };

    await db.ref(`community/${selectedFandom}/${postId}`).set(postData);

    // 일정 게시글이면 "정보 제공자" 배지 부여
    if (isSchedule) {
      await addUserBadge(currentUser.uid, "info-provider");
      showToast("✅ 게시물이 작성되었어요! 📅 정보 제공자 배지를 획득했습니다!");
    } else {
      showToast("✅ 게시물이 작성되었어요!");
    }
    closePostCreateModal();

    showToast("✅ 게시물이 작성되었어요!");
    closePostCreateModal();
  } catch (error) {
    showToast("게시물 작성 실패: " + error.message);
    console.error(error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "작성하기";
  }
}

// ── 게시물 수정 ──
async function editPost(fandom, postId, title, content) {
  const newTitle = prompt("제목을 수정해주세요:", title);
  if (newTitle === null || newTitle.trim() === "") return;

  const newContent = prompt("내용을 수정해주세요:", content);
  if (newContent === null || newContent.trim() === "") return;

  try {
    await db.ref(`community/${fandom}/${postId}`).update({
      title: newTitle.trim(),
      content: newContent.trim()
    });
    showToast("✅ 게시물이 수정되었어요!");
  } catch (error) {
    showToast("수정 실패: " + error.message);
    console.error(error);
  }
}

// ── 게시물 삭제 ──
async function deletePost(fandom, postId) {
  if (!confirm("정말 삭제하시겠어요? 복구할 수 없습니다.")) return;

  try {
    // Database에서 게시물 삭제
    await db.ref(`community/${fandom}/${postId}`).remove();
    showToast("✅ 게시물이 삭제되었어요");
  } catch (error) {
    showToast("삭제 실패: " + error.message);
    console.error(error);
  }
}

// ── 게시물 전체 내용 보기 ──
function showFullContent(postId, content) {
  const modal = document.getElementById("fullContentModal");
  const textEl = document.getElementById("fullContentText");
  textEl.textContent = content;
  modal.style.display = "flex";
}

function closeFullContentModal() {
  document.getElementById("fullContentModal").style.display = "none";
}

// 모달 외부 클릭 시 닫기
document.addEventListener("click", (e) => {
  const modal = document.getElementById("fullContentModal");
  if (modal && e.target === modal) {
    closeFullContentModal();
  }
});

// ESC 키로 모달 닫기
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("fullContentModal");
    if (modal && modal.style.display === "flex") {
      closeFullContentModal();
    }
  }
});

// ── 좋아요 토글 ──
async function toggleLike(fandom, postId) {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인 후 좋아요를 할 수 있습니다");
    return;
  }

  const likeRef = db.ref(`community/${fandom}/${postId}/likes/${currentUser.uid}`);
  const snapshot = await likeRef.once("value");

  if (snapshot.exists()) {
    // 좋아요 취소
    await likeRef.remove();
  } else {
    // 좋아요 추가
    await likeRef.set(true);
  }

  // 좋아요 수 업데이트 및 data-likes 속성 갱신
  const likesSnap = await db.ref(`community/${fandom}/${postId}/likes`).once("value");
  const likeCount = Object.keys(likesSnap.val() || {}).length;

  const postEl = document.querySelector(`[data-postid="${postId}"]`);
  if (postEl) {
    postEl.setAttribute("data-likes", likeCount);
  }

  loadLikes(fandom, postId);
}

// ── 좋아요 수 로드 ──
function loadLikes(fandom, postId) {
  db.ref(`community/${fandom}/${postId}/likes`).on("value", snap => {
    const likes = snap.val() || {};
    const likeCount = Object.keys(likes).length;
    const likeCountEl = document.getElementById(`like-count-${postId}`);
    if (likeCountEl) {
      likeCountEl.textContent = likeCount;
    }
  });
}

// ── 조회수 로드 ──
function loadViews(fandom, postId) {
  const viewsCallback = (snap) => {
    const viewCount = snap.val() || 0;
    const viewCountEl = document.getElementById(`view-count-${postId}`);
    if (viewCountEl) {
      viewCountEl.textContent = viewCount;
    }
  };

  const viewsRef = db.ref(`community/${fandom}/${postId}/views`);
  viewsRef.on("value", viewsCallback);
  postDetailListeners.views = { ref: viewsRef, callback: viewsCallback };
}

// ── 포스트 리스트용 좋아요 로드 (리스너 추적) ──
function loadLikesForPostList(fandom, postId) {
  const likeCountEl = document.getElementById(`like-count-${postId}`);
  if (!likeCountEl) return;

  const likesCallback = (snap) => {
    const likes = snap.val() || {};
    const likeCount = Object.keys(likes).length;
    if (likeCountEl) {
      likeCountEl.textContent = likeCount;
    }
  };

  const likesRef = db.ref(`community/${fandom}/${postId}/likes`);
  likesRef.on("value", likesCallback);
  postListListeners.push({ ref: likesRef, callback: likesCallback });
}

// ── 포스트 리스트용 조회수 로드 (리스너 추적) ──
function loadViewsForPostList(fandom, postId) {
  const viewCountEl = document.getElementById(`view-count-${postId}`);
  if (!viewCountEl) return;

  const viewsCallback = (snap) => {
    const viewCount = snap.val() || 0;
    if (viewCountEl) {
      viewCountEl.textContent = viewCount;
    }
  };

  const viewsRef = db.ref(`community/${fandom}/${postId}/views`);
  viewsRef.on("value", viewsCallback);
  postListListeners.push({ ref: viewsRef, callback: viewsCallback });
}

// ── 댓글 로드 ──
function loadComments(fandom, postId) {
  const commentsList = document.getElementById(`comments-list-${postId}`);
  if (!commentsList) return;

  db.ref(`community/${fandom}/${postId}/comments`).on("value", snap => {
    const comments = snap.val() || {};
    commentsList.innerHTML = "";

    Object.entries(comments).forEach(([commentId, comment]) => {
      if (comment.isHidden) return;

      const commentDate = new Date(comment.timestamp);
      const timeStr = commentDate.toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'});
      const isCommentAuthor = isLoggedIn && currentUser && comment.authorUid === currentUser.uid;

      const commentEl = document.createElement("div");
      commentEl.style.cssText = "padding:8px;background:rgba(124,77,255,0.05);border-radius:6px;margin-bottom:8px;font-size:0.9rem";
      commentEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-weight:600;color:var(--text)">${escHtml(comment.authorName)}</span>
          <span style="font-size:0.75rem;color:var(--muted)">${timeStr}</span>
        </div>
        <div style="color:var(--text);margin-bottom:6px">${escHtml(comment.content)}</div>
        ${isCommentAuthor ? `<button onclick="deleteComment('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}'); event.stopPropagation()" style="font-size:0.75rem;background:none;border:none;color:var(--pink);cursor:pointer;padding:0">삭제</button>` : ''}
      `;
      commentsList.appendChild(commentEl);
    });
  });
}

// ── 댓글 작성 ──
async function submitComment(fandom, postId) {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인 후 댓글을 작성할 수 있습니다");
    return;
  }

  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();

  if (!content) {
    showToast("댓글 내용을 입력해주세요");
    return;
  }

  try {
    const commentId = db.ref().push().key;
    await db.ref(`community/${fandom}/${postId}/comments/${commentId}`).set({
      content,
      authorUid: currentUser.uid,
      authorName: currentUser.customNickname || currentUser.displayName || "익명",
      timestamp: Date.now(),
      isHidden: false
    });
    input.value = "";
    showToast("💬 댓글이 등록되었어요!");

    // 게시물 목록의 댓글 수 업데이트
    setTimeout(() => {
      updateCommentCount(fandom, postId);
    }, 300);
  } catch (error) {
    showToast("댓글 작성 실패: " + error.message);
    console.error(error);
  }
}

// ── 댓글 삭제 ──
async function deleteComment(fandom, postId, commentId) {
  if (!confirm("댓글을 삭제하시겠어요?")) return;

  try {
    await db.ref(`community/${fandom}/${postId}/comments/${commentId}`).remove();
    showToast("댓글이 삭제되었어요");
  } catch (error) {
    showToast("삭제 실패: " + error.message);
    console.error(error);
  }
}

// ── 게시물 신고 ──
async function reportPost(fandom, postId) {
  if (!isLoggedIn) {
    showToast("로그인 후 신고할 수 있습니다");
    return;
  }

  const reason = prompt("신고 사유를 선택하세요:\n1. 부적절한 내용\n2. 스팸\n3. 광고\n4. 욕설");
  if (!reason) return;

  try {
    // 기존 신고 데이터 조회
    const snap = await db.ref(`reports/${postId}`).once("value");
    const reportData = snap.val() || { reports: [], count: 0 };

    // 중복 신고 확인
    if (reportData.reports.some(r => r.uid === currentUser.uid)) {
      showToast("이미 신고한 게시물입니다");
      return;
    }

    // 신고 추가
    reportData.reports.push({
      uid: currentUser.uid,
      timestamp: Date.now(),
      reason: reason
    });
    reportData.count = reportData.reports.length;

    // 신고 저장
    await db.ref(`reports/${postId}`).set(reportData);

    // 3회 이상 신고 시 게시물 숨김
    if (reportData.count >= 3) {
      await db.ref(`community/${fandom}/${postId}/isHidden`).set(true);
      showToast("✅ 신고가 접수되었습니다 (게시물이 숨겨졌습니다)");
    } else {
      showToast(`✅ 신고가 접수되었습니다 (${reportData.count}/3)`);
    }
  } catch (error) {
    showToast("신고 실패: " + error.message);
    console.error(error);
  }
}

// ── 모달 뒤로가기 처리 ──
window.addEventListener('popstate', (e) => {
  if (e.state && e.state.page === 'postDetail') {
    window.popstateActive = true;
    closePostDetail();
    window.popstateActive = false;
  } else if (e.state && e.state.modal === 'postCreate') {
    // popstate 이벤트 발생 - 모달이 열려 있으면 닫기
    closePostCreateModal();
  }
});

init();
