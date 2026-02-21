document.addEventListener("DOMContentLoaded", function () {
    // コードタブの初期化
    setupCodeTabs(document);

    // .htmx-link に htmx属性を一括付与
    setupHtmxLinks(document);

    // htmxでコンテンツ差し替え後、新しいコンテンツ内のリンクにも付与
    document.addEventListener("htmx:afterSettle", function (e) {
        setupHtmxLinks(e.detail.target);
        setupCodeTabs(e.detail.target);
    });

    // サイドバー: イベント委譲で分類フォルダの開閉
    var sidebarNav = document.querySelector(".sidebar-nav");
    if (sidebarNav) {
        sidebarNav.addEventListener("click", function (e) {
            var folder = e.target.closest(".sidebar-folder");
            if (!folder) return;
            e.preventDefault();
            e.stopPropagation();
            var item = folder.closest(".sidebar-item");
            var children = item.querySelector(":scope > .sidebar-children");
            if (!children) return;
            var isOpen = children.style.display !== "none";
            children.style.display = isOpen ? "none" : "block";
            var toggle = folder.querySelector(".toggle");
            if (toggle) {
                toggle.textContent = isOpen ? "▶" : "▼";
            }
            folder.classList.toggle("open", !isOpen);
        });
    }

    // 検索: 入力変化時にAJAXで検索
    var searchInput = document.getElementById("searchInput");
    if (searchInput) {
        var searchUrl = searchInput.dataset.searchUrl;
        var homeUrl = searchInput.dataset.homeUrl;
        var searchTimer = null;
        searchInput.addEventListener("input", function () {
            clearTimeout(searchTimer);
            var q = searchInput.value.trim();
            searchTimer = setTimeout(function () {
                if (q.length === 0) {
                    htmx.ajax("GET", homeUrl, { target: "#main-content", pushUrl: homeUrl });
                } else {
                    htmx.ajax("GET", searchUrl + "?q=" + encodeURIComponent(q), { target: "#main-content", pushUrl: false });
                }
            }, 300);
        });
    }

    // モバイル: サイドバートグル
    var toggleBtn = document.getElementById("sidebarToggle");
    var sidebar = document.getElementById("sidebar");
    var overlay = document.getElementById("sidebarOverlay");

    if (toggleBtn && sidebar && overlay) {
        toggleBtn.addEventListener("click", function () {
            sidebar.classList.toggle("open");
            overlay.classList.toggle("open");
        });

        overlay.addEventListener("click", function () {
            sidebar.classList.remove("open");
            overlay.classList.remove("open");
        });
    }
});

function setupCodeTabs(root) {
    root.querySelectorAll(".code-tabs").forEach(function (tabs) {
        if (tabs.dataset.tabsInit) return;
        tabs.dataset.tabsInit = "1";
        var buttons = tabs.querySelectorAll(".tab-btn");
        var panels = tabs.querySelectorAll(".tab-panel");
        buttons.forEach(function (btn) {
            btn.addEventListener("click", function () {
                var target = btn.dataset.tab;
                buttons.forEach(function (b) { b.classList.remove("active"); });
                panels.forEach(function (p) { p.classList.remove("active"); });
                btn.classList.add("active");
                var panel = tabs.querySelector('.tab-panel[data-tab="' + target + '"]');
                if (panel) panel.classList.add("active");
            });
        });
    });
}

function setupHtmxLinks(root) {
    root.querySelectorAll(".htmx-link:not([hx-get])").forEach(function (link) {
        link.setAttribute("hx-get", link.getAttribute("href"));
        link.setAttribute("hx-target", "#main-content");
        link.setAttribute("hx-push-url", "true");
        htmx.process(link);
    });
}
