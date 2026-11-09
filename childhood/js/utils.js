/**
 * childHood 阅读器 v1.1 - 工具函数
 */

window.Reader = window.Reader || {};

// 剔除脚注标记 [^xxx]
function stripFootnotes(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/\[\^[^\]]+\]/g, '').trim();
}

// ==================== 焦点保持 ====================
var lastFocusedEl = null;
let pendingOverlayFocus = null;

function focusOverlaySoon(overlay, selector) {
    if (pendingOverlayFocus) clearTimeout(pendingOverlayFocus.timer);
    const request = {overlay, timer: setTimeout(() => {
        if (pendingOverlayFocus !== request) return;
        pendingOverlayFocus = null;
        if (overlay.classList.contains('open') && !overlay.classList.contains('closing')) {
            const target = overlay.querySelector(selector);
            if (target) target.focus();
        }
    }, 100)};
    pendingOverlayFocus = request;
}

// Each opening owns its animation callbacks; an old close cannot hide a new dialog.
function openOverlay(overlay) {
    if (pendingOverlayFocus) clearTimeout(pendingOverlayFocus.timer);
    pendingOverlayFocus = null;
    if (overlay.cancelClose) overlay.cancelClose();
    overlay.classList.add('open');
    overlay.classList.remove('closing');
}

function closeOverlay(overlay, onClose) {
    if (pendingOverlayFocus && pendingOverlayFocus.overlay === overlay) {
        clearTimeout(pendingOverlayFocus.timer);
        pendingOverlayFocus = null;
    }
    if (overlay.cancelClose) overlay.cancelClose();
    overlay.classList.add('closing');
    function finish(event) {
        if (event && event.target !== overlay) return;
        overlay.cancelClose();
        overlay.classList.remove('open', 'closing');
        if (onClose) onClose();
    }
    const timer = setTimeout(finish, 200);
    overlay.addEventListener('animationend', finish);
    overlay.cancelClose = function() {
        clearTimeout(timer);
        overlay.removeEventListener('animationend', finish);
        overlay.cancelClose = null;
    };
}

function getFocusable(container) {
    return container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
}

function trapFocus(e, container) {
    var focusable = getFocusable(container);
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }
}

// ==================== 认证 Cookie 工具 ====================
var COOKIE_DAYS = 60;
function setCookie(name, value) {
    var d = new Date();
    d.setTime(d.getTime() + COOKIE_DAYS * 86400000);
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax';
}
function getCookie(name) {
    var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    try { return m ? decodeURIComponent(m[2]) : null; } catch (_) { return null; }
}
function delCookie(name) {
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
}

function getAuthHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    if (sessionToken) {
        headers['Authorization'] = 'Bearer ' + sessionToken;
    }
    return headers;
}

function restoreToken() {
    if (sessionToken) return;
    var tok = getCookie('reader_token');
    if (tok) {
        sessionToken = tok;
        Reader.storage.setItem('reader_session_token', tok);
    }
}

// inline onclick 需要这些在 window 上
window.stripFootnotes = stripFootnotes;

// Reader namespace
window.Reader.stripFootnotes = stripFootnotes;
window.Reader.getFocusable = getFocusable;
window.Reader.trapFocus = trapFocus;
window.Reader.setCookie = setCookie;
window.Reader.getCookie = getCookie;
window.Reader.delCookie = delCookie;
window.Reader.getAuthHeaders = getAuthHeaders;
window.Reader.restoreToken = restoreToken;

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function(c) {
        return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
}
