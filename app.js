const API_KEY = "3P3S56S1VEANGXKN";

const stocks = [
    { name: "NVDA", symbol: "NVDA" },
    { name: "AMD", symbol: "AMD" },
    { name: "RHM", symbol: "RHM.DE" },
    { name: "CSG", symbol: "CS.PA" }
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

// ⚠️ Alpha Vantage limit = 5 requests/min
setInterval(() => loadStock(currentSymbol), 60000);

select.addEventListener("change", () => {
    currentSymbol = select.value;
    loadStock(currentSymbol);
});

async function loadStock(symbol) {
    try {
        document.getElementById("price").innerText = "Loading...";

        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&apikey=${API_KEY}`;

        const res = await fetch(url);
        const data = await res.json();

        const series = data["Time Series (5min)"];
        if (!series) throw "No data (API limit hit?)";

        let candles = [];

        Object.keys(series).slice(0, 100).forEach(time => {
            const d = series[time];

            candles.push({
                time: Math.floor(new Date(time).getTime() / 1000),
                open: parseFloat(d["1. open"]),
                high: parseFloat(d["2. high"]),
                low: parseFloat(d["3. low"]),
                close: parseFloat(d["4. close"])
            });
        });

        candles.reverse();

        candleSeries.setData(candles);

        const closes = candles.map(c => c.close);
        const lastPrice = closes[closes.length - 1];

        document.getElementById("price").innerText = "€ " + lastPrice.toFixed(2);
        document.getElementById("time").innerText =
            new Date(candles[candles.length - 1].time * 1000).toLocaleTimeString();

        calculateIndicators(closes);

    } catch (err) {
        console.log(err);
        document.getElementById("price").innerText = "⚠️ API limit / error";
        document.getElementById("hint").innerText = "Wait 1 min (Alpha limit)";
    }
}

// RSI
function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;

    let gains = 0, losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
        let diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }

    if (losses === 0) return 100;

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

// SIGNAL
function generateHint(rsi, macd, signal) {
    let text = "Neutral";

    if (rsi < 30 && macd > signal) text = "💚 Strong Buy";
    else if (rsi > 70 && macd < signal) text = "🔴 Strong Sell";
    else if (macd > signal) text = "📈 Bullish";
    else if (macd < signal) text = "📉 Bearish";

    document.getElementById("hint").innerText = text;
}

// INIT
loadStock(currentSymbol);