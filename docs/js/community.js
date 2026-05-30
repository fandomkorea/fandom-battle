// 게시글/댓글의 authorUid가 현재 사용자면 최신 닉네임 반환 (배치 업데이트 없이 즉시 반영)
function resolveAuthorNickname(item) {
  if (isLoggedIn && currentUser && item.authorUid === currentUser.uid) {
    return currentUser.customNickname || item.authorName || item.authorNickname || '알 수 없음';
  }
  return item.authorNickname || item.authorName || '알 수 없음';
}

// ── 커뮤니티 게시물 새로고침 ──
function refreshCommunityPosts() {
  if (currentFeedMode === 'all') {
    showToast("🔄 전체 피드를 새로고침 중...");
    // ★ forceRefresh=true: 캐시 무시하고 최신 데이터 강제 로드
    loadAllFandomPosts(true);
    return;
  }
  const selectedFandom = document.getElementById("communityFandomSelect").value;
  if (!selectedFandom) {
    showToast("팬덤을 선택해주세요");
    return;
  }
  showToast("🔄 게시물을 새로고침 중입니다...");
  _invalidatePostListCache(selectedFandom); // ★ 캐시 무효화 후 Firebase 재로드
  loadCommunityPosts();
}

// ── 커뮤니티 초기화 ──
function initCommunityPage() {
  // showCommunityPage()에서 처리하므로 여기서는 비움
}

// 현재 활성 리스너 추적
let currentCommunityListener = null;
let communityPostsLoaded = false; // ★ 게시물 로드 성공 여부 (auth 재시도 판단용)

// ── 전체 피드 상태 ──
let currentFeedMode = 'my'; // 'my' | 'all'
let currentSelectedTab = null; // 선택된 탭: 팬덤명 | 'all'
let allFeedPosts = []; // 전체 피드 로드된 포스트 전체 배열
let allFeedDisplayed = 0; // 현재 화면에 표시된 수
const ALL_FEED_PAGE_SIZE = 20; // 한 번에 표시할 게시글 수
let _allFeedLoadId = 0; // 레이스 컨디션 방지용 로드 ID (비동기 중첩 무시)
let _allFeedLastLoadedAt = 0; // 마지막 전체 피드 로드 시각 (ms)
let _allFeedIsRendered = false; // 현재 DOM이 실제로 전체피드를 표시 중인지 여부
const ALL_FEED_CACHE_TTL = 5 * 60 * 1000; // 5분 이내 재로드 스킵
let _savedCommunityScrollY = 0; // 뒤로가기 스크롤 위치 복원용
let currentOtherFandom = null; // 팬덤 찾기로 선택한 타 팬덤

// ── 게시글 이미지 URL 및 public_id 저장소 ──
let postImageUrl = null;
let postImagePublicId = null; // 이미지 키 (R2 object key 또는 Cloudinary public_id)

// ── R2 이미지 업로드 Worker URL (Cloudinary 대체) ──
// 배포 후 입력: 'https://fandom-upload.coder-leebeegle2.workers.dev'
const R2_UPLOAD_WORKER_URL = 'https://fanpick-upload.coder-leebeegle2.workers.dev';

// ── 현재 열린 게시글 최소 메타 캐시 (알림 전송 시 Firebase 재읽기 방지) ──
let currentViewingPost = null;

// ── 게시물 상세 모달 리스너 저장소 ──
let postDetailListeners = {
  likes: null,
  comments: null,
  views: null
};

// ── 댓글 모달 리스너 저장소 ──
let commentsModalListener = null;

// ── 새 댓글 수 폴링 상태 ──
let _commentCountPollTimer = null;
let _displayedCommentCount = 0;

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

// ── 포스트 목록 localStorage 캐시 (3분 TTL) ──
const _POSTS_CACHE_TTL = 3 * 60 * 1000;

function _getCachedPostList(fandom) {
  try {
    const raw = localStorage.getItem(`posts_c_${fandom}`);
    if (!raw) return null;
    const { d, ts } = JSON.parse(raw);
    if (Date.now() - ts > _POSTS_CACHE_TTL) return null;
    return d;
  } catch { return null; }
}

function _setCachedPostList(fandom, data) {
  try {
    localStorage.setItem(`posts_c_${fandom}`, JSON.stringify({ d: data, ts: Date.now() }));
  } catch {}
}

function _invalidatePostListCache(fandom) {
  try {
    if (fandom) localStorage.removeItem(`posts_c_${fandom}`);
    localStorage.removeItem('posts_c_all');
  } catch {}
}

// ── 이미지 클라이언트 압축 (Canvas → WebP, 최대 1200px, ~100-300KB) ──
async function _compressImage(file, maxPx = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const ratio = Math.min(1, maxPx / img.width, maxPx / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('압축 실패')),
        'image/webp', quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('이미지 로드 실패')); };
    img.src = objUrl;
  });
}

// ── 썸네일 URL (R2는 업로드 시 이미 압축됨 — 원본 그대로 반환) ──
function _getThumbUrl(imageUrl) {
  if (!imageUrl) return null;
  return imageUrl;
}

// ── 새 댓글 30초 폴링 ("새 댓글 N개 보기" 알림 버튼) ──
function _startCommentCountPoll(fandom, postId, initialCount) {
  _stopCommentCountPoll();
  _displayedCommentCount = initialCount;
  _commentCountPollTimer = setInterval(async () => {
    try {
      const snap = await db.ref(`community/${fandom}/${postId}/commentsCount`).once('value');
      const latest = snap.val() || 0;
      const diff = latest - _displayedCommentCount;
      if (diff > 0) _showNewCommentNotice(fandom, postId, diff);
    } catch {}
  }, 30 * 1000);
}

function _stopCommentCountPoll() {
  if (_commentCountPollTimer) { clearInterval(_commentCountPollTimer); _commentCountPollTimer = null; }
  _hideNewCommentNotice();
}

function _showNewCommentNotice(fandom, postId, diff) {
  let notice = document.getElementById('new-comment-notice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'new-comment-notice';
    notice.style.cssText = [
      'position:sticky', 'top:0', 'z-index:200', 'text-align:center',
      'padding:10px 16px', 'cursor:pointer', 'font-size:0.88rem', 'font-weight:700',
      'color:#fff', 'backdrop-filter:blur(8px)',
      'background:linear-gradient(135deg,rgba(124,77,255,0.92),rgba(100,150,255,0.92))',
      'box-shadow:0 4px 16px rgba(124,77,255,0.4)',
      'border-radius:0 0 14px 14px',
      'animation:slideDown 0.25s ease-out'
    ].join(';');
    const container = document.querySelector('#postDetailPage .post-detail-container');
    if (container) container.insertBefore(notice, container.firstChild);
  }
  notice.onclick = () => { loadDetailComments(fandom, postId); _hideNewCommentNotice(); };
  notice.textContent = `💬 새 댓글 ${diff}개 보기 ↓`;
}

function _hideNewCommentNotice() {
  const n = document.getElementById('new-comment-notice');
  if (n) n.remove();
}

// ── 게시글 목록 DOM 렌더링 (캐시/Firebase 공통 사용) ──
function _renderCommunityPostList(selectedFandom, posts) {
  const postsList = document.getElementById("communityPostsList");
  const isOther = currentOtherFandom && currentOtherFandom === selectedFandom;

  if (Object.keys(posts).length === 0) {
    postsList.innerHTML = isOther ? `
      <div class="community-empty">
        <div class="community-empty-icon">🌐</div>
        <div class="community-empty-text">이 팬덤은 아직 게시물이 없어요</div>
        <button onclick="openFandomFinderModal()" style="margin-top:14px;padding:10px 20px;background:linear-gradient(135deg,var(--primary) 0%,rgba(124,77,255,0.8) 100%);border:none;border-radius:10px;color:#fff;font-weight:700;font-size:0.9rem;font-family:inherit;cursor:pointer">다른 팬덤 찾기 →</button>
      </div>
    ` : `
      <div class="community-empty">
        <div class="community-empty-icon">✨</div>
        <div class="community-empty-text">아직 게시물이 없어요<br>첫 번째 게시물을 작성해보세요!</div>
      </div>
    `;
    return;
  }

  const sortedPosts = Object.entries(posts).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
  postsList.innerHTML = "";
  let visibleIndex = 0;
  sortedPosts.forEach(([postId, post]) => {
    if (!post.isHidden) {
      const postEl = renderPost(selectedFandom, postId, post, visibleIndex, true);
      postsList.appendChild(postEl);
      visibleIndex++;
    }
  });

  // 타팬덤 구경 중 배너
  if (isOther) {
    const meta = GROUP_META[selectedFandom] || {};
    const banner = document.createElement('div');
    banner.style.cssText = 'margin-bottom:14px;padding:10px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px';
    banner.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px">
        <span style="font-weight:700;font-size:0.88rem;color:var(--text)">${escHtml(meta.emoji || '')} ${escHtml(selectedFandom)} 커뮤니티 구경 중</span>
        <button onclick="openFandomFinderModal()" style="flex-shrink:0;padding:4px 10px;background:rgba(124,77,255,0.15);border:1px solid rgba(124,77,255,0.3);border-radius:6px;color:var(--primary);font-size:0.75rem;font-weight:600;font-family:inherit;cursor:pointer">변경</button>
      </div>
      <div style="font-size:0.75rem;color:var(--muted)">👀 좋아요 가능 · 댓글은 내 팬덤에서만</div>
    `;
    postsList.insertBefore(banner, postsList.firstChild);
  }

  const sortDropdown = document.getElementById("sortDropdown");
  if (sortDropdown) sortDropdown.value = currentSortMode;
  sortCommunityPosts(currentSortMode);
  syncSortButtonStyles(currentSortMode);
}

// ── 커뮤니티 게시물 로드 (localStorage 캐시 → Firebase 폴백) ──
function loadCommunityPosts() {
  _allFeedIsRendered = false;
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

  // 기존 리스너 해제
  clearPostListListeners();
  if (currentCommunityListener) {
    db.ref(currentCommunityListener).off("value");
  }
  currentCommunityListener = `community/${selectedFandom}`;

  // ★ 캐시 히트: Firebase 읽기 없이 즉시 렌더링
  const cachedPosts = _getCachedPostList(selectedFandom);
  if (cachedPosts) {
    communityPostsLoaded = true;
    _renderCommunityPostList(selectedFandom, cachedPosts);
    return;
  }

  // 캐시 미스: 스피너 표시 후 Firebase 로드
  const postsList = document.getElementById("communityPostsList");
  postsList.innerHTML = `
    <div class="community-empty">
      <div class="spinner" style="display:inline-block;margin-bottom:12px"></div>
      <div class="community-empty-text">게시물을 불러오는 중...</div>
    </div>
  `;

  communityPostsLoaded = false;
  db.ref(currentCommunityListener).orderByChild('timestamp').limitToLast(30).once("value", snap => {
    communityPostsLoaded = true;
    const posts = snap.val() || {};
    _setCachedPostList(selectedFandom, posts); // ★ 캐시 저장
    _renderCommunityPostList(selectedFandom, posts);
  }, error => {
    // 권한 없음 (auth 미완료) → auth.js에서 자동 재시도
    console.log("커뮤니티 로드 대기 (auth 완료 후 재시도):", error.code);
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

  // 전체 피드 모드: 배열 재정렬 후 처음부터 다시 표시
  if (currentFeedMode === 'all' && allFeedPosts.length > 0) {
    sortAllFeedPostsArray(mode);
    const postsList = document.getElementById("communityPostsList");
    postsList.innerHTML = "";
    allFeedDisplayed = 0;
    renderMoreFeedPosts();
  } else {
    sortCommunityPosts(mode);
  }

  // 버튼 active 상태 업데이트
  syncSortButtonStyles(mode);

  // Firebase에 저장
  if (isLoggedIn && currentUser && db) {
    db.ref(`users/${currentUser.uid}/preferences/lastSortMode`).set(mode).catch(e => {
      console.error("정렬 모드 저장 실패:", e);
    });
  }
}

// ── 정렬 버튼 active 스타일 동기화 (공통 헬퍼) ──
function syncSortButtonStyles(mode) {
  document.querySelectorAll('.sort-btn').forEach(btn => {
    const isActive = btn.dataset.sort === mode;
    if (isActive) {
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
}

// 현재 탭에 맞는 글쓰기 액션을 추적
let currentFabWriteAction = openPostCreateModal;

function fabWrite() {
  currentFabWriteAction();
}

// ── 날짜 그룹 구분선 삽입 (최신순 + 내 팬덤 탭에서만) ──
function injectDateSeparators(postsList) {
  const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
  const yesterMid = new Date(todayMid); yesterMid.setDate(todayMid.getDate() - 1);
  const weekAgo = new Date(todayMid); weekAgo.setDate(todayMid.getDate() - 7);

  const labelMap = { '오늘': '📅 오늘', '어제': '📅 어제', '이번 주': '📅 이번 주', '이전': '📅 이전' };
  let lastGroup = null;

  Array.from(postsList.querySelectorAll('.post-item')).forEach(item => {
    const ts = parseInt(item.getAttribute('data-timestamp') || 0);
    const d = new Date(ts); d.setHours(0, 0, 0, 0);
    const dTime = d.getTime();

    let group;
    if (dTime >= todayMid.getTime()) group = '오늘';
    else if (dTime >= yesterMid.getTime()) group = '어제';
    else if (dTime >= weekAgo.getTime()) group = '이번 주';
    else group = '이전';

    if (group !== lastGroup) {
      const sep = document.createElement('div');
      sep.className = 'date-separator';
      sep.textContent = labelMap[group];
      postsList.insertBefore(sep, item);
      lastGroup = group;
    }
  });
}

// 마지막 정렬 모드 로드 (loadUserVotes에서 이미 읽은 currentUser 캐시 활용 — Firebase 재읽기 없음)
async function loadLastSortMode() {
  currentSortMode = (isLoggedIn && currentUser?.lastSortMode) || "latest";
}

function sortCommunityPosts(mode) {
  currentSortMode = mode;

  // 게시물 재정렬
  const postsList = document.getElementById("communityPostsList");
  // ★ 기존 날짜 구분선 먼저 제거 (정렬 후 재삽입)
  postsList.querySelectorAll('.date-separator').forEach(s => s.remove());
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

  // ★ 최신순 + 내 팬덤 탭일 때만 날짜 구분선 재삽입
  if (mode === 'latest' && currentFeedMode === 'my') {
    injectDateSeparators(postsList);
  }
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

// ── 헥스 컬러 → rgba 변환 헬퍼 ──
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── 게시물 렌더링 ──
// ── 게시물 목록 아이템 렌더링 (컴팩트 리스트) ──
function renderPost(fandom, postId, post, index, showFandomBadge = false) {
  const timeStr = getRelativeTime(post.timestamp);
  const postNumber = index + 1; // 1부터 시작하는 순번

  // 좋아요/댓글/조회수 초기값 (post 데이터에서 직접 읽기 — DOM 삽입 전 Firebase 재쿼리 불필요)
  const likeCount = post.likesCount != null ? post.likesCount : Object.keys(post.likes || {}).length;
  const commentCount = post.commentsCount != null ? post.commentsCount : Object.values(post.comments || {}).filter(c => !c.isHidden).length;
  const isHot = likeCount >= 5; // 좋아요 5개 이상 HOT

  const postEl = document.createElement("div");
  postEl.className = "post-item post-list-compact";
  postEl.setAttribute("data-timestamp", post.timestamp || 0);
  postEl.setAttribute("data-postid", postId);
  postEl.setAttribute("data-likes", likeCount);
  postEl.setAttribute("data-views", post.views || 0);
  postEl.setAttribute("onclick", `showPostDetail('${escAttr(fandom)}', '${escAttr(postId)}'); event.stopPropagation()`);
  postEl.style.cursor = "pointer";
  // 사진 여부 확인
  const hasImage = post.imageUrl ? '📷' : '';

  // ★ 본문 미리보기 (마크다운 기호 제거 후 1줄)
  const previewText = post.content
    ? post.content
        .replace(/\*\*/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^---\n?/m, '')
        .replace(/\n/g, ' ')
        .trim()
        .substring(0, 70)
    : '';
  const previewHtml = previewText
    ? `<div class="post-content-preview">${escHtml(previewText)}</div>`
    : '';

  // 팬덤 배지 (전체 피드 모드에서만 표시)
  let fandomBadgeHtml = '';
  if (showFandomBadge) {
    const meta = GROUP_META[fandom] || {};
    const color = meta.color || '#7c4dff';
    const emoji = meta.emoji || '';
    fandomBadgeHtml = `<span class="fandom-badge" style="background:${hexToRgba(color, 0.13)};border-color:${hexToRgba(color, 0.38)};color:${color}">${emoji} ${escHtml(fandom)}</span>`;
  }

  // 게시글 유형 배지
  const TYPE_LABELS = { schedule: '📅 일정', fanart: '🎨 팬아트', news: '📰 뉴스', qna: '❓ Q&A' };
  const typeBadgeHtml = (post.type && TYPE_LABELS[post.type])
    ? `<span style="display:inline-flex;align-items:center;font-size:0.68rem;font-weight:700;padding:2px 7px;border-radius:5px;background:rgba(100,200,255,0.12);border:1px solid rgba(100,200,255,0.28);color:rgba(100,200,255,0.9);white-space:nowrap">${TYPE_LABELS[post.type]}</span>`
    : '';

  postEl.innerHTML = `
    <div class="post-list-left">
      <div class="post-title-row">
        ${fandomBadgeHtml}
        ${typeBadgeHtml}
        ${isHot ? '<span class="hot-badge">🔥 HOT</span>' : ''}
        <div class="post-list-title">${escHtml(post.title)}</div>
        <div class="post-list-indicators">
          <span class="post-comment-badge">💬 <span id="comment-count-${postId}">${commentCount}</span></span>
          ${hasImage ? `<span class="post-image-badge">📷</span>` : ''}
        </div>
      </div>
      ${previewHtml}
      <div class="post-meta-row-mobile">
        <span class="post-list-meta">👤 <span id="author-${postId}">${escHtml(resolveAuthorNickname(post))}</span></span>
        <span class="post-list-meta-divider">·</span>
        <span class="post-list-meta">📅 ${timeStr}</span>
        <span class="post-list-meta-divider">·</span>
        <span class="post-list-meta">👁️ <span id="view-count-${postId}">${post.views || 0}</span></span>
        <span class="post-list-meta-divider">·</span>
        <span class="post-list-meta">❤️ <span id="like-count-${postId}">${likeCount}</span></span>
      </div>
    </div>
    ${post.imageUrl ? `<div class="post-thumbnail-wrap"><img src="${escAttr(_getThumbUrl(post.imageUrl))}" class="post-thumbnail-img" loading="lazy" onerror="this.parentElement.style.display='none'" alt="썸네일"></div>` : ''}
  `;

  // 댓글 개수: post 스냅샷에서 직접 초기화 (DOM 삽입 전 호출 시 null 반환 방지)

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

  // ★ 뒤로가기 시 스크롤 복원을 위해 현재 위치 저장
  _savedCommunityScrollY = window.scrollY;
  // ★ FAB 숨김 (게시글 상세 위에 FAB가 보이지 않도록)
  document.getElementById('communityFAB')?.style.setProperty('display', 'none');

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
  // ★ 슬라이드 인 애니메이션
  detailPage.classList.remove('page-slide-in');
  void detailPage.offsetWidth; // reflow 강제 (애니메이션 재시작)
  detailPage.classList.add('page-slide-in');
  // 스크롤은 내부 컨테이너에서 발생하므로 컨테이너를 최상단으로
  const detailContainer = detailPage.querySelector('.post-detail-container');
  if (detailContainer) detailContainer.scrollTop = 0;

  // ★ 이전 게시글 내용 즉시 초기화 (다른 게시글 클릭 시 이전 내용 잔류 방지)
  document.getElementById("postDetailTitle").textContent = "";
  document.getElementById("postDetailMeta").innerHTML = "";
  document.getElementById("postDetailEngagement").innerHTML = "";
  document.getElementById("postDetailManagement").innerHTML = "";
  document.getElementById("postDetailComments").innerHTML = "";
  const prevImg = document.getElementById("postDetailImageEl");
  if (prevImg) prevImg.remove();
  // 로딩 스피너 (Firebase 응답 대기 중 표시)
  document.getElementById("postDetailContent").innerHTML = `
    <div style="text-align:center;padding:40px 0;color:var(--muted)">
      <div class="spinner" style="display:inline-block;margin-bottom:12px"></div>
      <div style="font-size:0.9rem">게시물을 불러오는 중...</div>
    </div>
  `;

  try {
    // ★ 게시글 상세 sessionStorage 캐시 (10분 TTL) — Firebase 읽기 절감
    let post = null;
    const _pdKey = `pd_${postId}`;
    try {
      const _pdRaw = sessionStorage.getItem(_pdKey);
      if (_pdRaw) {
        const { d, ts } = JSON.parse(_pdRaw);
        if (Date.now() - ts < 10 * 60 * 1000) post = d;
      }
    } catch {}

    if (!post) {
      const snap = await db.ref(`community/${fandom}/${postId}`).once("value");
      if (!snap.exists()) { showToast("게시물을 찾을 수 없어요"); return; }
      post = snap.val();
      try { sessionStorage.setItem(_pdKey, JSON.stringify({ d: post, ts: Date.now() })); } catch {}
    }

    const isAuthor = isLoggedIn && currentUser && post.authorUid === currentUser.uid;
    const timeStr = getRelativeTime(post.timestamp);

    // 현재 게시글 메타 캐시 (알림 전송 시 재읽기 방지)
    currentViewingPost = { fandom, postId, authorUid: post.authorUid, title: post.title };

    // 조회수 증가 — 세션 내 중복 카운트 방지
    const viewedKey = `viewed_${postId}`;
    if (!sessionStorage.getItem(viewedKey)) {
      db.ref(`community/${fandom}/${postId}/views`).transaction(cur => (cur || 0) + 1).catch(() => {});
      sessionStorage.setItem(viewedKey, '1');
    }

    // 제목 설정
    document.getElementById("postDetailTitle").textContent = escHtml(post.title);

    // 메타 정보 설정
    const metaHTML = `
      <span class="post-author">👤 ${escHtml(resolveAuthorNickname(post))}</span>
      <span class="post-date">📅 ${timeStr}</span>
    `;
    document.getElementById("postDetailMeta").innerHTML = metaHTML;

    // 내용 설정 (스피너 대체)
    const contentEl = document.getElementById("postDetailContent");
    contentEl.textContent = post.content;

    // 이미지 표시 (있으면)
    if (post.imageUrl) {
      const imageEl = document.createElement("div");
      imageEl.id = "postDetailImageEl";
      imageEl.style.cssText = "margin:16px 0;border-radius:10px;overflow:hidden;box-shadow:0 4px 12px rgba(124,77,255,0.2)";
      imageEl.innerHTML = `<img src="${escHtml(post.imageUrl)}" style="width:100%;height:auto;object-fit:cover;display:block" alt="게시물 이미지">`;
      contentEl.parentNode.insertBefore(imageEl, contentEl.nextSibling);
    }

    // 참여 버튼 설정 (좋아요, 댓글)
    const engagementHTML = `
      <button id="postDetailLikeBtn" class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(255,100,100,0.1) 0%,rgba(255,140,140,0.05) 100%);border:1px solid rgba(255,100,100,0.2);position:relative;overflow:hidden;border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);cursor:pointer" onclick="toggleLike('${escAttr(fandom)}', '${escAttr(postId)}'); event.stopPropagation()" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(255,100,100,0.2)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">
        <span id="postDetailLikeHeart" style="font-size:1rem;display:inline-block;transition:transform 0.3s">🤍</span>
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
        <button class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(255,100,100,0.15) 0%,rgba(255,120,120,0.05) 100%);border:1px solid rgba(255,100,100,0.3);border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);color:rgb(255,100,100);cursor:pointer" onclick="confirmDeletePost('${escAttr(fandom)}', '${escAttr(postId)}', true); event.stopPropagation()" onmouseover="this.style.background='linear-gradient(135deg,rgba(255,100,100,0.25) 0%,rgba(255,120,120,0.15) 100%)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(255,100,100,0.25)';this.style.borderColor='rgba(255,100,100,0.5)'" onmouseout="this.style.background='linear-gradient(135deg,rgba(255,100,100,0.15) 0%,rgba(255,120,120,0.05) 100%)';this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='rgba(255,100,100,0.3)'"><span style="font-size:1rem">🗑️</span><span style="font-weight:700">삭제</span></button>
        <button class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(100,180,255,0.1) 0%,rgba(140,200,255,0.05) 100%);border:1px solid rgba(100,180,255,0.2);border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);color:var(--text);cursor:pointer;grid-column:span 2" onclick="sharePost('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(post.title)}'); event.stopPropagation()" onmouseover="this.style.background='linear-gradient(135deg,rgba(100,180,255,0.18) 0%,rgba(140,200,255,0.12) 100%)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(100,180,255,0.2)';this.style.borderColor='rgba(100,180,255,0.4)'" onmouseout="this.style.background='linear-gradient(135deg,rgba(100,180,255,0.1) 0%,rgba(140,200,255,0.05) 100%)';this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='rgba(100,180,255,0.2)'"><span style="font-size:1rem">🔗</span><span style="font-weight:700">공유</span></button>
      `;
    } else {
      managementHTML = `
        <button class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(255,150,50,0.1) 0%,rgba(255,170,80,0.05) 100%);border:1px solid rgba(255,150,50,0.2);border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);cursor:pointer" onclick="reportPost('${escAttr(fandom)}', '${escAttr(postId)}'); event.stopPropagation()" onmouseover="this.style.background='linear-gradient(135deg,rgba(255,150,50,0.18) 0%,rgba(255,170,80,0.12) 100%)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(255,150,50,0.2)';this.style.borderColor='rgba(255,150,50,0.4)'" onmouseout="this.style.background='linear-gradient(135deg,rgba(255,150,50,0.1) 0%,rgba(255,170,80,0.05) 100%)';this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='rgba(255,150,50,0.2)'"><span style="font-size:1rem">🚩</span><span style="font-weight:700;color:var(--text)">신고</span></button>
        <button class="post-action-btn" style="display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,rgba(100,180,255,0.1) 0%,rgba(140,200,255,0.05) 100%);border:1px solid rgba(100,180,255,0.2);border-radius:8px;padding:8px 12px;font-size:0.9rem;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);color:var(--text);cursor:pointer" onclick="sharePost('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(post.title)}'); event.stopPropagation()" onmouseover="this.style.background='linear-gradient(135deg,rgba(100,180,255,0.18) 0%,rgba(140,200,255,0.12) 100%)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(100,180,255,0.2)';this.style.borderColor='rgba(100,180,255,0.4)'" onmouseout="this.style.background='linear-gradient(135deg,rgba(100,180,255,0.1) 0%,rgba(140,200,255,0.05) 100%)';this.style.transform='translateY(0)';this.style.boxShadow='none';this.style.borderColor='rgba(100,180,255,0.2)'"><span style="font-size:1rem">🔗</span><span style="font-weight:700">공유</span></button>
      `;
    }
    document.getElementById("postDetailManagement").innerHTML = managementHTML;

    // 좋아요 수 업데이트 + 내 좋아요 상태 반영 (리스너 저장)
    const likesCallback = (snap) => {
      const likes = snap.val() || {};
      const likeCount = Object.keys(likes).length;
      const el = document.getElementById(`detail-like-count-${postId}`);
      if (el) el.textContent = likeCount;

      // 내가 좋아요 했는지 시각적으로 표시
      const likeBtn = document.getElementById("postDetailLikeBtn");
      const likeHeart = document.getElementById("postDetailLikeHeart");
      const hasLiked = isLoggedIn && currentUser && !!likes[currentUser.uid];
      if (likeBtn && isLoggedIn && currentUser) {
        likeBtn.style.background = hasLiked
          ? 'linear-gradient(135deg,rgba(255,80,80,0.35) 0%,rgba(255,120,120,0.25) 100%)'
          : 'linear-gradient(135deg,rgba(255,100,100,0.1) 0%,rgba(255,140,140,0.05) 100%)';
        likeBtn.style.borderColor = hasLiked ? 'rgba(255,80,80,0.6)' : 'rgba(255,100,100,0.2)';
        if (likeHeart) likeHeart.textContent = hasLiked ? '❤️' : '🤍';
      }
      // sticky 바 좋아요 동기화
      const stickyHeart = document.getElementById("stickyLikeHeart");
      const stickyCount = document.getElementById("stickyLikeCount");
      const stickyBtn = document.getElementById("stickyLikeBtn");
      if (stickyHeart) stickyHeart.textContent = hasLiked ? '❤️' : '🤍';
      if (stickyCount) stickyCount.textContent = likeCount;
      if (stickyBtn) stickyBtn.classList.toggle('liked', hasLiked);
    };
    // ★ .once()로 초기 상태만 로드 (실시간 구독 제거 → toggleLike에서 UI 직접 갱신)
    const likesRef = db.ref(`likes/${fandom}/${postId}`);
    likesRef.once("value", likesCallback);
    postDetailListeners.likes = null; // .once()는 자동 정리

    // 댓글 섹션 설정
    const canCommentHere = isLoggedIn && !!currentUser?.primaryFandom && currentUser.primaryFandom === fandom;
    const myFavMeta = currentUser?.primaryFandom ? (GROUP_META[currentUser.primaryFandom] || {}) : null;
    const commentInputHtml = (() => {
      if (!isLoggedIn) return `<div style="text-align:center;padding:16px;background:linear-gradient(135deg,rgba(124,77,255,0.1) 0%,rgba(100,150,255,0.05) 100%);border:1px solid rgba(124,77,255,0.2);border-radius:12px;color:var(--muted);font-size:0.9rem"><span style="font-size:1rem">🔐</span> 댓글을 작성하려면 로그인해주세요</div>`;
      if (canCommentHere) return `
        <div style="background:linear-gradient(135deg,rgba(124,77,255,0.08) 0%,rgba(100,150,255,0.05) 100%);border:1.5px solid rgba(124,77,255,0.25);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
          <textarea id="detail-comment-input-${postId}" placeholder="따뜻한 댓글을 남겨보세요..." style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit;font-size:0.95rem;resize:none;min-height:90px;transition:all 0.2s" onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'" maxlength="500" oninput="document.getElementById('char-count-${postId}').textContent=this.value.length"></textarea>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:0.75rem;color:var(--muted)">최대 <span id="char-count-${postId}">0</span>/500자</span>
            <button onclick="submitDetailComment('${escAttr(fandom)}','${escAttr(postId)}');event.stopPropagation()" style="padding:11px 24px;background:linear-gradient(135deg,var(--primary) 0%,rgba(124,77,255,0.85) 100%);border:none;border-radius:8px;color:#fff;font-weight:700;font-family:inherit;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 12px rgba(124,77,255,0.35);font-size:0.9rem">💬 댓글 작성</button>
          </div>
        </div>`;
      // 타팬덤 또는 팬덤 미설정
      if (!currentUser?.primaryFandom) {
        return `<div style="text-align:center;padding:14px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;color:var(--muted);font-size:0.85rem;line-height:1.6">👀 여긴 읽기 전용이에요<br><span style="font-size:0.8rem">💜 팬덤을 설정하면 댓글을 달 수 있어요</span></div>`;
      }
      return `<div onclick="goToMyFandomFromDetail()" style="text-align:center;padding:14px 16px;background:rgba(124,77,255,0.06);border:1px solid rgba(124,77,255,0.2);border-radius:12px;color:var(--muted);font-size:0.85rem;line-height:1.6;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='rgba(124,77,255,0.12)'" onmouseout="this.style.background='rgba(124,77,255,0.06)'">👀 여긴 읽기 전용이에요<br><span style="font-size:0.82rem;color:var(--primary);font-weight:700">${myFavMeta?.emoji || ''} ${escHtml(currentUser.primaryFandom)} 커뮤니티에서 댓글 달기 →</span></div>`;
    })();
    const commentsHTML = `
      <div style="margin-top:12px">
        <h3 style="font-size:1rem;font-weight:700;color:var(--text);margin-bottom:16px;display:flex;align-items:center;gap:8px;margin-top:4px"><span>💬</span> 댓글</h3>
        <div id="postDetailCommentsList" style="margin-bottom:20px"></div>
        ${commentInputHtml}
      </div>
    `;
    document.getElementById("postDetailComments").innerHTML = commentsHTML;

    // 댓글 로드
    loadDetailComments(fandom, postId);
    // ★ 새 댓글 30초 폴링 (commentsCount 숫자 1개만 읽음 ≈ 50바이트)
    _startCommentCountPoll(fandom, postId, post.commentsCount || 0);

    // ── 하단 sticky 바 주입 ──
    document.getElementById("postStickyBar")?.remove();
    const stickyBar = document.createElement('div');
    stickyBar.className = 'post-detail-sticky-bottom';
    stickyBar.id = 'postStickyBar';
    stickyBar.innerHTML = `
      <button class="sticky-like-btn" id="stickyLikeBtn" onclick="toggleLike('${escAttr(fandom)}', '${escAttr(postId)}')">
        <span id="stickyLikeHeart">🤍</span>
        <span id="stickyLikeCount">0</span>
      </button>
      ${canCommentHere ? `
      <div class="sticky-comment-bar" onclick="document.getElementById('stickyCommentInput-${escAttr(postId)}').focus()">
        <textarea id="stickyCommentInput-${escAttr(postId)}" placeholder="댓글 달기..." maxlength="500" rows="1"
          oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px';document.getElementById('stickySubmitBtn-${escAttr(postId)}').classList.toggle('visible',this.value.trim().length>0)"></textarea>
        <button class="sticky-comment-submit" id="stickySubmitBtn-${escAttr(postId)}"
          onclick="submitStickyComment('${escAttr(fandom)}', '${escAttr(postId)}')">게시</button>
      </div>` : isLoggedIn ? `
      <div class="sticky-comment-bar" style="cursor:pointer;justify-content:center" onclick="goToMyFandomFromDetail()">
        <span style="color:var(--muted);font-size:0.82rem">👀 읽기 전용 · ${currentUser?.primaryFandom ? `<strong style="color:var(--primary)">${escHtml(currentUser.primaryFandom)} 커뮤니티에서 댓글 달기 →</strong>` : '팬덤 설정 후 댓글 가능'}</span>
      </div>` : `
      <div class="sticky-comment-bar" style="cursor:pointer;justify-content:center" onclick="showToast('로그인 후 댓글을 작성할 수 있어요')">
        <span style="color:var(--muted);font-size:0.88rem">🔐 로그인 후 댓글을 달 수 있어요</span>
      </div>`}
    `;
    document.getElementById("postDetailPage").appendChild(stickyBar);

  } catch (e) {
    console.error("게시물 로드 실패:", e);
    showToast("게시물을 불러올 수 없어요");
  }
}

// ── 게시물 상세 페이지 닫기 ──
function closePostDetail() {
  // 페이지 숨김
  document.getElementById("postDetailPage").style.display = "none";

  // sticky 바 제거
  document.getElementById("postStickyBar")?.remove();

  // 커뮤니티 페이지 표시
  document.getElementById("communityPage").classList.remove("hidden");
  document.getElementById("communityPage").classList.add("show");

  // ★ FAB 재표시
  document.getElementById('communityFAB')?.style.setProperty('display', 'flex');

  // ★ 스크롤 위치 복원 (렌더 완료 후 복원)
  requestAnimationFrame(() => {
    window.scrollTo(0, _savedCommunityScrollY);
  });

  // 현재 게시글 캐시 초기화
  currentViewingPost = null;

  // 게시물 상세 페이지의 모든 Firebase 리스너 정리
  Object.values(postDetailListeners).forEach(listener => {
    if (listener && listener.ref && listener.callback) {
      listener.ref.off("value", listener.callback);
    }
  });
  postDetailListeners = { likes: null, comments: null, views: null };

  // 새 댓글 폴링 정지
  _stopCommentCountPoll();

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
        const commentLikes = comment.likes || {};
        const commentLikeCount = Object.keys(commentLikes).length;
        const hasLikedComment = isLoggedIn && currentUser && !!commentLikes[currentUser.uid];

        // 작성자 팬덤 배지
        const commentFandomName = comment.authorFandom;
        const commentFandomMeta = commentFandomName ? (GROUP_META[commentFandomName] || null) : null;
        const commentFandomBadge = commentFandomMeta
          ? `<span style="font-size:0.62rem;padding:1px 6px;border-radius:4px;background:${hexToRgba(commentFandomMeta.color || '#7c4dff', 0.15)};color:${commentFandomMeta.color || '#7c4dff'};border:1px solid ${hexToRgba(commentFandomMeta.color || '#7c4dff', 0.3)};font-weight:700;white-space:nowrap">${commentFandomMeta.emoji || ''} ${escHtml(commentFandomName)}</span>`
          : '';

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
                <span style="font-weight:700;color:var(--text);font-size:0.95rem">${escHtml(resolveAuthorNickname(comment))}</span>
                ${commentFandomBadge}
                ${isCommentAuthor ? `<span style="background:linear-gradient(135deg,rgba(124,77,255,0.3) 0%,rgba(100,150,255,0.2) 100%);color:var(--primary);font-size:0.7rem;padding:2px 6px;border-radius:4px;font-weight:600">내가 쓴 댓글</span>` : ''}
              </div>
              <div style="font-size:0.75rem;color:var(--muted)">${timeStr}</div>
            </div>
            ${isCommentAuthor ? `<div style="display:flex;gap:6px">
              <button onclick="editComment('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}', '${escAttr(comment.content)}'); event.stopPropagation()" style="font-size:0.75rem;background:rgba(100,150,255,0.1);border:1px solid rgba(100,150,255,0.3);color:rgb(100,150,255);cursor:pointer;padding:5px 10px;border-radius:6px;font-weight:600;transition:all 0.2s;white-space:nowrap" onmouseover="this.style.background='rgba(100,150,255,0.2)';this.style.borderColor='rgba(100,150,255,0.5)'" onmouseout="this.style.background='rgba(100,150,255,0.1)';this.style.borderColor='rgba(100,150,255,0.3)'">수정</button>
              <button onclick="deleteComment('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}'); event.stopPropagation()" style="font-size:0.75rem;background:rgba(255,100,100,0.1);border:1px solid rgba(255,100,100,0.3);color:rgb(255,100,100);cursor:pointer;padding:5px 10px;border-radius:6px;font-weight:600;transition:all 0.2s;white-space:nowrap" onmouseover="this.style.background='rgba(255,100,100,0.2)';this.style.borderColor='rgba(255,100,100,0.5)'" onmouseout="this.style.background='rgba(255,100,100,0.1)';this.style.borderColor='rgba(255,100,100,0.3)'">삭제</button>
            </div>` : ''}
          </div>
          <div style="color:var(--text);line-height:1.6;word-break:break-word;margin-bottom:8px">${escHtml(comment.content)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <button class="reply-toggle-btn" id="reply-toggle-${escAttr(commentId)}" onclick="toggleReplySection('${escAttr(fandom)}','${escAttr(postId)}','${escAttr(commentId)}'); event.stopPropagation()">
              💬 답글 <span id="reply-count-${escAttr(commentId)}">0</span>개
            </button>
            <button onclick="toggleCommentLike('${escAttr(fandom)}', '${escAttr(postId)}', '${escAttr(commentId)}'); event.stopPropagation()" style="display:flex;align-items:center;gap:4px;background:${hasLikedComment ? 'rgba(255,80,80,0.2)' : 'rgba(255,100,100,0.06)'};border:1px solid ${hasLikedComment ? 'rgba(255,80,80,0.45)' : 'rgba(255,100,100,0.15)'};border-radius:20px;padding:4px 10px;cursor:pointer;transition:all 0.2s;font-size:0.8rem" onmouseover="this.style.background='rgba(255,100,100,0.2)';this.style.borderColor='rgba(255,100,100,0.4)'" onmouseout="this.style.background='${hasLikedComment ? 'rgba(255,80,80,0.2)' : 'rgba(255,100,100,0.06)'}';this.style.borderColor='${hasLikedComment ? 'rgba(255,80,80,0.45)' : 'rgba(255,100,100,0.15)'}'">
              <span>${hasLikedComment ? '❤️' : '🤍'}</span>
              <span style="color:${hasLikedComment ? 'rgb(255,100,100)' : 'var(--muted)'}; font-weight:600">${commentLikeCount > 0 ? commentLikeCount : ''}</span>
            </button>
          </div>
          <!-- 답글 섹션 (토글) -->
          <div class="reply-section" id="reply-section-${escAttr(commentId)}" style="display:none">
            <div id="reply-list-${escAttr(commentId)}"></div>
            ${isLoggedIn ? `
              <div class="reply-input-area" id="reply-input-area-${escAttr(commentId)}">
                <textarea class="reply-textarea" id="reply-textarea-${escAttr(commentId)}" placeholder="답글을 입력해주세요..." maxlength="300"></textarea>
                <button class="reply-submit-btn" onclick="submitReply('${escAttr(fandom)}','${escAttr(postId)}','${escAttr(commentId)}'); event.stopPropagation()">답글 작성</button>
              </div>
            ` : ''}
          </div>
        `;
        commentsList.appendChild(commentEl);
        // ★ 답글 수: 이미 로드된 comment 데이터에서 직접 계산 (Firebase 재읽기 없음)
        const replyCount = comment.replies ? Object.keys(comment.replies).length : 0;
        const replyCountEl = document.getElementById(`reply-count-${commentId}`);
        if (replyCountEl) replyCountEl.textContent = replyCount;
      });
    }

    // 댓글 수 업데이트
    const countEl = document.getElementById(`detail-comment-count-${postId}`);
    if (countEl) countEl.textContent = commentCount;
    // ★ 폴링 기준값 갱신 (실제 렌더된 댓글 수로 동기화)
    _displayedCommentCount = commentCount;
  };

  // ★ .once()로 1회만 로드 (실시간 구독 제거 → 댓글 작성/삭제/수정 후 수동 재로드)
  const commentsRef = db.ref(`comments/${fandom}/${postId}`);
  commentsRef.once("value", commentsCallback);
  postDetailListeners.comments = null; // .once()는 자동 정리
}

// ── 답글 수 로드 ──
function loadReplyCount(fandom, postId, commentId) {
  db.ref(`comments/${fandom}/${postId}/${commentId}/replies`).once("value", snap => {
    const count = snap.exists() ? Object.keys(snap.val()).length : 0;
    const el = document.getElementById(`reply-count-${commentId}`);
    if (el) el.textContent = count;
  });
}

// ── 답글 섹션 토글 ──
function toggleReplySection(fandom, postId, commentId) {
  const section = document.getElementById(`reply-section-${commentId}`);
  if (!section) return;
  const isOpen = section.style.display !== 'none';
  section.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) loadReplies(fandom, postId, commentId);
}

// ── 답글 로드 ──
async function loadReplies(fandom, postId, commentId) {
  const listEl = document.getElementById(`reply-list-${commentId}`);
  if (!listEl) return;
  listEl.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;padding:4px 0">로딩 중...</div>';

  const snap = await db.ref(`comments/${fandom}/${postId}/${commentId}/replies`).once("value");
  const replies = snap.val() || {};
  const entries = Object.entries(replies).sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));

  if (entries.length === 0) {
    listEl.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;padding:4px 0">아직 답글이 없어요</div>';
    return;
  }

  listEl.innerHTML = '';
  entries.forEach(([, reply]) => {
    const el = document.createElement('div');
    el.className = 'reply-item';
    el.innerHTML = `
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
        <span style="font-weight:700;font-size:0.82rem;color:var(--primary)">↳ ${escHtml(resolveAuthorNickname(reply))}</span>
        <span style="font-size:0.72rem;color:var(--muted)">${getRelativeTime(reply.timestamp)}</span>
      </div>
      <div style="color:var(--text);line-height:1.5;word-break:break-word">${escHtml(reply.content)}</div>
    `;
    listEl.appendChild(el);
  });
}

// ── 답글 작성 ──
async function submitReply(fandom, postId, commentId) {
  if (!isLoggedIn || !currentUser) { showToast("로그인이 필요합니다"); return; }
  // ★ 타팬덤 답글 제한
  if (!currentUser.primaryFandom) { showToast("💜 팬덤을 먼저 설정해주세요!"); return; }
  if (fandom !== currentUser.primaryFandom) {
    const myMeta = GROUP_META[currentUser.primaryFandom] || {};
    showToast(`${myMeta.emoji || ''} ${currentUser.primaryFandom} 커뮤니티에서만 답글을 달 수 있어요`);
    return;
  }
  const textarea = document.getElementById(`reply-textarea-${commentId}`);
  const content = textarea?.value?.trim();
  if (!content) { showToast("답글 내용을 입력해주세요"); return; }

  try {
    const replyId = db.ref().push().key;
    const replyNickname = currentUser.customNickname || currentUser.displayName || '익명';
    await db.ref(`comments/${fandom}/${postId}/${commentId}/replies/${replyId}`).set({
      content,
      authorUid: currentUser.uid,
      authorNickname: replyNickname,
      authorName: replyNickname,
      authorFandom: currentUser.primaryFandom || null,
      timestamp: Date.now()
    });
    textarea.value = '';
    showToast("✅ 답글이 등록됐어요!");
    loadReplies(fandom, postId, commentId);
    loadReplyCount(fandom, postId, commentId);
  } catch (e) {
    console.error("답글 작성 실패:", e);
    if (e.code === 'PERMISSION_DENIED') showToast("⚠️ Firebase 보안 규칙에서 replies 경로를 허용해주세요");
    else showToast("답글 작성에 실패했어요");
  }
}

// ── 상세 페이지에서 댓글 작성 ──
async function submitDetailComment(fandom, postId) {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    return;
  }
  // ★ 타팬덤 댓글 제한
  if (!currentUser.primaryFandom) {
    showToast("💜 팬덤을 먼저 설정해주세요!");
    return;
  }
  if (fandom !== currentUser.primaryFandom) {
    const myMeta = GROUP_META[currentUser.primaryFandom] || {};
    showToast(`${myMeta.emoji || ''} ${currentUser.primaryFandom} 커뮤니티에서만 댓글을 달 수 있어요`);
    return;
  }

  const textarea = document.getElementById(`detail-comment-input-${postId}`);
  const content = textarea.value.trim();
  if (!content) { showToast("댓글 내용을 입력해주세요"); return; }

  // ★ 중복 제출 방지
  const btn = document.querySelector(`button[onclick*="submitDetailComment('${fandom}','${postId}')"], button[onclick*='submitDetailComment("${fandom}","${postId}")']`);
  if (btn) { btn.disabled = true; btn.textContent = "..."; }

  try {
    const commentId = db.ref().push().key;
    const commentNickname = currentUser.customNickname || currentUser.displayName || "익명";
    await db.ref(`comments/${fandom}/${postId}/${commentId}`).set({
      content,
      authorUid: currentUser.uid,
      authorNickname: commentNickname,
      authorName: commentNickname,
      authorFandom: currentUser.primaryFandom || null,
      timestamp: Date.now(),
      isHidden: false
    });
    db.ref(`community/${fandom}/${postId}/commentsCount`).transaction(c => (c || 0) + 1).catch(() => {});
    textarea.value = "";
    // ★ 글자 수 카운터 리셋
    const charCount = document.getElementById(`char-count-${postId}`);
    if (charCount) charCount.textContent = "0";
    showToast("댓글이 작성됐어요! 💬");
    sendCommentNotification(fandom, postId, content);
    // ★ .once() 전환으로 자동 재렌더 없음 → 수동 재로드
    loadDetailComments(fandom, postId);
  } catch (e) {
    console.error("댓글 작성 실패:", e);
    showToast("댓글 작성에 실패했어요");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "💬 댓글 작성"; }
  }
}

// ── 하단 sticky 바에서 댓글 작성 ──
async function submitStickyComment(fandom, postId) {
  if (!isLoggedIn || !currentUser) { showToast("로그인이 필요합니다"); return; }
  // ★ 타팬덤 댓글 제한
  if (!currentUser.primaryFandom) { showToast("💜 팬덤을 먼저 설정해주세요!"); return; }
  if (fandom !== currentUser.primaryFandom) {
    const myMeta = GROUP_META[currentUser.primaryFandom] || {};
    showToast(`${myMeta.emoji || ''} ${currentUser.primaryFandom} 커뮤니티에서만 댓글을 달 수 있어요`);
    return;
  }
  const textarea = document.getElementById(`stickyCommentInput-${postId}`);
  const content = textarea?.value?.trim();
  if (!content) { showToast("댓글 내용을 입력해주세요"); return; }

  const submitBtn = document.getElementById(`stickySubmitBtn-${postId}`);
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "..."; }

  try {
    const commentId = db.ref().push().key;
    const stickyNickname = currentUser.customNickname || currentUser.displayName || "익명";
    await db.ref(`comments/${fandom}/${postId}/${commentId}`).set({
      content,
      authorUid: currentUser.uid,
      authorNickname: stickyNickname,
      authorName: stickyNickname,
      authorFandom: currentUser.primaryFandom || null,
      timestamp: Date.now(),
      isHidden: false
    });
    db.ref(`community/${fandom}/${postId}/commentsCount`).transaction(c => (c || 0) + 1).catch(() => {});
    if (textarea) {
      textarea.value = '';
      textarea.style.height = '';
    }
    if (submitBtn) submitBtn.classList.remove('visible');
    showToast("댓글이 작성됐어요! 💬");
    sendCommentNotification(fandom, postId, content);
    // ★ .once() 전환으로 자동 재렌더 없음 → 수동 재로드
    loadDetailComments(fandom, postId);
  } catch (e) {
    console.error("댓글 작성 실패:", e);
    showToast("댓글 작성에 실패했어요");
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "게시"; }
  }
}

// ── 댓글 알림 전송 ──
async function sendCommentNotification(fandom, postId, commentContent) {
  if (!isLoggedIn || !currentUser) return;
  try {
    // 캐시된 게시글 메타 우선 사용 (Firebase 읽기 절감)
    let post;
    if (currentViewingPost && currentViewingPost.fandom === fandom && currentViewingPost.postId === postId) {
      post = currentViewingPost;
    } else {
      const postSnap = await db.ref(`community/${fandom}/${postId}`).once("value");
      if (!postSnap.exists()) return;
      post = postSnap.val();
    }
    // 본인 게시글 댓글은 알림 생략
    if (!post.authorUid || post.authorUid === currentUser.uid) return;

    const notifId = db.ref().push().key;
    await db.ref(`notifications/${post.authorUid}/${notifId}`).set({
      type: 'comment',
      fandom,
      postId,
      postTitle: post.title || '(제목 없음)',
      fromNickname: currentUser.customNickname || currentUser.displayName || '익명',
      preview: commentContent.substring(0, 50),
      timestamp: Date.now(),
      read: false
    });
    db.ref(`notif_counts/${post.authorUid}/unread`).transaction(c => (c || 0) + 1).catch(() => {});
  } catch (e) {
    console.warn("알림 전송 실패:", e.code);
  }
}

// ── 좋아요 알림 전송 ──
async function sendLikeNotification(fandom, postId) {
  if (!isLoggedIn || !currentUser) return;
  try {
    // 캐시된 게시글 메타 우선 사용 (Firebase 읽기 절감)
    let post;
    if (currentViewingPost && currentViewingPost.fandom === fandom && currentViewingPost.postId === postId) {
      post = currentViewingPost;
    } else {
      const postSnap = await db.ref(`community/${fandom}/${postId}`).once("value");
      if (!postSnap.exists()) return;
      post = postSnap.val();
    }
    if (!post.authorUid || post.authorUid === currentUser.uid) return;
    const notifId = db.ref().push().key;
    await db.ref(`notifications/${post.authorUid}/${notifId}`).set({
      type: 'like',
      fandom,
      postId,
      postTitle: post.title || '(제목 없음)',
      fromNickname: currentUser.customNickname || currentUser.displayName || '익명',
      timestamp: Date.now(),
      read: false
    });
    db.ref(`notif_counts/${post.authorUid}/unread`).transaction(c => (c || 0) + 1).catch(() => {});
  } catch (e) {
    console.warn("좋아요 알림 전송 실패:", e.code);
  }
}

// ── 게시글 공유 ──
async function sharePost(fandom, postId, title) {
  const url = `${location.protocol}//${location.host}${location.pathname}#postDetail/${encodeURIComponent(fandom)}/${encodeURIComponent(postId)}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: `팬픽 | ${title}`, url });
      return;
    } catch (e) { /* 취소 시 무시 */ }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('링크가 복사되었어요! 💜');
  } catch {
    showToast('공유: ' + url);
  }
}

// ── 알림 뱃지 실시간 리스너 ──
let _notifBadgeRef = null;
let _notifBadgeCallback = null;

function setupNotifBadgeListener(uid) {
  teardownNotifBadgeListener();
  _notifBadgeRef = db.ref(`notif_counts/${uid}/unread`);
  _notifBadgeCallback = (snap) => {
    const unread = snap.val() || 0;
    const badge = document.getElementById("notifBadge");
    if (badge) {
      badge.textContent = unread;
      badge.style.display = unread > 0 ? 'inline-block' : 'none';
    }
  };
  _notifBadgeRef.on('value', _notifBadgeCallback);
}

function teardownNotifBadgeListener() {
  if (_notifBadgeRef && _notifBadgeCallback) {
    _notifBadgeRef.off('value', _notifBadgeCallback);
  }
  _notifBadgeRef = null;
  _notifBadgeCallback = null;
}

// ── 알림 로드 ──
async function loadNotifications() {
  if (!isLoggedIn || !currentUser || !db) return;
  try {
    const snap = await db.ref(`notifications/${currentUser.uid}`)
      .orderByChild('timestamp').limitToLast(30).once("value");
    const notifs = snap.val() || {};
    const entries = Object.entries(notifs).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
    const unread = entries.filter(([, n]) => !n.read).length;

    // 배지 업데이트
    const badge = document.getElementById("notifBadge");
    if (badge) {
      badge.textContent = unread;
      badge.style.display = unread > 0 ? 'inline-block' : 'none';
    }

    // 알림 목록 렌더링
    const listEl = document.getElementById("notifList");
    if (!listEl) return;
    if (entries.length === 0) {
      listEl.innerHTML = '<div class="notif-empty">알림이 없어요 🔕</div>';
      return;
    }
    listEl.innerHTML = '';
    entries.forEach(([notifId, notif]) => {
      const el = document.createElement('div');
      el.className = `notif-item${notif.read ? '' : ' unread'}`;
      el.onclick = () => {
        markNotifRead(notifId);
        if (notif.fandom && notif.postId) {
          closeNotifPanel();
          showPostDetail(notif.fandom, notif.postId);
        }
      };
      const notifText = notif.type === 'like'
        ? `<b>${escHtml(notif.fromNickname)}</b>님이 회원님의 게시글을 좋아해요 ❤️<br><span style="color:var(--muted);font-size:0.8rem">${escHtml(notif.postTitle)}</span>`
        : `<b>${escHtml(notif.fromNickname)}</b>님이 <b>${escHtml(notif.postTitle)}</b>에 댓글을 남겼어요`;
      el.innerHTML = `
        <div class="notif-item-text">
          ${notifText}
          ${notif.preview && notif.type !== 'like' ? `<br><span style="color:var(--muted)">"${escHtml(notif.preview)}"</span>` : ''}
        </div>
        <div class="notif-item-time">${getRelativeTime(notif.timestamp)}</div>
      `;
      listEl.appendChild(el);
    });
  } catch (e) {
    console.warn("알림 로드 실패:", e.code);
  }
}

// ── 알림 패널 토글 ──
function toggleNotifPanel() {
  const panel = document.getElementById("notifPanel");
  if (!panel) return;
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) loadNotifications();
}
function closeNotifPanel() {
  document.getElementById("notifPanel")?.classList.remove('open');
}

// ── 개별 알림 읽음 처리 ──
function markNotifRead(notifId) {
  if (!isLoggedIn || !currentUser) return;
  db.ref(`notifications/${currentUser.uid}/${notifId}/read`).set(true).catch(() => {});
  db.ref(`notif_counts/${currentUser.uid}/unread`).transaction(c => Math.max(0, (c || 0) - 1)).catch(() => {});
  loadNotifications();
}

// ── 전체 알림 읽음 처리 ──
async function markAllNotifsRead() {
  if (!isLoggedIn || !currentUser) return;
  try {
    const snap = await db.ref(`notifications/${currentUser.uid}`).once("value");
    const notifs = snap.val() || {};
    const updates = {};
    Object.keys(notifs).forEach(id => { updates[`${id}/read`] = true; });
    if (Object.keys(updates).length > 0) {
      await db.ref(`notifications/${currentUser.uid}`).update(updates);
    }
    await db.ref(`notif_counts/${currentUser.uid}/unread`).set(0);
    loadNotifications();
    closeNotifPanel();
  } catch (e) {
    console.warn("읽음 처리 실패:", e.code);
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
              <span style="font-weight:700;color:var(--text);font-size:0.9rem">${escHtml(resolveAuthorNickname(comment))}</span>
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

  // .once()로 1회 로드 (.on() 실시간 구독 제거 → 비용 절감)
  const commentsRef = db.ref(`comments/${fandom}/${postId}`);
  commentsRef.once("value", commentsModalCallback);
  commentsModalListener = null;

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
    await db.ref(`comments/${fandom}/${postId}/${commentId}`).set({
      content,
      authorUid: currentUser.uid,
      authorName: currentUser.customNickname || currentUser.displayName || "익명",
      timestamp: Date.now(),
      isHidden: false
    });
    db.ref(`community/${fandom}/${postId}/commentsCount`).transaction(c => (c || 0) + 1).catch(() => {});
    textarea.value = "";
    showToast("댓글이 작성됐어요!");
  } catch (e) {
    console.error("댓글 작성 실패:", e);
    showToast("댓글 작성에 실패했어요");
  }
}


// ── 게시물 삭제 확인 모달 ──
let deletePostState = { fandom: null, postId: null, closeDetail: false };

function confirmDeletePost(fandom, postId, closeDetail = false) {
  deletePostState = { fandom, postId, closeDetail };
  document.getElementById('deletePostModal').style.display = 'flex';
}

function closeDeletePostModal() {
  document.getElementById('deletePostModal').style.display = 'none';
  deletePostState = { fandom: null, postId: null, closeDetail: false };
}

function confirmDeletePostAction() {
  const { fandom, postId, closeDetail } = deletePostState;
  if (!fandom || !postId) return;
  closeDeletePostModal();
  deletePost(fandom, postId, closeDetail);
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

  // ★ 팬덤 확인 (전체/내글 탭에서는 select.value가 "" → primaryFandom 사용)
  const select = document.getElementById("communityFandomSelect");
  const selectedFandom = select.value || currentUser.primaryFandom;
  if (!selectedFandom) {
    showToast("팬덤을 먼저 선택해주세요");
    return;
  }
  // ★ select에 팬덤 반영 (submitPost에서 정확한 경로 읽기 위함)
  if (!select.value) select.value = selectedFandom;

  // 팬덤 변경 후 24시간 제약 확인
  if (!canWritePost(selectedFandom)) {
    return;
  }

  // 모달 초기화
  document.getElementById("postTemplate").value = "free";
  document.getElementById("postTitle").value = "";
  document.getElementById("postContent").value = "";
  const titleCountEl = document.getElementById("postTitleCount");
  const contentCountEl = document.getElementById("postContentCount");
  titleCountEl.textContent = "0";
  titleCountEl.style.color = "";
  contentCountEl.textContent = "0";
  contentCountEl.style.color = "";
  document.getElementById("scheduleTemplate").style.display = "none";

  // ★ 이미지 초기화 (이전 게시글의 이미지가 남지 않도록)
  postImageUrl = null;
  document.getElementById("postImagePreview").style.display = "none";
  document.getElementById("postImagePreviewImg").src = "";

  // 팬덤 표시
  document.getElementById("postCreateFandom").textContent = selectedFandom;

  // ★ 글자 수 카운터 + 경고 색상
  document.getElementById("postTitle").oninput = () => {
    const len = document.getElementById("postTitle").value.length;
    const el = document.getElementById("postTitleCount");
    el.textContent = len;
    el.style.color = len >= 90 ? '#ff6464' : len >= 70 ? '#ffb450' : '';
  };
  document.getElementById("postContent").oninput = () => {
    const len = document.getElementById("postContent").value.length;
    const el = document.getElementById("postContentCount");
    el.textContent = len;
    el.style.color = len >= 1800 ? '#ff6464' : len >= 1500 ? '#ffb450' : '';
  };

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

// 작성 중 내용 확인 후 닫기
function confirmAndClosePostModal() {
  const title = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();
  if (title || content || postImageUrl) {
    if (!confirm("작성 중인 내용이 사라져요. 정말 닫으시겠어요?")) return;
  }
  closePostCreateModal();
}

// 모달 외부 클릭 시 닫기 (내용 있으면 확인)
document.addEventListener("click", (e) => {
  const modal = document.getElementById("postCreateModal");
  if (e.target === modal) {
    confirmAndClosePostModal();
  }
});

// ESC 키로 모달 닫기 (내용 있으면 확인)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const deleteModal = document.getElementById("deletePostModal");
    if (deleteModal && deleteModal.style.display === "flex") {
      closeDeletePostModal();
      return;
    }
    const editModal = document.getElementById("editPostModal");
    if (editModal && editModal.style.display === "flex") {
      closeEditPostModal();
      return;
    }
    const modal = document.getElementById("postCreateModal");
    if (modal.style.display === "flex") {
      confirmAndClosePostModal();
    }
  }
});

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

  const submitBtn = document.getElementById("submitPostBtn");
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "작성 중..."; }

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
      likesCount: 0,
      commentsCount: 0,
      type: template,
      isSchedule: isSchedule,
      imageUrl: postImageUrl || null,
      imagePublicId: postImagePublicId || null
    };

    await db.ref(`community/${selectedFandom}/${postId}`).set(postData);
    // 내가 쓴 글 인덱스 동시 기록 (loadMyPosts 최적화용)
    db.ref(`user_posts/${currentUser.uid}/${postId}`).set({
      fandom: selectedFandom,
      title,
      timestamp: postData.timestamp,
      type: template || null
    }).catch(() => {});

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

    // ★ 새 글 작성 → 캐시 무효화 (다음 로드 시 Firebase 재요청)
    _invalidatePostListCache(selectedFandom);
    _invalidateAllFeedCache();
    // ★ 내 팬덤 탭으로 이동하여 새 글 즉시 반영
    selectFandomTab(selectedFandom);
  } catch (error) {
    showToast("게시물 작성 실패: " + error.message);
    console.error(error);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "작성하기";
    }
  }
}

// ── 게시물 수정 모달 ──
let editPostState = { fandom: null, postId: null };

function editPost(fandom, postId, title, content) {
  editPostState = { fandom, postId };
  const titleEl = document.getElementById('editPostTitle');
  const contentEl = document.getElementById('editPostContent');
  titleEl.value = title;
  contentEl.value = content;
  document.getElementById('editPostTitleCount').textContent = title.length;
  document.getElementById('editPostContentCount').textContent = content.length;
  document.getElementById('editPostModal').style.display = 'flex';
  setTimeout(() => titleEl.focus(), 100);
}

function closeEditPostModal() {
  document.getElementById('editPostModal').style.display = 'none';
  editPostState = { fandom: null, postId: null };
}

async function saveEditPost() {
  const title = document.getElementById('editPostTitle').value.trim();
  const content = document.getElementById('editPostContent').value.trim();
  if (!title) { showToast('제목을 입력해주세요'); return; }
  if (!content) { showToast('내용을 입력해주세요'); return; }
  const { fandom, postId } = editPostState;
  if (!fandom || !postId) return;
  const btn = document.getElementById('saveEditPostBtn');
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    await db.ref(`community/${fandom}/${postId}`).update({ title, content });
    try { sessionStorage.removeItem(`pd_${postId}`); } catch {} // ★ 게시글 캐시 무효화
    showToast('✅ 게시물이 수정되었어요!');
    closeEditPostModal();
  } catch (e) {
    showToast('수정 실패: ' + e.message);
    console.error(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '저장'; }
  }
}

// ── 게시물 삭제 ──
async function deletePost(fandom, postId, closeAfterDelete = false) {
  // 작성자 권한 확인
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    return;
  }

  try {
    // 먼저 게시물 데이터 조회 (이미지 정보 + 작성자 확인)
    const postSnap = await db.ref(`community/${fandom}/${postId}`).once("value");
    const postData = postSnap.val();

    if (!postData) { showToast("게시물을 찾을 수 없어요"); return; }
    if (postData.authorUid !== currentUser.uid) {
      showToast("본인 게시물만 삭제할 수 있어요");
      return;
    }

    // 이미지 삭제 (R2)
    if (postData && postData.imagePublicId && R2_UPLOAD_WORKER_URL) {
      try {
        const idToken = await firebase.auth().currentUser.getIdToken(true);
        await fetch(`${R2_UPLOAD_WORKER_URL}/${encodeURIComponent(postData.imagePublicId)}`, {
          method: 'DELETE',
          headers: { 'X-Firebase-Token': idToken },
        });
        console.log("✅ R2 이미지 삭제:", postData.imagePublicId);
      } catch (imgError) {
        console.error("⚠️ 이미지 삭제 중 오류 (계속 진행):", imgError);
      }
    }

    // Database에서 게시물 삭제
    await db.ref(`community/${fandom}/${postId}`).remove();
    db.ref(`user_posts/${currentUser.uid}/${postId}`).remove().catch(() => {});
    db.ref(`likes/${fandom}/${postId}`).remove().catch(() => {});
    db.ref(`comments/${fandom}/${postId}`).remove().catch(() => {});
    _invalidatePostListCache(fandom); // ★ 삭제 후 캐시 무효화
    _invalidateAllFeedCache();
    showToast("✅ 게시물이 삭제되었어요");
    // 목록에서 즉시 제거
    document.querySelector(`[data-postid="${postId}"]`)?.remove();
    if (closeAfterDelete) closePostDetail();
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

// ── 좋아요 처리 중 중복 클릭 방지 ──
const _likingInProgress = new Set();

// ── 좋아요 토글 ──
async function toggleLike(fandom, postId) {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인 후 좋아요를 할 수 있습니다");
    return;
  }

  const likeKey = `${fandom}/${postId}`;
  if (_likingInProgress.has(likeKey)) return; // 처리 중 중복 클릭 무시
  _likingInProgress.add(likeKey);

  // 버튼 즉시 비활성화 (시각적 피드백)
  const likeBtn = document.getElementById("postDetailLikeBtn");
  if (likeBtn) likeBtn.style.opacity = "0.5";

  const likeRef = db.ref(`likes/${fandom}/${postId}/${currentUser.uid}`);

  try {
    const snapshot = await likeRef.once("value");
    const wasLiked = snapshot.exists();

    if (wasLiked) {
      await likeRef.remove();
    } else {
      await likeRef.set(true);
      sendLikeNotification(fandom, postId).catch(() => {});
    }

    // 좋아요 수 업데이트 및 data-likes 속성 갱신
    const likesSnap = await db.ref(`likes/${fandom}/${postId}`).once("value");
    const likeCount = Object.keys(likesSnap.val() || {}).length;
    db.ref(`community/${fandom}/${postId}/likesCount`).set(likeCount).catch(() => {});

    const postEl = document.querySelector(`[data-postid="${postId}"]`);
    if (postEl) postEl.setAttribute("data-likes", likeCount);

    loadLikes(fandom, postId);

    // ★ 상세 페이지 좋아요 UI 직접 갱신 (.once() 전환으로 리스너 없음)
    const _liked = !wasLiked;
    const _dCount = document.getElementById(`detail-like-count-${postId}`);
    const _dBtn   = document.getElementById("postDetailLikeBtn");
    const _dHeart = document.getElementById("postDetailLikeHeart");
    const _sHeart = document.getElementById("stickyLikeHeart");
    const _sCount = document.getElementById("stickyLikeCount");
    const _sBtn   = document.getElementById("stickyLikeBtn");
    if (_dCount) _dCount.textContent = likeCount;
    if (_dBtn) {
      _dBtn.style.background = _liked
        ? 'linear-gradient(135deg,rgba(255,80,80,0.35) 0%,rgba(255,120,120,0.25) 100%)'
        : 'linear-gradient(135deg,rgba(255,100,100,0.1) 0%,rgba(255,140,140,0.05) 100%)';
      _dBtn.style.borderColor = _liked ? 'rgba(255,80,80,0.6)' : 'rgba(255,100,100,0.2)';
    }
    if (_dHeart) _dHeart.textContent = _liked ? '❤️' : '🤍';
    if (_sHeart) _sHeart.textContent = _liked ? '❤️' : '🤍';
    if (_sCount) _sCount.textContent = likeCount;
    if (_sBtn)   _sBtn.classList.toggle('liked', _liked);

  } catch (e) {
    console.error("좋아요 저장 실패:", e.code, e.message);
    // 실패 시 즉시 UI 원복 (heart를 이전 상태로)
    const likeHeart = document.getElementById("postDetailLikeHeart");
    if (likeHeart) {
      const currentHeart = likeHeart.textContent;
      likeHeart.textContent = currentHeart === '❤️' ? '🤍' : '❤️';
    }
    if (e.code === 'PERMISSION_DENIED') {
      showToast("⚠️ 좋아요 저장 실패! Firebase 보안 규칙을 확인해주세요.");
    } else {
      showToast("좋아요 저장에 실패했어요. 다시 시도해주세요.");
    }
  } finally {
    _likingInProgress.delete(likeKey);
    if (likeBtn) likeBtn.style.opacity = "";
  }
}

// ── 댓글 좋아요 토글 ──
async function toggleCommentLike(fandom, postId, commentId) {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인 후 좋아요를 할 수 있습니다");
    return;
  }
  const likeRef = db.ref(`comments/${fandom}/${postId}/${commentId}/likes/${currentUser.uid}`);
  try {
    const snap = await likeRef.once("value");
    if (snap.exists()) {
      await likeRef.remove();
    } else {
      await likeRef.set(true);
    }
    // ★ .once() 전환으로 자동 재렌더 없음 → 댓글 목록 수동 재로드
    loadDetailComments(fandom, postId);
  } catch (e) {
    console.error("댓글 좋아요 실패:", e.code, e.message);
    showToast("댓글 좋아요 저장에 실패했어요.");
  }
}

// ── 좋아요 수 로드 (once: toggleLike 후 1회성 갱신용) ──
function loadLikes(fandom, postId) {
  db.ref(`likes/${fandom}/${postId}`).once("value", snap => {
    const likes = snap.val() || {};
    const likeCount = Object.keys(likes).length;
    const likeCountEl = document.getElementById(`like-count-${postId}`);
    if (likeCountEl) {
      likeCountEl.textContent = likeCount;
    }
  });
}

// ── 댓글 삭제 확인 모달 (브라우저 confirm() 대체) ──
function deleteComment(fandom, postId, commentId) {
  if (!isLoggedIn || !currentUser) { showToast("로그인이 필요합니다"); return; }

  const existing = document.getElementById('deleteCommentModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'deleteCommentModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:10001;backdrop-filter:blur(5px);padding:16px;box-sizing:border-box';
  modal.innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(18,12,36,0.99),rgba(26,16,46,0.99));border:1.5px solid rgba(255,100,100,0.3);border-radius:20px;padding:28px 24px;max-width:320px;width:100%;text-align:center;animation:modalSlideIn 0.25s ease-out;box-shadow:0 20px 50px rgba(0,0,0,0.5)">
      <div style="font-size:2.5rem;margin-bottom:12px">🗑️</div>
      <h3 style="font-size:1.05rem;font-weight:700;color:var(--text);margin:0 0 8px">댓글을 삭제할까요?</h3>
      <p style="font-size:0.83rem;color:var(--muted);margin:0 0 22px;line-height:1.5">삭제하면 되돌릴 수 없어요</p>
      <div style="display:flex;gap:10px">
        <button id="_dcCancel" style="flex:1;padding:12px;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.1);border-radius:12px;color:rgba(255,255,255,0.5);font-weight:600;font-size:0.88rem;cursor:pointer;font-family:inherit">취소</button>
        <button id="_dcConfirm" style="flex:1;padding:12px;background:linear-gradient(135deg,rgba(255,80,80,0.9),rgba(200,40,40,0.9));border:none;border-radius:12px;color:#fff;font-weight:700;font-size:0.88rem;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(255,80,80,0.3)">삭제</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('_dcCancel').onclick = () => modal.remove();
  document.getElementById('_dcConfirm').onclick = () => {
    modal.remove();
    _executeDeleteComment(fandom, postId, commentId);
  };
}

async function _executeDeleteComment(fandom, postId, commentId) {
  try {
    const snap = await db.ref(`comments/${fandom}/${postId}/${commentId}`).once("value");
    const comment = snap.val();
    if (!comment) { showToast("댓글을 찾을 수 없어요"); return; }
    if (comment.authorUid !== currentUser.uid) { showToast("본인 댓글만 삭제할 수 있어요"); return; }

    await db.ref(`comments/${fandom}/${postId}/${commentId}`).remove();
    db.ref(`community/${fandom}/${postId}/commentsCount`).transaction(c => Math.max(0, (c || 0) - 1)).catch(() => {});
    showToast("댓글이 삭제되었어요");
    loadDetailComments(fandom, postId);
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
    await db.ref(`comments/${fandom}/${postId}/${commentId}`).update({
      content: newContent
    });

    showToast("댓글이 수정되었어요!");
    closeEditCommentModal();
    // ★ .once() 전환으로 자동 재렌더 없음 → 수동 재로드
    loadDetailComments(fandom, postId);
  } catch (error) {
    showToast("댓글 수정 실패: " + error.message);
    console.error(error);
  }
}

// ── 게시글 이미지 업로드 (R2) ──
function openPostImageUpload() {
  // 파일 선택 대화
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

    const uploadBtn = document.getElementById("postImageUploadBtn");
    if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.textContent = "⏳ 업로드 중..."; }

    try {
      if (!R2_UPLOAD_WORKER_URL) throw new Error('R2_UPLOAD_WORKER_URL 미설정');

      // ★ R2 업로드: 클라이언트 압축(WebP) → Worker 인증 → R2 저장
      if (uploadBtn) uploadBtn.textContent = "⏳ 압축 중...";
      const compressed = await _compressImage(file);

      if (uploadBtn) uploadBtn.textContent = "⏳ 업로드 중...";
      const idToken = await firebase.auth().currentUser.getIdToken(true);
      const r2Key = `community/${currentUser.uid}/${Date.now()}.webp`;

      const res = await fetch(`${R2_UPLOAD_WORKER_URL}/${encodeURIComponent(r2Key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/webp', 'X-Firebase-Token': idToken },
        body: compressed,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      postImageUrl = data.url;
      postImagePublicId = r2Key; // R2 object key (삭제 시 사용)

      // 이미지 미리보기 표시
      const preview = document.getElementById('postImagePreview');
      const previewImg = document.getElementById('postImagePreviewImg');
      previewImg.src = postImageUrl;
      preview.style.display = 'block';

      showToast("✅ 이미지가 추가되었습니다!");
    } catch (error) {
      console.error("이미지 업로드 실패:", error);
      showToast("❌ 이미지 업로드에 실패했습니다.");
    } finally {
      if (uploadBtn) { uploadBtn.disabled = false; uploadBtn.textContent = "📸 이미지 추가"; }
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
  // .once() 전환 이후: 재정렬은 모달을 다시 열어서 처리 (리스너 없음)
  // showCommentsModal이 currentFandom/postId를 기억하지 않으므로 정렬만 시각적 반영
  const commentsList = document.getElementById('commentsModalList');
  if (commentsList) {
    const items = Array.from(commentsList.children);
    // 이미 렌더된 댓글 DOM 재정렬 (추가 Firebase read 없음)
    items.sort((a, b) => {
      const tsA = parseInt(a.dataset?.ts || 0);
      const tsB = parseInt(b.dataset?.ts || 0);
      return commentSortMode === 'latest' ? tsB - tsA : tsA - tsB;
    });
    items.forEach(el => commentsList.appendChild(el));
  }
}

// ── 게시물 신고 (브라우저 prompt() 대체 → 커스텀 선택 모달) ──
function reportPost(fandom, postId) {
  if (!isLoggedIn) { showToast("로그인 후 신고할 수 있습니다"); return; }

  const existing = document.getElementById('reportPostModal');
  if (existing) existing.remove();

  const reasons = ['부적절한 내용', '스팸', '광고', '욕설/혐오'];
  const modal = document.createElement('div');
  modal.id = 'reportPostModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:10001;backdrop-filter:blur(5px);padding:16px;box-sizing:border-box';
  modal.innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(18,12,36,0.99),rgba(26,16,46,0.99));border:1.5px solid rgba(255,150,50,0.3);border-radius:20px;padding:28px 24px;max-width:340px;width:100%;animation:modalSlideIn 0.25s ease-out;box-shadow:0 20px 50px rgba(0,0,0,0.5)">
      <div style="font-size:2rem;margin-bottom:10px;text-align:center">🚩</div>
      <h3 style="font-size:1.05rem;font-weight:700;color:var(--text);margin:0 0 6px;text-align:center">신고 사유 선택</h3>
      <p style="font-size:0.8rem;color:var(--muted);margin:0 0 18px;text-align:center">해당하는 사유를 선택해주세요</p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px">
        ${reasons.map((r, i) => `
          <label style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.08);border-radius:10px;cursor:pointer;transition:all 0.15s" onmouseover="this.style.borderColor='rgba(255,150,50,0.4)';this.style.background='rgba(255,150,50,0.06)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)';this.style.background='rgba(255,255,255,0.04)'">
            <input type="radio" name="reportReason" value="${escAttr(r)}" style="accent-color:rgba(255,150,50,0.9);width:16px;height:16px;cursor:pointer">
            <span style="font-size:0.9rem;color:var(--text);font-weight:500">${escHtml(r)}</span>
          </label>
        `).join('')}
      </div>
      <div style="display:flex;gap:10px">
        <button id="_rpCancel" style="flex:1;padding:12px;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.1);border-radius:12px;color:rgba(255,255,255,0.5);font-weight:600;font-size:0.88rem;cursor:pointer;font-family:inherit">취소</button>
        <button id="_rpConfirm" style="flex:1;padding:12px;background:linear-gradient(135deg,rgba(255,150,50,0.9),rgba(220,100,20,0.9));border:none;border-radius:12px;color:#fff;font-weight:700;font-size:0.88rem;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(255,150,50,0.3)">신고하기</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.getElementById('_rpCancel').onclick = () => modal.remove();
  document.getElementById('_rpConfirm').onclick = () => {
    const selected = modal.querySelector('input[name="reportReason"]:checked');
    if (!selected) { showToast('신고 사유를 선택해주세요'); return; }
    modal.remove();
    _executeReportPost(fandom, postId, selected.value);
  };
}

async function _executeReportPost(fandom, postId, reason) {
  try {
    // 기존 신고 데이터 조회 (fandom 포함 경로로 수정)
    const reportPath = `reports/${fandom}/${postId}`;
    const snap = await db.ref(reportPath).once("value");
    const reportData = snap.val() || { reports: [], count: 0, fandom };

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
    await db.ref(reportPath).set(reportData);

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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 전체 피드 & 팬덤 탭 바
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── 팬덤 탭 바 렌더링 ──
// 항상 4개 고정 탭: 전체 | 내꺼 | 팬덤찾기 | 내가쓴글
function renderFandomTabBar() {
  const bar = document.getElementById("fandomTabBar");
  if (!bar) return;

  const myFav = currentUserFav || localStorage.getItem('my_fav_group');
  const myFavMeta = myFav ? (GROUP_META[myFav] || {}) : null;

  // 둘러보기 탭: 선택된 타팬덤이 있으면 그 이름으로 활성 표시
  const isFinderActive = !!currentOtherFandom && currentSelectedTab === currentOtherFandom;
  const finderMeta = isFinderActive ? (GROUP_META[currentOtherFandom] || {}) : null;
  const finderLabel = isFinderActive
    ? `${finderMeta.emoji || ''} ${currentOtherFandom}`
    : '타팬덤 커뮤니티';

  const tabs = [
    {
      id: 'all',
      label: '🌍 전체',
      active: currentSelectedTab === 'all',
    },
    {
      id: myFav || '__nofav__',
      label: myFavMeta ? `${myFavMeta.emoji} ${myFav}` : '💜 팬덤설정',
      active: !!myFav && currentSelectedTab === myFav,
      dimmed: !myFav,
    },
    {
      id: 'fandomFinder',
      label: finderLabel,
      active: isFinderActive,
    },
    {
      id: 'myPosts',
      label: '✏️ 내가쓴글',
      active: currentSelectedTab === 'myPosts',
    },
  ];

  bar.innerHTML = tabs.map(tab => {
    const dimAttr = tab.dimmed ? ' style="opacity:0.45"' : '';
    return `<button class="fandom-tab${tab.active ? ' active' : ''}" data-tabid="${escAttr(tab.id)}"${dimAttr}>` +
      `<span class="tab-label">${escHtml(tab.label)}</span></button>`;
  }).join('');

  // 이벤트 바인딩
  bar.querySelectorAll('.fandom-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tid = btn.dataset.tabid;
      // 팬덤 미설정 탭 클릭 → 팬덤 선택 피커 오픈
      if (tid === '__nofav__') {
        if (typeof openFavPicker === 'function') openFavPicker();
        return;
      }
      // 내가쓴글 비로그인 클릭 → 로그인 안내
      if (tid === 'myPosts' && !isLoggedIn) {
        showToast('💜 로그인 후 이용할 수 있어요');
        return;
      }
      selectFandomTab(tid);
    });
  });
}

// ── 팬덤 탭 선택 ──
function selectFandomTab(tabId) {
  // 팬덤 찾기 버튼은 탭 전환 없이 모달만 오픈
  if (tabId === 'fandomFinder') {
    openFandomFinderModal();
    return;
  }

  // 전체 탭이 아닌 곳으로 이동 시 정렬 버튼 복원
  if (tabId !== 'all') {
    const sortGroup = document.getElementById("sortButtonGroup");
    if (sortGroup) sortGroup.style.display = 'flex';
  }

  currentSelectedTab = tabId;

  // 타팬덤이 아닌 탭으로 이동하면 타팬덤 세션 초기화
  if (tabId !== currentOtherFandom) {
    currentOtherFandom = null;
    sessionStorage.removeItem('other_fandom');
  }

  renderFandomTabBar();

  const pageTitle = document.querySelector("header h1");

  if (tabId === 'all') {
    currentFeedMode = 'all';
    currentFabWriteAction = openPostCreateModalForAll;
    if (pageTitle) pageTitle.textContent = '🌍 전체 피드';
    loadAllFandomPosts();
  } else if (tabId === 'myPosts') {
    currentFeedMode = 'all';
    currentFabWriteAction = openPostCreateModalForAll;
    if (pageTitle) pageTitle.textContent = '✏️ 내가 쓴 글';
    loadMyPosts();
  } else {
    currentFeedMode = 'my';
    currentFabWriteAction = openPostCreateModal;
    // hidden select 값 업데이트 (programmatic = change 이벤트 미발생)
    const select = document.getElementById("communityFandomSelect");
    if (select) select.value = tabId;
    const meta = GROUP_META[tabId];
    if (pageTitle && meta) pageTitle.textContent = `${meta.emoji} ${tabId} 커뮤니티`;
    loadCommunityPosts();
  }

  // 현재 탭 상태 저장 (새로고침 후 복원용)
  sessionStorage.setItem('feedMode', currentFeedMode);
  sessionStorage.setItem('selectedTab', currentSelectedTab);
}

// ── 팬덤 찾기 모달 ──
function openFandomFinderModal() {
  if (document.getElementById("fandomFinderModal")) return;

  const myFav = currentUserFav || localStorage.getItem('my_fav_group');

  const overlay = document.createElement("div");
  overlay.id = "fandomFinderModal";
  overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);display:flex;align-items:flex-end;justify-content:center;z-index:9000;backdrop-filter:blur(4px)`;
  overlay.onclick = (e) => { if (e.target === overlay) closeFandomFinderModal(); };

  const renderGrid = (query = "") => {
    const lower = query.toLowerCase();
    const filtered = ALL_GROUPS.filter(g => {
      const meta = GROUP_META[g] || {};
      return (meta.kr ? `${meta.kr} ${g}` : g).toLowerCase().includes(lower);
    });
    if (filtered.length === 0) {
      return `<div style="text-align:center;padding:32px 20px;color:var(--muted)">
        <div style="font-size:2rem;margin-bottom:8px">🔍</div>
        <div style="font-size:0.9rem">검색 결과가 없어요</div>
      </div>`;
    }
    return filtered.map(g => {
      const meta = GROUP_META[g] || { emoji: '🌟' };
      const displayName = meta.kr ? `${meta.kr} (${g})` : g;
      const isCurrent = g === currentOtherFandom;
      const isMine = g === myFav;
      return `<button class="fav-picker-btn${isCurrent ? ' selected' : ''}" onclick="pickOtherFandom('${escAttr(g)}')" style="${isMine ? 'opacity:0.45;pointer-events:none' : ''}">
        <span class="fp-emoji">${meta.emoji}</span>
        <span class="fp-name">${escHtml(displayName)}${isMine ? ' <span style="font-size:0.65rem;color:var(--primary)">(내꺼)</span>' : ''}</span>
      </button>`;
    }).join('');
  };

  overlay.innerHTML = `<div class="fav-picker-sheet" id="fandomFinderSheet" style="border-radius:20px 20px 0 0;max-height:80vh;overflow:hidden;display:flex;flex-direction:column">
    <div class="fav-picker-title" style="flex-shrink:0">
      🔍 어떤 팬덤 커뮤니티를 볼까요?
      <button class="fav-picker-close" onclick="closeFandomFinderModal()">✕</button>
    </div>
    <div style="flex-shrink:0;padding:0 16px 12px">
      <input type="text" id="fandomFinderSearch" placeholder="팬덤 검색... (예: NCT, 뉴진스, aespa)"
        inputmode="search" autocomplete="off" style="
        width:100%;padding:10px 14px;border:1.5px solid rgba(124,77,255,0.3);border-radius:10px;
        background:rgba(124,77,255,0.08);color:var(--text);font-family:inherit;font-size:1rem;
        outline:none;transition:all 0.2s;box-sizing:border-box" />
    </div>
    <div class="fav-picker-grid" id="fandomFinderGrid" style="flex:1;overflow-y:auto;padding:0 16px 24px">${renderGrid()}</div>
  </div>`;

  document.body.appendChild(overlay);

  // 검색 이벤트
  const input = document.getElementById("fandomFinderSearch");
  const grid = document.getElementById("fandomFinderGrid");
  const sheet = document.getElementById("fandomFinderSheet");
  input.addEventListener("input", (e) => {
    grid.innerHTML = renderGrid(e.target.value);
  });

  // ★ 자동 포커스 제거 — 모바일에서 키보드가 자동으로 올라와 결과를 가리는 문제 방지
  // (사용자가 직접 검색창을 탭하면 키보드 올라옴)

  // ★ visualViewport: 키보드가 올라오면 overlay 자체를 visual viewport 크기에 맞게 이동
  const updateLayout = () => {
    if (!document.getElementById("fandomFinderModal")) return;
    const vv = window.visualViewport;
    if (vv) {
      overlay.style.top = vv.offsetTop + 'px';
      overlay.style.height = vv.height + 'px';
      sheet.style.maxHeight = Math.floor(vv.height * 0.85) + 'px';
    }
  };
  updateLayout();
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateLayout);
    window.visualViewport.addEventListener('scroll', updateLayout);
  }

  // ESC 닫기
  const handleEsc = (e) => { if (e.key === "Escape") { closeFandomFinderModal(); document.removeEventListener("keydown", handleEsc); } };
  document.addEventListener("keydown", handleEsc);

  // 모바일 뒤로가기
  window.history.pushState({ modal: "fandomFinder" }, null, null);
  const handlePop = () => { closeFandomFinderModal(); window.removeEventListener("popstate", handlePop); };
  window.addEventListener("popstate", handlePop);
}

function closeFandomFinderModal() {
  document.getElementById("fandomFinderModal")?.remove();
  // visualViewport 리스너는 updateSheetHeight 내부에서 모달 존재 여부를 확인하므로 자동 비활성화
}

function pickOtherFandom(fandom) {
  closeFandomFinderModal();
  currentOtherFandom = fandom;
  sessionStorage.setItem('other_fandom', fandom); // 새로고침 후 복원용
  selectFandomTab(fandom);
}

// ── 타팬덤 상세에서 내 팬덤 커뮤니티로 이동 ──
function goToMyFandomFromDetail() {
  const myFav = currentUserFav;
  if (!myFav) return;
  closePostDetail();
  setTimeout(() => selectFandomTab(myFav), 80);
}

// ── 전체 피드 마지막 업데이트 시각 표시 ──
function updateAllFeedTimestamp() {
  const el = document.getElementById("allFeedLastUpdate");
  if (!el) return;
  if (_allFeedLastLoadedAt === 0) { el.style.display = 'none'; return; }
  const diffMin = Math.floor((Date.now() - _allFeedLastLoadedAt) / 60000);
  const label = diffMin < 1 ? '방금 전' : `${diffMin}분 전`;
  el.textContent = `업데이트: ${label}`;
  el.style.display = 'block';
}

// ── 전체 피드 localStorage 캐시 (새로고침 후에도 유지) ──
const _ALL_FEED_LS_KEY = 'allFeed_ls_cache';
const _ALL_FEED_LS_TTL = 10 * 60 * 1000; // 10분

function _getAllFeedLsCache() {
  try {
    const raw = localStorage.getItem(_ALL_FEED_LS_KEY);
    if (!raw) return null;
    const { d, ts } = JSON.parse(raw);
    if (Date.now() - ts > _ALL_FEED_LS_TTL) return null;
    return d;
  } catch { return null; }
}

function _setAllFeedLsCache(posts) {
  try {
    localStorage.setItem(_ALL_FEED_LS_KEY, JSON.stringify({ d: posts, ts: Date.now() }));
  } catch {}
}

function _invalidateAllFeedCache() {
  try { localStorage.removeItem(_ALL_FEED_LS_KEY); } catch {}
  _allFeedLastLoadedAt = 0;
  _allFeedIsRendered = false;
}

// ── 전체 피드 로드 (상위 5개 팬덤 그룹 뷰) ──
async function loadAllFandomPosts(forceRefresh = false) {
  const postsList = document.getElementById("communityPostsList");

  // 정렬 버튼 숨기기 (그룹뷰에선 불필요)
  const sortGroup = document.getElementById("sortButtonGroup");
  if (sortGroup) sortGroup.style.display = 'none';

  // ★ in-memory 캐시
  if (!forceRefresh && _allFeedLastLoadedAt > 0 &&
      Date.now() - _allFeedLastLoadedAt < ALL_FEED_CACHE_TTL &&
      _allFeedIsRendered) {
    updateAllFeedTimestamp();
    return;
  }

  // ★ localStorage 캐시 (새로고침 후에도 유지)
  if (!forceRefresh) {
    const lsCache = _getAllFeedLsCache();
    if (lsCache && lsCache.length > 0) {
      _renderGroupedFeed(lsCache);
      _allFeedIsRendered = true;
      _allFeedLastLoadedAt = Date.now();
      communityPostsLoaded = true;
      updateAllFeedTimestamp();
      return;
    }
  }

  const loadId = ++_allFeedLoadId;

  clearPostListListeners();
  if (currentCommunityListener) {
    db.ref(currentCommunityListener).off("value");
    currentCommunityListener = null;
  }

  postsList.innerHTML = `
    <div class="community-empty">
      <div class="spinner" style="display:inline-block;margin-bottom:12px"></div>
      <div class="community-empty-text">전체 피드를 불러오는 중...</div>
    </div>
  `;

  // 랭킹 상위 5개 팬덤만 로드
  const top5 = _getTop5Fandoms();

  try {
    // ★ 팬덤당 최신 5개만 로드 (전체 피드보다 훨씬 저렴)
    const snapshots = await Promise.all(
      top5.map(fandom =>
        db.ref(`community/${fandom}`)
          .orderByChild('timestamp')
          .limitToLast(5)
          .once("value")
      )
    );

    if (loadId !== _allFeedLoadId) return;

    // 팬덤별 섹션 구성
    const sections = top5.map((fandom, i) => {
      const posts = [];
      const val = snapshots[i].val() || {};
      Object.entries(val).forEach(([postId, post]) => {
        if (!post.isHidden) posts.push({postId, post});
      });
      posts.sort((a, b) => (b.post.timestamp || 0) - (a.post.timestamp || 0));
      return {fandom, posts: posts.slice(0, 5)};
    }).filter(s => s.posts.length > 0);

    communityPostsLoaded = true;

    _setAllFeedLsCache(sections);
    _renderGroupedFeed(sections);
    _allFeedIsRendered = true;
    _allFeedLastLoadedAt = Date.now();
    updateAllFeedTimestamp();

  } catch (e) {
    console.error("전체 피드 로드 실패:", e);
    postsList.innerHTML = `
      <div class="community-empty">
        <div class="community-empty-icon">⚠️</div>
        <div class="community-empty-text">피드를 불러오지 못했어요<br>잠시 후 다시 시도해주세요</div>
      </div>
    `;
  }
}

// ── 랭킹 상위 5개 팬덤 가져오기 ──
function _getTop5Fandoms() {
  if (allRankingsData && Object.keys(allRankingsData).length > 0) {
    return Object.entries(allRankingsData)
      .filter(([g]) => ALL_GROUPS.includes(g))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([g]) => g);
  }
  return ALL_GROUPS.slice(0, 5);
}

// ── 그룹별 피드 렌더링 ──
function _renderGroupedFeed(sections) {
  const postsList = document.getElementById("communityPostsList");

  if (!sections || sections.length === 0) {
    postsList.innerHTML = `
      <div class="community-empty">
        <div class="community-empty-icon">📭</div>
        <div class="community-empty-text">아직 게시물이 없어요</div>
      </div>
    `;
    return;
  }

  const RANK_BADGES = [
    { label: '1위', bg: 'linear-gradient(135deg,#FFD700,#FFA500)', color: '#000', shadow: '0 0 8px rgba(255,200,0,0.5)' },
    { label: '2위', bg: 'linear-gradient(135deg,#C0C0C0,#A8A8A8)', color: '#000', shadow: '0 0 6px rgba(192,192,192,0.4)' },
    { label: '3위', bg: 'linear-gradient(135deg,#CD7F32,#A0522D)', color: '#fff', shadow: '0 0 6px rgba(205,127,50,0.4)' },
    { label: '4위', bg: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', shadow: 'none' },
    { label: '5위', bg: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', shadow: 'none' },
  ];

  postsList.innerHTML = sections.map(({fandom, posts}, idx) => {
    const meta = GROUP_META[fandom] || {emoji: '🌟', kr: fandom};
    const badge = RANK_BADGES[idx] || RANK_BADGES[4];
    const badgeHtml = `<span class="fandom-rank-badge" style="background:${badge.bg};color:${badge.color};box-shadow:${badge.shadow}">${badge.label}</span>`;

    const postsHtml = posts.map(({postId, post}) => {
      const ago = getRelativeTime(post.timestamp);
      const comments = post.commentsCount || 0;
      const likes = post.likesCount || 0;
      const metaText = [ago, likes ? `❤️ ${likes}` : ''].filter(Boolean).join(' · ');
      return `
        <div class="grouped-post-item" onclick="showPostDetail('${escAttr(fandom)}','${escAttr(postId)}')">
          <div class="grouped-post-row1">
            <span class="grouped-post-title">${escHtml(post.title)}</span>
            ${comments ? `<span class="grouped-post-comments">💬 ${comments}</span>` : ''}
          </div>
          <div class="grouped-post-meta">${escHtml(metaText)}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="fandom-group-section">
        <div class="fandom-group-header">
          <span class="fandom-group-title">${badgeHtml} ${escHtml(meta.emoji || '🌟')} ${escHtml(meta.kr || fandom)}</span>
          <button class="fandom-group-more" onclick="selectFandomTab('${escAttr(fandom)}')">더보기 ›</button>
        </div>
        <div class="fandom-group-posts">${postsHtml}</div>
      </div>
    `;
  }).join('');
}

// ── 전체 피드 배열 정렬 ──
function sortAllFeedPostsArray(mode) {
  if (mode === 'latest') {
    allFeedPosts.sort((a, b) => (b.post.timestamp || 0) - (a.post.timestamp || 0));
  } else if (mode === 'popular') {
    allFeedPosts.sort((a, b) => {
      const la = a.post.likesCount != null ? a.post.likesCount : Object.keys(a.post.likes || {}).length;
      const lb = b.post.likesCount != null ? b.post.likesCount : Object.keys(b.post.likes || {}).length;
      return lb - la || (b.post.timestamp || 0) - (a.post.timestamp || 0);
    });
  } else if (mode === 'best') {
    allFeedPosts.sort((a, b) => {
      const la = a.post.likesCount != null ? a.post.likesCount : Object.keys(a.post.likes || {}).length;
      const lb = b.post.likesCount != null ? b.post.likesCount : Object.keys(b.post.likes || {}).length;
      const va = a.post.views || 0;
      const vb = b.post.views || 0;
      const scoreA = la * 0.4 + va * 0.6;
      const scoreB = lb * 0.4 + vb * 0.6;
      return scoreB - scoreA;
    });
  }
}

// ── 전체 피드 다음 배치 렌더링 ──
function renderMoreFeedPosts() {
  const postsList = document.getElementById("communityPostsList");

  // 기존 "더 보기" 버튼 제거
  const existingBtn = document.getElementById("loadMoreFeedBtn");
  if (existingBtn) existingBtn.remove();

  // 다음 PAGE_SIZE개 렌더링
  const batch = allFeedPosts.slice(allFeedDisplayed, allFeedDisplayed + ALL_FEED_PAGE_SIZE);
  batch.forEach(({ fandom, postId, post }, i) => {
    const postEl = renderPost(fandom, postId, post, allFeedDisplayed + i, true);
    postsList.appendChild(postEl);
  });
  allFeedDisplayed += batch.length;

  // 남은 게시글이 있으면 "더 보기" 버튼 표시
  const remaining = allFeedPosts.length - allFeedDisplayed;
  if (remaining > 0) {
    const btn = document.createElement("button");
    btn.id = "loadMoreFeedBtn";
    btn.className = "load-more-feed-btn";
    btn.innerHTML = `📄 더 보기 <span style="background:rgba(124,77,255,0.15);padding:2px 8px;border-radius:10px;font-size:0.8rem">${remaining}개 남음</span>`;
    btn.onclick = renderMoreFeedPosts;
    postsList.appendChild(btn);
  }
}

// ── 전체 피드 모드에서 글쓰기 (내 팬덤으로 포스팅) ──
function openPostCreateModalForAll() {
  if (!isLoggedIn || !currentUser) {
    showToast("로그인이 필요합니다");
    return;
  }
  const myFav = currentUserFav || localStorage.getItem('my_fav_group');
  if (!myFav) {
    showToast("팬덤을 먼저 설정해주세요");
    return;
  }
  // 내 팬덤으로 hidden select 설정 후 모달 오픈
  const select = document.getElementById("communityFandomSelect");
  if (select) select.value = myFav;
  openPostCreateModal();
}

// ── 내가 쓴 글 로드 ──
async function loadMyPosts() {
  if (!isLoggedIn || !currentUser) {
    document.getElementById("communityPostsList").innerHTML =
      '<div class="community-empty"><div class="community-empty-icon">🔐</div><div class="community-empty-text">로그인 후 이용할 수 있어요</div></div>';
    return;
  }

  clearPostListListeners();
  if (currentCommunityListener) {
    db.ref(currentCommunityListener).off("value");
    currentCommunityListener = null;
  }

  const postsList = document.getElementById("communityPostsList");
  postsList.innerHTML = `
    <div class="community-empty">
      <div class="spinner" style="display:inline-block;margin-bottom:12px"></div>
      <div class="community-empty-text">내 글을 불러오는 중...</div>
    </div>
  `;

  // user_posts 인덱스에서 내 글 목록 조회 (팬덤 전체 스캔 대신 O(내 글 수)만 읽음)
  try {
    const indexSnap = await db.ref(`user_posts/${currentUser.uid}`)
      .orderByChild('timestamp').limitToLast(50).once('value');
    const index = indexSnap.val() || {};
    const entries = Object.entries(index).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

    if (entries.length === 0) {
      postsList.innerHTML = `
        <div class="community-empty">
          <div class="community-empty-icon">✏️</div>
          <div class="community-empty-text">아직 작성한 글이 없어요<br>첫 번째 글을 써보세요!</div>
        </div>
      `;
      return;
    }

    // 각 게시글 전체 데이터를 병렬로 개별 조회 (최대 50개 targeted read)
    const snapshots = await Promise.all(
      entries.map(([postId, meta]) => db.ref(`community/${meta.fandom}/${postId}`).once('value'))
    );

    let myPosts = [];
    snapshots.forEach((snap, i) => {
      if (!snap.exists()) return; // 삭제됐지만 인덱스가 남은 경우 스킵
      const post = snap.val();
      if (post.isHidden) return;
      const [postId, meta] = entries[i];
      myPosts.push({ fandom: meta.fandom, postId, post });
    });

    postsList.innerHTML = '';
    if (myPosts.length === 0) {
      postsList.innerHTML = `
        <div class="community-empty">
          <div class="community-empty-icon">✏️</div>
          <div class="community-empty-text">아직 작성한 글이 없어요<br>첫 번째 글을 써보세요!</div>
        </div>
      `;
      return;
    }

    myPosts.forEach(({ fandom, postId, post }, i) => {
      const postEl = renderPost(fandom, postId, post, i, true);
      postsList.appendChild(postEl);
    });
  } catch (e) {
    console.error("내 글 로드 실패:", e);
    showToast("내 글을 불러올 수 없어요");
  }
}

// ── 맨 위로 버튼 ──
function scrollToTopPage() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // communityPage도 스크롤 초기화
  const communityPage = document.getElementById("communityPage");
  if (communityPage) communityPage.scrollTop = 0;
}

// 스크롤 이벤트 → 맨 위로 버튼 표시
window.addEventListener('scroll', function () {
  const btn = document.getElementById('scrollToTopBtn');
  if (!btn) return;
  if (window.scrollY > 300) {
    btn.classList.add('visible');
  } else {
    btn.classList.remove('visible');
  }
}, { passive: true });

// 알림 패널 외부 클릭 시 닫기
document.addEventListener('click', function (e) {
  const panel = document.getElementById('notifPanel');
  const bellBtn = document.getElementById('notifBellBtn');
  if (panel && bellBtn && !panel.contains(e.target) && !bellBtn.contains(e.target)) {
    panel.classList.remove('open');
  }
});

init();
