/**
 * childHood 阅读器 v1.1 - 初始化 + 键盘快捷键 + 事件绑定
 */

window.Reader = window.Reader || {};

// ==================== 初始化 ====================
async function init() {
    restoreSettings();
    initSettingsPanel();
    const authId = ++authRequest;
    restoreToken();
    const data = await Reader.api.request('/api/bootstrap');
    if (typeof data.edition !== 'string' || !Array.isArray(data.tree)) throw new Error('无法读取书稿目录');
    if (Reader.edition !== data.edition) Reader.api.clearImages();
    Reader.edition = data.edition;
    if (authId === authRequest) applyAuthUser(data.user);
    setFlatChapters(flattenTree(data.tree));
    await loadTree(data);
    loadAchievements();
    document.getElementById('quickSearch').addEventListener('keydown', handleQuickSearchKey);
}

async function loadFlat() {
    try {
        const res = await Reader.api.fetch('/api/flat');
        setFlatChapters(await res.json());
    } catch(e) {
        console.error('loadFlat failed:', e);
    }
}

function setFlatChapters(chapters) {
    flatChapters = chapters;
    chapterMap = {};
    flatChapters.forEach(ch => { chapterMap[ch.id] = ch; });
    totalWordCount = flatChapters.reduce((sum, ch) => sum + ch.word_count, 0);
}

// Navigation and the sidebar share one version-consistent tree response.
function flattenTree(tree) {
    const chapters = [];
    function visit(node, ancestors) {
        const children = node.children || [];
        const directory = node.is_dir == null ? children.length > 0 : node.is_dir;
        if (!directory || node.page_path) {
            const chapter = {
                id: node.id, number: node.number, title: node.title,
                path: node.page_path || node.path,
                word_count: node.page_path ? (node.page_word_count || 0) : node.word_count,
                series: ancestors[0] || node.title, ancestors, locked: !!node.locked
            };
            if (node.page_path) chapter.is_opener = true;
            chapters.push(chapter);
        }
        children.forEach(child => visit(child, [...ancestors, node.title]));
    }
    tree.forEach(node => visit(node, []));
    chapters.forEach((chapter, index) => Object.assign(chapter, {
        prev: index ? chapters[index - 1].id : null,
        next: index + 1 < chapters.length ? chapters[index + 1].id : null,
        index, total: chapters.length
    }));
    return chapters;
}

// ==================== 键盘快捷键 ====================
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && ['k', 'b'].includes(e.key.toLowerCase())
            && document.querySelector('.search-overlay.open, .settings-overlay.open, .feedback-overlay.open, .login-overlay.open')) {
        e.preventDefault();
        return;
    }
    if (document.getElementById('searchOverlay').classList.contains('open')) {
        if (e.key === 'Escape') {
            closeSearch();
            return;
        }
        trapFocus(e, document.getElementById('searchOverlay'));
        if (e.key === 'Tab') return;
    }

    if (document.getElementById('settingsOverlay').classList.contains('open')) {
        if (e.key === 'Escape') {
            closeSettings();
            return;
        }
        trapFocus(e, document.getElementById('settingsOverlay'));
        if (e.key === 'Tab') return;
    }

    if (document.getElementById('feedbackOverlay').classList.contains('open')) {
        if (e.key === 'Escape') {
            closeFeedback();
            return;
        }
        trapFocus(e, document.getElementById('feedbackOverlay'));
        if (e.key === 'Tab') return;
    }

    if (document.getElementById('loginOverlay').classList.contains('open')) {
        if (e.key === 'Escape') {
            closeLogin();
            return;
        }
        if (e.key === 'Enter' && e.target.id === 'loginUsername' && !e.isComposing) {
            e.preventDefault();
            doAuth();
            return;
        }
        trapFocus(e, document.getElementById('loginOverlay'));
        if (e.key === 'Tab') return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
    }
});

// 侧边栏键盘导航
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
        const focused = document.activeElement;
        if (focused && focused.closest && (focused.closest('.sub-chapter') || focused.closest('.chapter-title') || focused.closest('.sub-directory'))) {
            e.preventDefault();
            focused.click();
        }
    }
});

// ==================== 阅读进度条 ====================
var _mainEl, _progressFill, _backBtn;
var _scrollTicking = false;
var _lastScrollY = 0;

function cacheDom() {
    _mainEl = document.querySelector('.main-content');
    _progressFill = document.querySelector('.reading-progress-fill');
    _backBtn = document.getElementById('backToTop');
}

function updateScrollUI() {
    if (!_mainEl) return;
    var scrollTop = _mainEl.scrollTop;
    var scrollHeight = _mainEl.scrollHeight - _mainEl.clientHeight;

    // Progress bar
    if (_progressFill) {
        var pct = scrollHeight > 0 ? Math.min((scrollTop / scrollHeight) * 100, 100) : 0;
        _progressFill.style.width = pct + '%';
    }

    // Back-to-top visibility (only toggle when crossing threshold)
    if (_backBtn) {
        if (scrollTop > 400 && _lastScrollY <= 400) {
            _backBtn.classList.add('visible');
        } else if (scrollTop <= 400 && _lastScrollY > 400) {
            _backBtn.classList.remove('visible');
        }
    }

    _lastScrollY = scrollTop;
    _scrollTicking = false;
}

function onScroll() {
    if (!_scrollTicking) {
        requestAnimationFrame(updateScrollUI);
        _scrollTicking = true;
    }
}

function scrollToTop() {
    if (_mainEl) {
        _mainEl.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
}

// 绑定滚动事件
function bindScrollEvents() {
    cacheDom();
    if (!_mainEl) return;
    _mainEl.addEventListener('scroll', onScroll, { passive: true });
}

// 启动
document.addEventListener('DOMContentLoaded', function() {
    init().catch(function(error) {
        document.getElementById('chapterList').textContent = '加载失败：' + error.message;
    });
    bindScrollEvents();
});

// Reader namespace
window.Reader.init = init;
window.Reader.loadFlat = loadFlat;
window.scrollToTop = scrollToTop;
