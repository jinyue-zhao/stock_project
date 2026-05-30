const DATA_URL = "data/tpex_stock_today.json";

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
                <td colspan="11">雲端資料讀取失敗，請稍後再試。</td>
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

    updatePageSelects(totalPages);

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

function updatePageSelects(totalPages) {
    const selects = [
        document.getElementById("pageSelect"),
        document.getElementById("topPageSelect")
    ];

    selects.forEach(select => {
        if (!select) {
            return;
        }

        if (Number(select.dataset.totalPages) !== totalPages) {
            select.innerHTML = "";

            for (let i = 1; i <= totalPages; i++) {
                const option = document.createElement("option");
                option.value = i;
                option.textContent = i;
                select.appendChild(option);
            }

            select.dataset.totalPages = totalPages;
        }

        select.value = currentPage;
    });
}

function renderTable(data) {
    const tableBody = document.getElementById("dataTable");
    tableBody.innerHTML = "";

    if (data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="11">查無資料</td>
            </tr>
        `;
        return;
    }

    data.forEach(item => {
        const row = document.createElement("tr");

        row.classList.add("clickable-row");
        row.addEventListener("click", () => {
            window.location.href = `stock.html?id=${encodeURIComponent(item.stock_id)}`;
        });

        row.innerHTML = `
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

document.getElementById("pageSelect").addEventListener("change", (event) => {
    currentPage = Number(event.target.value);
    renderCurrentPage(true);
});

document.getElementById("topPageSelect").addEventListener("change", (event) => {
    currentPage = Number(event.target.value);
    renderCurrentPage(true);
});

document.getElementById("searchBtn").addEventListener("click", () => {
    const keyword = document.getElementById("keywordInput").value.trim();
    loadAllData(keyword);
});
