const stocks = [
    { name: "NVDA", symbol: "NVDA" },
    { name: "AMD", symbol: "AMD" },
    { name: "RHM", symbol: "RHM.DE" },
    { name: "CSG", symbol: "CS.PA" },
    { name: "Silver", symbol: "XAD6.DE" }
];

const select = document.getElementById("stockSelect");
const stockA = document.getElementById("stockA");
const stockB = document.getElementById("stockB");

stocks.forEach(s => {
    select.innerHTML += `<option value="${s.symbol}">${s.name}</option>`;
    stockA.innerHTML += `<option value="${s.symbol}">${s.name}</option>`;
    stockB.innerHTML += `<option value="${s.symbol}">${s.name}</option>`;
});

let chart = LightweightCharts.createChart(document.getElementById('chart'), {
    layout: { background: { color: '#0d0f14' }, textColor: '#DDD' },
    grid: { vertLines: { color: '#1a1d25' }, horzLines: { color: '#1a1d25' } }
});

let lineSeries = chart.addLineSeries();

select.addEventListener("change", () => loadStock(select.value));

async function loadStock(symbol) {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
    const data = await res.json();

    const result = data.chart.result[0];
    const prices = result.indicators.quote[0].close;
    const times = result.timestamp;

    const formatted = prices.map((p, i) => ({
        time: times[i],
        value: p
    }));

    lineSeries.setData(formatted);

    const lastPrice = prices[prices.length - 1];
    document.getElementById("price").innerText = "€ " + lastPrice.toFixed(2);

    document.getElementById("time").innerText =
        new Date(times[times.length - 1] * 1000).toLocaleTimeString();

    calculateRSI(prices);
}

// RSI calculation
function calculateRSI(prices, period = 14) {
    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
        let diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }

    let rs = gains / losses;
    let rsi = 100 - (100 / (1 + rs));

    document.getElementById("rsi").innerText = "RSI: " + rsi.toFixed(2);
}

// Compare feature
async function compare() {
    const symA = stockA.value;
    const symB = stockB.value;

    const resA = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symA}`);
    const resB = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symB}`);

    const dataA = await resA.json();
    const dataB = await resB.json();

    const pricesA = dataA.chart.result[0].indicators.quote[0].close;
    const pricesB = dataB.chart.result[0].indicators.quote[0].close;
    const times = dataA.chart.result[0].timestamp;

    let ratio = pricesA.map((p, i) => ({
        time: times[i],
        value: p / pricesB[i]
    }));

    lineSeries.setData(ratio);

    document.getElementById("price").innerText = "Ratio Mode";
}
