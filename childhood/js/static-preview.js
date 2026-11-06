/** Static export adapter; only included by export-static, never by the live reader. */
(() => {
    let pendingBook;
    const book = () => pendingBook || (pendingBook = fetch('book.json').then(response => {
        if (!response.ok) throw new Error('无法加载阅读内容');
        return response.json();
    }).catch(error => { pendingBook = null; throw error; }));
    const response = (payload, status = 200) => ({ok: status < 400, status,
        headers: new Headers(), json: async () => payload});
    Reader.api = Object.freeze({
        clearImages() {},
        async fetch(path) {
            const data = await book();
            const url = new URL(path, location.origin);
            const id = url.searchParams.get('path');
            switch (url.pathname) {
            case '/api/bootstrap':
                return response({edition: data.edition, tree: data.tree, stats: data.stats, user: null});
            case '/api/book': return response({edition: data.edition});
            case '/api/tree': return response({tree: data.tree, stats: data.stats});
            case '/api/flat': return response(flattenTree(data.tree));
            case '/api/load': return data.chapters[id] ? response(data.chapters[id]) : response({error: 'not found'}, 404);
            case '/api/achievements': return response({achievements: [], all: []});
            case '/api/search': {
                const query = (url.searchParams.get('q') || '').trim();
                const results = [];
                if (query) for (const chapter of flattenTree(data.tree)) {
                    const text = data.chapters[chapter.id].search_text;
                    const position = text.toLowerCase().indexOf(query.toLowerCase());
                    if (position >= 0) results.push({...chapter, matches: [
                        text.slice(Math.max(0, position - 30), position) + '<<<' +
                        text.slice(position, position + query.length) + '>>>' +
                        text.slice(position + query.length, position + query.length + 30)]});
                }
                return response({query, results, count: results.length});
            }
            default: return response({error: '临时阅读版不提供此功能'}, 404);
            }
        },
        async request(path, options) {
            const result = await this.fetch(path, options);
            const data = await result.json();
            if (!result.ok) throw new Error(data.error);
            return data;
        },
        async image(path, options = {}) {
            const data = await book();
            const url = new URL(path, location.origin);
            const id = url.searchParams.get('path');
            if (!data.chapters[id]?.illustration) throw new Error('插画不存在');
            const variant = url.searchParams.get('variant');
            const suffix = variant === 'preview-768' ? '-768.webp' : variant === 'preview-1280' ? '-1280.webp' : '.png';
            const result = await fetch('media/' + encodeURIComponent(id) + suffix, {signal: options.signal});
            if (!result.ok) throw new Error('插画加载失败');
            return result.blob();
        }
    });
    // Static readers have no account or remote write endpoint.
    restoreToken = function() { sessionToken = null; };
    applyAuthUser = function() {
        currentUser = sessionToken = null;
        document.getElementById('welcomeActionsGrid').style.display = 'flex';
    };
    const storage = Reader.storage;
    const storageKey = key => 'static_' +
        (['reader_progress', 'reader_last_chapter'].includes(key) ? Reader.edition + ':' : '') + key;
    Reader.storage = Object.freeze({
        getItem: key => storage.getItem(storageKey(key)),
        setItem: (key, value) => storage.setItem(storageKey(key), value),
        removeItem: key => storage.removeItem(storageKey(key))
    });
})();
