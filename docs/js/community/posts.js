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

    // ★ 헤더 업데이트는 먼저 실행 (게시물 유무와 상관없이)
    const fandomHeader = document.getElementById("communityHeaderInfo");
    const fandomMeta = GROUP_META[selectedFandom];
    if (fandomMeta) {
      document.getElementById("communityHeaderEmoji").textContent = fandomMeta.emoji;
      document.getElementById("communityHeaderFandom").textContent = selectedFandom;
      document.getElementById("communityHeaderText").textContent = selectedFandom;
      fandomHeader.style.display = "block";
    }

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