/** Whole-reader direction. Native fullscreen when available, local rotation otherwise. */
window.Reader = window.Reader || {};
Reader.viewport = (() => {
    const host = document.getElementById('readerScreen');
    const surface = document.getElementById('readerViewport');
    const touch = matchMedia('(any-pointer: coarse)');
    let width = innerWidth, height = innerHeight, rotated = false;
    let revision = 0, ownedFullscreen = false, enteringFullscreen = null, nativeLock = false;
    const direction = () => Reader.settings.readingDirection;
    const mobile = () => width <= 768 || (width <= 1024 && height <= 500);
    const syncButton = () => {
        const landscape = width > height;
        const button = document.getElementById('toggleOrientation');
        button.textContent = landscape ? '切换为竖屏' : '切换为横屏';
        button.disabled = !touch.matches;
        document.getElementById('orientationStatus').textContent = touch.matches
            ? '当前为' + (landscape ? '横屏' : '竖屏') + '，切换作用于整个阅读界面。'
            : '手机和平板可使用此按钮切换整个阅读界面的方向。';
    };
    const point = ({clientX, clientY}) => rotated ? {x: clientY, y: innerWidth - clientX} : {x: clientX, y: clientY};
    const rect = element => {
        const box = element.getBoundingClientRect();
        return rotated ? {left: box.top, top: innerWidth - box.right, width: box.height, height: box.width} : box;
    };
    function apply() {
        const wanted = direction();
        rotated = touch.matches && wanted && (wanted === 'landscape' ? innerHeight > innerWidth : innerWidth > innerHeight);
        width = rotated ? innerHeight : innerWidth;
        height = rotated ? innerWidth : innerHeight;
        surface.classList.toggle('is-rotated', !!rotated);
        surface.style.width = width + 'px';
        surface.style.height = height + 'px';
        syncButton();
        const sidebar = document.getElementById('sidebar');
        // A desktop drawer can be open when the settings button changes to a
        // narrow layout. Keep it below the active settings/search/login panel.
        if (mobile() && document.querySelector('.settings-overlay.open, .search-overlay.open, .feedback-overlay.open, .login-overlay.open')) {
            if (!sidebar.classList.contains('collapsed')) {
                sidebar.classList.add('collapsed');
                const expand = document.getElementById('btnExpandSidebar');
                expand._shouldShow = true;
                Reader.storage.setItem('reader_sidebar_collapsed', '1');
            }
        }
        document.getElementById('sidebarBackdrop').classList.toggle('visible', mobile() && !sidebar.classList.contains('collapsed'));
        window.dispatchEvent(new Event('readerlayoutchange'));
    }
    const unlock = () => {
        if (nativeLock) { try { screen.orientation.unlock(); } catch (_) {} nativeLock = false; }
    };
    async function toggle() {
        const wanted = width > height ? 'portrait' : 'landscape';
        Reader.settings.readingDirection = wanted;
        saveSettings();
        const request = ++revision;
        apply();
        if (!touch.matches || !document.fullscreenEnabled || !host.requestFullscreen
                || typeof screen.orientation?.lock !== 'function') return;
        try {
            if (!document.fullscreenElement) {
                if (!enteringFullscreen) enteringFullscreen = host.requestFullscreen().finally(() => { enteringFullscreen = null; });
                await enteringFullscreen;
            }
            if (request !== revision || document.fullscreenElement !== host) return;
            nativeLock = true;
            await screen.orientation.lock(wanted);
            if (request !== revision && !document.fullscreenElement) { nativeLock = true; unlock(); }
        } catch (_) { /* The local reader surface already has the requested direction. */ }
    }
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement === host) { ownedFullscreen = true; apply(); }
        else if (ownedFullscreen && !document.fullscreenElement) {
            ownedFullscreen = false;
            ++revision;
            unlock();
            Reader.settings.readingDirection = null;
            saveSettings();
            apply();
        }
    });
    window.addEventListener('resize', apply);
    touch.addEventListener('change', apply);
    apply();
    return { apply, toggle, syncButton, mobile, point, rect, get width() { return width; },
        get height() { return height; }, get direction() { return direction(); } };
})();
