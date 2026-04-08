const API_KEY = "d7b665hr01ql9e4lfeg0d7b665hr01ql9e4lfegg";

const stocks = [
    { name: "NVDA", symbol: "NVDA" },
    { name: "AMD", symbol: "AMD" },
    { name: "RHM", symbol: "RHM.DE" },
    { name: "CSG", symbol: "CS.PA" }
];

// UI Elements
const select = document.getElementById("stockSelect");
const stockA = document.getElementById("stockA");
const stockB = document.getElementById("stockB");
const priceEl = document.getElementById("price");
const hintEl = document.getElementById("hint");

// Initialize Select Menus
stocks.forEach(s => {
    const opt = `<option value="${s.symbol}">${s.name}</option>`;
    select.innerHTML += opt;
    stockA.innerHTML += opt;
    stockB.innerHTML += opt;
});

// Initialize Chart
const chartElement = document.getElementById('chart');
let chart = LightweightCharts.createChart(chartElement, {
    width: chartElement.clientWidth,
    height: 400,
    layout: { background: { color: '#0d0f14' }, textColor: '#DDD' },
    grid: { vertLines: { color: '#1a1d25' }, horzLines: { color: '#1a1d25' } },
    timeScale: { timeVisible: true, secondsVisible: false }
});

let candleSeries = chart.addCandlestickSeries({
    upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
    wickUpColor: '#26a69a', wickDownColor: '#ef5350',
});

let currentSymbol = "NVDA";
let currentRes = "5"; // Finnhub resolutions: 1, 5, 15, 30, 60, D, W, M

// Handle Window Resize
window.addEventListener('resize', () => {
    chart.applyOptions({ width: chartElement.clientWidth });
});

// Handle Interval Buttons
document.querySelectorAll('.iv').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.iv').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentRes = e.target.getAttribute('data-res');
        loadStock(currentSymbol, currentRes);
    });
});

select.addEventListener("change", () => {
    currentSymbol = select.value;
    loadStock(currentSymbol, currentRes);
});

async function loadStock(symbol, res) {
    try {
        priceEl.innerText = "Loading...";
        
        // Calculate Timeframe (To = now, From = X days ago)
        const to = Math.floor(Date.now() / 1000);
        let daysAgo = 2;
        if (res === "60") daysAgo = 14;
        if (res === "D") daysAgo = 180;
        const from = to - (daysAgo * 24 * 60 * 60);

        const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${res}&from=${from}&to=${to}&token=${API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.s !== "ok") {
            throw "No data found or API limit hit";
        }

        // Map Finnhub arrays {c, h, l, o, t} to Lightweight Charts format
        const candles = data.t.map((time, i) => ({
            time: time, // Finnhub already provides Unix seconds
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i]
        }));

        candleSeries.setData(candles);
        chart.timeScale().fitContent();

        const lastPrice = candles[candles.length - 1].close;
        priceEl.innerText = "$" + lastPrice.toFixed(2);
        document.getElementById("time").innerText = new Date(candles[candles.length - 1].time * 1000).toLocaleTimeString();

        calculateIndicators(candles.map(c => c.close));

    } catch (err) {
        console.error(err);
        priceEl.innerText = "⚠️ Error";
        hintEl.innerText = "Check Console / API Key";
    }
}

// --- INDICATORS (Unchanged Logic) ---

function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
        let diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    return losses === 0 ? 100 : 100 - (100 / (1 + (gains / losses)));
}

function ema(data, period) {
    let k = 2 / (period + 1);
    let emaArr = [data[0]];
    for (let i = 1; i < data.length; i++) {
        emaArr.push(data[i] * k + emaArr[i - 1] * (1 - k));
    }
    return emaArr;
}

function calculateIndicators(prices) {
    let rsi = calculateRSI(prices);
    let ema12 = ema(prices, 12);
    let ema26 = ema(prices, 26);
    let macdVal = ema12[ema12.length - 1] - ema26[ema26.length - 1];
    let signalVal = ema12[ema12.length - 2] - ema26[ema26.length - 2]; // Simple signal approximation

    document.getElementById("rsi").innerText = rsi.toFixed(2);
    document.getElementById("macd").innerText = macdVal.toFixed(2);
    document.getElementById("signal").innerText = signalVal.toFixed(2);

    generateHint(rsi, macdVal, signalVal);
}

function generateHint(rsi, macd, signal) {
    let text = "Neutral";
    if (rsi < 35 && macd > signal) text = "💚 Strong Buy";
    else if (rsi > 65 && macd < signal) text = "🔴 Strong Sell";
    else if (macd > signal) text = "📈 Bullish";
    else if (macd < signal) text = "📉 Bearish";
    hintEl.innerText = text;
}

// Start
loadStock(currentSymbol, currentRes);