async function showPostDetail(fandom, postId) {
  // History API로 URL 상태 저장
  window.history.pushState({
    page: "postDetail",
    fandom: fandom,
    postId: postId
  }, null, `#postDetail/${fandom}/${postId}`);

  // 페이지 표시
  document.getElementById("communityPage").classList.add("hidden");
  document.getElementById("votePage").classList.add("hidden");
  const detailPage = document.getElementById("postDetailPage");
  detailPage.style.display = "flex";
  detailPage.scrollTop = 0;

  try {
    // 게시물 데이터 로드
    const snap = await db.ref(`community/${fandom}/${postId}`).once("value");
    if (!snap.exists()) {
      showToast("게시물을 찾을 수 없어요");
      return;
    }

    const post = snap.val();
    const isAuthor = isLoggedIn && currentUser && post.authorUid === currentUser.uid;
    const timeStr = getRelativeTime(post.timestamp);

    // 조회수 증가
    const currentViews = post.views || 0;
    await db.ref(`community/${fandom}/${postId}/views`).set(currentViews + 1);

    // 제목 설정
    document.getElementById("postDetailTitle").textContent = escHtml(post.title);

    // 메타 정보 설정
    const metaHTML = `
      <span class="post-author">👤 ${escHtml(post.authorName)}</span>
      <span class="post-date">📅 ${timeStr}</span>
    `;
    document.getElementById("postDetailMeta").innerHTML = metaHTML;

    // 내용 설정
    document.getElementById("postDetailContent").textContent = post.content;

    // 참여 버튼 설정 (좋아요, 댓글)
    const engagementHTML = `
      <button class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(255,100,100,0.1) 0%,rgba(255,140,140,0.05) 100%);border:1px solid rgba(255,100,100,0.2);position:relative;overflow:hidden;border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);cursor:pointer" onclick="toggleLike('${escAttr(fandom)}', '${escAttr(postId)}'); event.stopPropagation()" onmouseover="this.style.background='linear-gradient(135deg,rgba(255,100,100,0.18) 0%,rgba(255,140,140,0.12) 100%)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(255,100,100,0.2)';this.style.borderColor='rgba(255,100,100,0.4)'" onmouseout="this.style.background='linear-gradient(135deg,rgba(255,100,100,0.1) 0%,rgba(255,140,140,0.05) 100%)';this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='rgba(255,100,100,0.2)'">
        <span style="font-size:1rem;display:inline-block;transition:transform 0.3s">❤️</span>
        <span style="font-weight:700;color:var(--text);font-size:0.9rem">좋아요</span>
        <span id="detail-like-count-${postId}" style="background:rgba(255,100,100,0.2);padding:2px 8px;border-radius:12px;font-size:0.8rem;font-weight:700;color:rgb(255,100,100);transition:all 0.2s">0</span>
      </button>
      <button class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(100,180,255,0.1) 0%,rgba(140,200,255,0.05) 100%);border:1px solid rgba(100,180,255,0.2);border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);cursor:pointer" onclick="document.getElementById('postDetailCommentsList').scrollIntoView({behavior:'smooth'}); event.stopPropagation()" onmouseover="this.style.background='linear-gradient(135deg,rgba(100,180,255,0.18) 0%,rgba(140,200,255,0.12) 100%)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(100,180,255,0.2)';this.style.borderColor='rgba(100,180,255,0.4)'" onmouseout="this.style.background='linear-gradient(135deg,rgba(100,180,255,0.1) 0%,rgba(140,200,255,0.05) 100%)';this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='rgba(100,180,255,0.2)'">
        <span style="font-size:1rem;display:inline-block;transition:transform 0.3s">💬</span>
        <span style="font-weight:700;color:var(--text);font-size:0.9rem">댓글</span>
        <span id="detail-comment-count-${postId}" style="background:rgba(100,180,255,0.2);padding:2px 8px;border-radius:12px;font-size:0.8rem;font-weight:700;color:rgb(100,180,255);transition:all 0.2s">0</span>
      </button>
    `;
    document.getElementById("postDetailEngagement").innerHTML = engagementHTML;

    // 관리 버튼 설정 (수정, 삭제, 신고)
    let managementHTML = '';
    if (isAuthor) {
      managementHTML = `
        <button class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(100,200,100,0.1) 0%,rgba(140,220,140,0.05) 100%);border:1px solid rgba(100,200,100,0.2);border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);color:var(--text);cursor:pointer" onclick="editPost('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(post.title)}', '${escAttr(post.content)}'); event.stopPropagation()" onmouseover="this.style.background='linear-gradient(135deg,rgba(100,200,100,0.18) 0%,rgba(140,220,140,0.12) 100%)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(100,200,100,0.2)';this.style.borderColor='rgba(100,200,100,0.4)'" onmouseout="this.style.background='linear-gradient(135deg,rgba(100,200,100,0.1) 0%,rgba(140,220,140,0.05) 100%)';this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='rgba(100,200,100,0.2)'"><span style="font-size:1rem">✏️</span><span style="font-weight:700">수정</span></button>
        <button class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(255,100,100,0.15) 0%,rgba(255,120,120,0.05) 100%);border:1px solid rgba(255,100,100,0.3);border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);color:rgb(255,100,100);cursor:pointer" onclick="confirmDeletePost('${escAttr(fandom)}', '${escAttr(postId)}'); closePostDetail(); event.stopPropagation()" onmouseover="this.style.background='linear-gradient(135deg,rgba(255,100,100,0.25) 0%,rgba(255,120,120,0.15) 100%)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(255,100,100,0.25)';this.style.borderColor='rgba(255,100,100,0.5)'" onmouseout="this.style.background='linear-gradient(135deg,rgba(255,100,100,0.15) 0%,rgba(255,120,120,0.05) 100%)';this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='rgba(255,100,100,0.3)'"><span style="font-size:1rem">🗑️</span><span style="font-weight:700">삭제</span></button>
      `;
    } else {
      managementHTML = `
        <button class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(255,150,50,0.1) 0%,rgba(255,170,80,0.05) 100%);border:1px solid rgba(255,150,50,0.2);border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);grid-column:span 2;cursor:pointer" onclick="reportPost('${escAttr(fandom)}', '${escAttr(postId)}'); event.stopPropagation()" onmouseover="this.style.background='linear-gradient(135deg,rgba(255,150,50,0.18) 0%,rgba(255,170,80,0.12) 100%)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(255,150,50,0.2)';this.style.borderColor='rgba(255,150,50,0.4)'" onmouseout="this.style.background='linear-gradient(135deg,rgba(255,150,50,0.1) 0%,rgba(255,170,80,0.05) 100%)';this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='rgba(255,150,50,0.2)'"><span style="font-size:1rem">🚩</span><span style="font-weight:700;color:var(--text)">신고</span></button>
      `;
    }
    document.getElementById("postDetailManagement").innerHTML = managementHTML;

    // 좋아요 수 업데이트 (리스너 저장)
    const likesCallback = (snap) => {
      const likes = snap.val() || {};
      const likeCount = Object.keys(likes).length;
      const el = document.getElementById(`detail-like-count-${postId}`);
      if (el) el.textContent = likeCount;
    };
    const likesRef = db.ref(`community/${fandom}/${postId}/likes`);
    likesRef.on("value", likesCallback);
    postDetailListeners.likes = { ref: likesRef, callback: likesCallback };

    // 댓글 섹션 설정
    const commentsHTML = `
      <div style="margin-top:12px">
        <h3 style="font-size:1rem;font-weight:700;color:var(--text);margin-bottom:16px;display:flex;align-items:center;gap:8px;margin-top:4px"><span>💬</span> 댓글</h3>
        <div id="postDetailCommentsList" style="margin-bottom:20px;max-height:350px;overflow-y:auto"></div>

        ${isLoggedIn ? `
          <div style="background:linear-gradient(135deg,rgba(124,77,255,0.08) 0%,rgba(100,150,255,0.05) 100%);border:1.5px solid rgba(124,77,255,0.25);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
            <textarea id="detail-comment-input-${postId}" placeholder="따뜻한 댓글을 남겨보세요..." style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit;font-size:0.95rem;resize:none;min-height:90px;transition:all 0.2s" onmouseover="this.style.borderColor='rgba(124,77,255,0.5)'" onmouseout="this.style.borderColor='var(--border)'" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'" maxlength="500" oninput="document.getElementById('char-count-${postId}').textContent = this.value.length"></textarea>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:0.75rem;color:var(--muted)">최대 <span id="char-count-${postId}">0</span>/500자</span>
              <button onclick="submitDetailComment('${escAttr(fandom)}', '${escAttr(postId)}'); event.stopPropagation()" style="padding:11px 24px;background:linear-gradient(135deg,var(--primary) 0%,rgba(124,77,255,0.85) 100%);border:none;border-radius:8px;color:#fff;font-weight:700;font-family:inherit;cursor:pointer;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);box-shadow:0 4px 12px rgba(124,77,255,0.35);font-size:0.9rem;position:relative;overflow:hidden" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 20px rgba(124,77,255,0.45)';this.style.background='linear-gradient(135deg,var(--primary) 0%,rgba(124,77,255,0.9) 100%)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(124,77,255,0.35)';this.style.background='linear-gradient(135deg,var(--primary) 0%,rgba(124,77,255,0.85) 100%)'">💬 댓글 작성</button>
            </div>
          </div>
        ` : `<div style="text-align:center;padding:16px;background:linear-gradient(135deg,rgba(124,77,255,0.1) 0%,rgba(100,150,255,0.05) 100%);border:1px solid rgba(124,77,255,0.2);border-radius:12px;color:var(--muted);font-size:0.9rem"><span style="font-size:1rem">🔐</span> 댓글을 작성하려면 로그인해주세요</div>`}
      </div>
    `;
    document.getElementById("postDetailComments").innerHTML = commentsHTML;

    // 댓글 로드
    loadDetailComments(fandom, postId);

  } catch (e) {
    console.error("게시물 로드 실패:", e);
    showToast("게시물을 불러올 수 없어요");
  }
}

// ── 게시물 상세 페이지 닫기 ──





function closePostDetail() {
  // 페이지 숨김
  document.getElementById("postDetailPage").style.display = "none";

  // 커뮤니티 페이지 표시
  document.getElementById("communityPage").classList.remove("hidden");
  document.getElementById("communityPage").classList.add("show");

  // 게시물 상세 페이지의 모든 Firebase 리스너 정리
  Object.values(postDetailListeners).forEach(listener => {
    if (listener && listener.ref && listener.callback) {
      listener.ref.off("value", listener.callback);
    }
  });
  postDetailListeners = { likes: null, comments: null, views: null };

  // 뒤로가기 시뮬레이션 (popstate 이벤트에서 호출된 경우 제외)
  if (!window.popstateActive) {
    window.history.back();
  }
}

// ── 상세 페이지에서 댓글 로드 ──
function loadDetailComments(fandom, postId) {
  const commentsList = document.getElementById("postDetailCommentsList");

  const commentsCallback = (snap) => {
    const comments = snap.val() || {};
    commentsList.innerHTML = "";
    let commentCount = 0;

    if (Object.keys(comments).length === 0) {
      commentsList.innerHTML = '<div style="text-align:center;padding:12px;color:var(--muted);font-size:0.9rem">댓글이 없어요</div>';
    } else {
      Object.entries(comments).forEach(([commentId, comment]) => {
        if (comment.isHidden) return;
        commentCount++;

        const isCommentAuthor = isLoggedIn && currentUser && comment.authorUid === currentUser.uid;
        const timeStr = getRelativeTime(comment.timestamp);

        const commentEl = document.createElement("div");
        commentEl.style.cssText = "padding:12px 14px;background:linear-gradient(135deg,rgba(124,77,255,0.08) 0%,rgba(100,150,255,0.04) 100%);border:1px solid rgba(124,77,255,0.15);border-radius:10px;margin-bottom:10px;font-size:0.9rem;transition:all 0.2s";
        commentEl.onmouseover = function() {
          this.style.background = 'linear-gradient(135deg,rgba(124,77,255,0.12) 0%,rgba(100,150,255,0.08) 100%)';
          this.style.borderColor = 'rgba(124,77,255,0.25)';
        };
        commentEl.onmouseout = function() {
          this.style.background = 'linear-gradient(135deg,rgba(124,77,255,0.08) 0%,rgba(100,150,255,0.04) 100%)';
          this.style.borderColor = 'rgba(124,77,255,0.15)';
        };
        commentEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <span style="font-weight:700;color:var(--text);font-size:0.95rem">${escHtml(comment.authorName)}</span>
                ${isCommentAuthor ? `<span style="background:linear-gradient(135deg,rgba(124,77,255,0.3) 0%,rgba(100,150,255,0.2) 100%);color:var(--primary);font-size:0.7rem;padding:2px 6px;border-radius:4px;font-weight:600">작성자</span>` : ''}
              </div>
              <div style="font-size:0.75rem;color:var(--muted)">${timeStr}</div>
            </div>
            ${isCommentAuthor ? `<button onclick="deleteComment('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}'); event.stopPropagation()" style="font-size:0.75rem;background:rgba(255,100,100,0.1);border:1px solid rgba(255,100,100,0.3);color:rgb(255,100,100);cursor:pointer;padding:5px 10px;border-radius:6px;font-weight:600;transition:all 0.2s;white-space:nowrap" onmouseover="this.style.background='rgba(255,100,100,0.2)';this.style.borderColor='rgba(255,100,100,0.5)'" onmouseout="this.style.background='rgba(255,100,100,0.1)';this.style.borderColor='rgba(255,100,100,0.3)'">삭제</button>` : ''}
          </div>
          <div style="color:var(--text);line-height:1.6;word-break:break-word">${escHtml(comment.content)}</div>
        `;
        commentsList.appendChild(commentEl);
      });
    }

    // 댓글 수 업데이트
    const countEl = document.getElementById(`detail-comment-count-${postId}`);
    if (countEl) countEl.textContent = commentCount;
  };

  // 리스너 등록 및 저장
  const commentsRef = db.ref(`community/${fandom}/${postId}/comments`);
  commentsRef.on("value", commentsCallback);
  postDetailListeners.comments = { ref: commentsRef, callback: commentsCallback };
}

// ── 상세 페이지에서 댓글 작성 ──
async function submitDetailComment(fandom, postId) {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    return;
  }

  const textarea = document.getElementById(`detail-comment-input-${postId}`);
  const content = textarea.value.trim();

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
    textarea.value = "";
    showToast("댓글이 작성됐어요!");
  } catch (e) {
    console.error("댓글 작성 실패:", e);
    showToast("댓글 작성에 실패했어요");
  }
}

// ── 댓글 모달 열기 ──
function showCommentsModal(fandom, postId) {
  const modal = document.getElementById("commentsModal");
  modal.style.display = "flex";

  // 댓글 목록 로드
  const commentsList = document.getElementById("commentsModalList");
  commentsList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">댓글을 불러오는 중...</div>';

  // 기존 리스너 정리
  if (commentsModalListener && commentsModalListener.ref && commentsModalListener.callback) {
    commentsModalListener.ref.off("value", commentsModalListener.callback);
  }

  // 댓글 리스너 설정
  const commentsModalCallback = (snap) => {
    const comments = snap.val() || {};
    commentsList.innerHTML = "";

    if (Object.keys(comments).length === 0) {
      commentsList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">댓글이 없어요. 첫 댓글을 남겨보세요!</div>';
    } else {
      Object.entries(comments).forEach(([commentId, comment]) => {
        if (comment.isHidden) return;

        const isCommentAuthor = isLoggedIn && currentUser && comment.authorUid === currentUser.uid;
        const timeStr = getRelativeTime(comment.timestamp);

        const commentEl = document.createElement("div");
        commentEl.style.cssText = "padding:12px;background:rgba(124,77,255,0.05);border-radius:8px;margin-bottom:8px";
        commentEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
            <div>
              <span style="font-weight:700;color:var(--text);font-size:0.9rem">${escHtml(comment.authorName)}</span>
              <div style="font-size:0.75rem;color:var(--muted);margin-top:2px">${timeStr}</div>
            </div>
            ${isCommentAuthor ? `<button onclick="deleteComment('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}'); event.stopPropagation()" style="font-size:0.7rem;background:rgba(255,77,77,0.1);border:1px solid rgba(255,77,77,0.3);color:var(--pink);cursor:pointer;padding:4px 8px;border-radius:4px">삭제</button>` : ''}
          </div>
          <div style="color:var(--text);font-size:0.9rem;line-height:1.5">${escHtml(comment.content)}</div>
        `;
        commentsList.appendChild(commentEl);
      });
    }
  };

  // 리스너 등록 및 저장
  const commentsRef = db.ref(`community/${fandom}/${postId}/comments`);
  commentsRef.on("value", commentsModalCallback);
  commentsModalListener = { ref: commentsRef, callback: commentsModalCallback };

  // 댓글 입력 섹션 업데이트
  const inputSection = document.getElementById("commentsModalInput");
  if (isLoggedIn) {
    inputSection.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <textarea id="modal-comment-input" placeholder="댓글을 입력해주세요..." style="width:100%;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;font-size:0.9rem;resize:none;min-height:60px" maxlength="500"></textarea>
        <button onclick="submitCommentFromModal('${escAttr(fandom)}', '${escAttr(postId)}'); event.stopPropagation()" style="padding:12px;background:var(--primary);border:none;border-radius:8px;color:#fff;font-weight:700;font-family:inherit;cursor:pointer">댓글 작성</button>
      </div>
    `;
  } else {
    inputSection.innerHTML = '<div style="text-align:center;padding:16px;background:rgba(124,77,255,0.1);border-radius:8px;color:var(--muted);font-size:0.9rem">댓글을 작성하려면 로그인해주세요</div>';
  }
}

// ── 댓글 모달 닫기 ──
function closeCommentsModal() {
  const modal = document.getElementById("commentsModal");
  modal.style.display = "none";

  // 리스너 정리
  if (commentsModalListener && commentsModalListener.ref && commentsModalListener.callback) {
    commentsModalListener.ref.off("value", commentsModalListener.callback);
    commentsModalListener = null;
  }
}

// ── 모달에서 댓글 작성 ──
async function submitCommentFromModal(fandom, postId) {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    return;
  }

  const textarea = document.getElementById("modal-comment-input");
  const content = textarea.value.trim();

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
    textarea.value = "";
    showToast("댓글이 작성됐어요!");
  } catch (e) {
    console.error("댓글 작성 실패:", e);
    showToast("댓글 작성에 실패했어요");
  }
}

// ── 댓글 개수 업데이트 ──
function updateCommentCount(fandom, postId) {
  const commentCountEl = document.getElementById(`comment-count-${postId}`);
  if (!commentCountEl) return;

  const commentCountCallback = (snap) => {
    const comments = snap.val() || {};
    const count = Object.keys(comments).filter(id => !comments[id].isHidden).length;
    if (commentCountEl) commentCountEl.textContent = count;
  };

  const commentsRef = db.ref(`community/${fandom}/${postId}/comments`);
  commentsRef.on("value", commentCountCallback);
  postListListeners.push({ ref: commentsRef, callback: commentCountCallback });
}

// ── 게시물 삭제 확인 ──