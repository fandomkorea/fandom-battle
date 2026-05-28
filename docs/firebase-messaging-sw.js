importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAzUVrCc7-gmdYyXu0wFBm8XRi-1OHb2r4",
  authDomain: "fandom-battle-92aa8.firebaseapp.com",
  databaseURL: "https://fandom-battle-92aa8-default-rtdb.firebaseio.com",
  projectId: "fandom-battle-92aa8",
  storageBucket: "fandom-battle-92aa8.firebasestorage.app",
  messagingSenderId: "9287384303",
  appId: "1:9287384303:web:9e9fded2e119ae2a33af1a"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || '팬픽';
  const body  = payload.notification?.body  || '';

  self.registration.showNotification(title, {
    body,
    icon: 'https://fandomkorea.github.io/fandom-battle/og-image.png',
    data: { url: 'https://fandomkorea.github.io/fandom-battle/' }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://fandomkorea.github.io/fandom-battle/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
