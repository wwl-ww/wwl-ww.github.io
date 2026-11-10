/**
 * childHood 阅读器 v1.1 - 认证系统（登录/注销/用户菜单）
 */

window.Reader = window.Reader || {};
let authRequest = 0;

function applyAuthUser(user) {
    currentUser = user || null;
    if (!currentUser) {
        sessionToken = null;
        Reader.storage.removeItem('reader_session_token');
        delCookie('reader_token');
        delCookie('reader_username');
    }
    updateAuthUI();
}

// ==================== 认证 ====================
async function checkAuth() {
    const requestId = ++authRequest;
    restoreToken();
    if (!sessionToken) {
        updateAuthUI();
        return;
    }
    try {
        var res = await Reader.api.fetch('/api/auth/whoami', {
            headers: { 'Authorization': 'Bearer ' + sessionToken }
        });
        var data = await res.json();
        if (requestId !== authRequest) return;
        applyAuthUser(data.user);
    } catch(e) {}
}

function updateAuthUI() {
    if (!currentUser) Reader.api.clearImages();
    var btnLogin = document.getElementById('btnLogin');
    var userBadge = document.getElementById('userBadge');
    var avatarBtn = document.getElementById('userAvatarBtn');
    var dropdownName = document.getElementById('userDropdownName');
    var loginCard = document.getElementById('welcomeLoginCard');
    var actionsGrid = document.getElementById('welcomeActionsGrid');
    if (currentUser) {
        btnLogin.style.display = 'none';
        userBadge.style.display = 'block';
        document.getElementById('userAvatarDot').textContent = currentUser.username.charAt(0);
        dropdownName.textContent = currentUser.username;
        if (loginCard) loginCard.style.display = 'none';
        if (actionsGrid) actionsGrid.style.display = 'flex';
    } else {
        btnLogin.style.display = '';
        userBadge.style.display = 'none';
        if (loginCard) loginCard.style.display = 'block';
        if (actionsGrid) actionsGrid.style.display = 'none';
    }
}

function toggleUserMenu() {
    var dropdown = document.getElementById('userDropdown');
    var chip = document.getElementById('userAvatarBtn');
    var isOpen = dropdown.classList.toggle('open');
    chip.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) {
        document.getElementById('dropdownDefault').style.display = '';
        document.getElementById('dropdownConfirm').style.display = 'none';
    }
}

// 点击其他区域关闭用户菜单
document.addEventListener('click', function(e) {
    var badge = document.getElementById('userBadge');
    var dropdown = document.getElementById('userDropdown');
    if (badge && dropdown && dropdown.classList.contains('open')) {
        if (!badge.contains(e.target)) {
            dropdown.classList.remove('open');
            var chip = document.getElementById('userAvatarBtn');
            if (chip) chip.setAttribute('aria-expanded', 'false');
            document.getElementById('dropdownDefault').style.display = '';
            document.getElementById('dropdownConfirm').style.display = 'none';
        }
    }
});

function showLogoutConfirm(e) {
    e.stopPropagation();
    document.getElementById('dropdownDefault').style.display = 'none';
    document.getElementById('dropdownConfirm').style.display = 'block';
}

function cancelLogout(e) {
    e.stopPropagation();
    document.getElementById('dropdownDefault').style.display = '';
    document.getElementById('dropdownConfirm').style.display = 'none';
}

function openLogin() {
    closeSidebarOnMobile();
    lastFocusedEl = document.activeElement;
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginMsg').textContent = '';
    var overlay = document.getElementById('loginOverlay');
    openOverlay(overlay);
    focusOverlaySoon(overlay, '#loginUsername');
}

function closeLogin() {
    var overlay = document.getElementById('loginOverlay');
    closeOverlay(overlay);
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
        try { lastFocusedEl.focus(); } catch(e) {}
    }
}

async function doAuth() {
    var username = document.getElementById('loginUsername').value.trim();
    var msgEl = document.getElementById('loginMsg');

    if (!username) {
        msgEl.textContent = '请输入用户名';
        msgEl.className = 'login-msg error';
        return;
    }

    var btn = document.getElementById('loginSubmit');
    if (btn.disabled) return;
    const requestId = ++authRequest;
    btn.disabled = true;
    btn.textContent = '请稍候…';
    msgEl.textContent = '';

    try {
        var res = await Reader.api.fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username })
        });
        var data = await res.json();

        if (requestId !== authRequest) return;
        if (data.ok) {
            sessionToken = data.token;
            currentUser = data.user;
            Reader.storage.setItem('reader_session_token', sessionToken);
            setCookie('reader_token', sessionToken);
            setCookie('reader_username', currentUser.username);
            updateAuthUI();
            loadAchievements();
            closeLogin();
            if (pendingChapter) {
                var p = pendingChapter;
                pendingChapter = null;
                loadChapter(p.path, p.title, p.number, p.chId);
            } else if (currentChapterId && currentChapterPath) {
                loadChapter(currentChapterPath, currentChapterTitle, currentChapterNumber, currentChapterId);
            }
        } else {
            msgEl.textContent = data.error || '操作失败';
            msgEl.className = 'login-msg error';
        }
    } catch(e) {
        if (requestId !== authRequest) return;
        msgEl.textContent = '网络错误：' + e;
        msgEl.className = 'login-msg error';
    } finally {
        btn.disabled = false;
        btn.textContent = '确定';
    }
}

async function logout() {
    ++authRequest;
    const token = sessionToken;
    sessionToken = null;
    currentUser = null;
    clearChapterView();
    closeSearch();
    closeFeedback();
    document.getElementById('searchResults').innerHTML = '';
    document.querySelector('.content-wrapper').innerHTML =
        '<div class="locked-notice"><h2>已退出登录</h2><button class="welcome-btn" onclick="openLogin()">重新登录</button></div>';
    Reader.storage.removeItem('reader_session_token');
    delCookie('reader_token');
    delCookie('reader_username');
    updateAuthUI();
    loadAchievements();
    try {
        await Reader.api.fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });
    } catch(e) {}
}

// inline onclick 需要这些在 window 上
window.openLogin = openLogin;
window.closeLogin = closeLogin;
window.doAuth = doAuth;
window.logout = logout;
window.toggleUserMenu = toggleUserMenu;
window.showLogoutConfirm = showLogoutConfirm;
window.cancelLogout = cancelLogout;

// Reader namespace
window.Reader.checkAuth = checkAuth;
window.Reader.updateAuthUI = updateAuthUI;
window.Reader.toggleUserMenu = toggleUserMenu;
window.Reader.showLogoutConfirm = showLogoutConfirm;
window.Reader.cancelLogout = cancelLogout;
window.Reader.openLogin = openLogin;
window.Reader.closeLogin = closeLogin;
window.Reader.doAuth = doAuth;
window.Reader.logout = logout;
