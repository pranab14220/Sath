importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCyJm-IA8FwtVGLkavbv5HxHhwUAgVs5DU",
  authDomain: "saath-app-84a2e.firebaseapp.com",
  projectId: "saath-app-84a2e",
  storageBucket: "saath-app-84a2e.firebasestorage.app",
  messagingSenderId: "160313745704",
  appId: "1:160313745704:web:ac80a3d570b3913620701d",
  measurementId: "G-BLE9RVDPX1"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Saath";
  const options = {
    body: "Someone messaged you.",
    icon: "/Sath/favicon.svg",
    data: { url: "https://pranab14220.github.io/Sath/" },
    tag: payload.data?.message_id ? "saath-message-" + payload.data.message_id : "saath-message"
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "https://pranab14220.github.io/Sath/"));
});
