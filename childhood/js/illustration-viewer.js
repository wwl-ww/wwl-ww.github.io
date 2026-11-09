/** Immediate preview followed by an authorized full-resolution PNG for inspection/save. */
window.Reader = window.Reader || {};
Reader.illustrationViewer = (() => {
    let dismiss = null;
    let orientationOwner = null;
    function close(restoreFocus = true) { if (dismiss) dismiss(restoreFocus); }

    function open(source, trigger) {
        if (!source.complete || !source.naturalWidth || source.hidden) return;
        close(false);
        const events = new AbortController();
        const on = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: events.signal });
        const dialog = document.createElement('dialog');
        dialog.className = 'illustration-viewer';
        dialog.setAttribute('aria-label', '插画大图');
        const fullscreenHost = document.createElement('div');
        fullscreenHost.className = 'illustration-viewer-host';
        const surface = document.createElement('div');
        surface.className = 'illustration-viewer-surface';
        fullscreenHost.append(surface);
        dialog.append(fullscreenHost);
        let rotated = false, closed = false, hadFullscreen = false, locking = false;
        let originalURL = null, originalRequest = null;
        let downloadPending = false;
        const touchDevice = matchMedia('(any-pointer: coarse)').matches;
        const direction = Reader.viewport.direction || 'landscape';
        const releaseNative = () => {
            if (orientationOwner === surface) {
                try { screen.orientation.unlock(); } catch (_) { /* Unsupported native API. */ }
                if (!locking) orientationOwner = null;
            }
            if (document.fullscreenElement === fullscreenHost) document.exitFullscreen().catch(() => {});
        };
        const toolbar = document.createElement('div');
        toolbar.className = 'illustration-viewer-toolbar';
        const title = document.createElement('span');
        title.className = 'illustration-viewer-title';
        title.textContent = source.alt || '插画';
        const controls = document.createElement('div');
        controls.className = 'illustration-viewer-controls';
        const control = (label, text, action) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.setAttribute('aria-label', label);
            button.title = label;
            button.textContent = text;
            on(button, 'click', action);
            controls.append(button);
            return button;
        };
        const stage = document.createElement('div');
        stage.className = 'illustration-viewer-stage';
        const picture = document.createElement('img');
        picture.src = source.src;
        picture.alt = source.alt;
        picture.draggable = false;
        stage.append(picture);
        const hint = document.createElement('p');
        hint.className = 'illustration-viewer-hint';
        hint.textContent = '滚轮或双指缩放 · 放大后拖动 · 双击还原／放大 · 手机长按图片保存';
        const output = document.createElement('output');
        output.className = 'illustration-viewer-scale';
        output.setAttribute('aria-label', '相对适应屏幕的缩放比例');
        let zoom = 1, x = 0, y = 0, width = 1, height = 1, frameWidth = 1, frameHeight = 1;
        let dragged = false, pinchUsed = false;
        const pointers = new Map();
        const clamp = (value, low, high) => Math.max(low, Math.min(value, high));
        const paint = () => {
            const limitX = Math.max(0, (width * zoom - frameWidth) / 2);
            const limitY = Math.max(0, (height * zoom - frameHeight) / 2);
            x = clamp(x, -limitX, limitX);
            y = clamp(y, -limitY, limitY);
            picture.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${zoom})`;
            stage.classList.toggle('is-zoomed', zoom > 1);
            output.value = Math.round(zoom * 100) + '%';
            minus.disabled = zoom <= 1;
            plus.disabled = zoom >= 6;
        };
        const scaleAt = (next, clientX, clientY) => {
            const bounds = stage.getBoundingClientRect();
            const cx = clientX == null ? 0 : clientX - bounds.left - bounds.width / 2;
            const cy = clientY == null ? 0 : clientY - bounds.top - bounds.height / 2;
            const px = rotated ? cy : cx, py = rotated ? -cx : cy;
            next = clamp(next, 1, 6);
            const ratio = next / zoom;
            x = px - (px - x) * ratio;
            y = py - (py - y) * ratio;
            zoom = next;
            paint();
        };
        const reset = () => { zoom = 1; x = y = 0; paint(); };
        const minus = control('缩小插画', '−', () => scaleAt(zoom / 1.4));
        controls.append(output);
        const plus = control('放大插画', '＋', () => scaleAt(zoom * 1.4));
        control('适应屏幕', '还原', reset);
        const download = document.createElement('a');
        download.className = 'illustration-download';
        download.href = source.dataset.originalEndpoint ? '#' : source.src;
        const filename = (source.dataset.downloadName || source.alt || '插画')
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().replace(/[. ]+$/, '');
        download.download = (Array.from(filename).slice(0, 80).join('') || '插画') + '.png';
        download.textContent = '下载';
        download.setAttribute('aria-label', '下载图片');
        download.title = '下载图片';
        controls.append(download);
        const readyHint = hint.textContent;
        const loadOriginal = () => {
            if (originalRequest) return originalRequest;
            if (!source.dataset.originalEndpoint || originalURL) return Promise.resolve(true);
            hint.textContent = '高清图加载中…';
            download.setAttribute('aria-busy', 'true');
            originalRequest = (async () => {
                try {
                    const blob = await Reader.api.image(source.dataset.originalEndpoint, {signal: events.signal});
                    if (closed) return false;
                    originalURL = URL.createObjectURL(blob);
                    picture.src = originalURL;
                    await picture.decode();
                    if (closed) return false;
                    download.href = originalURL;
                    hint.textContent = readyHint;
                    return true;
                } catch (_) {
                    if (!closed) {
                        if (originalURL) URL.revokeObjectURL(originalURL);
                        originalURL = null;
                        picture.src = source.src;
                        hint.textContent = '高清图加载失败，点击下载重试';
                    }
                    return false;
                } finally {
                    originalRequest = null;
                    download.removeAttribute('aria-busy');
                }
            })();
            return originalRequest;
        };
        on(download, 'click', async event => {
            if (source.dataset.originalEndpoint && download.getAttribute('href') === '#') {
                event.preventDefault();
                if (downloadPending) return;
                downloadPending = true;
                try {
                    if (await loadOriginal() && !closed) download.click();
                } finally { downloadPending = false; }
            }
        });
        const exit = control('关闭大图', '×', () => close());
        toolbar.append(title, controls);
        surface.append(toolbar, stage, hint);
        const scrollHost = document.getElementById('mainContent');
        const scrollTop = scrollHost.scrollTop;
        const oldOverflow = scrollHost.style.overflow;
        dismiss = (restoreFocus) => {
            dismiss = null;
            closed = true;
            events.abort();
            releaseNative();
            dialog.close();
            picture.removeAttribute('src');
            if (originalURL) URL.revokeObjectURL(originalURL);
            originalURL = null;
            dialog.remove();
            scrollHost.style.overflow = oldOverflow;
            scrollHost.scrollTop = scrollTop;
            if (restoreFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
        };
        const layout = () => {
            rotated = touchDevice && (direction === 'landscape' ? innerHeight > innerWidth : innerWidth > innerHeight);
            surface.classList.toggle('is-rotated', rotated);
            const surfaceWidth = rotated ? innerHeight : innerWidth;
            const surfaceHeight = rotated ? innerWidth : innerHeight;
            surface.classList.toggle('is-compact', touchDevice && surfaceHeight <= 500 && surfaceWidth > surfaceHeight);
            surface.classList.toggle('is-narrow', surfaceWidth <= 600);
            surface.style.width = surfaceWidth + 'px';
            surface.style.height = surfaceHeight + 'px';
            frameWidth = stage.clientWidth;
            frameHeight = stage.clientHeight;
            pointers.clear();
            const fit = Math.min(Math.max(1, frameWidth - 32) / source.naturalWidth,
                Math.max(1, frameHeight - 32) / source.naturalHeight);
            width = source.naturalWidth * fit;
            height = source.naturalHeight * fit;
            picture.style.width = width + 'px';
            picture.style.height = height + 'px';
            reset();
        };
        on(dialog, 'cancel', event => { event.preventDefault(); close(); });
        on(dialog, 'keydown', event => {
            // Keep reader shortcuts and background navigation outside this modal.
            event.stopPropagation();
            if (event.key === 'Tab') { trapFocus(event, dialog); return; }
            if (['+', '='].includes(event.key)) scaleAt(zoom * 1.4);
            else if (event.key === '-') scaleAt(zoom / 1.4);
            else if (['0', 'Home'].includes(event.key)) reset();
            else if (event.key.startsWith('Arrow')) {
                if (event.key === 'ArrowLeft') x += 60;
                if (event.key === 'ArrowRight') x -= 60;
                if (event.key === 'ArrowUp') y += 60;
                if (event.key === 'ArrowDown') y -= 60;
                paint();
            } else return;
            event.preventDefault();
        });
        on(stage, 'wheel', event => {
            event.preventDefault();
            scaleAt(zoom * Math.exp(-clamp(event.deltaY, -250, 250) * .002), event.clientX, event.clientY);
        }, { passive: false });
        on(stage, 'dblclick', event => {
            const bounds = picture.getBoundingClientRect();
            if (event.clientX >= bounds.left && event.clientX <= bounds.right
                    && event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
                scaleAt(zoom > 1 ? 1 : 2.5, event.clientX, event.clientY);
            }
        });
        const geometry = () => {
            const [a, b] = Array.from(pointers.values());
            return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
        };
        on(stage, 'pointerdown', event => {
            if (event.button !== 0) return;
            if (!pointers.size) { dragged = false; pinchUsed = false; }
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pointers.size > 1) pinchUsed = true;
            // Keep the image as the touch target for native long-press saving.
            event.target.setPointerCapture(event.pointerId);
        });
        on(stage, 'pointermove', event => {
            const previous = pointers.get(event.pointerId);
            if (!previous) return;
            const before = pointers.size >= 2 ? geometry() : null;
            const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
            if (Math.abs(dx) + Math.abs(dy) > 2) dragged = true;
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (before) {
                const after = geometry();
                if (before.distance > 0) scaleAt(zoom * after.distance / before.distance, before.x, before.y);
                const mx = after.x - before.x, my = after.y - before.y;
                x += rotated ? my : mx;
                y += rotated ? -mx : my;
            } else if (zoom > 1) { x += rotated ? dy : dx; y += rotated ? -dx : dy; }
            paint();
        });
        const release = event => { pointers.delete(event.pointerId); };
        on(stage, 'pointerup', release);
        on(stage, 'pointercancel', release);
        on(stage, 'lostpointercapture', release);
        on(picture, 'contextmenu', () => {
            // Let the browser show its native image menu; end our gesture only.
            dragged = true;
            for (const id of pointers.keys()) {
                if (picture.hasPointerCapture(id)) picture.releasePointerCapture(id);
            }
            pointers.clear();
        });
        on(stage, 'click', event => {
            // Capture can retarget clicks; actual geometry identifies blank space.
            const bounds = picture.getBoundingClientRect();
            const outside = event.clientX < bounds.left || event.clientX > bounds.right
                || event.clientY < bounds.top || event.clientY > bounds.bottom;
            if (!dragged && !pinchUsed && outside) close();
        });
        on(window, 'resize', layout);
        on(document, 'fullscreenchange', () => {
            if (document.fullscreenElement === fullscreenHost) {
                hadFullscreen = true;
                layout();
            } else if (hadFullscreen) close();
        });
        document.body.append(dialog);
        scrollHost.style.overflow = 'hidden';
        dialog.showModal();
        layout();
        exit.focus();
        loadOriginal();
        // Use the selected native direction when available; rotation is immediate
        // and remains usable if fullscreen/orientation is unavailable or denied.
        if (touchDevice && document.fullscreenEnabled && !document.fullscreenElement
                && fullscreenHost.requestFullscreen && typeof screen.orientation?.lock === 'function') {
            (async () => {
                try {
                    await fullscreenHost.requestFullscreen();
                    if (closed) { releaseNative(); return; }
                    orientationOwner = surface;
                    locking = true;
                    try { await screen.orientation.lock(direction); }
                    finally { locking = false; if (closed) releaseNative(); }
                } catch (_) { /* Keep the viewer's own landscape layout. */ }
            })();
        }
    }
    return Object.freeze({ open, close });
})();
