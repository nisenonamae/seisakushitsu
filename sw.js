// 制作室：インストールのための最小限の service worker（中身は毎回ネットから読む）
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', e => {});
