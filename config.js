/**
 * config.js — Cấu hình cho bản chạy trên GitHub Pages (https://gl-app.github.io/nhatro/).
 *  API_URL: link Web App của Apps Script sau khi Deploy, dạng
 *           https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
 *  Bản chạy bên trong Apps Script (link /exec mở trực tiếp) không dùng file này.
 */
window.NHATRO_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwM56P5KE5pXmXaK8pkZwc4yMQ8_Kf-A4dFDDSGDsSH6j1XdEInxcJYKz6ePhit5fULXg/exec',
  REQUEST_TIMEOUT_MS: 60000
};
