/**
 * childHood 阅读器 v1.1 - 搜索系统
 */

window.Reader = window.Reader || {};

// ==================== 搜索浮层 ====================
let searchReturnFocus = null;
function openSearch() {
    var overlay = document.getElementById('searchOverlay');
    if (!overlay.contains(document.activeElement)) searchReturnFocus = document.activeElement;
    closeSidebarOnMobile();
    hideFloatingBtns();
    openOverlay(overlay);
    var input = document.getElementById('searchInput');
    input.focus();
    input.select();
}

let searchRequest = 0;

function closeSearch() {
    ++searchRequest;
    clearTimeout(searchTimer);
    var overlay = document.getElementById('searchOverlay');
    const returnFocus = searchReturnFocus;
    closeOverlay(overlay, function() {
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
        document.getElementById('searchStats').style.display = 'none';
        showFloatingBtns();
        if (document.querySelector('.settings-overlay.open, .feedback-overlay.open, .login-overlay.open')) return;
        const canFocus = el => el && el.isConnected && !el.closest('[inert]')
            && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
        const fallback = document.getElementById('sidebar').classList.contains('collapsed')
            ? document.getElementById('btnExpandSidebar') : document.getElementById('mainContent');
        const target = canFocus(returnFocus) ? returnFocus : fallback;
        if (canFocus(target)) target.focus({ preventScroll: true });
    });
}

function handleQuickSearchKey(e) {
    if (e.key === 'Escape') closeSearch();
}

async function doSearch(q) {
    const requestId = ++searchRequest;
    try {
        const res = await Reader.api.fetch('/api/search?q=' + encodeURIComponent(q), { headers: getAuthHeaders() });
        const data = await res.json();
        if (requestId !== searchRequest) return;
        if (!res.ok) throw new Error(data.error || "搜索失败");

        document.getElementById('searchStats').style.display = 'block';
        document.getElementById('searchStats').textContent =
            '找到 ' + data.count + ' 个章节包含 "' + data.query + '"';

        const container = document.getElementById('searchResults');
        if (data.results.length === 0) {
            container.innerHTML = '<div class="search-no-results">没有找到匹配的章节</div>';
            return;
        }

        container.replaceChildren();
        for (const r of data.results) {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.tabIndex = 0;
            item.setAttribute('role', 'button');
            item.addEventListener('click', () => searchResultClick(r.id, r.path, r.title, r.number));
            item.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    item.click();
                }
            });
            const title = document.createElement('div');
            title.className = 'search-result-title';
            title.textContent = r.number + ' ' + r.title + (r.series ? ' (' + r.series + ')' : '');
            const meta = document.createElement('div');
            meta.className = 'search-result-meta';
            meta.textContent = r.word_count.toLocaleString() + ' 字 · ' + r.matches.length + ' 处匹配';
            const snippet = document.createElement('div');
            snippet.className = 'search-result-snippet';
            snippet.innerHTML = r.matches.map(m => escapeHtml(m)
                .replace(/&lt;&lt;&lt;/g, '<span class="hl">')
                .replace(/&gt;&gt;&gt;/g, '</span>')).join('<br>');
            item.append(title, meta, snippet);
            container.appendChild(item);
        }
    } catch(e) {
        if (requestId !== searchRequest) return;
        document.getElementById('searchResults').innerHTML =
            '<div class="search-no-results">搜索失败：' + escapeHtml(e) + '</div>';
    }
}

function searchResultClick(chId, path, title, number) {
    var q = document.getElementById('searchInput').value.trim();
    closeSearch();
    highlightSidebarItem(chId);
    loadChapter(path, title, number, chId, q);
}

function highlightInContent(query) {
    var body = document.querySelector('.markdown-body');
    if (!body || !query) return;

    body.querySelectorAll('mark.search-hl').forEach(function(m) {
        m.replaceWith(m.textContent);
    });

    var regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null, false);
    var textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    var firstMark = null;
    textNodes.forEach(function(node) {
        var parent = node.parentNode;
        if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'MARK') return;
        if (parent.closest('.chapter-header') || parent.closest('.chapter-nav') || parent.closest('.chapter-nav-top')) return;
        const pieces = node.textContent.split(regex);
        if (pieces.length === 1) return;
        const html = pieces.map((piece, i) => i % 2
            ? '<mark class="search-hl">' + escapeHtml(piece) + '</mark>'
            : escapeHtml(piece)).join('');
        var span = document.createElement('span');
        span.innerHTML = html;
        parent.replaceChild(span, node);
        if (!firstMark) firstMark = span.querySelector('mark.search-hl');
    });

    if (firstMark) {
        firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// 搜索输入监听 + 覆盖层关闭
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            ++searchRequest;
            clearTimeout(searchTimer);
            const q = this.value.trim();
            if (q.length === 0) {
                document.getElementById('searchResults').innerHTML = '';
                document.getElementById('searchStats').style.display = 'none';
                return;
            }
            searchTimer = setTimeout(() => doSearch(q), 300);
        });
    }

    const overlay = document.getElementById('searchOverlay');
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === this) closeSearch();
        });
    }
});

// inline onclick 需要这些在 window 上
window.openSearch = openSearch;
window.closeSearch = closeSearch;
window.handleQuickSearchKey = handleQuickSearchKey;
window.searchResultClick = searchResultClick;

// Reader namespace
window.Reader.openSearch = openSearch;
window.Reader.closeSearch = closeSearch;
window.Reader.handleQuickSearchKey = handleQuickSearchKey;
window.Reader.doSearch = doSearch;
window.Reader.searchResultClick = searchResultClick;
window.Reader.highlightInContent = highlightInContent;
