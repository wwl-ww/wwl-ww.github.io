/**
 * childHood 阅读器 v1.1 - 设置系统 + 设置面板
 */

window.Reader = window.Reader || {};

// ==================== 设置系统 ====================
let settings = { theme: 'day', font: 'song', size: '2', miniToc: false, readingDirection: null };

function applySettings() {
    document.body.classList.remove('night-mode', 'eye-care', 'luxury', 'minimal', 'modern', 'relax', 'cute', 'orange');
    const themeClassMap = {
        'day': '',
        'night': 'night-mode',
        'eye': 'eye-care',
        'luxury': 'luxury',
        'minimal': 'minimal',
        'modern': 'modern',
        'relax': 'relax',
        'cute': 'cute',
        'orange': 'orange'
    };
    const cls = themeClassMap[settings.theme] || '';
    if (cls) document.body.classList.add(cls);

    document.body.classList.remove('font-default', 'font-song', 'font-fangsong', 'font-kai', 'font-hei', 'font-yahei', 'font-source-serif', 'font-source-sans');
    document.body.classList.add('font-' + settings.font);

    document.body.classList.remove('size-0', 'size-1', 'size-2', 'size-3', 'size-4');
    document.body.classList.add('size-' + settings.size);
}

function saveSettings() {
    Reader.storage.setItem('reader_settings', JSON.stringify(settings));
}

function restoreSettings() {
    try {
        var saved = JSON.parse(Reader.storage.getItem('reader_settings') || 'null');
        if (saved && typeof saved === 'object') {
            for (const key of ['theme', 'font', 'size']) {
                const panel = document.getElementById('setting' + key[0].toUpperCase() + key.slice(1));
                const values = Array.from(panel.querySelectorAll('[data-value]'), el => el.dataset.value);
                if (values.includes(saved[key])) settings[key] = saved[key];
            }
            if (typeof saved.miniToc === 'boolean') settings.miniToc = saved.miniToc;
            if (['landscape', 'portrait'].includes(saved.readingDirection)) settings.readingDirection = saved.readingDirection;
        }
    } catch(e) {}
    applySettings();
    Reader.viewport.apply();
    syncSettingsPanel();
    restoreSidebarState();
    restoreFootnoteState();
}

function syncSettingsPanel() {
    if (Reader.viewport) Reader.viewport.syncButton();
    var themeBtns = document.querySelectorAll('#settingTheme .setting-option');
    themeBtns.forEach(function(b) {
        var active = b.getAttribute('data-value') === settings.theme;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    var fontBtns = document.querySelectorAll('#settingFont .setting-option');
    fontBtns.forEach(function(b) {
        var active = b.getAttribute('data-value') === settings.font;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    var sizeBtns = document.querySelectorAll('#settingSize .setting-option');
    sizeBtns.forEach(function(b) {
        var active = b.getAttribute('data-value') === settings.size;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.getElementById('settingMiniToc').setAttribute('aria-checked', String(settings.miniToc));
    var toggleSwitch = document.getElementById('toggleMiniTocSwitch');
    if (toggleSwitch) {
        toggleSwitch.classList.toggle('on', settings.miniToc);
    }
}

// ==================== 小节目录开关 ====================
function toggleMiniTocSetting() {
    settings.miniToc = !settings.miniToc;
    saveSettings();
    syncSettingsPanel();
    if (!settings.miniToc) {
        document.getElementById('floatingToc').style.display = 'none';
        document.getElementById('floatingToc').classList.remove('collapsed');
    } else if (currentChapterId) {
        buildMiniToc(currentChapterId);
    }
}

// ==================== 模式切换（兼容旧版） ====================
function setMode(mode) {
    settings.theme = mode;
    saveSettings();
    applySettings();
    syncSettingsPanel();
}

// ==================== 浮层按钮管理 ====================
let floatingButtonsHidden = false;
function hideFloatingBtns() {
    if (floatingButtonsHidden) return;
    floatingButtonsHidden = true;
    var expandBtn = document.getElementById('btnExpandSidebar');
    var noteToggle = document.getElementById('footnoteToggle');
    expandBtn._shouldShow = !expandBtn.classList.contains('btn-hidden');
    noteToggle._shouldShow = noteToggle.classList.contains('show');
    expandBtn.classList.add('btn-hidden');
    syncSidebarAccessibility();
    noteToggle.classList.remove('show');
    noteToggle.style.display = 'none';
}
function showFloatingBtns() {
    if (document.querySelector('#searchOverlay.open, #settingsOverlay.open')) return;
    floatingButtonsHidden = false;
    var expandBtn = document.getElementById('btnExpandSidebar');
    var noteToggle = document.getElementById('footnoteToggle');
    syncSidebarAccessibility();
    if (noteToggle._shouldShow) {
        noteToggle.classList.add('show');
        noteToggle.style.display = 'flex';
    }
}

// ==================== 设置面板 ====================
function openSettings() {
    closeSidebarOnMobile();
    hideFloatingBtns();
    lastFocusedEl = document.activeElement;
    syncSettingsPanel();
    var overlay = document.getElementById('settingsOverlay');
    openOverlay(overlay);
    focusOverlaySoon(overlay, '.setting-option:not(:disabled)');
}

function closeSettings() {
    var overlay = document.getElementById('settingsOverlay');
    closeOverlay(overlay, showFloatingBtns);
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
        try { lastFocusedEl.focus(); } catch(e) {}
    }
}

function initSettingsPanel() {
    document.querySelectorAll('#settingTheme .setting-option').forEach(function(btn) {
        btn.addEventListener('click', function() {
            settings.theme = this.getAttribute('data-value');
            saveSettings();
            applySettings();
            syncSettingsPanel();
        });
    });
    document.querySelectorAll('#settingFont .setting-option').forEach(function(btn) {
        btn.addEventListener('click', function() {
            settings.font = this.getAttribute('data-value');
            saveSettings();
            applySettings();
            syncSettingsPanel();
        });
    });
    document.querySelectorAll('#settingSize .setting-option').forEach(function(btn) {
        btn.addEventListener('click', function() {
            settings.size = this.getAttribute('data-value');
            saveSettings();
            applySettings();
            syncSettingsPanel();
        });
    });

    document.getElementById('settingsOverlay').addEventListener('click', function(e) {
        if (e.target === this) closeSettings();
    });
}

// inline onclick 需要这些在 window 上
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.toggleMiniTocSetting = toggleMiniTocSetting;
window.setMode = setMode;

// Reader namespace
window.Reader.settings = settings;
window.Reader.applySettings = applySettings;
window.Reader.saveSettings = saveSettings;
window.Reader.restoreSettings = restoreSettings;
window.Reader.syncSettingsPanel = syncSettingsPanel;
window.Reader.toggleMiniTocSetting = toggleMiniTocSetting;
window.Reader.setMode = setMode;
window.Reader.hideFloatingBtns = hideFloatingBtns;
window.Reader.showFloatingBtns = showFloatingBtns;
window.Reader.openSettings = openSettings;
window.Reader.closeSettings = closeSettings;
window.Reader.initSettingsPanel = initSettingsPanel;
