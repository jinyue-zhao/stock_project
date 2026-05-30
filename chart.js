const CHART_DATA_URL = "data/chart_data.json";

let metricChart = null;

window.addEventListener("DOMContentLoaded", () => {
    loadMetricChart();

    const backBtn = document.getElementById("backBtn");
    const params = new URLSearchParams(window.location.search);
    const stockId = params.get("id");

    if (backBtn && stockId) {
        backBtn.addEventListener("click", () => {
            window.location.href = `stock.html?id=${encodeURIComponent(stockId)}`;
        });
    }
});

async function loadMetricChart() {
    const params = new URLSearchParams(window.location.search);
    const stockId = params.get("id");
    const metric = params.get("metric");

    if (!stockId || !metric) {
        showChartError("缺少股票代號或指標參數");
        return;
    }

    try {
        const response = await fetch(CHART_DATA_URL + "?t=" + Date.now());

        if (!response.ok) {
            throw new Error("找不到 data/chart_data.json");
        }

        const chartData = await response.json();

        const normalizedId = String(stockId).padStart(4, "0");
        const stock = chartData[normalizedId];

        if (!stock) {
            showChartError(`查無股票代號 ${stockId} 的圖表資料`);
            return;
        }

        const metricName = stock.metrics[metric] || metric;

        const labels = stock.data.map(item => item.date);
        const values = stock.data.map(item => {
            const value = item[metric];
            return value === null || value === undefined ? null : Number(value);
        });

        document.getElementById("chartTitle").textContent =
            `${stock.stock_id} ${stock.stock_name}`;

        document.getElementById("chartSubtitle").textContent =
            `目前顯示 ${stock.stock_name} 最近 ${stock.data.length} 筆交易資料。`;

        document.getElementById("metricTitle").textContent =
            `${metricName}走勢圖`;

        document.getElementById("displayNote").textContent =
            `指標：${metricName}`;

        renderLineChart(labels, values, metricName);

    } catch (error) {
        console.error("圖表資料讀取失敗：", error);
        showChartError("圖表資料讀取失敗，請稍後再試。");
    }
}

function renderLineChart(labels, values, metricName) {
    const ctx = document.getElementById("metricChart");

    if (metricChart) {
        metricChart.destroy();
    }

    metricChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: metricName,
                    data: values,
                    tension: 0.25,
                    spanGaps: true,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false,
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;

                            if (value === null || value === undefined) {
                                return `${metricName}: --`;
                            }

                            if (
                                metricName.includes("漲跌幅") ||
                                metricName.includes("比例") ||
                                metricName.includes("換手率") ||
                                metricName.includes("法人/成交量")
                            ) {
                                return `${metricName}: ${value.toFixed(3)}%`;
                            }

                            return `${metricName}: ${Number(value).toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "日期"
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: metricName
                    }
                }
            }
        }
    });
}

function showChartError(message) {
    document.getElementById("chartTitle").textContent = message;
    document.getElementById("displayNote").textContent = message;
}