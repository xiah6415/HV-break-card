/* Firebase Web App 設定（使用者 2026-10-24 提供；Web 設定本來就公開，存取權限由 Realtime Database 安全規則與 Authentication 控制）。
   多人連線由 Codex 實作：Realtime Database（asia-southeast1）＋ Authentication（匿名＋Google）。 */
(function (root) {
'use strict';
const firebaseConfig = {
  apiKey: "AIzaSyDDNKDron3QfMjEjr_ty-Namin6zHiLn68",
  authDomain: "haikyuu-playmat.firebaseapp.com",
  databaseURL: "https://haikyuu-playmat-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "haikyuu-playmat",
  storageBucket: "haikyuu-playmat.firebasestorage.app",
  messagingSenderId: "834432697270",
  appId: "1:834432697270:web:9a85c7fdbbba451cb4f717"
};
if (typeof module !== 'undefined' && module.exports) module.exports = firebaseConfig; else root.BREAK_FIREBASE_CONFIG = firebaseConfig;
})(typeof globalThis !== 'undefined' ? globalThis : this);
