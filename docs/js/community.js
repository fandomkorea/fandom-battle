// ── 커뮤니티 게시물 새로고침 ──
function refreshCommunityPosts() {
  const selectedFandom = document.getElementById("communityFandomSelect").value;
  if (!selectedFandom) {
    showToast("팬덤을 선택해주세요");
    return;
  }

  // 게시물 목록 초기화 후 다시 로드
  showToast("🔄 게시물을 새로고침 중입니다...");
  loadCommunityPosts();
}

// ── 커뮤니티 초기화 ──
function initCommunityPage() {
  // showCommunityPage()에서 처리하므로 여기서는 비움
}

// 현재 활성 리스너 추적
let currentCommunityListener = null;

// ── 게시글 이미지 URL 및 public_id 저장소 ──
let postImageUrl = null;
let postImagePublicId = null; // Cloudinary 이미지 삭제용

// ── 게시물 상세 모달 리스너 저장소 ──
let postDetailListeners = {
  likes: null,
  comments: null,
  views: null
};

// ── 댓글 모달 리스너 저장소 ──
let commentsModalListener = null;

// ── 댓글 수정 상태 저장소 ──
let editCommentState = {
  fandom: null,
  postId: null,
  commentId: null
};

// ── 댓글 정렬 모드 ──
let commentSortMode = "latest"; // latest, popular, best

// ── 커뮤니티 포스트 리스너 저장소 ──
let postListListeners = [];

// 포스트 리스너 정리 함수
function clearPostListListeners() {
  postListListeners.forEach(listener => {
    if (listener && listener.ref && listener.callback) {
      listener.ref.off("value", listener.callback);
    }
  });
  postListListeners = [];
}

// ── 커뮤니티 게시물 로드 (실시간 리스너) ──
function loadCommunityPosts() {
  const selectedFandom = document.getElementById("communityFandomSelect").value;
  if (!selectedFandom) {
    document.getElementById("communityPostsList").innerHTML = `
      <div class="community-empty">
        <div class="community-empty-icon">👆</div>
        <div class="community-empty-text">위에서 팬덤을 선택하면<br>커뮤니티 게시물을 볼 수 있어요!</div>
      </div>
    `;
    return;
  }

  // 기존 리스너 해제 (포스트 리스트 + 메인 리스너)
  clearPostListListeners();
  if (currentCommunityListener) {
    db.ref(currentCommunityListener).off("value");
  }

  // 로딩 상태 표시
  const postsList = document.getElementById("communityPostsList");
  postsList.innerHTML = `
    <div class="community-empty">
      <div class="spinner" style="display:inline-block;margin-bottom:12px"></div>
      <div class="community-empty-text">게시물을 불러오는 중...</div>
    </div>
  `;

  // Firebase 실시간 리스너
  currentCommunityListener = `community/${selectedFandom}`;
  db.ref(currentCommunityListener).on("value", snap => {
    const posts = snap.val() || {};

    if (Object.keys(posts).length === 0) {
      postsList.innerHTML = `
        <div class="community-empty">
          <div class="community-empty-icon">✨</div>
          <div class="community-empty-text">아직 게시물이 없어요<br>첫 번째 게시물을 작성해보세요!</div>
        </div>
      `;
      return;
    }

    // 최신순으로 정렬
    const sortedPosts = Object.entries(posts)
      .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

    postsList.innerHTML = "";

    let visibleIndex = 0;
    sortedPosts.forEach(([postId, post]) => {
      if (!post.isHidden) {
        const postEl = renderPost(selectedFandom, postId, post, visibleIndex);
        postsList.appendChild(postEl);
        visibleIndex++;
      }
    });

    // 드롭다운 값 초기화 및 정렬 적용
    const sortDropdown = document.getElementById("sortDropdown");
    if (sortDropdown) {
      sortDropdown.value = currentSortMode;
    }
    sortCommunityPosts(currentSortMode);
  });
}

// ── 검색 & 정렬 섹션 토글 ──
function toggleSearchSort() {
  const section = document.getElementById("searchSortSection");
  const isVisible = section.style.display !== "none";

  section.style.display = isVisible ? "none" : "block";
}

// ── 게시물 검색/필터 ──
function filterCommunityPosts() {
  const searchText = document.getElementById("communitySearchInput").value.toLowerCase();
  const postItems = document.querySelectorAll(".post-item");
  let visibleCount = 0;

  if (!searchText.trim()) {
    postItems.forEach(item => item.style.display = "block");
    return;
  }

  postItems.forEach(item => {
    const title = item.querySelector(".post-title")?.textContent.toLowerCase() || "";
    const content = item.querySelector(".post-content")?.textContent.toLowerCase() || "";

    const isMatch = title.includes(searchText) || content.includes(searchText);
    item.style.display = isMatch ? "block" : "none";
    if (isMatch) visibleCount++;
  });

  // 검색 결과 없음 메시지 표시
  let emptyMsg = document.getElementById("searchEmptyMsg");
  if (visibleCount === 0) {
    if (!emptyMsg) {
      const postsList = document.getElementById("communityPostsList");
      emptyMsg = document.createElement("div");
      emptyMsg.id = "searchEmptyMsg";
      emptyMsg.style.cssText = "text-align:center;padding:40px 20px;color:var(--muted);background:rgba(124,77,255,0.04);border:1px dashed var(--border);border-radius:12px;margin:16px 0;font-size:0.9rem";
      emptyMsg.innerHTML = `<div style="font-size:2rem;margin-bottom:12px">🔍</div><div>"<strong>${escHtml(searchText)}</strong>"에 대한 검색 결과가 없어요</div>`;
      postsList.appendChild(emptyMsg);
    }
    emptyMsg.style.display = "block";
  } else if (emptyMsg) {
    emptyMsg.style.display = "none";
  }
}

// ── 게시물 정렬 ──
let currentSortMode = "latest";

function changeSortMode(mode) {
  currentSortMode = mode;
  sortCommunityPosts(mode);

  // 버튼 active 상태 업데이트
  const buttons = document.querySelectorAll('.sort-btn');
  buttons.forEach(btn => {
    if (btn.dataset.sort === mode) {
      btn.classList.add('active');
      btn.style.background = 'linear-gradient(135deg,rgba(124,77,255,0.3) 0%,rgba(100,200,255,0.15) 100%)';
      btn.style.borderColor = 'rgba(124,77,255,0.6)';
      btn.style.boxShadow = '0 0 15px rgba(124,77,255,0.25)';
    } else {
      btn.classList.remove('active');
      btn.style.background = 'linear-gradient(135deg,rgba(124,77,255,0.1) 0%,rgba(100,200,255,0.08) 100%)';
      btn.style.borderColor = 'rgba(124,77,255,0.3)';
      btn.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.1)';
    }
  });

  // Firebase에 저장
  if (isLoggedIn && currentUser && db) {
    db.ref(`users/${currentUser.uid}/preferences/lastSortMode`).set(mode).catch(e => {
      console.error("정렬 모드 저장 실패:", e);
    });
  }
}

// Firebase에서 마지막 정렬 모드 로드
async function loadLastSortMode() {
  if (!isLoggedIn || !currentUser || !db) {
    currentSortMode = "latest";
    return;
  }

  try {
    const snap = await db.ref(`users/${currentUser.uid}/preferences/lastSortMode`).once("value");
    currentSortMode = snap.val() || "latest";
  } catch (e) {
    console.error("정렬 모드 로드 실패:", e);
    currentSortMode = "latest";
  }
}

function sortCommunityPosts(mode) {
  currentSortMode = mode;

  // 게시물 재정렬
  const postsList = document.getElementById("communityPostsList");
  const posts = Array.from(document.querySelectorAll(".post-item"));

  posts.sort((a, b) => {
    if (mode === "latest") {
      // 최신순: timestamp 내림차순
      const timeA = parseInt(a.getAttribute("data-timestamp") || 0);
      const timeB = parseInt(b.getAttribute("data-timestamp") || 0);
      return timeB - timeA;
    } else if (mode === "popular") {
      // 인기순: 좋아요 수 내림차순
      const likesA = parseInt(a.getAttribute("data-likes") || 0);
      const likesB = parseInt(b.getAttribute("data-likes") || 0);
      return likesB - likesA;
    } else if (mode === "best") {
      // 베스트: 좋아요(40%) + 조회수(60%)
      const likesA = parseInt(a.getAttribute("data-likes") || 0);
      const likesB = parseInt(b.getAttribute("data-likes") || 0);
      const viewsA = parseInt(a.getAttribute("data-views") || 0);
      const viewsB = parseInt(b.getAttribute("data-views") || 0);
      const scoreA = likesA * 0.4 + viewsA * 0.6;
      const scoreB = likesB * 0.4 + viewsB * 0.6;
      return scoreB - scoreA;
    }
  });

  // 정렬된 순서대로 다시 추가
  posts.forEach(post => {
    postsList.appendChild(post);
  });
}

// ── 상대 시간 계산 ──
function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('ko-KR', {month:'short', day:'numeric'});
}

// ── 게시물 렌더링 ──
// ── 게시물 목록 아이템 렌더링 (컴팩트 리스트) ──
function renderPost(fandom, postId, post, index) {
  const timeStr = getRelativeTime(post.timestamp);
  const postNumber = index + 1; // 1부터 시작하는 순번

  const postEl = document.createElement("div");
  postEl.className = "post-item post-list-compact";
  postEl.setAttribute("data-timestamp", post.timestamp || 0);
  postEl.setAttribute("data-postid", postId);
  postEl.setAttribute("data-likes", post.likes || 0);
  postEl.setAttribute("data-views", post.views || 0);
  postEl.setAttribute("onclick", `showPostDetail('${escAttr(fandom)}', '${escAttr(postId)}'); event.stopPropagation()`);
  postEl.style.cursor = "pointer";
  // 사진 여부 확인
  const hasImage = post.imageUrl ? '📷' : '';

  postEl.innerHTML = `
    <div class="post-list-left">
      <div class="post-title-row">
        <div class="post-list-title">${escHtml(post.title)}</div>
        <div class="post-list-indicators">
          <span class="post-comment-badge">💬 <span id="comment-count-${postId}">0</span></span>
          ${hasImage ? `<span class="post-image-badge">📷</span>` : ''}
        </div>
      </div>
      <div class="post-meta-row-mobile">
        <span class="post-list-meta">👤 <span id="author-${postId}">${escHtml(post.authorName)}</span></span>
        <span class="post-list-meta-divider">·</span>
        <span class="post-list-meta">📅 ${timeStr}</span>
        <span class="post-list-meta-divider">·</span>
        <span class="post-list-meta">👁️ <span id="view-count-${postId}">${post.views || 0}</span></span>
        <span class="post-list-meta-divider">·</span>
        <span class="post-list-meta">❤️ <span id="like-count-${postId}">0</span></span>
      </div>
    </div>
  `;

  // 배지는 게시물 목록에서 표시하지 않음 (간결성)

  // 좋아요 리스너 설정 (포스트 리스트용)
  loadLikesForPostList(fandom, postId);

  // 댓글 개수 업데이트
  updateCommentCount(fandom, postId);

  // 조회수 리스너 설정 (포스트 리스트용)
  loadViewsForPostList(fandom, postId);

  return postEl;
}

// ── 게시물 상세 페이지 열기 ──
async function showPostDetail(fandom, postId) {
  // popstate 이벤트 리스너 (한 번만 등록)
  if (!window.postDetailPopstateSetup) {
    window.addEventListener('popstate', function(event) {
      if (document.getElementById("postDetailPage").style.display !== "none") {
        if (!event.state || event.state.page !== "postDetail") {
          window.popstateActive = true;
          closePostDetail();
          window.popstateActive = false;
        }
      }
    });
    window.postDetailPopstateSetup = true;
  }

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
    // 디버깅
    console.log(`[DEBUG] isAuthor: ${isAuthor}, isLoggedIn: ${isLoggedIn}, authorUid: ${post.authorUid}, currentUid: ${currentUser?.uid}`);
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
    const contentEl = document.getElementById("postDetailContent");
    contentEl.textContent = post.content;

    // 이미지 표시 (있으면)
    if (post.imageUrl) {
      const imageEl = document.createElement("div");
      imageEl.style.cssText = "margin:16px 0;border-radius:10px;overflow:hidden;box-shadow:0 4px 12px rgba(124,77,255,0.2)";
      imageEl.innerHTML = `<img src="${escHtml(post.imageUrl)}" style="width:100%;height:auto;object-fit:cover;display:block" alt="게시물 이미지">`;
      contentEl.parentNode.insertBefore(imageEl, contentEl.nextSibling);
    }

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
            ${isCommentAuthor ? `<div style="display:flex;gap:6px">
              <button onclick="editComment('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}', '${escAttr(comment.content)}'); event.stopPropagation()" style="font-size:0.75rem;background:rgba(100,150,255,0.1);border:1px solid rgba(100,150,255,0.3);color:rgb(100,150,255);cursor:pointer;padding:5px 10px;border-radius:6px;font-weight:600;transition:all 0.2s;white-space:nowrap" onmouseover="this.style.background='rgba(100,150,255,0.2)';this.style.borderColor='rgba(100,150,255,0.5)'" onmouseout="this.style.background='rgba(100,150,255,0.1)';this.style.borderColor='rgba(100,150,255,0.3)'">수정</button>
              <button onclick="deleteComment('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}'); event.stopPropagation()" style="font-size:0.75rem;background:rgba(255,100,100,0.1);border:1px solid rgba(255,100,100,0.3);color:rgb(255,100,100);cursor:pointer;padding:5px 10px;border-radius:6px;font-weight:600;transition:all 0.2s;white-space:nowrap" onmouseover="this.style.background='rgba(255,100,100,0.2)';this.style.borderColor='rgba(255,100,100,0.5)'" onmouseout="this.style.background='rgba(255,100,100,0.1)';this.style.borderColor='rgba(255,100,100,0.3)'">삭제</button>
            </div>` : ''}
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
      // 댓글 정렬
      let commentEntries = Object.entries(comments).filter(([_, comment]) => !comment.isHidden);

      if (commentSortMode === "latest") {
        // 최신순: timestamp 내림차순
        commentEntries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
      } else if (commentSortMode === "popular") {
        // 인기순: 좋아요 많은 순 (현재는 timestamp로 정렬, 좋아요 기능 추가 시 업데이트)
        commentEntries.sort((a, b) => (b[1].likes || 0) - (a[1].likes || 0) || (b[1].timestamp || 0) - (a[1].timestamp || 0));
      } else if (commentSortMode === "best") {
        // 베스트: 평점 기준 (현재는 timestamp로 정렬, 평점 기능 추가 시 업데이트)
        commentEntries.sort((a, b) => (b[1].score || 0) - (a[1].score || 0) || (b[1].timestamp || 0) - (a[1].timestamp || 0));
      }

      commentEntries.forEach(([commentId, comment]) => {
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
            ${isCommentAuthor ? `<div style="display:flex;gap:4px">
              <button onclick="editComment('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}', '${escAttr(comment.content)}'); event.stopPropagation()" style="font-size:0.7rem;background:rgba(100,150,255,0.1);border:1px solid rgba(100,150,255,0.3);color:var(--blue);cursor:pointer;padding:4px 8px;border-radius:4px">수정</button>
              <button onclick="deleteComment('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}'); event.stopPropagation()" style="font-size:0.7rem;background:rgba(255,77,77,0.1);border:1px solid rgba(255,77,77,0.3);color:var(--pink);cursor:pointer;padding:4px 8px;border-radius:4px">삭제</button>
            </div>` : ''}
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

  // 모달 표시 (드롭다운은 이미 selectedFandom으로 확인됨 — 덮어쓰지 않음)
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

  // 팬덤 변경 후 24시간 제약 확인
  if (!canWritePost(selectedFandom)) {
    return;
  }

  // 모달 초기화
  document.getElementById("postTemplate").value = "free";
  document.getElementById("postTitle").value = "";
  document.getElementById("postContent").value = "";
  document.getElementById("postTitleCount").textContent = "0";
  document.getElementById("postContentCount").textContent = "0";
  document.getElementById("scheduleTemplate").style.display = "none";

  // ★ 이미지 초기화 (이전 게시글의 이미지가 남지 않도록)
  postImageUrl = null;
  document.getElementById("postImagePreview").style.display = "none";
  document.getElementById("postImagePreviewImg").src = "";

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

  // 폼 초기화
  document.getElementById("postTitle").value = "";
  document.getElementById("postContent").value = "";
  document.getElementById("postTitleCount").textContent = "0";
  document.getElementById("postContentCount").textContent = "0";

  // 일정 템플릿 필드 초기화
  document.getElementById("scheduleTitle").value = "";
  document.getElementById("scheduleDate").value = "";
  document.getElementById("scheduleLocation").value = "";
  document.getElementById("schedulePrice").value = "";
  document.getElementById("scheduleLink").value = "";
  document.getElementById("postTemplate").value = "free";

  // 이미지 초기화
  postImageUrl = null;
  document.getElementById("postImagePreview").style.display = "none";
  document.getElementById("postImagePreviewImg").src = "";
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

  // 팬덤 변경 후 24시간 제약 확인
  if (!canWritePost(selectedFandom)) {
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
      isSchedule: isSchedule, // 일정 여부
      imageUrl: postImageUrl || null, // 이미지 URL (있으면 저장)
      imagePublicId: postImagePublicId || null // Cloudinary public_id (이미지 삭제용)
    };

    await db.ref(`community/${selectedFandom}/${postId}`).set(postData);

    // 게시글 작성 후 이미지 URL 및 public_id 초기화
    postImageUrl = null;
    postImagePublicId = null;

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
    // 먼저 게시물 데이터 조회 (이미지 정보 확인)
    const postSnap = await db.ref(`community/${fandom}/${postId}`).once("value");
    const postData = postSnap.val();

    // Cloudinary 이미지가 있으면 직접 삭제 (unsigned API)
    if (postData && postData.imagePublicId) {
      try {
        const formData = new FormData();
        formData.append('public_id', postData.imagePublicId);
        formData.append('upload_preset', 'fandom_battle_images');

        // Cloudinary destroy API 호출 (unsigned)
        const response = await fetch(
          'https://api.cloudinary.com/v1_1/dhkgabcme/image/destroy',
          {
            method: 'POST',
            body: formData
          }
        );

        if (response.ok) {
          console.log("✅ Cloudinary 이미지 삭제 완료:", postData.imagePublicId);
        } else {
          console.warn("⚠️ 이미지 삭제 실패 (계속 진행)");
        }
      } catch (imgError) {
        console.error("⚠️ 이미지 삭제 중 오류 (계속 진행):", imgError);
      }
    }

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
        ${isCommentAuthor ? `<div style="display:flex;gap:12px">
          <button onclick="editComment('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}', '${escAttr(comment.content)}'); event.stopPropagation()" style="font-size:0.75rem;background:none;border:none;color:var(--blue);cursor:pointer;padding:0;text-decoration:underline">수정</button>
          <button onclick="deleteComment('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}'); event.stopPropagation()" style="font-size:0.75rem;background:none;border:none;color:var(--pink);cursor:pointer;padding:0;text-decoration:underline">삭제</button>
        </div>` : ''}
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

// ── 댓글 수정 모달 열기 ──
function editComment(fandom, postId, commentId, currentContent) {
  editCommentState = { fandom, postId, commentId };

  const modal = document.getElementById("editCommentModal");
  const textarea = document.getElementById("editCommentTextarea");

  textarea.value = currentContent;
  textarea.focus();
  textarea.select();

  modal.style.display = "flex";
}

// ── 댓글 수정 모달 닫기 ──
function closeEditCommentModal() {
  const modal = document.getElementById("editCommentModal");
  modal.style.display = "none";

  // 상태 초기화
  editCommentState = { fandom: null, postId: null, commentId: null };
}

// ── 댓글 수정 저장 ──
async function saveEditComment() {
  const textarea = document.getElementById("editCommentTextarea");
  const newContent = textarea.value.trim();

  if (!newContent) {
    showToast("댓글 내용을 입력해주세요");
    return;
  }

  const { fandom, postId, commentId } = editCommentState;

  if (!fandom || !postId || !commentId) {
    showToast("오류가 발생했어요");
    return;
  }

  try {
    await db.ref(`community/${fandom}/${postId}/comments/${commentId}`).update({
      content: newContent
    });

    showToast("댓글이 수정되었어요!");
    closeEditCommentModal();
  } catch (error) {
    showToast("댓글 수정 실패: " + error.message);
    console.error(error);
  }
}

// ── 게시글 이미지 업로드 (Cloudinary) ──
function openPostImageUpload() {
  // Cloudinary 직접 업로드 - 파일 선택 대화
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 파일 검증
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (file.size > maxSize) {
      showToast("❌ 5MB 이하의 이미지만 업로드 가능합니다");
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      showToast("❌ JPG, PNG, GIF, WebP 형식만 지원합니다");
      return;
    }

    showToast("⏳ 이미지를 Cloudinary에 업로드 중입니다...");

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'fandom_battle_images'); // Unsigned upload

      // Cloudinary API로 업로드
      const response = await fetch(
        'https://api.cloudinary.com/v1_1/dhkgabcme/image/upload',
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      // 응답 URL에 변환 파라미터 추가 (자동 최적화)
      postImageUrl = data.secure_url.replace(
        '/upload/',
        '/upload/w_1200,q_auto,f_auto/'
      );
      // public_id 저장 (삭제 시 사용)
      postImagePublicId = data.public_id;

      // 이미지 미리보기 표시
      const preview = document.getElementById('postImagePreview');
      const previewImg = document.getElementById('postImagePreviewImg');
      previewImg.src = postImageUrl;
      preview.style.display = 'block';

      showToast("✅ 이미지가 추가되었습니다!");
    } catch (error) {
      console.error("이미지 업로드 실패:", error);
      showToast("❌ 이미지 업로드에 실패했습니다.");
    }
  };
  input.click();
}

// ── 게시글 이미지 제거 ──
function removePostImage() {
  postImageUrl = null;
  postImagePublicId = null; // public_id도 초기화
  document.getElementById('postImagePreview').style.display = 'none';
  document.getElementById('postImagePreviewImg').src = '';
  showToast("이미지가 제거되었습니다");
}

// ── 댓글 정렬 모드 변경 ──
function changeCommentSortMode(mode) {
  commentSortMode = mode;

  // 버튼 active 상태 업데이트
  const buttons = document.querySelectorAll('.comment-sort-btn');
  buttons.forEach(btn => {
    if (btn.dataset.sort === mode) {
      btn.classList.add('active');
      btn.style.background = 'linear-gradient(135deg,rgba(124,77,255,0.3) 0%,rgba(100,200,255,0.15) 100%)';
      btn.style.borderColor = 'rgba(124,77,255,0.6)';
      btn.style.boxShadow = '0 0 15px rgba(124,77,255,0.25)';
    } else {
      btn.classList.remove('active');
      btn.style.background = 'linear-gradient(135deg,rgba(124,77,255,0.1) 0%,rgba(100,200,255,0.08) 100%)';
      btn.style.borderColor = 'rgba(124,77,255,0.3)';
      btn.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.1)';
    }
  });

  // 댓글 목록을 다시 렌더링 (Firebase 리스너가 자동으로 처리)
  // commentSortMode가 변경되면 다음 리스너 콜백에서 정렬된 순서로 렌더링됨
  const commentsList = document.getElementById('commentsModalList');
  if (commentsList) {
    // 리스너를 재설정하여 정렬된 댓글을 다시 로드
    if (commentsModalListener && commentsModalListener.ref) {
      commentsModalListener.ref.off('value', commentsModalListener.callback);
      commentsModalListener.ref.on('value', commentsModalListener.callback);
    }
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
