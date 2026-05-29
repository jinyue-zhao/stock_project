let allStockData = [];

const DATA_URL = "data/tpex_stock.json";

window.addEventListener("DOMContentLoaded", () => {
    loadFromCloudJson();

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

    const keywordInput = document.getElementById("keywordInput");

    if (keywordInput) {
        keywordInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                filterData();
            }
        });
    }
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

        const latestDate = getLatestDate(filtered);

        const latestData = filtered.filter(item => item.date === latestDate);

        updateStats(latestData);
        renderDashboardTables(latestData, latestDate);

    } catch (error) {
        console.error("雲端資料讀取失敗：", error);

        showLoadError("instTopTable", 9);
        showLoadError("gainTopTable", 9);
        showLoadError("volumeTopTable", 9);
    }
}

function getLatestDate(data) {
    const dates = data
        .map(item => item.date)
        .filter(date => date !== null && date !== undefined && date !== "");

    return dates.sort().reverse()[0];
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

function renderDashboardTables(data, latestDate) {
    const instTop = [...data]
        .sort((a, b) => Number(b.total_inst_net_buy || 0) - Number(a.total_inst_net_buy || 0))
        .slice(0, 10);

    const gainTop = [...data]
        .sort((a, b) => Number(b.price_change_pct || 0) - Number(a.price_change_pct || 0))
        .slice(0, 10);

    const volumeTop = [...data]
        .sort((a, b) => Number(b.volume || 0) - Number(a.volume || 0))
        .slice(0, 10);

    renderCompactTable("instTopTable", instTop, "inst");
    renderCompactTable("gainTopTable", gainTop, "gain");
    renderCompactTable("volumeTopTable", volumeTop, "volume");

    document.getElementById("instNote").textContent =
        `${latestDate} 法人買超前 ${instTop.length} 名`;

    document.getElementById("gainNote").textContent =
        `${latestDate} 漲幅前 ${gainTop.length} 名`;

    document.getElementById("volumeNote").textContent =
        `${latestDate} 成交量前 ${volumeTop.length} 名`;
}

function renderCompactTable(tableId, data, type) {
    const tableBody = document.getElementById(tableId);
    tableBody.innerHTML = "";

    if (data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9">查無資料</td>
            </tr>
        `;
        return;
    }

    data.forEach((item, index) => {
        const row = document.createElement("tr");

        const lastColumn = type === "inst"
            ? formatPercentFromDecimal(item.inst_total_ratio)
            : formatPercentFromDecimal(item.turnover_rate);

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${formatValue(item.date)}</td>
            <td>${formatValue(item.stock_id)}</td>
            <td>${formatValue(item.stock_name)}</td>
            <td>${formatNumber(item.close)}</td>
            <td class="${getChangeClass(item.price_change_pct)}">
                ${formatPercent(item.price_change_pct)}
            </td>
            <td>${formatNumber(item.volume)}</td>
            <td class="${getNetClass(item.total_inst_net_buy)}">
                ${formatNumber(item.total_inst_net_buy)}
            </td>
            <td>${lastColumn}</td>
        `;

        tableBody.appendChild(row);
    });
}

function showLoadError(tableId, colspan) {
    const tableBody = document.getElementById(tableId);

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = `
        <tr>
            <td colspan="${colspan}">雲端資料讀取失敗，請稍後再試。</td>
        </tr>
    `;
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