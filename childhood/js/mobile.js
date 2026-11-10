/**
 * childHood 阅读器 v1.1 - 手机端滑动关闭手势
 */

window.Reader = window.Reader || {};

// ==================== 手机端侧边栏滑动关闭 ====================
function initSidebarSwipe() {
    var sidebar = document.getElementById('sidebar');
    var backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !backdrop) return;

    // 遮罩层左滑收起
    var bdStartX = 0, bdStartY = 0, bdTrackX = 0, bdTracking = false;
    var bdThreshold = 40;

    backdrop.addEventListener('touchstart', function(e) {
        if (!Reader.viewport.mobile()) return;
        if (sidebar.classList.contains('collapsed')) return;
        bdStartX = Reader.viewport.point(e.touches[0]).x;
        bdStartY = Reader.viewport.point(e.touches[0]).y;
        bdTrackX = 0;
        bdTracking = true;
    }, { passive: true });

    backdrop.addEventListener('touchmove', function(e) {
        if (!bdTracking || !Reader.viewport.mobile()) return;
        var dx = Reader.viewport.point(e.touches[0]).x - bdStartX;
        var dy = Reader.viewport.point(e.touches[0]).y - bdStartY;
        if (Math.abs(dx) > Math.abs(dy) && dx < -8) {
            bdTrackX = Math.abs(dx);
        }
    }, { passive: true });

    backdrop.addEventListener('touchend', function() {
        if (!bdTracking || !Reader.viewport.mobile()) return;
        bdTracking = false;
        if (bdTrackX > bdThreshold) {
            toggleSidebar();
        }
    });

    // 侧边栏自身左滑收起
    var startX = 0, startY = 0, trackX = 0, tracking = false;
    var threshold = 80;

    sidebar.addEventListener('touchstart', function(e) {
        if (!Reader.viewport.mobile()) return;
        startX = Reader.viewport.point(e.touches[0]).x;
        startY = Reader.viewport.point(e.touches[0]).y;
        trackX = 0;
        tracking = true;
    }, { passive: true });

    sidebar.addEventListener('touchmove', function(e) {
        if (!tracking || !Reader.viewport.mobile()) return;
        var dx = Reader.viewport.point(e.touches[0]).x - startX;
        var dy = Reader.viewport.point(e.touches[0]).y - startY;
        if (Math.abs(dx) > Math.abs(dy) && dx < -8) {
            trackX = Math.abs(dx);
        }
    }, { passive: true });

    sidebar.addEventListener('touchend', function() {
        if (!tracking || !Reader.viewport.mobile()) return;
        tracking = false;
        if (trackX > threshold) {
            toggleSidebar();
        }
    });
}

// ==================== 手机端注释栏下滑关闭 ====================
function initFootnoteSwipe() {
    var panel = document.getElementById('footnotePanel');
    var backdrop = document.getElementById('footnoteBackdrop');
    if (!panel) return;

    var startX = 0, startY = 0, trackY = 0, tracking = false;
    var threshold = 50;

    function onStart(e) {
        tracking = false;
        if (Reader.viewport.width > 1024) return;
        if (panel.classList.contains('collapsed')) return;
        if (e.touches.length !== 1) return;
        // Reading a long note must scroll its content, not dismiss the sheet.
        var content = document.getElementById('footnotePanelContent');
        if (content.contains(e.target) && panel.scrollTop > 0) return;
        var point = Reader.viewport.point(e.touches[0]);
        startX = point.x;
        startY = point.y;
        trackY = 0;
        tracking = true;
    }

    function onMove(e) {
        if (!tracking || Reader.viewport.width > 1024) return;
        if (e.touches.length !== 1) { tracking = false; return; }
        var point = Reader.viewport.point(e.touches[0]);
        var dy = point.y - startY;
        trackY = dy > Math.abs(point.x - startX) ? Math.max(0, dy) : 0;
    }

    function onEnd() {
        if (!tracking || Reader.viewport.width > 1024) return;
        tracking = false;
        if (trackY > threshold) {
            toggleFootnotePanel();
        }
    }

    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: true });
    panel.addEventListener('touchend', onEnd);
    panel.addEventListener('touchcancel', function() { tracking = false; });

    if (backdrop) {
        var bdStartY = 0, bdTrackY = 0, bdTracking = false;
        var bdThreshold = 40;

        backdrop.addEventListener('touchstart', function(e) {
            if (Reader.viewport.width > 1024) return;
            if (panel.classList.contains('collapsed')) return;
            bdStartY = Reader.viewport.point(e.touches[0]).y;
            bdTrackY = 0;
            bdTracking = true;
        }, { passive: true });

        backdrop.addEventListener('touchmove', function(e) {
            if (!bdTracking || Reader.viewport.width > 1024) return;
            var dy = Reader.viewport.point(e.touches[0]).y - bdStartY;
            if (dy > 8) {
                bdTrackY = dy;
            }
        }, { passive: true });

        backdrop.addEventListener('touchend', function() {
            if (!bdTracking || Reader.viewport.width > 1024) return;
            bdTracking = false;
            if (bdTrackY > bdThreshold) {
                toggleFootnotePanel();
            }
        });
    }
}

// 尽早初始化手势监听（不等待 app init 的 async 操作）
document.addEventListener('DOMContentLoaded', function() {
    initSidebarSwipe();
    initFootnoteSwipe();
});

// Reader namespace
window.Reader.initSidebarSwipe = initSidebarSwipe;
window.Reader.initFootnoteSwipe = initFootnoteSwipe;
