// ── FCM 댓글 알림 ──
// VAPID 키: Firebase Console → 프로젝트 설정 → 클라우드 메시징 → 웹 구성 → 키 쌍 생성 후 교체
const FCM_VAPID_KEY = 'REPLACE_WITH_YOUR_VAPID_KEY';

let fcmMessaging = null;

function initFCM() {
  if (!('Notification' in window)) return;
  if (typeof firebase === 'undefined' || !firebase.messaging.isSupported()) return;
  try {
    fcmMessaging = firebase.messaging();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/fandom-battle/firebase-messaging-sw.js')
        .catch(err => console.warn('SW 등록 실패:', err));
    }
  } catch (e) {
    console.warn('FCM 초기화 실패:', e);
  }
}

// auth.js loadUserVotes()에서 자동 호출됨
async function loadNotifications() {
  if (!isLoggedIn || !currentUser) return;
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    await _refreshFCMToken();
    return;
  }

  if (Notification.permission === 'default' && !localStorage.getItem('notif_prompt_shown')) {
    setTimeout(showNotificationPromptModal, 2000);
  }
}

async function _refreshFCMToken() {
  if (!fcmMessaging || !currentUser) return;
  if (FCM_VAPID_KEY === 'REPLACE_WITH_YOUR_VAPID_KEY') return;
  try {
    const sw = await navigator.serviceWorker.ready;
    const token = await fcmMessaging.getToken({ vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: sw });
    if (token) await db.ref(`users/${currentUser.uid}/fcmToken`).set(token);
  } catch (e) {
    console.warn('FCM 토큰 갱신 실패:', e);
  }
}

async function enableNotifications() {
  if (!fcmMessaging) {
    showToast('이 브라우저는 알림을 지원하지 않아요');
    return;
  }
  if (FCM_VAPID_KEY === 'REPLACE_WITH_YOUR_VAPID_KEY') {
    showToast('알림 설정이 아직 준비 중이에요');
    return;
  }

  const btn = document.getElementById('notifEnableBtn');
  if (btn) { btn.disabled = true; btn.textContent = '설정 중...'; }

  try {
    const permission = await Notification.requestPermission();
    localStorage.setItem('notif_prompt_shown', '1');
    document.getElementById('notifPromptModal')?.remove();

    if (permission === 'granted') {
      await _refreshFCMToken();
      showToast('🔔 댓글 알림이 켜졌어요!');
    } else {
      showToast('알림이 거부됐어요. 브라우저 설정에서 켤 수 있어요.');
    }
  } catch (e) {
    console.error('알림 설정 실패:', e);
    showToast('알림 설정에 실패했어요. 다시 시도해주세요.');
    if (btn) { btn.disabled = false; btn.textContent = '🔔 알림 켜기'; }
  }
}

function dismissNotificationPrompt() {
  localStorage.setItem('notif_prompt_shown', '1');
  document.getElementById('notifPromptModal')?.remove();
}

function showNotificationPromptModal() {
  if (document.getElementById('notifPromptModal')) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  if (!isLoggedIn) return;

  const modal = document.createElement('div');
  modal.id = 'notifPromptModal';
  modal.style.cssText = `
    position:fixed;bottom:80px;left:0;width:100%;z-index:9500;
    padding:0 16px;box-sizing:border-box;
    animation:notifSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1);
  `;

  modal.innerHTML = `
    <style>
      @keyframes notifSlideUp {
        from { transform:translateY(120%); opacity:0; }
        to   { transform:translateY(0);    opacity:1; }
      }
    </style>
    <div style="
      background:linear-gradient(160deg,rgba(18,12,40,0.98) 0%,rgba(30,18,58,0.98) 100%);
      border:1.5px solid rgba(124,77,255,0.4);border-radius:20px;
      padding:20px;max-width:480px;margin:0 auto;
      box-shadow:0 -4px 40px rgba(124,77,255,0.3),0 0 0 1px rgba(255,255,255,0.04) inset;
    ">
      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:16px">
        <div style="
          width:48px;height:48px;flex-shrink:0;border-radius:14px;
          background:linear-gradient(135deg,rgba(124,77,255,0.3),rgba(255,77,141,0.3));
          display:flex;align-items:center;justify-content:center;font-size:1.6rem;
          border:1px solid rgba(124,77,255,0.3);
        ">🔔</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:1rem;font-weight:800;color:#fff;margin-bottom:5px">댓글 알림 받기</div>
          <div style="font-size:0.82rem;color:rgba(255,255,255,0.55);line-height:1.6">
            내 글에 댓글이 달리면 브라우저 알림으로 알려드려요.<br>
            <span style="color:rgba(124,77,255,0.9);font-weight:600">탭을 닫아도 알림이 와요!</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button onclick="dismissNotificationPrompt()" style="
          flex:1;padding:12px 8px;background:transparent;
          border:1px solid rgba(255,255,255,0.1);border-radius:12px;
          color:rgba(255,255,255,0.4);font-size:0.85rem;cursor:pointer;font-family:inherit;
        ">나중에</button>
        <button id="notifEnableBtn" onclick="enableNotifications()" style="
          flex:2;padding:12px;
          background:linear-gradient(135deg,#7c4dff 0%,#ff4d8d 100%);
          border:none;border-radius:12px;color:#fff;
          font-weight:800;font-size:0.95rem;cursor:pointer;font-family:inherit;
          box-shadow:0 4px 16px rgba(124,77,255,0.45);
        ">🔔 알림 켜기</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}
