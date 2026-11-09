/** Infrastructure shared by all UI features: persistence and HTTP. */
window.Reader = window.Reader || {};
Reader.edition = null;
const imageBlobs = new Map();
let imageBlobBytes = 0;
let imageCacheGeneration = 0;
function clearImageCache() {
    ++imageCacheGeneration;
    imageBlobs.clear();
    imageBlobBytes = 0;
}

function rememberImage(key, blob, etag) {
    // Other requests can replace/evict this key while a response is in flight.
    const current = imageBlobs.get(key);
    if (current) { imageBlobs.delete(key); imageBlobBytes -= current.blob.size; }
    if (!etag || blob.size > 16 * 1024 * 1024) return;
    imageBlobs.set(key, {blob, etag}); imageBlobBytes += blob.size;
    while (imageBlobBytes > 16 * 1024 * 1024) {
        const oldest = imageBlobs.keys().next().value;
        imageBlobBytes -= imageBlobs.get(oldest).blob.size;
        imageBlobs.delete(oldest);
    }
}

function editionStorageKey(key) {
    if (['reader_progress', 'reader_last_chapter'].includes(key) && Reader.edition && Reader.edition !== 'legacy') {
        return key + ':' + Reader.edition;
    }
    return key;
}

Reader.storage = Object.freeze({
    getItem(key) {
        try { return localStorage.getItem(editionStorageKey(key)); } catch (_) { return null; }
    },
    setItem(key, value) {
        try { localStorage.setItem(editionStorageKey(key), value); } catch (_) { /* private mode */ }
    },
    removeItem(key) {
        try { localStorage.removeItem(editionStorageKey(key)); } catch (_) { /* private mode */ }
    }
});

Reader.api = Object.freeze({
    async fetch(path, options = {}, responseType = 'json') {
        const controller = new AbortController();
        const abort = () => controller.abort();
        if (options.signal) {
            if (options.signal.aborted) abort();
            else options.signal.addEventListener('abort', abort, { once: true });
        }
        const timeout = setTimeout(() => controller.abort(), 15000);
        const headers = new Headers(options.headers || {});
        if (Reader.edition) headers.set('X-Book-Edition', Reader.edition);
        const token = Reader.state && Reader.state.sessionToken;
        if (token && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
        if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
        try {
            const response = await fetch(path, { ...options, headers, signal: controller.signal });
            // Read while the timeout is active; retain the legacy response interface.
            const payload = response.status === 304 ? null :
                response.ok && responseType === 'blob' ? await response.blob() : await response.json();
            if (response.status === 409 && payload.error === 'edition_changed') {
                clearImageCache();
                // Never retry a write against a different book. Reload metadata
                // and let the reader choose the chapter again.
                window.location.reload();
                throw new Error('书稿已换版，正在刷新');
            }
            return { ok: response.ok, status: response.status, headers: response.headers,
                json: async () => payload, blob: async () => payload };
        } finally {
            clearTimeout(timeout);
            if (options.signal) options.signal.removeEventListener('abort', abort);
        }
    },
    async request(path, options) {
        const response = await this.fetch(path, options);
        const data = await response.json();
        if (!response.ok) throw Object.assign(new Error(data.error || '请求失败'), { status: response.status });
        return data;
    },
    clearImages: clearImageCache,
    async image(path, options = {}) {
        const token = Reader.state && Reader.state.sessionToken;
        const edition = Reader.edition;
        const generation = imageCacheGeneration;
        const isCurrent = () => generation === imageCacheGeneration
            && token === (Reader.state && Reader.state.sessionToken) && edition === Reader.edition;
        const key = JSON.stringify([token, edition, path]);
        const cached = imageBlobs.get(key);
        const headers = new Headers(options.headers || {});
        if (cached) headers.set('If-None-Match', cached.etag);
        const response = await this.fetch(path, { ...options, headers }, 'blob');
        if (!isCurrent()) {
            throw new Error('阅读会话已更新');
        }
        if (response.status === 304 && cached) {
            rememberImage(key, cached.blob, cached.etag);
            return cached.blob;
        }
        if (!response.ok) {
            clearImageCache();
            throw new Error((await response.json()).error || '插画加载失败');
        }
        const blob = await response.blob();
        if (!isCurrent()) throw new Error('阅读会话已更新');
        const etag = response.headers.get('ETag');
        rememberImage(key, blob, etag);
        return blob;
    }
});

Reader.prepareBook = async function() {
    const book = await Reader.api.request('/api/book');
    if (typeof book.edition !== 'string') throw new Error('无法读取书稿版本');
    Reader.edition = book.edition;
};
