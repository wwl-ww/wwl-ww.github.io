/**
 * childHood 阅读器 v1.1 - 反馈系统
 */

window.Reader = window.Reader || {};
let feedbackSession = 0;
let feedbackChapterPath = null;

// ==================== 反馈 ====================
function openFeedback() {
    ++feedbackSession;
    feedbackChapterPath = currentChapterPath;
    const submitBtn = document.querySelector('.feedback-submit');
    submitBtn.disabled = false;
    submitBtn.textContent = '提交';
    closeSidebarOnMobile();
    lastFocusedEl = document.activeElement;
    document.getElementById('feedbackChapter').textContent =
        '章节：' + (currentChapterTitle || '未知');
    var overlay = document.getElementById('feedbackOverlay');
    openOverlay(overlay);
    document.getElementById('feedbackMsg').textContent = '';
    document.getElementById('feedbackContent').value = '';
    document.querySelectorAll('#feedbackTypes .feedback-type-btn').forEach(function(b, i) {
        b.classList.toggle('active', i === 0);
    });
    focusOverlaySoon(overlay, '#feedbackContent');
}

function closeFeedback() {
    ++feedbackSession;
    var overlay = document.getElementById('feedbackOverlay');
    closeOverlay(overlay);
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
        try { lastFocusedEl.focus(); } catch(e) {}
    }
}

async function submitFeedback() {
    var activeType = document.querySelector('#feedbackTypes .feedback-type-btn.active');
    var fbType = activeType ? activeType.getAttribute('data-value') : '提议';
    var fbContent = document.getElementById('feedbackContent').value.trim();
    var msgEl = document.getElementById('feedbackMsg');

    if (!fbContent) {
        msgEl.textContent = '请输入意见内容';
        msgEl.className = 'feedback-msg error';
        return;
    }

    var submitBtn = document.querySelector('.feedback-submit');
    if (submitBtn.disabled) return;
    const requestSession = feedbackSession;
    const requestToken = sessionToken;
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中…';
    msgEl.textContent = '';

    try {
        var res = await Reader.api.fetch('/api/feedback', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                path: feedbackChapterPath,
                type: fbType,
                content: fbContent
            })
        });
        var data = await res.json();
        if (requestSession !== feedbackSession || requestToken !== sessionToken) return;

        if (data.error) {
            msgEl.textContent = data.error;
            msgEl.className = 'feedback-msg error';
        } else {
            msgEl.textContent = '已收到对《' + data.chapter_name + '》的' + data.type;
            msgEl.className = 'feedback-msg success';
            if (data.achievement) {
                showAchievementToast(data.achievement);
            }
            setTimeout(function() {
                if (requestSession === feedbackSession) closeFeedback();
            }, 1500);
        }
    } catch(e) {
        if (requestSession !== feedbackSession || requestToken !== sessionToken) return;
        msgEl.textContent = '提交失败：' + e;
        msgEl.className = 'feedback-msg error';
    } finally {
        if (requestSession === feedbackSession) {
            submitBtn.disabled = false;
            submitBtn.textContent = '提交';
        }
    }
}

// 反馈类型切换 + 覆盖层关闭
document.addEventListener('DOMContentLoaded', function() {
    var typeBtns = document.querySelectorAll('#feedbackTypes .feedback-type-btn');
    typeBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            typeBtns.forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
        });
    });

    var fbOverlay = document.getElementById('feedbackOverlay');
    if (fbOverlay) {
        fbOverlay.addEventListener('click', function(e) {
            if (e.target === this) closeFeedback();
        });
    }
});

// inline onclick 需要这些在 window 上
window.openFeedback = openFeedback;
window.closeFeedback = closeFeedback;
window.submitFeedback = submitFeedback;

// Reader namespace
window.Reader.openFeedback = openFeedback;
window.Reader.closeFeedback = closeFeedback;
window.Reader.submitFeedback = submitFeedback;
