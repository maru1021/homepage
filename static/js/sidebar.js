document.addEventListener("DOMContentLoaded", () => {
    setupCodeTabs(document);
    setupHtmxLinks(document);

    document.addEventListener("htmx:afterSettle", (e) => {
        setupHtmxLinks(e.detail.target);
        setupCodeTabs(e.detail.target);
        const main = document.getElementById("main-content");
        if (main && main.contains(e.detail.target)) main.scrollTo(0, 0);
    });

    initSidebar();
    initSearch();
    initMobileToggle();
});

// --- サイドバー ---

function initSidebar() {
    const nav = document.querySelector(".sidebar-nav");
    if (!nav) return;

    restoreSidebarState(nav);

    nav.addEventListener("click", (e) => {
        const folder = e.target.closest(".sidebar-folder");
        if (!folder) return;
        e.preventDefault();
        e.stopPropagation();
        const item = folder.closest(".sidebar-item");
        const children = item?.querySelector(":scope > .sidebar-children");
        if (!children) return;
        setFolderOpen(folder, children, children.style.display === "none");
        saveSidebarState(nav);
    });
}

function setFolderOpen(folder, children, open) {
    children.style.display = open ? "block" : "none";
    folder.classList.toggle("open", open);
    const toggle = folder.querySelector(".toggle");
    if (toggle) toggle.textContent = open ? "\u25BC" : "\u25B6";
}

function saveSidebarState(nav) {
    const slugs = [];
    nav.querySelectorAll(".sidebar-folder").forEach((folder) => {
        const children = folder.closest(".sidebar-item")?.querySelector(":scope > .sidebar-children");
        if (children && children.style.display !== "none" && folder.dataset.slug) {
            slugs.push(folder.dataset.slug);
        }
    });
    try { localStorage.setItem("sidebarOpen", JSON.stringify(slugs)); } catch {}
}

function restoreSidebarState(nav) {
    let openSlugs;
    try {
        const saved = localStorage.getItem("sidebarOpen");
        if (!saved) return;
        openSlugs = new Set(JSON.parse(saved));
    } catch { return; }

    nav.querySelectorAll(".sidebar-folder").forEach((folder) => {
        if (!folder.dataset.slug) return;
        const children = folder.closest(".sidebar-item")?.querySelector(":scope > .sidebar-children");
        if (children) setFolderOpen(folder, children, openSlugs.has(folder.dataset.slug));
    });
}

// --- 検索 ---

function initSearch() {
    const inputs = document.querySelectorAll("#searchInput, #sidebarSearchInput");
    let timer = null;

    inputs.forEach((input) => {
        input.addEventListener("input", () => {
            clearTimeout(timer);
            inputs.forEach((other) => { if (other !== input) other.value = input.value; });
            const q = input.value.trim();
            timer = setTimeout(() => {
                const url = q ? input.dataset.searchUrl + "?q=" + encodeURIComponent(q) : input.dataset.homeUrl;
                htmx.ajax("GET", url, { target: "#main-content", pushUrl: q ? false : url });
            }, 300);
        });
    });
}

// --- モバイルサイドバートグル ---

function initMobileToggle() {
    const btn = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (!btn || !sidebar || !overlay) return;

    const toggle = () => { sidebar.classList.toggle("open"); overlay.classList.toggle("open"); };
    const close = () => { sidebar.classList.remove("open"); overlay.classList.remove("open"); };
    btn.addEventListener("click", toggle);
    overlay.addEventListener("click", close);
}

// --- コードタブ ---

function setupCodeTabs(root) {
    root.querySelectorAll(".code-tabs:not([data-tabs-init])").forEach((tabs) => {
        tabs.dataset.tabsInit = "1";
        const buttons = tabs.querySelectorAll(".tab-btn");
        const panels = tabs.querySelectorAll(".tab-panel");
        buttons.forEach((btn) => {
            btn.addEventListener("click", () => {
                buttons.forEach((b) => b.classList.remove("active"));
                panels.forEach((p) => p.classList.remove("active"));
                btn.classList.add("active");
                tabs.querySelector(`.tab-panel[data-tab="${btn.dataset.tab}"]`)?.classList.add("active");
            });
        });
    });
}

// --- htmx リンク ---

function setupHtmxLinks(root) {
    root.querySelectorAll(".htmx-link:not([hx-get])").forEach((link) => {
        link.setAttribute("hx-get", link.getAttribute("href"));
        link.setAttribute("hx-target", "#main-content");
        link.setAttribute("hx-push-url", "true");
        htmx.process(link);
    });
}
