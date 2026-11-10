/**
 * childHood 阅读器 v1.1 - 成就系统 + 阅读记录
 */

window.Reader = window.Reader || {};

// ==================== 成就系统 ====================
async function recordReading(chapterId, wordCount) {
    if (!sessionToken) return;
    const token = sessionToken;
    try {
        var res = await Reader.api.fetch('/api/reading/done', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ chapter_id: chapterId, word_count: wordCount })
        });
        var data = await res.json();
        if (token !== sessionToken) return;
        if (data.ok && data.new_achievements && data.new_achievements.length > 0) {
            data.new_achievements.forEach(function(a) {
                showAchievementToast(a);
            });
        }
    } catch(e) {}
}

function showAchievementToast(a) {
    var toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = '<span class="ach-toast-icon">' + (a.icon || '') + '</span>' +
        '<div><strong>' + a.name + '</strong><br><small>' + a.desc + '</small></div>';
    document.getElementById('readerViewport').appendChild(toast);
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
    loadAchievements();
}

async function loadAchievements() {
    const token = sessionToken;
    try {
        var headers = {};
        if (sessionToken) headers['Authorization'] = 'Bearer ' + sessionToken;
        var res = await Reader.api.fetch('/api/achievements', { headers: headers });
        var data = await res.json();
        if (token !== sessionToken) return;
        renderAchievements(data.achievements, data.all);
    } catch(e) {}
}

function renderAchievements(earned, all) {
    var container = document.getElementById('userDropdownAchs');
    if (!container) return;
    var earnedKeys = {};
    earned.forEach(function(a) { earnedKeys[a.key] = a; });
    var html = '';
    all.forEach(function(a) {
        var has = !!earnedKeys[a.key];
        html += '<div class="ach-item' + (has ? ' earned' : '') + '" title="' + a.desc + '">' +
            '<span class="ach-icon">' + a.icon + '</span>' +
            '<span class="ach-name">' + a.name + '</span>' +
        '</div>';
    });
    if (all.length === 0) {
        html = '<div class="ach-empty">暂无成就</div>';
    }
    container.innerHTML = html;
}

// Reader namespace
window.Reader.recordReading = recordReading;
window.Reader.showAchievementToast = showAchievementToast;
window.Reader.loadAchievements = loadAchievements;
window.Reader.renderAchievements = renderAchievements;
