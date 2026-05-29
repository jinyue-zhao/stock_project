const DATA_URL = "data/stock_ranking.json";

let rankingData = [];
let allRankingData = [];

window.addEventListener("DOMContentLoaded", () => {
    loadRankingData();
});

async function loadRankingData() {
    try {
        const response = await fetch(DATA_URL + "?t=" + Date.now());

        if (!response.ok) {
            throw new Error("找不到 data/stock_ranking.json");
        }

        const data = await response.json();

        allRankingData = data;
        rankingData = data;

        updateRankingStats(rankingData);
        renderRankingTable(rankingData);

        const latestDate = rankingData.length > 0 ? rankingData[0].date : "--";

        document.getElementById("displayNote").textContent =
            `目前顯示 ${latestDate} 股票排行前 ${rankingData.length} 名`;

    } catch (error) {
        console.error("排行榜資料讀取失敗：", error);

        document.getElementById("rankingTable").innerHTML = `
            <tr>
                <td colspan="13">排行榜資料讀取失敗，請確認 data/stock_ranking.json 是否存在。</td>
            </tr>
        `;
    }
}

function updateRankingStats(data) {
    document.getElementById("rankingCount").textContent = data.length + " 筆";

    const validScores = data.filter(item => !isNaN(Number(item.total_score ?? item.score)));

    const avgScore = validScores.length > 0
        ? validScores.reduce((sum, item) => sum + Number(item.total_score ?? item.score), 0) / validScores.length
        : 0;

    const maxScore = validScores.length > 0
        ? Math.max(...validScores.map(item => Number(item.total_score ?? item.score)))
        : 0;

    const instBuyCount = data.filter(item => Number(item.total_inst_net_buy) > 0).length;

    const latestDate = data.length > 0 ? data[0].date : "--";

    document.getElementById("rankingAvgChange").textContent = avgScore.toFixed(2) + " 分";
    document.getElementById("rankingInstBuy").textContent = instBuyCount + " 家";
    document.getElementById("rankingMaxUp").textContent = maxScore.toFixed(2) + " 分";
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

        row.classList.add("clickable-row");
        row.addEventListener("click", () => {
            window.location.href = `stock.html?id=${encodeURIComponent(item.stock_id)}`;
        });

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${formatValue(item.stock_id)}</td>
            <td>${formatValue(item.stock_name)}</td>

            <td class="score-cell">
                <strong>${formatScore(item.total_score ?? item.score)}</strong>
            </td>

            <td>${formatScore(item.chip_score)}</td>
            <td>${formatScore(item.price_score)}</td>
            <td>${formatScore(item.volume_score)}</td>
            <td>${formatScore(item.psych_score)}</td>

            <td>${formatNumber(item.close)}</td>

            <td class="${getChangeClass(item.price_change_pct)}">
                ${formatPercent(item.price_change_pct)}
            </td>

            <td class="${getNetClass(item.total_inst_net_buy)}">
                ${formatNumber(item.total_inst_net_buy)}
            </td>

            <td>${formatNumber(item.volume)}</td>
        `;

        tableBody.appendChild(row);
    });
}