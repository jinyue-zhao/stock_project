const DATA_URL = "data/stock_ranking.json";

let rankingData = [];
let originalData = [];

window.addEventListener("DOMContentLoaded", () => {
    loadRankingData();

    document.getElementById("searchBtn").addEventListener("click", () => {
        const keyword = document.getElementById("keywordInput").value.trim();
        filterRanking(keyword);
    });

    document.getElementById("keywordInput").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            const keyword = document.getElementById("keywordInput").value.trim();
            filterRanking(keyword);
        }
    });
});

async function loadRankingData() {
    try {
        const response = await fetch(DATA_URL + "?t=" + Date.now());

        if (!response.ok) {
            throw new Error("找不到 data/tpex_stock.json");
        }

        const data = await response.json();

        originalData = data;

        const latestDate = getLatestDate(data);

        rankingData = data
            .filter(item => item.date === latestDate)
            .map(item => {
                return {
                    ...item,
                    score: calculateScore(item)
                };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 100);

        updateRankingStats(rankingData);
        renderRankingTable(rankingData);

        document.getElementById("displayNote").textContent =
            `目前顯示 ${latestDate} 綜合排行前 ${rankingData.length} 名`;

    } catch (error) {
        console.error("排行榜資料讀取失敗：", error);

        document.getElementById("rankingTable").innerHTML = `
            <tr>
                <td colspan="12">排行榜資料讀取失敗，請稍後再試。</td>
            </tr>
        `;
    }
}

function getLatestDate(data) {
    const dates = data
        .map(item => item.date)
        .filter(date => date !== null && date !== undefined && date !== "");

    return dates.sort().reverse()[0];
}

function calculateScore(item) {
    let score = 0;

    const priceChangePct = Number(item.price_change_pct);
    const totalInstNetBuy = Number(item.total_inst_net_buy);
    const foreignNetBuy = Number(item.foreign_net_buy);
    const investmentTrustNetBuy = Number(item.investment_trust_net_buy);
    const volume = Number(item.volume);
    const instTotalRatio = Number(item.inst_total_ratio);
    const turnoverRate = Number(item.turnover_rate);

    // 價格分數
    if (!isNaN(priceChangePct)) {
        if (priceChangePct > 0) score += 10;
        if (priceChangePct >= 2) score += 10;
        if (priceChangePct >= 5) score += 10;
    }

    // 法人分數
    if (!isNaN(totalInstNetBuy)) {
        if (totalInstNetBuy > 0) score += 15;
        if (totalInstNetBuy >= 1000) score += 10;
        if (totalInstNetBuy >= 10000) score += 10;
    }

    // 外資分數
    if (!isNaN(foreignNetBuy) && foreignNetBuy > 0) {
        score += 10;
    }

    // 投信分數
    if (!isNaN(investmentTrustNetBuy) && investmentTrustNetBuy > 0) {
        score += 10;
    }

    // 成交量分數
    if (!isNaN(volume)) {
        if (volume >= 100000) score += 5;
        if (volume >= 500000) score += 5;
        if (volume >= 1000000) score += 5;
    }

    // 法人買超占成交量比例
    if (!isNaN(instTotalRatio)) {
        if (instTotalRatio > 0) score += 5;
        if (instTotalRatio >= 0.1) score += 5;
        if (instTotalRatio >= 0.2) score += 5;
    }

    // 週轉率
    if (!isNaN(turnoverRate)) {
        if (turnoverRate >= 1) score += 5;
        if (turnoverRate >= 3) score += 5;
    }

    return score;
}

function filterRanking(keyword) {
    if (!keyword) {
        renderRankingTable(rankingData);
        updateRankingStats(rankingData);
        document.getElementById("displayNote").textContent =
            `目前顯示綜合排行前 ${rankingData.length} 名`;
        return;
    }

    const filtered = rankingData.filter(item =>
        String(item.stock_id || "").includes(keyword) ||
        String(item.stock_name || "").includes(keyword)
    );

    renderRankingTable(filtered);
    updateRankingStats(filtered);

    document.getElementById("displayNote").textContent =
        `搜尋「${keyword}」，共找到 ${filtered.length} 筆資料`;
}

function updateRankingStats(data) {
    document.getElementById("rankingCount").textContent = data.length + " 筆";

    const validChange = data.filter(item => !isNaN(Number(item.price_change_pct)));

    const avgChange = validChange.length > 0
        ? validChange.reduce((sum, item) => sum + Number(item.price_change_pct), 0) / validChange.length
        : 0;

    const maxUp = validChange.length > 0
        ? Math.max(...validChange.map(item => Number(item.price_change_pct)))
        : 0;

    const instBuyCount = data.filter(item => Number(item.total_inst_net_buy) > 0).length;

    const latestDate = data.length > 0 ? data[0].date : "--";

    document.getElementById("rankingAvgChange").textContent = avgChange.toFixed(2) + "%";
    document.getElementById("rankingInstBuy").textContent = instBuyCount + " 家";
    document.getElementById("rankingMaxUp").textContent = maxUp.toFixed(2) + "%";
    document.getElementById("rankingDate").textContent = latestDate;
}

function renderRankingTable(data) {
    const tableBody = document.getElementById("rankingTable");
    tableBody.innerHTML = "";

    if (data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="12">查無資料</td>
            </tr>
        `;
        return;
    }

    data.forEach((item, index) => {
        const row = document.createElement("tr");

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
            <td class="${getNetClass(item.foreign_net_buy)}">
                ${formatNumber(item.foreign_net_buy)}
            </td>
            <td class="${getNetClass(item.investment_trust_net_buy)}">
                ${formatNumber(item.investment_trust_net_buy)}
            </td>
            <td class="${getNetClass(item.total_inst_net_buy)}">
                ${formatNumber(item.total_inst_net_buy)}
            </td>
            <td>${formatPercentFromDecimal(item.inst_total_ratio)}</td>
            <td><strong>${formatNumber(item.score)}</strong></td>
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

    return num.toFixed(2) + "%";
}

function getChangeClass(value) {
    const num = Number(value);

    if (isNaN(num) || num === 0) {
        return "";
    }

    return num > 0 ? "positive" : "negative";
}

function getNetClass(value) {
    const num = Number(value);

    if (isNaN(num) || num === 0) {
        return "";
    }

    return num > 0 ? "positive" : "negative";
}