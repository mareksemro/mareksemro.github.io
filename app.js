// ─── CONFIG ──────────────────────────────────────────────────────────────────
const STOCKS = [
  { name: "NVDA",       symbol: "NVDA"   },
  { name: "AMD",        symbol: "AMD"    },
  { name: "TSLA",       symbol: "TSLA"   },
  { name: "AAPL",       symbol: "AAPL"   },
  { name: "MSFT",       symbol: "MSFT"   },
  { name: "RHM (DE)",   symbol: "RHM"    },
  { name: "Silver ETF", symbol: "SLV"    },
];

// ─── STATE ────────────────────────────────────────────────────────────────────
let apiKey = localStorage.getItem("finnhub_key") || "";
let currentSymbol = "NVDA";
let currentRes = "5";
let currentDays = 2;
let chart, candleSeries, lineSeries;
let refreshTimer;

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const stockSelect = document.getElementById("stockSelect");
const stockA      = document.getElementById("stockA");
const stockB      = document.getElementById("stockB");
const apiKeyInput = document.getElementById("apiKey");
const saveKeyBtn  = document.getElementById("saveKey");
const hintEl      = document.getElementById("hint");
const priceEl     = document.getElementById("price");
const changeEl    = document.getElementById("change");
const timeEl      = document.getElementById("time");

// ─── INIT SELECTS ─────────────────────────────────────────────────────────────
STOCKS.forEach(s => {
  [stockSelect, stockA, stockB].forEach(sel => {
    sel.innerHTML += `<option value="${s.symbol}">${s.name}</option>`;
  });
});
stockB.value = "AMD";
apiKeyInput.value = apiKey;

// ─── CHART SETUP ─────────────────────────────────────────────────────────────
function initChart() {
  chart = LightweightCharts.createChart(document.getElementById("chart"), {
    width: document.getElementById("chart").clientWidth,
    height: 300,
    layout: { background: { color: "#13161f" }, textColor: "#9299b8" },
    grid: { vertLines: { color: "#1e2130" }, horzLines: { color: "#1e2130" } },
    timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#252836" },
    rightPriceScale: { borderColor: "#252836" },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal }
  });
  candleSeries = chart.addCandlestickSeries({
    upColor: "#26a69a", downColor: "#ef5350",
    borderUpColor: "#26a69a", borderDownColor: "#ef5350",
    wickUpColor: "#26a69a", wickDownColor: "#ef5350"
  });
  window.addEventListener("resize", () => {
    chart.applyOptions({ width: document.getElementById("chart").clientWidth });
  });
}

// ─── FINNHUB FETCH ────────────────────────────────────────────────────────────
async function loadStock(symbol, resolution, days) {
  if (!apiKey) {
    setHint("⚠ Enter your free Finnhub API key below", "");
    priceEl.textContent = "--";
    return;
  }

  priceEl.textContent = "...";
  hintEl.textContent = "Loading...";
  hintEl.className = "hint";

  const to   = Math.floor(Date.now() / 1000);
  const from = to - days * 24 * 3600;

  try {
    // Candles
    const candleUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;
    const res = await fetch(candleUrl);
    const data = await res.json();

    if (data.s !== "ok" || !data.t || data.t.length === 0) {
      throw new Error(data.s === "no_data" ? "No data for this symbol/period" : (data.error || "API error"));
    }

    const candles = data.t.map((t, i) => ({
      time: t,
      open:  data.o[i],
      high:  data.h[i],
      low:   data.l[i],
      close: data.c[i]
    }));

    if (lineSeries) { chart.removeSeries(lineSeries); lineSeries = null; }
    candleSeries.setData(candles);
    chart.timeScale().fitContent();

    // Quote for real-time price
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
    const qRes = await fetch(quoteUrl);
    const q = await qRes.json();

    const price  = q.c || candles[candles.length - 1].close;
    const prev   = q.pc || candles[0].open;
    const diff   = price - prev;
    const pct    = ((diff / prev) * 100).toFixed(2);
    const sign   = diff >= 0 ? "+" : "";

    priceEl.textContent = price.toFixed(2);
    changeEl.textContent = `${sign}${diff.toFixed(2)} (${sign}${pct}%)`;
    changeEl.style.color = diff >= 0 ? "#26a69a" : "#ef5350";
    timeEl.textContent = "Updated " + new Date().toLocaleTimeString();

    // Volume
    const avgVol = data.v.reduce((a, b) => a + b, 0) / data.v.length;
    document.getElementById("vol").textContent =
      avgVol > 1e6 ? (avgVol / 1e6).toFixed(1) + "M" :
      avgVol > 1e3 ? (avgVol / 1e3).toFixed(0) + "K" :
      avgVol.toFixed(0);

    const closes = candles.map(c => c.close);
    computeIndicators(closes);

  } catch (err) {
    console.error(err);
    priceEl.textContent = "Error";
    setHint("⚠ " + err.message, "");
  }
}

// ─── INDICATORS ───────────────────────────────────────────────────────────────
function ema(data, period) {
  const k = 2 / (period + 1);
  const out = [data[0]];
  for (let i = 1; i < data.length; i++) out.push(data[i] * k + out[i - 1] * (1 - k));
  return out;
}

function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  const rs = gains / (losses || 0.0001);
  return 100 - 100 / (1 + rs);
}

function calcMACD(prices) {
  const e12 = ema(prices, 12), e26 = ema(prices, 26);
  const macd = e12.map((v, i) => v - e26[i]);
  const signal = ema(macd, 9);
  return { macd, signal };
}

function computeIndicators(closes) {
  const rsi = calcRSI(closes);
  const { macd, signal } = calcMACD(closes);
  const lastMACD = macd[macd.length - 1];
  const lastSig  = signal[signal.length - 1];

  document.getElementById("rsi").textContent    = rsi != null ? rsi.toFixed(1) : "--";
  document.getElementById("macd").textContent   = lastMACD.toFixed(3);
  document.getElementById("signal").textContent = lastSig.toFixed(3);

  // Colour RSI value
  const rsiEl = document.getElementById("rsi");
  if (rsi < 30) rsiEl.style.color = "#26a69a";
  else if (rsi > 70) rsiEl.style.color = "#ef5350";
  else rsiEl.style.color = "#e2e4ed";

  // Signal
  if (rsi != null && rsi < 30 && lastMACD > lastSig) {
    setHint("Strong buy zone — oversold + bullish MACD crossover", "strong-buy");
  } else if (rsi != null && rsi > 70 && lastMACD < lastSig) {
    setHint("Strong sell zone — overbought + bearish MACD crossover", "strong-sell");
  } else if (lastMACD > lastSig) {
    setHint("Bullish — MACD above signal line", "bull");
  } else if (lastMACD < lastSig) {
    setHint("Bearish — MACD below signal line", "bear");
  } else {
    setHint("Neutral", "neutral");
  }
}

function setHint(text, cls) {
  hintEl.textContent = text;
  hintEl.className = "hint" + (cls ? " " + cls : "");
}

// ─── COMPARE ─────────────────────────────────────────────────────────────────
document.getElementById("compareBtn").addEventListener("click", async () => {
  if (!apiKey) { setHint("⚠ Enter your API key first", ""); return; }
  const symA = stockA.value, symB = stockB.value;
  if (symA === symB) { setHint("Pick two different symbols", "neutral"); return; }

  setHint("Loading compare...", "");
  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 90 * 24 * 3600;
    const [rA, rB] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${symA}&resolution=D&from=${from}&to=${to}&token=${apiKey}`).then(r => r.json()),
      fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${symB}&resolution=D&from=${from}&to=${to}&token=${apiKey}`).then(r => r.json())
    ]);
    if (rA.s !== "ok" || rB.s !== "ok") throw new Error("No data for one or both symbols");

    const base = rA.c[0] / rB.c[0];
    const ratioData = rA.t.map((t, i) => ({
      time: t,
      value: parseFloat((rA.c[i] / rB.c[i] / base).toFixed(4))
    })).filter(d => isFinite(d.value));

    candleSeries.setData([]);
    if (!lineSeries) lineSeries = chart.addLineSeries({ color: "#448aff", lineWidth: 2 });
    lineSeries.setData(ratioData);
    chart.timeScale().fitContent();

    priceEl.textContent = "Ratio";
    changeEl.textContent = symA + " / " + symB;
    changeEl.style.color = "#448aff";
    setHint(symA + " vs " + symB + " — relative performance (90 days, normalised)", "neutral");
  } catch (err) {
    setHint("⚠ Compare failed: " + err.message, "");
  }
});

// ─── EVENTS ───────────────────────────────────────────────────────────────────
stockSelect.addEventListener("change", () => {
  currentSymbol = stockSelect.value;
  reload();
});

document.querySelectorAll(".iv").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".iv").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentRes  = btn.dataset.res;
    currentDays = parseInt(btn.dataset.days);
    reload();
  });
});

saveKeyBtn.addEventListener("click", () => {
  apiKey = apiKeyInput.value.trim();
  localStorage.setItem("finnhub_key", apiKey);
  saveKeyBtn.textContent = "Saved ✓";
  setTimeout(() => saveKeyBtn.textContent = "Save", 1500);
  reload();
});

apiKeyInput.addEventListener("keydown", e => { if (e.key === "Enter") saveKeyBtn.click(); });

// ─── REFRESH LOOP ─────────────────────────────────────────────────────────────
function reload() {
  clearInterval(refreshTimer);
  loadStock(currentSymbol, currentRes, currentDays);
  // Only auto-refresh on intraday intervals
  if (currentRes !== "D") {
    refreshTimer = setInterval(() => loadStock(currentSymbol, currentRes, currentDays), 30000);
  }
}

// ─── BOOT ────────────────────────────────────────────────────────────────────
initChart();
reload();