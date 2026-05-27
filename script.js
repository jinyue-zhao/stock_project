let stockData = [];
let allStockData = [];

const DATA_URL = "data/tpex_stock.json";

window.addEventListener("DOMContentLoaded", () => {
    loadFromCloudJson();
});

async function loadFromCloudJson(keyword = "") {
    try {
        const response = await fetch(DATA_URL + "?t=" + Date.now());

        if (!response.ok) {
            throw new Error("找不到 data/tpex_stock.json");
        }

        const data = await response.json();

        allStockData = data;

        let filtered = allStockData;

        if (keyword) {
            filtered = allStockData.filter(item =>
                String(item.stock_id || "").includes(keyword) ||
                String(item.stock_name || "").includes(keyword)
            );
        }

        filtered = filtered.sort((a, b) => {
            const da = String(a.date || "");
            const db = String(b.date || "");
            const sa = String(a.stock_id || "");
            const sb = String(b.stock_id || "");

            return (db + sb).localeCompare(da + sa);
        });

        stockData = filtered.slice(0, 10);

        updateStats(filtered);
        renderTable(stockData);

        document.getElementById("displayNote").textContent =
            `目前顯示前 ${stockData.length} 筆資料`;

    } catch (error) {
        console.error("雲端資料讀取失敗：", error);

        document.getElementById("dataTable").innerHTML = `
            <tr>
                <td colspan="12">
                    雲端資料讀取失敗，請稍後再試。
                </td>
            </tr>
        `;
    }
}

function filterData() {
    const keyword = document.getElementById("keywordInput").value.trim();
    loadFromCloudJson(keyword);
}

function updateStats(data) {
    const totalCount = data.length;

    const validChange = data.filter(item =>
        item.price_change_pct !== null &&
        item.price_change_pct !== undefined &&
        !isNaN(Number(item.price_change_pct))
    );

    const upCount = validChange.filter(item => Number(item.price_change_pct) > 0).length;
    const downCount = validChange.filter(item => Number(item.price_change_pct) < 0).length;

    const avgChange = validChange.length > 0
        ? validChange.reduce((sum, item) => sum + Number(item.price_change_pct), 0) / validChange.length
        : 0;

    const validInst = data.filter(item =>
        item.total_inst_net_buy !== null &&
        item.total_inst_net_buy !== undefined &&
        !isNaN(Number(item.total_inst_net_buy))
    );

    const instBuyCount = validInst.filter(item => Number(item.total_inst_net_buy) > 0).length;

    const instBuyRatio = validInst.length > 0
        ? instBuyCount / validInst.length * 100
        : 0;

    document.getElementById("totalCount").textContent = totalCount + " 筆";
    document.getElementById("upCount").textContent = upCount + " 家";
    document.getElementById("downCount").textContent = downCount + " 家";
    document.getElementById("avgChange").textContent = avgChange.toFixed(2) + "%";
    document.getElementById("instBuyRatio").textContent = instBuyRatio.toFixed(1) + "%";
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

    return (num * 100).toFixed(3) + "%";
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

const moreBtn = document.getElementById("moreBtn");

if (moreBtn) {
    moreBtn.addEventListener("click", () => {
        const keyword = document.getElementById("keywordInput").value.trim();

        if (keyword) {
            window.location.href = `all.html?q=${encodeURIComponent(keyword)}`;
        } else {
            window.location.href = "all.html";
        }
    });
}