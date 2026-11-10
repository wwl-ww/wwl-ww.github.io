/**
 * childHood 阅读器 v1.1 - 章节加载 + 导航 + 脚注面板
 */

window.Reader = window.Reader || {};

let chapterRequest = 0;
let illustrationController = null;
let illustrationURL = null;

function clearChapterView() {
    Reader.illustrationViewer.close(false);
    ++chapterRequest;
    if (illustrationController) illustrationController.abort();
    illustrationController = null;
    if (illustrationURL) URL.revokeObjectURL(illustrationURL);
    illustrationURL = null;
    currentChapterId = currentChapterPath = currentChapterTitle = currentChapterNumber = null;
    pendingChapter = null;
    document.getElementById('footnotePanelContent').innerHTML = '';
    document.getElementById('footnotePanel').style.display = 'none';
    document.getElementById('footnoteToggle').style.display = 'none';
    document.getElementById('footnoteToggle').classList.remove('show');
    document.getElementById('footnoteToggle').setAttribute('aria-expanded', 'false');
    document.getElementById('footnoteToggle')._shouldShow = false;
    document.getElementById('footnoteBackdrop').classList.remove('visible');
    document.getElementById('floatingToc').style.display = 'none';
    document.querySelector('.content-wrapper').classList.remove('opener-page', 'article-page');
    document.querySelector('.content-wrapper').innerHTML = '';
}

// ==================== 加载章节 ====================
async function loadChapter(path, title, number, chId, searchQuery) {
    clearChapterView();
    const requestId = ++chapterRequest;
    var contentWrapper = document.querySelector('.content-wrapper');
    contentWrapper.innerHTML = '<div class="loading">加载中</div>';

    highlightSidebarItem(chId);

    try {
        const encoded = encodeURIComponent(path);
        var fetchOpts = {};
        if (sessionToken) {
            fetchOpts.headers = { 'Authorization': 'Bearer ' + sessionToken };
        }
        const res = await Reader.api.fetch('/api/load?path=' + encoded, fetchOpts);
        const data = await res.json();
        if (requestId !== chapterRequest) return;

        if (data.error) {
            if (data.error === 'auth_required') {
                pendingChapter = { path: path, title: title, number: number, chId: chId };
                contentWrapper.innerHTML =
                    '<div class="locked-notice">' +
                        '<div class="locked-icon">' +
                            '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                        '</div>' +
                        '<h2>请先登录</h2>' +
                        '<p>登录后即可阅读已开放的内容</p>' +
                        '<button class="welcome-btn" onclick="openLogin()" style="margin-top:20px">起个名字吧</button>' +
                    '</div>';
                return;
            }
            if (data.error === 'locked') {
                contentWrapper.innerHTML =
                    '<div class="locked-notice">' +
                        '<div class="locked-icon">' +
                            '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
                        '</div>' +
                        '<h2>此章节暂未开放</h2>' +
                        '<p>该章节尚未对读者开放，敬请期待。</p>' +
                    '</div>';
            } else {
                showChapterError(contentWrapper, () => loadChapter(path, title, number, chId, searchQuery));
            }
            return;
        }

        document.title = (number || '') + ' ' + title + ' - childHood';
        if (Reader.viewport.mobile()) {
            var sidebar = document.getElementById('sidebar');
            if (!sidebar.classList.contains('collapsed')) {
                toggleSidebar();
            }
        }

        currentChapterId = chId;
        currentChapterPath = path;
        currentChapterTitle = title;
        currentChapterNumber = number;

        const topNav = chId ? buildTopNavHtml(chId) : '';
        const bottomNav = chId ? buildNavHtml(chId) : '';
        const cleanTitle = (data.illustration ? data.illustration.chapter_title : title).replace(/^\d+(\.\d+)*\s+/, '');

        contentWrapper.innerHTML =
            (data.is_opener ? '' : topNav) +
            '<div class="chapter-header">' +
                '<div class="chapter-header-top">' +
                    '<div>' +
                        '<div class="chapter-number">' + escapeHtml(number || '') + '</div>' +
                        '<h1>' + escapeHtml(cleanTitle) + '</h1>' +
                    '</div>' +
                    '<div class="chapter-toolbar">' +
                        '<button class="toolbar-icon-btn" onclick="openChapterDirectory()" title="目录" aria-label="目录">' +
                            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>' +
                        '</button>' +
                        '<button class="toolbar-icon-btn" onclick="openSearch()" title="搜索" aria-label="搜索">' +
                            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
                        '</button>' +
                        '<button class="toolbar-icon-btn" onclick="openSettings()" title="设置" aria-label="设置">' +
                            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
                        '</button>' +
                        '<button class="feedback-inline-btn" onclick="openFeedback()" title="提交意见" aria-label="提交意见">' +
                            '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="word-count-badge">' + (data.is_opener ? '本章首页' : (data.illustration ? '章首 · 图与文' : (data.word_count || 0).toLocaleString() + ' 字')) + '</div>' +
            '</div>' +
            (data.is_opener ? '' : '<div class="markdown-body">' + data.html + '</div>') +
            bottomNav;

        if (!data.is_opener) {
            contentWrapper.classList.add('article-page');
            const header = contentWrapper.querySelector('.chapter-header');
            const metadata = document.createElement('div');
            metadata.className = 'chapter-meta-row';
            metadata.append(header.querySelector('.word-count-badge'), header.querySelector('.chapter-toolbar'));
            header.append(metadata);
        }

        if (data.illustration) {
            const figure = buildIllustratedOpener(data.illustration);
            if (data.is_opener) {
                buildOpenerPage(contentWrapper, figure, chId, cleanTitle);
            } else {
                contentWrapper.querySelector('.chapter-header').after(figure);
            }
            loadIllustration(figure, path, requestId, fetchOpts);
        }

        if (data.footnotes) {
            var panel = document.getElementById('footnotePanel');
            var panelContent = document.getElementById('footnotePanelContent');
            panelContent.innerHTML = data.footnotes;
            panel.style.display = 'block';
            syncFootnoteLayout(true);
        } else {
            document.getElementById('footnotePanel').style.display = 'none';
            document.getElementById('footnoteToggle').style.display = 'none';
        }

        buildMiniToc(chId);
        document.getElementById('mainContent').scrollTop = 0;

        if (searchQuery) {
            highlightInContent(searchQuery);
        }

        Reader.storage.setItem('reader_last_chapter', JSON.stringify({
            id: chId, path: path, title: title, number: number || ''
        }));

        if (currentUser && chId) {
            recordReading(chId, data.word_count || 0);
        }

    } catch(e) {
        if (requestId !== chapterRequest) return;
        showChapterError(contentWrapper, () => loadChapter(path, title, number, chId, searchQuery));
    }
}

function showChapterError(wrapper, retry) {
    wrapper.replaceChildren();
    const notice = document.createElement('div');
    notice.className = 'reading-state';
    notice.setAttribute('role', 'alert');
    const heading = document.createElement('h2');
    heading.textContent = '这一节暂时未能打开';
    const detail = document.createElement('p');
    detail.textContent = '请检查网络连接后重试。';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '重新加载';
    button.addEventListener('click', retry);
    notice.append(heading, detail, button);
    wrapper.append(notice);
}

function buildOpenerPage(wrapper, figure, chId, title) {
    wrapper.classList.add('opener-page');
    const header = wrapper.querySelector('.chapter-header');
    const bar = document.createElement('div');
    bar.className = 'opener-bar';
    const series = document.createElement('span');
    series.className = 'opener-series';
    const chapter = chapterMap[chId];
    series.textContent = chapter && chapter.series ? chapter.series : '';
    bar.append(series, header.querySelector('.chapter-toolbar'));
    header.before(bar);
    const titleParts = title.match(/^(第[^\s]+章)\s*(.+)$/u);
    if (titleParts) {
        header.querySelector('.chapter-number').textContent = titleParts[1];
        header.querySelector('h1').textContent = titleParts[2];
    }
    header.querySelector('.word-count-badge').remove();
    const spread = document.createElement('div');
    spread.className = 'opener-spread';
    spread.append(figure, buildChapterContents(chId));
    header.after(spread);
}

function buildChapterContents(chId) {
    const section = document.createElement('nav');
    section.className = 'chapter-contents toc-surface';
    section.setAttribute('aria-labelledby', 'chapter-contents-heading');
    const masthead = document.createElement('div');
    masthead.className = 'chapter-contents-heading';
    const heading = document.createElement('h2');
    heading.id = 'chapter-contents-heading';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'chapter-contents-toggle';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-controls', 'chapter-contents-list');
    toggle.setAttribute('aria-label', '收起本章目录');
    const headingText = document.createElement('span');
    headingText.textContent = '本章目录';
    const node = findNodeInTree(treeData || [], chId);
    const children = node ? node.children : [];
    const count = document.createElement('span');
    count.className = 'chapter-contents-count';
    count.textContent = children.length + ' 节';
    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('viewBox', '0 0 20 20');
    chevron.setAttribute('width', '16');
    chevron.setAttribute('height', '16');
    chevron.setAttribute('aria-hidden', 'true');
    chevron.classList.add('chapter-contents-chevron');
    const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    chevronPath.setAttribute('d', 'm5 7 5 5 5-5');
    chevronPath.setAttribute('fill', 'none');
    chevronPath.setAttribute('stroke', 'currentColor');
    chevronPath.setAttribute('stroke-width', '1.5');
    chevronPath.setAttribute('stroke-linecap', 'round');
    chevronPath.setAttribute('stroke-linejoin', 'round');
    chevron.append(chevronPath);
    toggle.append(headingText, count, chevron);
    heading.append(toggle);
    masthead.append(heading);
    const list = document.createElement('ol');
    list.id = 'chapter-contents-list';
    list.className = 'chapter-contents-list';
    toggle.addEventListener('click', () => {
        list.hidden = !list.hidden;
        toggle.setAttribute('aria-expanded', String(!list.hidden));
        toggle.setAttribute('aria-label', list.hidden ? '展开本章目录' : '收起本章目录');
        section.classList.toggle('is-collapsed', list.hidden);
    });
    section.append(masthead, list);
    let storyIndex = 0;
    for (const child of children) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        const locked = child.is_dir ? areAllLeavesLocked(child) : child.locked;
        const label = document.createElement('span');
        label.className = 'chapter-contents-title';
        const title = stripFootnotes(child.title);
        const introTitle = stripFootnotes(node.title) + ' · 引言';
        const bodyTitle = stripFootnotes(node.title) + ' · 正文';
        label.textContent = title === introTitle ? '章前言' : (title === bodyTitle ? '正文' : title);
        const order = document.createElement('span');
        order.className = 'chapter-contents-order';
        order.setAttribute('aria-hidden', 'true');
        order.textContent = title === introTitle ? '序' : String(++storyIndex).padStart(2, '0');
        button.setAttribute('aria-label', label.textContent + (locked ? '，未开放' : ''));
        button.append(order, label);
        if (locked) {
            button.classList.add('is-locked');
            const status = document.createElement('span');
            status.className = 'chapter-contents-status';
            status.textContent = '未开放';
            button.append(status);
        } else {
            const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            arrow.setAttribute('viewBox', '0 0 20 20');
            arrow.setAttribute('width', '18');
            arrow.setAttribute('height', '18');
            arrow.setAttribute('aria-hidden', 'true');
            arrow.classList.add('chapter-contents-arrow');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M4 10h11m-4-4 4 4-4 4');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'currentColor');
            path.setAttribute('stroke-width', '1.2');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            arrow.append(path);
            button.append(arrow);
        }
        button.addEventListener('click', () => {
            list.querySelectorAll('.is-selected').forEach(entry => entry.classList.remove('is-selected'));
            button.classList.add('is-selected');
            if (locked) return showLockedNotice();
            if (chapterMap[child.id]) return loadChapterById(child.id);
            openChapterDirectory();
            const element = Array.from(document.querySelectorAll('[data-chapter-id]')).find(el => el.dataset.chapterId === child.id);
            setChapterExpanded(child.id, element, true);
        });
        item.append(button);
        list.append(item);
    }
    return section;
}

function buildIllustratedOpener(art) {
    const figure = document.createElement('figure');
    figure.className = 'chapter-illustration';
    const frame = document.createElement('div');
    frame.className = 'illustration-frame';
    frame.style.aspectRatio = art.width + ' / ' + art.height;
    const picture = document.createElement('img');
    picture.alt = art.alt;
    picture.dataset.downloadName = art.chapter_title || art.alt || '插画';
    picture.width = art.width;
    picture.height = art.height;
    picture.decoding = 'async';
    picture.hidden = true;
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'illustration-open';
    open.setAttribute('aria-label', '查看插画大图');
    open.title = '点击查看大图';
    open.disabled = true;
    const hint = document.createElement('span');
    hint.className = 'illustration-open-hint';
    hint.textContent = '查看大图';
    hint.setAttribute('aria-hidden', 'true');
    open.append(picture, hint);
    let nativeMenuAt = -Infinity;
    picture.addEventListener('contextmenu', () => { nativeMenuAt = performance.now(); });
    open.addEventListener('click', () => {
        // Some touch browsers send a click when dismissing the native image menu.
        if (performance.now() - nativeMenuAt > 1000) Reader.illustrationViewer.open(picture, open);
    });
    const status = document.createElement('div');
    status.className = 'illustration-status';
    status.setAttribute('role', 'status');
    const caption = document.createElement('figcaption');
    caption.className = 'illustration-caption';
    const length = Array.from(art.paragraphs.join('').replace(/\s/g, '')).length;
    figure.classList.add(length <= 100 && art.paragraphs.length <= 2 ? 'caption-short'
        : art.paragraphs.length > 1 ? 'caption-multiple' : 'caption-long');
    art.paragraphs.forEach(text => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        caption.append(paragraph);
    });
    frame.append(open, status);
    figure.append(frame, caption);
    return figure;
}

async function loadIllustration(figure, path, requestId, options) {
    if (requestId !== chapterRequest) return;
    if (illustrationController) illustrationController.abort();
    illustrationController = new AbortController();
    const picture = figure.querySelector('img');
    const status = figure.querySelector('.illustration-status');
    status.textContent = '插画加载中…';
    try {
        const width = figure.clientWidth * Math.min(devicePixelRatio || 1, 2);
        const endpoint = '/api/illustration?path=' + encodeURIComponent(path);
        const blob = await Reader.api.image(endpoint + '&variant=preview-' + (width <= 768 ? '768' : '1280'),
            { ...options, signal: illustrationController.signal });
        if (requestId !== chapterRequest || !figure.isConnected) return;
        if (illustrationURL) URL.revokeObjectURL(illustrationURL);
        illustrationURL = URL.createObjectURL(blob);
        picture.src = illustrationURL;
        picture.dataset.originalEndpoint = endpoint;
        await picture.decode();
        if (requestId !== chapterRequest || !figure.isConnected) return;
        picture.hidden = false;
        figure.querySelector('.illustration-open').disabled = false;
        status.hidden = true;
    } catch (_) {
        if (requestId !== chapterRequest || !figure.isConnected) return;
        status.replaceChildren(document.createTextNode('插画暂时未能加载，配文仍可阅读。'));
        const retry = document.createElement('button');
        retry.textContent = '重试插画';
        retry.addEventListener('click', () => loadIllustration(figure, path, requestId, options));
        status.append(retry);
    }
}

function loadChapterById(chId) {
    const chapter = chapterMap[chId];
    if (!chapter) return;
    if (chapter.locked) return showLockedNotice();
    return loadChapter(chapter.path, chapter.title, chapter.number, chId);
}

function showLockedNotice() {
    clearChapterView();
    var contentWrapper = document.querySelector('.content-wrapper');
    contentWrapper.innerHTML =
        '<div class="locked-notice">' +
            '<div class="locked-icon">' +
                '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
            '</div>' +
            '<h2>此章节暂未开放</h2>' +
            '<p>该章节尚未对读者开放，敬请期待。</p>' +
        '</div>';
}

function buildTopNavHtml(chId) {
    const ch = chapterMap[chId];
    if (!ch) return '';
    const prev = ch.prev ? chapterMap[ch.prev] : null;
    const next = ch.next ? chapterMap[ch.next] : null;

    let html = '<nav class="chapter-nav-top" aria-label="章节快捷翻页">';
    html += '<button type="button"' + (prev ? ' title="' + escapeHtml(prev.title || '') + '" data-chapter-id="' + escapeHtml(prev.id) + '" onclick="navigateFromNav(this.dataset.chapterId)"' : ' disabled') + '>← 上一篇</button>';
    html += '<span class="nav-sep">' + (ch.index + 1) + ' / ' + ch.total + '</span>';
    html += '<button type="button"' + (next ? ' title="' + escapeHtml(next.title || '') + '" data-chapter-id="' + escapeHtml(next.id) + '" onclick="navigateFromNav(this.dataset.chapterId)"' : ' disabled') + '>下一篇 →</button>';
    html += '</nav>';
    return html;
}

function buildNavHtml(chId) {
    const ch = chapterMap[chId];
    if (!ch) return '';
    const prev = ch.prev ? chapterMap[ch.prev] : null;
    const next = ch.next ? chapterMap[ch.next] : null;


    return '<nav class="chapter-nav" aria-label="相邻章节">' +
        '<button type="button"' + (prev ? ' data-chapter-id="' + escapeHtml(prev.id) + '" onclick="navigateFromNav(this.dataset.chapterId)"' : ' disabled') + '>' +
            '<span class="nav-label">← 上一篇</span>' +
            '<span class="nav-title">' + (prev ? escapeHtml((prev.number || '') + ' ' + (prev.title || '')) : '已是第一篇') + '</span>' +
        '</button>' +
        '<span class="progress-indicator">' + (ch.index + 1) + ' / ' + ch.total + '</span>' +
        '<button type="button"' + (next ? ' data-chapter-id="' + escapeHtml(next.id) + '" onclick="navigateFromNav(this.dataset.chapterId)"' : ' disabled') + '>' +
            '<span class="nav-label">下一篇 →</span>' +
            '<span class="nav-title">' + (next ? escapeHtml((next.number || '') + ' ' + (next.title || '')) : '已是最后一篇') + '</span>' +
        '</button>' +
    '</nav>';
}

function navigateFromNav(chId) {
    return loadChapterById(chId);
}

function highlightSidebarItem(chId) {
    document.querySelectorAll('.chapter-title, .sub-chapter, .sub-directory, .floating-toc-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.chapter-title [aria-current], .chapter-title[aria-current], .sub-directory [aria-current], .sub-directory[aria-current], .sub-chapter[aria-current], .floating-toc-item[aria-current]').forEach(el => el.removeAttribute('aria-current'));
    var allItems = document.querySelectorAll('.chapter-title[data-chapter-id], .sub-directory[data-chapter-id], .sub-chapter[data-chapter-id], .floating-toc-item[data-chapter-id]');
    for (var i = 0; i < allItems.length; i++) {
        var el = allItems[i];
        if (el.dataset.chapterId === chId) {
            el.classList.add('active');
            (el.querySelector('.chapter-title-content[role="button"]') || el).setAttribute('aria-current', 'page');
            if (chapterMap[chId] && chapterMap[chId].is_opener) setChapterExpanded(chId, el, true);
            var parent = el.closest('.sub-chapters');
            while (parent) {
                var parentId = parent.id.replace('sub-', '');
                setChapterExpanded(parentId, parent.previousElementSibling, true);
                parent = parent.parentElement.closest('.sub-chapters');
            }
        }
    }
}

// ==================== 脚注栏折叠 ====================
let footnoteMobileLayout = null;
function syncFootnoteLayout(force = false) {
    const panel = document.getElementById('footnotePanel');
    if (!document.getElementById('footnotePanelContent').textContent.trim()) return;
    const compactNotes = Reader.viewport.width <= 1024;
    if (!force && footnoteMobileLayout === compactNotes) return;
    footnoteMobileLayout = compactNotes;
    document.getElementById('footnoteBackdrop').classList.remove('visible');
    var toggle = document.getElementById('footnoteToggle');
    var isMobile = compactNotes;
    if (isMobile) {
        panel.classList.add('collapsed');
        toggle.classList.remove('collapsed');
        toggle.style.display = 'flex';
        toggle.classList.add('show');
        toggle.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></svg>';
        if (!panel.querySelector('.footnote-sheet-close')) {
            var closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'footnote-sheet-close';
            closeBtn.setAttribute('aria-label', '收起注释');
            closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
            closeBtn.onclick = toggleFootnotePanel;
            panel.insertBefore(closeBtn, panel.firstChild);
        }
    } else {
        panel.classList.remove('collapsed');
        panel.querySelector('.footnote-sheet-close')?.remove();
        toggle.classList.remove('collapsed', 'show');
        toggle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
        toggle.style.display = 'flex';
    }
    if (floatingButtonsHidden) toggle.style.display = 'none';
    toggle.setAttribute('aria-expanded', String(!panel.classList.contains('collapsed')));
}
window.addEventListener('readerlayoutchange', () => syncFootnoteLayout());

function toggleFootnotePanel() {
    var panel = document.getElementById('footnotePanel');
    var toggle = document.getElementById('footnoteToggle');
    var backdrop = document.getElementById('footnoteBackdrop');
    var isCollapsed = panel.classList.toggle('collapsed');
    toggle.setAttribute('aria-expanded', String(!isCollapsed));
    if (isCollapsed && panel.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    var isMobile = Reader.viewport.width <= 1024;
    if (!isMobile) {
        toggle.classList.toggle('collapsed', isCollapsed);
    } else {
        if (isCollapsed) {
            backdrop.classList.remove('visible');
        } else {
            backdrop.classList.add('visible');
        }
    }
    setTimeout(updateFloatingTocPosition, 350);
}

function restoreFootnoteState() {
    // 注释栏默认展开，不记忆折叠状态
}

// 脚注引用点击：手机端展开注释浮层
document.addEventListener('click', function(e) {
    var ref = e.target.closest('.footnote-ref');
    if (!ref) return;
    var panel = document.getElementById('footnotePanel');
    if (!panel || !panel.classList.contains('collapsed')) return;
    var isMobile = Reader.viewport.width <= 1024;
    if (isMobile) {
        e.preventDefault();
        toggleFootnotePanel();
        var href = ref.getAttribute('href');
        if (href) {
            setTimeout(function() {
                var target = panel.querySelector(href);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 350);
        }
    } else {
        toggleFootnotePanel();
    }
});

// inline onclick 需要这些在 window 上
window.loadChapterById = loadChapterById;
window.showLockedNotice = showLockedNotice;
window.navigateFromNav = navigateFromNav;
window.toggleFootnotePanel = toggleFootnotePanel;

// Reader namespace
window.Reader.loadChapter = loadChapter;
window.Reader.loadChapterById = loadChapterById;
window.Reader.showLockedNotice = showLockedNotice;
window.Reader.buildTopNavHtml = buildTopNavHtml;
window.Reader.buildNavHtml = buildNavHtml;
window.Reader.navigateFromNav = navigateFromNav;
window.Reader.highlightSidebarItem = highlightSidebarItem;
window.Reader.toggleFootnotePanel = toggleFootnotePanel;
window.Reader.restoreFootnoteState = restoreFootnoteState;
