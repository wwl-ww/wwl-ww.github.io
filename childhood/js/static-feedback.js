/** Optional static-only transport. Never forward live-reader credentials. */
(() => {
    const valid = config => config?.provider === 'formspark' &&
        typeof config.endpoint === 'string' && config.endpoint === config.endpoint.trim() &&
        /^https:\/\/submit-form\.com\/[A-Za-z0-9_-]{1,64}$/.test(config.endpoint);
    const result = (payload, status = 200) => ({ok: status < 400, status, json: async () => payload});
    const failure = (error, status = 400) => result({error}, status);
    Reader.staticFeedback = Object.freeze({
        configure(config) {
            Reader.feedbackNeedsName = !!valid(config);
            document.documentElement.classList.toggle('static-feedback-enabled', Reader.feedbackNeedsName);
        },
        async submit(book, options) {
            if (!valid(book.feedback)) return failure('尚未开启反馈', 503);
            if (options.method !== 'POST') return failure('请使用提交按钮发送反馈', 405);
            let payload;
            try { payload = JSON.parse(options.body); } catch (_) { return failure('反馈格式不正确'); }
            const {path, type, username, content} = payload || {};
            const chapter = flattenTree(book.tree).find(item => item.id === path);
            if (!chapter || !Object.hasOwn(book.chapters, path)) return failure('请先打开一个已开放章节');
            if (typeof username !== 'string' || !username.trim() || username.trim().length > 64)
                return failure('请输入 1–64 字的用户名');
            if (typeof content !== 'string' || !content.trim() || content.trim().length > 10000)
                return failure('请输入 1–10000 字的反馈内容');
            if (!['提议', '意见', '勘误', '投诉', '评论', '补充', '感悟', '提问'].includes(type))
                return failure('请选择反馈类型');
            const submission = {username: username.trim(), content: content.trim(), type,
                chapter_id: path, chapter_name: chapter.title, edition: book.edition};
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            try {
                const reply = await fetch(book.feedback.endpoint, {
                    method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'error',
                    // Domain restriction needs Referer; send only the site's origin.
                    referrerPolicy: 'strict-origin-when-cross-origin', signal: controller.signal,
                    headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
                    body: JSON.stringify(submission)
                });
                const data = await reply.json().catch(() => null);
                if (reply.status === 402) return failure('收件额度已用完，请联系作者', 402);
                if (reply.status === 429) return failure('提交过于频繁，请稍后再试', 429);
                if (reply.status === 403) return failure('收件服务拦截了本次提交，请联系作者检查表单设置', 403);
                // Formspark's JSON response echoes accepted fields. A generic
                // 200 page or another provider's response is not a delivery receipt.
                if (!reply.ok || !data || typeof data !== 'object' || Array.isArray(data) ||
                    !Object.entries(submission).every(([key, value]) => data[key] === value))
                    return failure('收件服务未确认成功，请稍后重试或联系作者', 502);
                return result({chapter_name: chapter.title, type});
            } catch (_) {
                // A lost response can follow a successful delivery. Never retry automatically.
                return failure('未能确认是否送达，内容已保留；请检查网络，避免连续重复提交', 503);
            } finally {
                clearTimeout(timer);
            }
        }
    });
})();
