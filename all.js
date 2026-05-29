const DATA_URL = "data/tpex_stock.json";

let allData = [];
let currentPage = 1;
const pageSize = 50;

window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const keyword = params.get("q") || "";

    document.getElementById("keywordInput").value = keyword;

    loadAllData(keyword);

    document.getElementById("keywordInput").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            const inputKeyword = document.getElementById("keywordInput").value.trim();
            loadAllData(inputKeyword);
        }
    });
});

async function loadAllData(keyword = "") {
    try {
        const response = await fetch(DATA_URL + "?t=" + Date.now());

        if (!response.ok) {
            throw new Error("找不到 data/tpex_stock.json");
        }

        const data = await response.json();

        let filtered = data;

        if (keyword) {
            filtered = data.filter(item =>
                String(item.stock_id || "").includes(keyword) ||
                String(item.stock_name || "").includes(keyword)
            );
        }

        allData = filtered.sort((a, b) => {
            const da = String(a.date || "");
            const db = String(b.date || "");
            const sa = String(a.stock_id || "");
            const sb = String(b.stock_id || "");

            return (db + sb).localeCompare(da + sa);
        });

        currentPage = 1;
        renderCurrentPage();

    } catch (error) {
        console.error("雲端資料讀取失敗：", error);

        document.getElementById("dataTable").innerHTML = `
            <tr>
                <td colspan="12">雲端資料讀取失敗，請稍後再試。</td>
            </tr>
        `;
    }
}

function renderCurrentPage(shouldScrollTop = false) {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageData = allData.slice(start, end);

    renderTable(pageData);

    const totalPages = Math.max(1, Math.ceil(allData.length / pageSize));

    const pageText = `第 ${currentPage} 頁 / 共 ${totalPages} 頁`;
    const noteText = `共 ${allData.length} 筆資料，目前顯示第 ${start + 1} 到 ${Math.min(end, allData.length)} 筆`;

    document.getElementById("pageInfo").textContent = pageText;
    document.getElementById("topPageInfo").textContent = pageText;

    document.getElementById("displayNote").textContent = noteText;

    document.getElementById("prevBtn").disabled = currentPage <= 1;
    document.getElementById("nextBtn").disabled = currentPage >= totalPages;

    document.getElementById("topPrevBtn").disabled = currentPage <= 1;
    document.getElementById("topNextBtn").disabled = currentPage >= totalPages;

    if (shouldScrollTop) {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }
}

function renderTable(data) {
    const tableBody = document.getElementById("dataTable");
    tableBody.innerHTML = "";

    if (data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="12">查無資料</td>
            </tr>
        `;
        return;
    }

    data.forEach(item => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${formatValue(item.date)}</td>
            <td>${formatValue(item.stock_id)}</td>
            <td>${formatValue(item.stock_name)}</td>
            <td>${formatNumber(item.close)}</td>
            <td class="${getChangeClass(item.price_change_pct)}">
                ${formatPercent(item.price_change_pct)}
            </td>
            <td>${formatNumber(item.volume)}</td>
            <td class="${getNetClass(item.foreign_net_buy)}">
                ${formatNumber(item.foreign_net_buy)}
            </td>
            <td class="${getNetClass(item.investment_trust_net_buy)}">
                ${formatNumber(item.investment_trust_net_buy)}
            </td>
            <td class="${getNetClass(item.dealer_net_buy)}">
                ${formatNumber(item.dealer_net_buy)}
            </td>
            <td class="${getNetClass(item.total_inst_net_buy)}">
                ${formatNumber(item.total_inst_net_buy)}
            </td>
            <td>${formatPercentFromDecimal(item.inst_total_ratio)}</td>
            <td>${formatPercentFromDecimal(item.inst_to_issued_ratio)}</td>
        `;

        tableBody.appendChild(row);
    });
}

function goPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderCurrentPage(true);
    }
}

function goNextPage() {
    const totalPages = Math.ceil(allData.length / pageSize);

    if (currentPage < totalPages) {
        currentPage++;
        renderCurrentPage(true);
    }
}

document.getElementById("prevBtn").addEventListener("click", goPrevPage);
document.getElementById("nextBtn").addEventListener("click", goNextPage);

document.getElementById("topPrevBtn").addEventListener("click", goPrevPage);
document.getElementById("topNextBtn").addEventListener("click", goNextPage);

document.getElementById("searchBtn").addEventListener("click", () => {
    const keyword = document.getElementById("keywordInput").value.trim();
    loadAllData(keyword);
});

function formatValue(value) {
    if (
        value === null ||
        value === undefined ||
        value === "" ||
        String(value) === "NaN"
    ) {
        return "--";
    }

    return value;
}

function formatNumber(value) {
    const num = Number(value);

    if (isNaN(num)) {
        return "--";
    }

    return num.toLocaleString();
}

function formatPercent(value) {
    const num = Number(value);

    if (isNaN(num)) {
        return "--";
    }

    return num.toFixed(2) + "%";
}

function formatPercentFromDecimal(value) {
    const num = Number(value);

    if (isNaN(num)) {
        return "--";
    }

    return num.toFixed(3) + "%";
}

function getChangeClass(value) {
    const num = Number(value);

    if (isNaN(num) || num === 0) {
        return "neutral";
    }

    return num > 0 ? "positive" : "negative";
}

function getNetClass(value) {
    const num = Number(value);

    if (isNaN(num) || num === 0) {
        return "neutral";
    }

    return num > 0 ? "positive" : "negative";
}