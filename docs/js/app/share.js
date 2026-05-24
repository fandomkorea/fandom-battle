function getShareText() {
  const myGroup = cachedTodayFreeVote;
  const now = new Date();
  const monthStr = (now.getMonth() + 1) + "월";
  const title = `🏆 ${monthStr} 팬덤 파워 랭킹 — 팬덤배틀`;
  const myTag = myGroup ? myGroup.replace(/\s/g, "") : "";
  const shareUrl = myGroup ? `${SITE_URL}?ref=${encodeURIComponent(myGroup)}` : SITE_URL;
  const text = myGroup
    ? `나는 ${myGroup}에 투표했어! 100만원 포토카드 주인공을 만들자! #팬덤배틀 #${myTag} #팬덤파워랭킹`
    : `${monthStr} 팬덤 파워 랭킹 진행 중! 100만원 포토카드 내 최애한테! #팬덤배틀 #팬덤파워랭킹`;
  return { title, text, url: shareUrl };
}

function handleShareRef() {
  const params = new URLSearchParams(location.search);
  const ref = params.get("ref");
  if (ref) {
    setTimeout(() => scrollToMyGroup(ref), 1200);
    showToast(`친구 초대감사! ${escHtml(ref)} 팬덤을 보고 있어요 💜`);
  }
}

async function shareNative() {
  const { title, text, url } = getShareText();
  if (navigator.share) {
    try {
      await navigator.share({ title, text: text + "\n" + url });
      return;
    } catch (e) { /* 취소 시 무시 */ }
  }
  // fallback: 클립보드 복사
  try {
    await navigator.clipboard.writeText(url);
    showToast("링크 복사됨! 친구한테 공유해줘 💜");
  } catch {
    // 구형 브라우저 fallback
    const ta = document.createElement("textarea");
    ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast("링크 복사됨! 💜");
  }
}

function shareKakao() {
  const { text, url } = getShareText();
  // Kakao SDK 없이 카카오톡 URL 스킴 + 웹 fallback
  const kakaoShareUrl = "https://sharer.kakao.com/talk/friends/picker/link?app_key=undefined&validation_action=default&validation_params={}";
  // 실용적 방법: 카카오 오픈채팅 or 링크 공유
  // navigator.share가 있으면 카카오도 목록에 뜸
  if (navigator.share) {
    navigator.share({ title: "팬덤배틀", text: text.replace(/#\S+/g, "").trim(), url });
    return;
  }
  // 없으면 링크 복사
  shareNative();
}

function shareToX() {
  const { text, url } = getShareText();
  const tweetText = text + " 👉 " + url;
  window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(tweetText), "_blank", "width=600,height=400");
}

// ── 관리자 ──
