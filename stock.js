const DATA_URL = "data/ranking_source.json";
const RANKING_URL = "data/stock_scores.json";

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
        loadStockRanking(stockId);
        setupMetricHeaderLinks(stockId);

    } catch (error) {
        console.error("個股資料讀取失敗：", error);
        showError("個股資料讀取失敗，請稍後再試。");
    }
}

async function loadStockRanking(stockId) {
    const scoreBox = document.getElementById("stockScoreBox");

    if (!scoreBox) {
        return;
    }

    try {
        const response = await fetch(RANKING_URL + "?t=" + Date.now());

        if (!response.ok) {
            throw new Error("找不到 data/stock_ranking.json");
        }

        const rankingData = await response.json();

        const normalizedId = String(stockId).padStart(4, "0");

        const item = rankingData.find(item =>
            String(item.stock_id || "").padStart(4, "0") === normalizedId
        );

        if (!item) {
            scoreBox.innerHTML = `
                <div class="score-box-title">排行榜分數</div>
                <div class="score-box-main">--</div>
                <div class="score-box-sub">此股票目前沒有可計算的分數資料</div>
            `;
            return;
        }

        scoreBox.innerHTML = `
            <div class="score-box-title">排行榜分數</div>

            <div class="score-box-main">
                ${formatScore(item.total_score ?? item.score)}
                <span>分</span>
            </div>

            <div class="score-box-detail">
                <span>籌碼 ${formatScore(item.chip_score)}</span>
                <span>價格 ${formatScore(item.price_score)}</span>
                <span>價量 ${formatScore(item.volume_score)}</span>
                <span>心理 ${formatScore(item.psych_score)}</span>
            </div>
        `;

    } catch (error) {
        console.error("排行榜分數讀取失敗：", error);

        scoreBox.innerHTML = `
            <div class="score-box-title">排行榜分數</div>
            <div class="score-box-main">--</div>
            <div class="score-box-sub">排行榜資料讀取失敗</div>
        `;
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

function setupMetricHeaderLinks(stockId) {
    const buttons = document.querySelectorAll(".metric-header-btn");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const metric = button.dataset.metric;

            window.location.href =
                `chart.html?id=${encodeURIComponent(stockId)}&metric=${encodeURIComponent(metric)}`;
        });
    });
}