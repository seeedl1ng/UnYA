// ==UserScript==
// @name         UnYA - script
// @namespace    UnYA
// @version      0.1
// @description  Показывает скрытые Яндексом сайты Reddit, GitHub и Stack Overflow, из выдачи DuckDuckGo
// @license      AGPL-3.0
// @author       seeedl1ng
// @homepageURL  https://github.com/seeedl1ng/UnYA
// @supportURL   https://github.com/seeedl1ng/UnYA/issues
// @updateURL    https://raw.githubusercontent.com/seeedl1ng/UnYA/UnYA.user.js
// @downloadURL  https://raw.githubusercontent.com/seeedl1ng/UnYA/UnYA.user.js
//
// @match        https://ya.ru/search*
// @match        https://yandex.ru/search*
// @match        https://www.yandex.ru/search*
// @include      https://ya.ru/search?text=*
// @resource     unya-inter-cyrillic https://cdn.jsdelivr.net/fontsource/fonts/inter:vf@latest/cyrillic-wght-normal.woff2
// @resource     unya-inter-latin https://cdn.jsdelivr.net/fontsource/fonts/inter:vf@latest/latin-wght-normal.woff2
// @grant        GM_getResourceURL
// @grant        GM_xmlhttpRequest
// @connect      html.duckduckgo.com
//
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";

    // Сайты, ссылки на которые мы хотим оставить
    const SITES = [
        { name: "Reddit", icon: "👽", domain: "reddit.com" },
        { name: "GitHub", icon: "💻", domain: "github.com" },
        { name: "Stack Overflow", icon: "📚", domain: "stackoverflow.com" }
    ];

    // Берём текст запроса из адреса страницы Яндекса
    const url = new URL(location.href);
    const query = url.searchParams.get("text");

    // В Яндексе: p=0 — первая страница, p=1 — вторая и так далее
    const yandexPage = Number(url.searchParams.get("p") || 0);

    if (!query) return;

    createPanel();
    loadResults();

    function loadResults() {
        const panel = document.querySelector("#unya-content");

        const status = document.createElement("p");
        status.id = "unya-status";
        status.textContent = "Загружаю результаты…";
        panel.appendChild(status);

        searchDuckDuckGo(query, yandexPage)
            .then(results => {
            status.remove();

            for (const site of SITES) {
                const siteResults = results.filter(result =>
                                                   isFromSite(result.url, site.domain)
                                                  );

                renderSite(site, siteResults);
            }
        })
            .catch(error => {
            console.error("UnYA:", error);

            status.textContent =
                "Не удалось получить результаты DuckDuckGo. " +
                "Код ошибки: " + (error.message || error.error || "неизвестен");
        });
    }

    function searchDuckDuckGo(query, page) {
        return new Promise((resolve, reject) => {
            // DuckDuckGo использует s как смещение:
            // 0 — первая страница, 30 — вторая, 60 — третья.
            const offset = page * 30;

            const ddgUrl =
                  "https://html.duckduckgo.com/html/?q=" +
                  encodeURIComponent(query) +
                  "&s=" + offset;

            GM_xmlhttpRequest({
                method: "GET",
                url: ddgUrl,

                onload(response) {
                    const doc = new DOMParser().parseFromString(
                        response.responseText,
                        "text/html"
                    );

                    const results = [];

                    doc.querySelectorAll(".result").forEach(element => {
                        const link = element.querySelector(".result__a");

                        if (!link) return;

                        results.push({
                            title: link.textContent.trim(),
                            url: getDirectUrl(link.getAttribute("href"))
                        });
                    });

                    resolve(results);
                },

                onerror(response) {
                    reject(new Error(response.error || "ошибка сети"));
                }
            });
        });
    }

    function getDirectUrl(url) {
        // DuckDuckGo иногда оборачивает ссылки в свой редирект.
        // Достаём из него настоящий адрес сайта.
        try {
            const parsed = new URL(url, "https://duckduckgo.com");
            return parsed.searchParams.get("uddg") || parsed.href;
        } catch {
            return url;
        }
    }

    function isFromSite(url, domain) {
        try {
            const hostname = new URL(url).hostname.toLowerCase();

            return hostname === domain || hostname.endsWith("." + domain);
        } catch {
            return false;
        }
    }

    function createPanel() {
        const panel = document.createElement("aside");

        panel.id = "unya-results";

        const fixedTabs = document.querySelector(".HeaderNav-FixedTabs");

        const top = fixedTabs
        ? fixedTabs.getBoundingClientRect().bottom
        : 16;

        if (fixedTabs) {
            fixedTabs.style.zIndex = "100";
        }

        panel.style.zIndex = "10";

        panel.innerHTML = `
        <div id="unya-header">
            <span id="unya-title">🔎 Из DuckDuckGo</span>
            <button id="unya-toggle" type="button" title="Свернуть панель">«</button>
        </div>

        <div id="unya-content"></div>
    `;

        Object.assign(panel.style, {
            width: "100%",
            boxSizing: "border-box",

            background: "#202020",
            color: "#f2f2f2",
            border: "1px solid #444",
            borderRadius: "12px",
            padding: "16px"
        });

        const aside = document.querySelector("#search-result-aside");

        if (aside) {

            const wrapper = document.createElement("section");
            wrapper.id = "unya-wrapper";

            wrapper.append(panel);

            aside.prepend(wrapper);

        } else {

            panel.style.position = "fixed";
            panel.style.top = "160px";
            panel.style.right = "24px";

            document.body.appendChild(panel);
        }

        const title = panel.querySelector("#unya-title");
        const content = panel.querySelector("#unya-content");
        const toggle = panel.querySelector("#unya-toggle");

        Object.assign(toggle.style, {
            border: "0",
            background: "transparent",
            color: "#f2f2f2",
            cursor: "pointer",
            fontSize: "22px",
            lineHeight: "1"
        });

        function setCollapsed(collapsed) {
            content.hidden = collapsed;
            title.hidden = collapsed;

            panel.style.width = collapsed ? "48px" : "360px";
            panel.style.flexBasis = collapsed ? "48px" : "360px";
            panel.style.padding = collapsed ? "12px 8px" : "16px";

            toggle.textContent = collapsed ? "»" : "«";
            toggle.title = collapsed ? "Развернуть панель" : "Свернуть панель";

            localStorage.setItem("unya-panel-collapsed", collapsed ? "1" : "0");
        }

        toggle.addEventListener("click", () => {
            setCollapsed(!content.hidden);
        });

        setCollapsed(localStorage.getItem("unya-panel-collapsed") === "1");
    }

    // Добавляем панель прямо в страницу, а не внутрь выдачи Яндекса
    const style = document.createElement("style");

    const cyrillicFontUrl = GM_getResourceURL("unya-inter-cyrillic");
    const latinFontUrl = GM_getResourceURL("unya-inter-latin");

    style.textContent = `
    @font-face {
        font-family: "UnYA Inter";
        src: url("${latinFontUrl}") format("woff2");
        font-weight: 100 900;
        font-style: normal;
        unicode-range: U+0000-024F;
    }

    @font-face {
        font-family: "UnYA Inter";
        src: url("${cyrillicFontUrl}") format("woff2");
        font-weight: 100 900;
        font-style: normal;
        unicode-range: U+0400-052F;
    }

    #unya-results,
    #unya-results * {
        font-family: "Proxima Nova", "UnYA Inter", Arial, sans-serif !important;
    }

    #unya-results h2,
    #unya-results h3 {
        font-weight: 600;
    }

    #unya-wrapper{
    	margin-bottom:16px;
    }

    #unya-results{
    	width:100%;
    	box-sizing:border-box;
    }

    #unya-header{
    	display:flex;
    	align-items:center;
    	justify-content:space-between;
    	margin-bottom:16px;
    }

    #unya-content ul{
    	margin:0;
    	padding:0;
    	list-style:none;
    }

    #unya-content li{
	    margin-bottom:12px;
    }

    #unya-content a{
    	color:inherit;
    	text-decoration:none;
    }

    #unya-content a:hover{
    	text-decoration:underline;
    }
`;

    document.head.appendChild(style);

    function renderSite(site, results) {
        const panel = document.querySelector("#unya-content");
        const block = document.createElement("div");

        block.style.marginBottom = "18px";

        const heading = document.createElement("h3");
        heading.textContent = `${site.icon} ${site.name}`;
        block.appendChild(heading);

        if (results.length === 0) {
            const text = document.createElement("p");
            text.textContent = "На этой странице DuckDuckGo ссылок нет";
            block.appendChild(text);
        } else {
            const list = document.createElement("ul");

            for (const result of results) {
                const item = document.createElement("li");
                const link = document.createElement("a");

                link.href = result.url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = result.title;

                item.appendChild(link);
                list.appendChild(item);
            }

            block.appendChild(list);
        }

        panel.appendChild(block);
    }
})();
