const DATA_URL = "data/ranking_source.json";

window.addEventListener("DOMContentLoaded", () => {
    loadStockData();
});

async function loadStockData() {
    const params = new URLSearchParams(window.location.search);
    const stockId = params.get("id");

    if (!stockId) {
        showError("沒有指定股票代號");
        return;
    }

    try {
        const response = await fetch(DATA_URL + "?t=" + Date.now());

        if (!response.ok) {
            throw new Error("找不到 data/ranking_source.json");
        }

        const data = await response.json();

        const stockData = data
            .filter(item => String(item.stock_id || "").padStart(4, "0") === String(stockId).padStart(4, "0"))
            .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
            .slice(0, 30);

        if (stockData.length === 0) {
            showError(`查無股票代號 ${stockId} 的資料`);
            return;
        }

        updateStockHeader(stockData);
        updateStockStats(stockData);
        renderStockTable(stockData);

    } catch (error) {
        console.error("個股資料讀取失敗：", error);
        showError("個股資料讀取失敗，請稍後再試。");
    }
}

function updateStockHeader(data) {
    const latest = data[0];

    document.getElementById("stockTitle").textContent =
        `${formatValue(latest.stock_id)} ${formatValue(latest.stock_name)}`;

    document.getElementById("stockSubtitle").textContent =
        `目前顯示 ${formatValue(latest.stock_name)} 最近 ${data.length} 筆交易資料。`;

    document.getElementById("displayNote").textContent =
        `資料日期範圍：${formatValue(data[data.length - 1].date)} ～ ${formatValue(data[0].date)}`;
}

function updateStockStats(data) {
    const latest = data[0];

    document.getElementById("stockDataCount").textContent = data.length + " 筆";
    document.getElementById("latestClose").textContent = formatNumber(latest.close);
    document.getElementById("latestChange").textContent = formatPercent(latest.price_change_pct);
    document.getElementById("latestInst").textContent = formatNumber(latest.total_inst_net_buy);
    document.getElementById("latestVolume").textContent = formatNumber(latest.volume);

    document.getElementById("latestChange").className = getChangeClass(latest.price_change_pct);
    document.getElementById("latestInst").className = getNetClass(latest.total_inst_net_buy);
}

function renderStockTable(data) {
    const tableBody = document.getElementById("stockTable");
    tableBody.innerHTML = "";

    data.forEach(item => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${formatValue(item.date)}</td>
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
            <td>${formatPercentFromDecimal(item.turnover_rate)}</td>
            <td>${formatNumber(item.margin_balance)}</td>
        `;

        tableBody.appendChild(row);
    });
}

function showError(message) {
    document.getElementById("stockTitle").textContent = message;
    document.getElementById("displayNote").textContent = message;

    document.getElementById("stockTable").innerHTML = `
        <tr>
            <td colspan="11">${message}</td>
        </tr>
    `;
}