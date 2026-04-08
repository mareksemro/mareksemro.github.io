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

let candleSeries = chart.addCandlestickSeries();
let currentSymbol = "NVDA";

// AUTO REFRESH
setInterval(() => loadStock(currentSymbol), 10000);

select.addEventListener("change", () => {
    currentSymbol = select.value;
    loadStock(currentSymbol);
});

async function loadStock(symbol) {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=1d`);
    const data = await res.json();

    const result = data.chart.result[0];
    const q = result.indicators.quote[0];
    const times = result.timestamp;

    let candles = times.map((t, i) => ({
        time: t,
        open: q.open[i],
        high: q.high[i],
        low: q.low[i],
        close: q.close[i]
    }));

    candleSeries.setData(candles);

    const lastPrice = q.close[q.close.length - 1];
    document.getElementById("price").innerText = "€ " + lastPrice.toFixed(2);
    document.getElementById("time").innerText =
        new Date(times[times.length - 1] * 1000).toLocaleTimeString();

    calculateIndicators(q.close);
}

// RSI
function calculateRSI(prices, period = 14) {
    let gains = 0, losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
        let diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }

    let rs = gains / losses;
    return 100 - (100 / (1 + rs));
}

// EMA
function ema(data, period) {
    let k = 2 / (period + 1);
    let emaArr = [data[0]];

    for (let i = 1; i < data.length; i++) {
        emaArr.push(data[i] * k + emaArr[i - 1] * (1 - k));
    }

    return emaArr;
}

// MACD
function calculateMACD(prices) {
    let ema12 = ema(prices, 12);
    let ema26 = ema(prices, 26);

    let macd = ema12.map((v, i) => v - ema26[i]);
    let signal = ema(macd, 9);

    return { macd, signal };
}

function calculateIndicators(prices) {
    let rsi = calculateRSI(prices);
    let { macd, signal } = calculateMACD(prices);

    let lastMACD = macd[macd.length - 1];
    let lastSignal = signal[signal.length - 1];

    document.getElementById("rsi").innerText = "RSI: " + rsi.toFixed(2);
    document.getElementById("macd").innerText = "MACD: " + lastMACD.toFixed(2);
    document.getElementById("signal").innerText = "Signal: " + lastSignal.toFixed(2);

    generateHint(rsi, lastMACD, lastSignal);
}

// SIGNAL LOGIC
function generateHint(rsi, macd, signal) {
    let text = "Neutral";

    if (rsi < 30 && macd > signal) text = "💚 Strong Buy Zone";
    else if (rsi > 70 && macd < signal) text = "🔴 Strong Sell Zone";
    else if (macd > signal) text = "📈 Bullish Trend";
    else if (macd < signal) text = "📉 Bearish Trend";

    document.getElementById("hint").innerText = text;
}

// COMPARE
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

    chart.removeSeries(candleSeries);
    let lineSeries = chart.addLineSeries();
    lineSeries.setData(ratio);

    document.getElementById("price").innerText = "Ratio Mode";
}

// INIT
loadStock(currentSymbol);