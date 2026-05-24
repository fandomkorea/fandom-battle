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
