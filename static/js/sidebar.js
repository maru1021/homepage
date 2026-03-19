document.addEventListener("DOMContentLoaded", () => {
    setupCodeTabs(document);
    setupHtmxLinks(document);
    initGlossaryTooltips();
    highlightActiveLink();

    document.addEventListener("htmx:afterSettle", (e) => {
        setupHtmxLinks(e.detail.target);
        setupCodeTabs(e.detail.target);
        highlightActiveLink(false);
        const main = document.getElementById("main-content");
        if (main && main.contains(e.detail.target)) main.scrollTo(0, 0);
    });

    initSidebar();
    initSearch();
    initMobileToggle();
});

// --- サイドバー共通ヘルパー ---

function getNav() {
    return document.querySelector(".sidebar-nav");
}

function getChildren(folder) {
    return folder.closest(".sidebar-item")?.querySelector(":scope > .sidebar-children");
}

function setFolderOpen(folder, children, open) {
    children.style.display = open ? "block" : "none";
    folder.classList.toggle("open", open);
    const toggle = folder.querySelector(".toggle");
    if (toggle) toggle.textContent = open ? "\u25BC" : "\u25B6";
}

// --- サイドバー ---

function initSidebar() {
    const nav = getNav();
    if (!nav) return;

    restoreSidebarState(nav);

    nav.addEventListener("click", (e) => {
        const folder = e.target.closest(".sidebar-folder");
        if (!folder) return;
        e.preventDefault();
        e.stopPropagation();
        const children = getChildren(folder);
        if (!children) return;
        setFolderOpen(folder, children, children.style.display === "none");
        saveSidebarState(nav);
    });
}

function saveSidebarState(nav) {
    const slugs = [];
    nav.querySelectorAll(".sidebar-folder").forEach((folder) => {
        const children = getChildren(folder);
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
        const children = getChildren(folder);
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

function toggleMobileSidebar(open) {
    document.getElementById("sidebar")?.classList.toggle("open", open);
    document.getElementById("sidebarOverlay")?.classList.toggle("open", open);
}

function initMobileToggle() {
    document.addEventListener("click", (e) => {
        if (e.target.closest("#sidebarToggle")) {
            const sidebar = document.getElementById("sidebar");
            toggleMobileSidebar(!sidebar?.classList.contains("open"));
            return;
        }
        if (e.target.closest("#sidebarOverlay") || e.target.closest("#sidebar a")) {
            toggleMobileSidebar(false);
        }
    });
}

// --- アクティブリンクのハイライト ---

function highlightActiveLink(scrollToActive = true) {
    const nav = getNav();
    if (!nav) return;
    const path = location.pathname;
    nav.querySelectorAll("a.active").forEach((a) => a.classList.remove("active"));

    const activeLink = nav.querySelector(`a[href="${CSS.escape(path)}"]`);
    if (!activeLink) return;
    activeLink.classList.add("active");

    // アクティブリンクの親フォルダをすべて展開
    let el = activeLink.closest(".sidebar-children");
    while (el) {
        const folder = el.closest(".sidebar-item")?.querySelector(":scope > .sidebar-folder");
        if (folder) setFolderOpen(folder, el, true);
        el = el.parentElement?.closest(".sidebar-children");
    }
    saveSidebarState(nav);

    // 初回表示時のみサイドバー内でアクティブリンクが中央に来るようスクロール
    if (scrollToActive && document.getElementById("sidebar")) {
        activeLink.scrollIntoView({ block: "center", behavior: "instant" });
    }
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

// --- 用語ツールチップ（body 直下 fixed 配置で overflow に隠れない） ---

function initGlossaryTooltips() {
    const GAP = 10;
    const ARROW_SIZE = 6;
    const EDGE_MARGIN = 4;

    const box = document.createElement("div");
    box.className = "glossary-tooltip-box";
    const arrow = document.createElement("div");
    arrow.className = "glossary-tooltip-arrow";
    document.body.append(box, arrow);

    function show(term) {
        const text = term.getAttribute("data-tooltip");
        if (!text) return;
        box.textContent = text;
        box.classList.add("visible");
        arrow.classList.add("visible");

        const rect = term.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;

        // 仮配置してサイズ取得
        box.style.left = "0px";
        box.style.top = "0px";
        const bw = box.offsetWidth;
        const bh = box.offsetHeight;

        // 上に表示（デフォルト）、収まらなければ下に表示
        const above = rect.top - bh - GAP > 0;
        const top = above ? rect.top - bh - GAP : rect.bottom + GAP;
        const arrowTop = above ? rect.top - GAP : rect.bottom + GAP - ARROW_SIZE * 2;
        const arrowProp = above ? "borderTopColor" : "borderBottomColor";

        box.style.left = Math.max(EDGE_MARGIN, Math.min(cx - bw / 2, window.innerWidth - bw - EDGE_MARGIN)) + "px";
        box.style.top = top + "px";

        arrow.style.borderColor = "transparent";
        arrow.style[arrowProp] = "var(--color-dark)";
        arrow.style.left = (cx - ARROW_SIZE) + "px";
        arrow.style.top = arrowTop + "px";
    }

    function hide() {
        box.classList.remove("visible");
        arrow.classList.remove("visible");
    }

    for (const [showEvt, hideEvt] of [["mouseover", "mouseout"], ["focusin", "focusout"]]) {
        document.addEventListener(showEvt, (e) => { if (e.target.closest(".glossary-term")) show(e.target.closest(".glossary-term")); });
        document.addEventListener(hideEvt, (e) => { if (e.target.closest(".glossary-term")) hide(); });
    }
}
