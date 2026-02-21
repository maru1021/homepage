document.addEventListener("DOMContentLoaded", () => {
    // コードタブの初期化
    setupCodeTabs(document);

    // .htmx-link に htmx属性を一括付与
    setupHtmxLinks(document);

    // htmxでコンテンツ差し替え後、新しいコンテンツ内のリンクにも付与
    document.addEventListener("htmx:afterSettle", (e) => {
        setupHtmxLinks(e.detail.target);
        setupCodeTabs(e.detail.target);
    });

    // サイドバー: イベント委譲で分類フォルダの開閉
    const sidebarNav = document.querySelector(".sidebar-nav");
    if (sidebarNav) {
        sidebarNav.addEventListener("click", (e) => {
            const folder = e.target.closest(".sidebar-folder");
            if (!folder) return;
            e.preventDefault();
            e.stopPropagation();
            const item = folder.closest(".sidebar-item");
            const children = item.querySelector(":scope > .sidebar-children");
            if (!children) return;
            const isOpen = children.style.display !== "none";
            children.style.display = isOpen ? "none" : "block";
            const toggle = folder.querySelector(".toggle");
            if (toggle) {
                toggle.textContent = isOpen ? "▶" : "▼";
            }
            folder.classList.toggle("open", !isOpen);
        });
    }

    // 検索: ヘッダーとサイドバーの検索欄を連動
    const searchInputs = document.querySelectorAll("#searchInput, #sidebarSearchInput");
    let searchTimer = null;

    searchInputs.forEach((input) => {
        const searchUrl = input.dataset.searchUrl;
        const homeUrl = input.dataset.homeUrl;

        input.addEventListener("input", () => {
            clearTimeout(searchTimer);
            const q = input.value.trim();

            // もう一方の検索欄にも値を同期
            searchInputs.forEach((other) => {
                if (other !== input) other.value = input.value;
            });

            searchTimer = setTimeout(() => {
                if (q.length === 0) {
                    htmx.ajax("GET", homeUrl, { target: "#main-content", pushUrl: homeUrl });
                } else {
                    htmx.ajax("GET", searchUrl + "?q=" + encodeURIComponent(q), { target: "#main-content", pushUrl: false });
                }
            }, 300);
        });
    });

    // モバイル: サイドバートグル
    const toggleBtn = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");

    if (toggleBtn && sidebar && overlay) {
        toggleBtn.addEventListener("click", () => {
            sidebar.classList.toggle("open");
            overlay.classList.toggle("open");
        });

        overlay.addEventListener("click", () => {
            sidebar.classList.remove("open");
            overlay.classList.remove("open");
        });
    }
});

function setupCodeTabs(root) {
    root.querySelectorAll(".code-tabs").forEach((tabs) => {
        if (tabs.dataset.tabsInit) return;
        tabs.dataset.tabsInit = "1";
        const buttons = tabs.querySelectorAll(".tab-btn");
        const panels = tabs.querySelectorAll(".tab-panel");
        buttons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const target = btn.dataset.tab;
                buttons.forEach((b) => b.classList.remove("active"));
                panels.forEach((p) => p.classList.remove("active"));
                btn.classList.add("active");
                const panel = tabs.querySelector(`.tab-panel[data-tab="${target}"]`);
                if (panel) panel.classList.add("active");
            });
        });
    });
}

function setupHtmxLinks(root) {
    root.querySelectorAll(".htmx-link:not([hx-get])").forEach((link) => {
        link.setAttribute("hx-get", link.getAttribute("href"));
        link.setAttribute("hx-target", "#main-content");
        link.setAttribute("hx-push-url", "true");
        htmx.process(link);
    });
}
