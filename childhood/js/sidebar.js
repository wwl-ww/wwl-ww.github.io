/**
 * childHood 阅读器 v1.1 - 目录树 + 迷你目录 + 侧边栏折叠 + 浮动目录拖拽 + 欢迎页
 */

window.Reader = window.Reader || {};

// ==================== 目录树 ====================
async function loadTree(data = null) {
    try {
        if (!data) {
            const res = await Reader.api.fetch('/api/tree');
            data = await res.json();
        }
        treeData = data.tree;
        document.getElementById('chapterList').innerHTML = generateChapterList(data.tree);
        document.getElementById('stats').innerHTML =
            '<span>' + data.stats.series + '</span> 个系列 | ' +
            '<span>' + data.stats.chapters + '</span> 个章节 | ' +
            '<span>' + data.stats.words.toLocaleString() + '</span> 字';
        const welcomeStats = { welcomeSeries: data.stats.series, welcomeChapters: data.stats.chapters,
            welcomeWords: Math.round(data.stats.words / 1000).toLocaleString() };
        Object.entries(welcomeStats).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        if (currentChapterId) highlightSidebarItem(currentChapterId);
        let saved = null;
        try { saved = JSON.parse(Reader.storage.getItem('reader_progress') || 'null'); } catch (_) {}
        if (!currentChapterId && saved && saved.chapterId && chapterMap[saved.chapterId]) {
            setTimeout(() => highlightSidebar(saved.chapterId), 200);
        }
        updateWelcomeReadingAction();
    } catch(e) {
        document.getElementById('chapterList').innerHTML =
            '<div style="padding:20px;color:#e74c3c;">加载失败：' + escapeHtml(e) + '</div>';
    }
}

function generateChapterList(tree) {
    let html = '';
    for (const chapter of tree) {
        const hasChildren = chapter.children && chapter.children.length > 0;
        const displayTitle = stripFootnotes(chapter.title);
        const fullInfo = (chapter.number || '') + ' ' + displayTitle + ' (' + chapter.word_count.toLocaleString() + '字)';

        if (hasChildren) {
            const allLocked = areAllLeavesLocked(chapter);
            const dirLockIcon = allLocked ? '<span class="lock-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>' : '';
            const dirClickHandler = chapter.page_path ? 'openChapterPage(this.dataset.chapterId, this)' : (allLocked ? 'showLockedNotice()' : 'toggleChapter(this.dataset.chapterId, this)');
            const dirLockedClass = allLocked ? ' locked' : '';
            html += '<div class="chapter-item">' +
                '<div class="chapter-title' + dirLockedClass + '" data-chapter-id="' + escapeHtml(chapter.id) + '" onclick="' + dirClickHandler + '" title="' + escapeHtml(fullInfo) + (allLocked ? ' (未开放)' : '') + '" aria-expanded="false">' +
                    '<div class="chapter-title-content"' + directoryTitleAttributes(chapter, allLocked) + '>' +
                        '<span class="chapter-name-only">' + escapeHtml(displayTitle) + '</span>' +
                        dirLockIcon +
                    '</div>' +
                    directoryToggle(chapter, allLocked) +
                '</div>' +
                generateSubChapters(chapter, 0) +
            '</div>';
        } else {
            const isLocked = chapter.locked;
            const lockIcon = isLocked ? '<span class="lock-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>' : '';
            const clickHandler = isLocked ? 'showLockedNotice()' : 'loadChapterById(this.dataset.chapterId)';
            html += '<div class="chapter-item">' +
                '<div class="chapter-title' + (isLocked ? ' locked' : '') + '" data-chapter-id="' + escapeHtml(chapter.id) + '" onclick="' + clickHandler + '" title="' + escapeHtml(fullInfo) + (isLocked ? ' (未开放)' : '') + '" tabindex="0" role="button">' +
                    '<div class="chapter-title-content">' +
                        '<span class="chapter-name-only">' + escapeHtml(displayTitle) + '</span>' +
                        lockIcon +
                    '</div>' +
                '</div>' +
            '</div>';
        }
    }
    return html;
}

function generateSubChapters(chapter, depth) {
    depth = depth || 0;
    let html = '<div class="sub-chapters" id="sub-' + escapeHtml(chapter.id) + '">';
    for (const sub of chapter.children) {
        const hasChildren = sub.children && sub.children.length > 0;
        const subId = sub.id || 'sub_' + Math.random().toString(36).slice(2);
        const subTitle = String(sub.title || '');
        const displayTitle = stripFootnotes(subTitle) === stripFootnotes(chapter.title) + ' · 正文' ? '正文' : stripFootnotes(subTitle);
        const fullInfo = (sub.number || '') + ' ' + displayTitle + ' (' + (sub.word_count || 0).toLocaleString() + '字)';

        if (hasChildren) {
            const allLocked = areAllLeavesLocked(sub);
            const dirLockIcon = allLocked ? '<span class="lock-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>' : '';
            const dirClickHandler = sub.page_path ? 'event.stopPropagation(); openChapterPage(this.dataset.chapterId, this)' : (allLocked ? 'showLockedNotice()' : 'event.stopPropagation(); toggleChapter(this.dataset.chapterId, this)');
            const dirLockedClass = allLocked ? ' locked' : '';
            html += '<div class="sub-directory' + dirLockedClass + '" data-chapter-id="' + escapeHtml(subId) + '" onclick="' + dirClickHandler + '" title="' + escapeHtml(fullInfo) + (allLocked ? ' (未开放)' : '') + '" aria-expanded="false">' +
                '<div class="chapter-title-content"' + directoryTitleAttributes(sub, allLocked) + '>' +
                    '<span class="chapter-name-only">' + escapeHtml(displayTitle) + '</span>' +
                    dirLockIcon +
                '</div>' +
                directoryToggle(sub, allLocked) +
            '</div>' +
            generateSubChapters(sub, depth + 1);
        } else {
            const isLocked = sub.locked;
            const lockIcon = isLocked ? '<span class="lock-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>' : '';
            const clickHandler = isLocked ? 'showLockedNotice()' : 'loadChapterById(this.dataset.chapterId)';
            html += '<div class="sub-chapter' + (isLocked ? ' locked' : '') + '" data-chapter-id="' + escapeHtml(subId) + '" onclick="' + clickHandler + '" title="' + escapeHtml(fullInfo) + (isLocked ? ' (未开放)' : '') + '" tabindex="0" role="button">' +
                '<div class="chapter-title-content">' +
                    '<span class="chapter-name-only">' + escapeHtml(displayTitle) + '</span>' +
                    lockIcon +
                '</div>' +
            '</div>';
        }
    }
    html += '</div>';
    return html;
}

function directoryTitleAttributes(node, allLocked) {
    return ' role="button" tabindex="0"' + (allLocked ? ' aria-disabled="true"' : '') +
        (node.page_path ? '' : ' aria-expanded="false" aria-controls="sub-' + escapeHtml(node.id) + '"');
}

function directoryToggle(node, allLocked) {
    if (allLocked) return '';
    return '<button type="button" class="directory-toggle" aria-label="展开或收起：' + escapeHtml(stripFootnotes(node.title)) + '" aria-controls="sub-' + escapeHtml(node.id) + '" aria-expanded="false" data-chapter-id="' + escapeHtml(node.id) +
        '" onclick="event.stopPropagation(); toggleChapter(this.dataset.chapterId, this.parentElement)">' +
        '<span class="arrow" id="arrow-' + escapeHtml(node.id) + '"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></span></button>';
}

function setChapterExpanded(id, element, expanded) {
    const sub = document.getElementById('sub-' + id);
    const arrow = document.getElementById('arrow-' + id);
    if (sub) {
        sub.classList.toggle('open', expanded);
        if (arrow) arrow.classList.toggle('open', expanded);
        if (element) {
            element.setAttribute('aria-expanded', String(expanded));
            const toggle = element.querySelector('.directory-toggle');
            if (toggle) toggle.setAttribute('aria-expanded', String(expanded));
            const title = element.querySelector('.chapter-title-content[aria-expanded]');
            if (title) title.setAttribute('aria-expanded', String(expanded));
        }
    }
}

function toggleChapter(id, element) {
    const sub = document.getElementById('sub-' + id);
    if (sub) setChapterExpanded(id, element, !sub.classList.contains('open'));
}

function openChapterPage(id, element) {
    setChapterExpanded(id, element, true);
    return loadChapterById(id);
}

function areAllLeavesLocked(node) {
    if (node.page_path && node.locked !== true) return false;
    if (!node.children || node.children.length === 0) {
        return node.locked === true;
    }
    for (var i = 0; i < node.children.length; i++) {
        if (!areAllLeavesLocked(node.children[i])) {
            return false;
        }
    }
    return true;
}

function highlightSidebar(id) {
    highlightSidebarItem(id);
}

// Arrow keys follow the visible chapter hierarchy without moving into hidden rows.
document.getElementById('chapterList').addEventListener('keydown', function(e) {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    const row = e.target.closest('.chapter-title, .sub-directory, .sub-chapter');
    if (!row) return;
    const rowControl = item => item.querySelector('.chapter-title-content[role="button"]') || item;
    const sub = document.getElementById('sub-' + row.dataset.chapterId);
    let target = null;
    if (e.key === 'ArrowRight' && sub) {
        if (!sub.classList.contains('open')) {
            if (row.querySelector('.directory-toggle')) setChapterExpanded(row.dataset.chapterId, row, true);
        } else {
            target = sub.querySelector('.sub-directory, .sub-chapter');
        }
    } else if (e.key === 'ArrowLeft') {
        if (sub && sub.classList.contains('open')) setChapterExpanded(row.dataset.chapterId, row, false);
        else {
            const parent = row.closest('.sub-chapters');
            target = parent && parent.previousElementSibling;
        }
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        const rows = Array.from(this.querySelectorAll('.chapter-title, .sub-directory, .sub-chapter'))
            .filter(item => item.getClientRects().length > 0);
        const index = rows.indexOf(row);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 :
            Math.max(0, Math.min(rows.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)));
        target = rows[next];
    }
    e.preventDefault();
    if (target) rowControl(target).focus();
});

// ==================== 浮动小节目录 ====================
function buildMiniToc(chId) {
    const toc = document.getElementById('floatingToc');
    if (!settings.miniToc) { toc.style.display = 'none'; return; }

    const ch = chapterMap[chId];
    if (!ch || !treeData) { toc.style.display = 'none'; return; }
    const idParts = chId.split('_');
    if (idParts.length < 2) { toc.style.display = 'none'; return; }
    const parentId = idParts.slice(0, -1).join('_');
    const parentNode = findNodeInTree(treeData, parentId);
    if (!parentNode || !parentNode.children || parentNode.children.length <= 1) {
        toc.style.display = 'none'; return;
    }
    const allLeaves = parentNode.children.every(function(c) { return !c.is_dir; });
    if (!allLeaves) { toc.style.display = 'none'; return; }

    var wasCollapsed = Reader.storage.getItem('reader_toc_collapsed');
    if (wasCollapsed === null) {
        toc.classList.add('collapsed');
    }

    toc.style.display = 'block';
    const list = document.getElementById('floatingTocList');
    let items = '';
    for (const child of parentNode.children) {
        const title = stripFootnotes(child.title || '');
        const isActive = child.id === chId;
        items += '<div class="floating-toc-item' + (isActive ? ' active' : '') + '" role="button" tabindex="0"' + (isActive ? ' aria-current="page"' : '') + ' data-chapter-id="' + escapeHtml(child.id) + '" onclick="event.stopPropagation(); loadChapterById(this.dataset.chapterId)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click();}">' +
            escapeHtml((child.number || '') + ' ' + title) +
        '</div>';
    }
    list.innerHTML = items;
    syncMiniTocControl();
}

function syncMiniTocControl() {
    const toc = document.getElementById('floatingToc');
    const handle = toc && toc.querySelector('.floating-toc-title');
    if (!handle) return;
    const collapsed = toc.classList.contains('collapsed');
    handle.setAttribute('aria-expanded', String(!collapsed));
    handle.setAttribute('aria-label', collapsed ? '展开本节目录' : '收起本节目录');
}

function toggleMiniTocCollapse() {
    var toc = document.getElementById('floatingToc');
    var isCollapsed = toc.classList.toggle('collapsed');
    Reader.storage.setItem('reader_toc_collapsed', isCollapsed ? '1' : '0');
    syncMiniTocControl();
}

(function() {
    var toc = document.getElementById('floatingToc');
    if (toc && Reader.storage.getItem('reader_toc_collapsed') === '1') {
        toc.classList.add('collapsed');
    }
})();

function findNodeInTree(nodes, targetId) {
    for (const node of nodes) {
        if (node.id === targetId) return node;
        if (node.children && node.children.length > 0) {
            const found = findNodeInTree(node.children, targetId);
            if (found) return found;
        }
    }
    return null;
}

// ==================== 侧边栏折叠 ====================
function closeSidebarOnMobile() {
    if (!Reader.viewport.mobile()) return;
    var sidebar = document.getElementById('sidebar');
    if (!sidebar.classList.contains('collapsed')) {
        toggleSidebar();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const expandBtn = document.getElementById('btnExpandSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const focused = document.activeElement;
    const isCollapsed = sidebar.classList.toggle('collapsed');

    if (isCollapsed) {
        expandBtn.classList.remove('btn-hidden');
        backdrop.classList.remove('visible');
    } else {
        expandBtn.classList.add('btn-hidden');
        if (Reader.viewport.mobile()) {
            backdrop.classList.add('visible');
        }
    }

    if (isCollapsed && focused && focused.matches('#sidebar button[aria-label="收起侧边栏"]')) {
        expandBtn.inert = false;
        expandBtn.focus({ preventScroll: true });
    }
    syncSidebarAccessibility();
    if (!isCollapsed && focused === expandBtn) {
        const first = sidebar.querySelector('.chapter-title-content[role="button"], .chapter-title[role="button"]');
        if (first) first.focus({ preventScroll: true });
    }
    Reader.storage.setItem('reader_sidebar_collapsed', isCollapsed ? '1' : '0');
    setTimeout(updateFloatingTocPosition, 350);
}

function syncSidebarAccessibility() {
    const sidebar = document.getElementById('sidebar');
    const expandBtn = document.getElementById('btnExpandSidebar');
    if (!sidebar || !expandBtn) return;
    const collapsed = sidebar.classList.contains('collapsed');
    const overlayOpen = typeof floatingButtonsHidden !== 'undefined' && floatingButtonsHidden;
    expandBtn.classList.toggle('btn-hidden', !collapsed || overlayOpen);
    sidebar.inert = collapsed;
    sidebar.setAttribute('aria-hidden', String(collapsed));
    expandBtn.inert = !collapsed || overlayOpen;
    expandBtn.setAttribute('aria-controls', 'sidebar');
    expandBtn.setAttribute('aria-expanded', String(!collapsed));
}
window.addEventListener('readerlayoutchange', syncSidebarAccessibility);

window.addEventListener('resize', function() {
    if (!Reader.viewport.mobile()) {
        document.getElementById('sidebarBackdrop').classList.remove('visible');
    }
});

function restoreSidebarState() {
    const collapsed = Reader.storage.getItem('reader_sidebar_collapsed');
    document.getElementById('sidebar').classList.toggle('collapsed', collapsed === '1');
    document.getElementById('sidebarBackdrop').classList.toggle('visible', collapsed !== '1' && Reader.viewport.mobile());
    syncSidebarAccessibility();
}

// ==================== 浮动目录拖拽 + 展开/收缩 ====================
(function() {
    var toc = document.getElementById('floatingToc');
    if (!toc) return;

    var handle = toc.querySelector('.floating-toc-title');
    if (!handle) return;

    handle.setAttribute('role', 'button');
    handle.setAttribute('tabindex', '0');
    handle.setAttribute('aria-controls', 'floatingTocList');
    handle.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleMiniTocCollapse();
        }
    });
    syncMiniTocControl();

    var dragging = false;
    var hasMoved = false;
    var suppressClick = false;
    var startX, startY, startLeft, startTop;

    handle.style.cursor = 'grab';

    function getClientXY(e) {
        return Reader.viewport.point(e.touches ? e.touches[0] : e);
    }

    function onDragStart(e) {
        if (e.button !== undefined && e.button !== 0) return;
        if (toc.classList.contains('collapsed')) return;
        suppressClick = true;
        dragging = true;
        hasMoved = false;
        var p = getClientXY(e);
        startX = p.x; startY = p.y;
        var rect = Reader.viewport.rect(toc);
        startLeft = rect.left;
        startTop = rect.top;
        toc.style.transition = 'none';
        handle.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
    }

    function onDragMove(e) {
        if (!dragging) return;
        var p = getClientXY(e);
        var dx = p.x - startX;
        var dy = p.y - startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved = true;

        var newLeft = startLeft + dx;
        var newTop = startTop + dy;

        var sidebar = document.getElementById('sidebar');
        var sidebarWidth = sidebar.classList.contains('collapsed') ? 0 : sidebar.offsetWidth;
        var minLeft = sidebarWidth + 16;
        var maxLeft = Math.max(minLeft, Reader.viewport.width - toc.offsetWidth - 20);
        var minTop = 60;
        var maxTop = Reader.viewport.height - toc.offsetHeight - 20;

        newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
        newTop = Math.max(minTop, Math.min(maxTop, newTop));

        toc.style.left = newLeft + 'px';
        toc.style.top = newTop + 'px';
        toc.style.transform = 'none';
    }

    function onDragEnd() {
        if (!dragging) return;
        dragging = false;
        handle.style.cursor = '';
        document.body.style.userSelect = '';
        toc.style.transition = '';
        if (hasMoved) {
            Reader.storage.setItem('reader_toc_position', JSON.stringify({
                left: toc.style.left,
                top: toc.style.top
            }));
        } else {
            toggleMiniTocCollapse();
        }
        setTimeout(function() { suppressClick = false; }, 0);
    }

    handle.addEventListener('mousedown', onDragStart);
    handle.addEventListener('touchstart', onDragStart, { passive: false });
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchend', onDragEnd);
    document.addEventListener('touchcancel', onDragEnd);

    toc.addEventListener('click', function(e) {
        if (suppressClick) return;
        if (toc.classList.contains('collapsed')) {
            toggleMiniTocCollapse();
        }
    });

    try {
        var saved = JSON.parse(Reader.storage.getItem('reader_toc_position'));
        if (saved && saved.left && saved.top) {
            toc.style.left = saved.left;
            toc.style.top = saved.top;
            toc.style.transform = 'none';
        }
    } catch(e) {}
})();

function updateFloatingTocPosition() {
    var toc = document.getElementById('floatingToc');
    if (!toc || toc.style.display === 'none') return;
    var saved = Reader.storage.getItem('reader_toc_position');
    if (saved) return;
    var sidebar = document.getElementById('sidebar');
    var sidebarWidth = sidebar.classList.contains('collapsed') ? 0 : sidebar.offsetWidth;
    toc.style.left = (sidebarWidth + 32) + 'px';
}

// ==================== 欢迎页 ====================
function openChapterDirectory() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('collapsed')) {
        toggleSidebar();
    }
    const active = sidebar.querySelector('.active .chapter-title-content[role="button"], .active[role="button"]');
    const target = active || sidebar.querySelector('.chapter-title-content[role="button"], .chapter-title[role="button"]');
    if (target) target.focus({ preventScroll: true });
}

function readingStartChapter() {
    var saved = Reader.storage.getItem('reader_last_chapter');
    if (saved) {
        try {
            var last = JSON.parse(saved);
            if (last && last.id && chapterMap[last.id] && !chapterMap[last.id].locked) {
                return { chapter: chapterMap[last.id], resume: true };
            }
        } catch(e) {}
    }
    return { chapter: flatChapters.find(ch => !ch.locked), resume: false };
}

function updateWelcomeReadingAction() {
    const button = document.querySelector('.welcome-menu-item--hero');
    if (!button) return;
    const next = readingStartChapter();
    button.querySelector('.welcome-menu-label').textContent = next.resume ? '继续阅读' : '开始阅读';
    button.querySelector('.welcome-menu-sub').textContent = next.chapter ? stripFootnotes(next.chapter.title) : '暂未开放章节';
    button.disabled = !next.chapter;
}

function startReading() {
    const next = readingStartChapter();
    if (next.chapter) loadChapterById(next.chapter.id);
}

function continueReading() {
    var saved = Reader.storage.getItem('reader_last_chapter');
    if (!saved) return;
    try {
        var last = JSON.parse(saved);
        if (last && last.id) {
            loadChapterById(last.id, last.path, last.title, last.number);
        }
    } catch(e) {}
}

// inline onclick 需要这些在 window 上
window.toggleSidebar = toggleSidebar;
window.toggleChapter = toggleChapter;
window.openChapterPage = openChapterPage;
window.openChapterDirectory = openChapterDirectory;
window.startReading = startReading;

// Reader namespace
window.Reader.loadTree = loadTree;
window.Reader.generateChapterList = generateChapterList;
window.Reader.generateSubChapters = generateSubChapters;
window.Reader.toggleChapter = toggleChapter;
window.Reader.areAllLeavesLocked = areAllLeavesLocked;
window.Reader.highlightSidebar = highlightSidebar;
window.Reader.buildMiniToc = buildMiniToc;
window.Reader.toggleMiniTocCollapse = toggleMiniTocCollapse;
window.Reader.findNodeInTree = findNodeInTree;
window.Reader.closeSidebarOnMobile = closeSidebarOnMobile;
window.Reader.toggleSidebar = toggleSidebar;
window.Reader.restoreSidebarState = restoreSidebarState;
window.Reader.updateFloatingTocPosition = updateFloatingTocPosition;
window.Reader.openChapterDirectory = openChapterDirectory;
window.Reader.startReading = startReading;
window.Reader.continueReading = continueReading;
