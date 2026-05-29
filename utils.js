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

function getLatestDate(data) {
    const dates = data
        .map(item => item.date)
        .filter(date => date !== null && date !== undefined && date !== "");

    return dates.sort().reverse()[0];
}

function formatScore(value) {
    const num = Number(value);

    if (isNaN(num)) {
        return "--";
    }

    return num.toFixed(2);
}