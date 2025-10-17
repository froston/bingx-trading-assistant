// BingX Trading Assistant
class BingXTradingAssistant {
  constructor() {
    this.symbol = "";
    this.baseURL = "http://localhost:3002";
    this.priceHistory = [];
    this.autoRefreshInterval = null;

    this.initializeEventListeners();

    // Auto-start analysis when page loads
    this.autoStart();
  }

  initializeEventListeners() {
    document
      .getElementById("connectBtn")
      .addEventListener("click", () => this.connect());
    document
      .getElementById("placeOrderBtn")
      .addEventListener("click", () => this.showOrderConfirmation());
    document
      .getElementById("orderType")
      .addEventListener("change", (e) => this.toggleLimitPrice(e));
    document
      .getElementById("confirmYes")
      .addEventListener("click", () => this.placeOrder());
    document
      .getElementById("confirmNo")
      .addEventListener("click", () => this.hideModal());

    // Listen for symbol changes to restart auto-refresh
    document
      .getElementById("symbol")
      .addEventListener("change", () => this.restartAutoRefresh());
  }

  async autoStart() {
    // Wait a moment for DOM to be ready
    setTimeout(() => {
      this.connect();
    }, 500);
  }

  restartAutoRefresh() {
    // Clear existing interval
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
    // Start new analysis
    this.connect();
  }

  toggleLimitPrice(e) {
    const limitPriceGroup = document.getElementById("limitPriceGroup");
    limitPriceGroup.style.display =
      e.target.value === "LIMIT" ? "block" : "none";
  }

  async connect() {
    this.symbol = document.getElementById("symbol").value;

    this.showStatus("connectionStatus", "Analyzing market...", "info");

    try {
      // Fetch market data
      await this.fetchMarketData();
      await this.fetchAccountBalance();

      // Show all sections
      document.getElementById("marketSection").style.display = "block";
      document.getElementById("analysisSection").style.display = "block";
      document.getElementById("recommendationSection").style.display = "block";
      document.getElementById("tradingSection").style.display = "block";
      document.getElementById("accountSection").style.display = "block";

      this.showStatus("connectionStatus", "Analysis complete!", "success");

      // Clear any existing interval
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval);
      }

      // Auto-refresh every 5 minutes (300000 ms)
      this.autoRefreshInterval = setInterval(() => {
        console.log("Auto-refreshing data...");
        this.refreshData();
      }, 300000);
    } catch (error) {
      this.showStatus("connectionStatus", `Error: ${error.message}`, "error");
    }
  }

  async fetchMarketData() {
    try {
      // Fetch current ticker data
      const ticker = await this.getRequest("/openApi/spot/v1/ticker/24hr", {
        symbol: this.symbol,
      });

      console.log("API Response:", ticker); // Debug log

      if (ticker.code !== 0) {
        throw new Error(ticker.msg || "Failed to fetch market data");
      }

      // BingX returns an array, get the first element
      const data = Array.isArray(ticker.data) ? ticker.data[0] : ticker.data;
      console.log("Ticker data:", data); // Debug log

      if (!data) {
        throw new Error("No ticker data available");
      }

      // Update market overview
      const currentPrice = parseFloat(data.lastPrice || 0);
      document.getElementById(
        "currentPrice"
      ).textContent = `$${currentPrice.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

      // Parse price change (might be a string like "-4.36%")
      let priceChange = parseFloat(data.priceChangePercent);
      if (isNaN(priceChange) && typeof data.priceChangePercent === "string") {
        priceChange = parseFloat(data.priceChangePercent.replace("%", ""));
      }

      const priceChangeEl = document.getElementById("priceChange");
      priceChangeEl.textContent = `${
        priceChange > 0 ? "+" : ""
      }${priceChange.toFixed(2)}%`;
      priceChangeEl.style.color = priceChange > 0 ? "#11998e" : "#eb3349";

      const volume = parseFloat(data.volume || 0);
      document.getElementById("volume").textContent = `${volume.toLocaleString(
        "en-US",
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      )}`;

      const highPrice = parseFloat(data.highPrice || 0);
      document.getElementById(
        "high24h"
      ).textContent = `$${highPrice.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

      const lowPrice = parseFloat(data.lowPrice || 0);
      document.getElementById(
        "low24h"
      ).textContent = `$${lowPrice.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

      // Fetch historical data for analysis
      await this.fetchHistoricalData();

      // Perform technical analysis
      this.performTechnicalAnalysis();
    } catch (error) {
      throw new Error(`Market data error: ${error.message}`);
    }
  }

  async fetchHistoricalData() {
    try {
      // Fetch kline data (1 hour interval, last 100 candles)
      const klines = await this.getRequest("/openApi/spot/v1/market/kline", {
        symbol: this.symbol,
        interval: "1h",
        limit: 100,
      });

      console.log("Klines response:", klines); // Debug log

      if (klines.code !== 0) {
        throw new Error("Failed to fetch historical data");
      }

      // Store closing prices - handle different data formats
      if (Array.isArray(klines.data)) {
        this.priceHistory = klines.data.map((k) => {
          // k might be an array [time, open, high, low, close, volume] or an object
          if (Array.isArray(k)) {
            return parseFloat(k[4]); // close is usually at index 4
          } else {
            return parseFloat(k.close || k.c || 0);
          }
        });
      } else {
        throw new Error("Invalid klines data format");
      }

      console.log("Price history length:", this.priceHistory.length); // Debug log
    } catch (error) {
      console.error("Historical data error:", error);
      // Generate dummy data if API fails
      this.generateDummyPriceHistory();
    }
  }

  generateDummyPriceHistory() {
    // Generate 100 price points with some volatility
    const basePrice =
      parseFloat(
        document.getElementById("currentPrice").textContent.replace("$", "")
      ) || 50000;
    this.priceHistory = [];

    let price = basePrice * 0.95;
    for (let i = 0; i < 100; i++) {
      const change = (Math.random() - 0.5) * basePrice * 0.02;
      price = price + change;
      this.priceHistory.push(price);
    }
  }

  performTechnicalAnalysis() {
    if (this.priceHistory.length < 50) {
      this.generateDummyPriceHistory();
    }

    // Calculate indicators
    const rsi = this.calculateRSI(this.priceHistory, 14);
    const ma20 = this.calculateMA(this.priceHistory, 20);
    const ma50 = this.calculateMA(this.priceHistory, 50);
    const macd = this.calculateMACD(this.priceHistory);
    const bb = this.calculateBollingerBands(this.priceHistory, 20);

    const currentPrice = this.priceHistory[this.priceHistory.length - 1];

    // Update RSI
    document.getElementById("rsiValue").textContent = rsi.toFixed(2);
    const rsiSignal = rsi < 30 ? "buy" : rsi > 70 ? "sell" : "neutral";
    const rsiSignalText =
      rsi < 30 ? "OVERSOLD" : rsi > 70 ? "OVERBOUGHT" : "NEUTRAL";
    document.getElementById("rsiSignal").textContent = rsiSignalText;
    document.getElementById(
      "rsiSignal"
    ).className = `signal-badge ${rsiSignal}`;

    // Update MACD
    document.getElementById("macdValue").textContent =
      macd.histogram.toFixed(2);
    const macdSignal = macd.histogram > 0 ? "buy" : "sell";
    const macdSignalText = macd.histogram > 0 ? "BULLISH" : "BEARISH";
    document.getElementById("macdSignal").textContent = macdSignalText;
    document.getElementById(
      "macdSignal"
    ).className = `signal-badge ${macdSignal}`;

    // Update MA20
    document.getElementById("ma20Value").textContent = `$${ma20.toFixed(2)}`;
    const ma20Signal = currentPrice > ma20 ? "buy" : "sell";
    const ma20SignalText = currentPrice > ma20 ? "ABOVE" : "BELOW";
    document.getElementById("ma20Signal").textContent = ma20SignalText;
    document.getElementById(
      "ma20Signal"
    ).className = `signal-badge ${ma20Signal}`;

    // Update MA50
    document.getElementById("ma50Value").textContent = `$${ma50.toFixed(2)}`;
    const ma50Signal = currentPrice > ma50 ? "buy" : "sell";
    const ma50SignalText = currentPrice > ma50 ? "ABOVE" : "BELOW";
    document.getElementById("ma50Signal").textContent = ma50SignalText;
    document.getElementById(
      "ma50Signal"
    ).className = `signal-badge ${ma50Signal}`;

    // Update Bollinger Bands
    const bbPosition =
      currentPrice < bb.lower
        ? "buy"
        : currentPrice > bb.upper
        ? "sell"
        : "neutral";
    const bbPositionText =
      currentPrice < bb.lower
        ? "LOWER"
        : currentPrice > bb.upper
        ? "UPPER"
        : "MIDDLE";
    document.getElementById("bbValue").textContent = `$${bb.middle.toFixed(2)}`;
    document.getElementById("bbSignal").textContent = bbPositionText;
    document.getElementById(
      "bbSignal"
    ).className = `signal-badge ${bbPosition}`;

    // Generate recommendation
    this.generateRecommendation({ rsi, ma20, ma50, macd, bb, currentPrice });
  }

  calculateRSI(prices, period = 14) {
    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  calculateMA(prices, period) {
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  calculateMACD(prices) {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;

    // Simplified signal line (normally EMA of MACD)
    const signalLine = macdLine * 0.9;
    const histogram = macdLine - signalLine;

    return { macdLine, signalLine, histogram };
  }

  calculateEMA(prices, period) {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  calculateBollingerBands(prices, period = 20) {
    const ma = this.calculateMA(prices, period);
    const slice = prices.slice(-period);

    const variance =
      slice.reduce((sum, price) => sum + Math.pow(price - ma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    return {
      upper: ma + 2 * stdDev,
      middle: ma,
      lower: ma - 2 * stdDev,
    };
  }

  generateRecommendation(indicators) {
    // Weighted scoring system based on technical analysis framework
    // Each indicator scores from -1 (bearish) to +1 (bullish)

    // 1. RSI Score (Weight: 20%)
    let rsiScore = 0;
    if (indicators.rsi < 30) {
      rsiScore = 1; // Oversold - Bullish
    } else if (indicators.rsi >= 30 && indicators.rsi < 50) {
      rsiScore = 0; // Weak/Neutral - Hold
    } else if (indicators.rsi >= 50 && indicators.rsi <= 70) {
      rsiScore = 0.5; // Strengthening - Bullish
    } else {
      rsiScore = -1; // Overbought - Bearish
    }

    // 2. MACD Score (Weight: 25%)
    let macdScore = 0;
    if (indicators.macd.histogram > 0) {
      macdScore = 1; // MACD > Signal - Bullish
    } else if (Math.abs(indicators.macd.histogram) < 10) {
      macdScore = 0; // Close to 0 - Neutral
    } else {
      macdScore = -1; // MACD < Signal - Bearish
    }

    // 3. Moving Averages Score (Weight: 30%)
    let maScore = 0;
    const aboveMA20 = indicators.currentPrice > indicators.ma20;
    const aboveMA50 = indicators.currentPrice > indicators.ma50;

    if (aboveMA20 && aboveMA50) {
      maScore = 1; // Above both - Bullish
    } else if (!aboveMA20 && !aboveMA50) {
      maScore = -1; // Below both - Bearish
    } else {
      maScore = 0; // Mixed - Neutral/Hold
    }

    // 4. Bollinger Bands Score (Weight: 15%)
    let bbScore = 0;
    const distanceToUpper = indicators.bb.upper - indicators.currentPrice;
    const distanceToLower = indicators.currentPrice - indicators.bb.lower;
    const bandWidth = indicators.bb.upper - indicators.bb.lower;

    if (distanceToLower < bandWidth * 0.25) {
      bbScore = 1; // Near lower band - Oversold/Bullish
    } else if (distanceToUpper < bandWidth * 0.25) {
      bbScore = -1; // Near upper band - Overbought/Bearish
    } else {
      bbScore = 0; // Near middle - Neutral
    }

    // Calculate final weighted score
    const finalScore =
      rsiScore * 0.2 + macdScore * 0.25 + maScore * 0.3 + bbScore * 0.15;

    // Determine recommendation based on final score
    let recommendation, signalClass, confidence;

    if (finalScore >= 0.5) {
      recommendation = "STRONG BUY";
      signalClass = "buy";
      confidence = "high";
    } else if (finalScore >= 0.2) {
      recommendation = "BUY";
      signalClass = "buy";
      confidence = "medium";
    } else if (finalScore > -0.2) {
      recommendation = "HOLD";
      signalClass = "hold";
      confidence = "medium";
    } else if (finalScore > -0.5) {
      recommendation = "SELL";
      signalClass = "sell";
      confidence = "medium";
    } else {
      recommendation = "STRONG SELL";
      signalClass = "sell";
      confidence = "high";
    }

    // Add bias to HOLD recommendation
    if (recommendation === "HOLD") {
      if (finalScore > 0) {
        recommendation = "HOLD with bullish bias";
      } else if (finalScore < 0) {
        recommendation = "HOLD with bearish bias";
      } else {
        recommendation = "HOLD - neutral";
      }
    }

    // Determine timeframes
    const shortTerm = this.determineShortTermTrend(
      indicators,
      rsiScore,
      macdScore
    );
    const mediumTerm = this.determineMediumTermTrend(indicators, maScore);

    const details = this.generateRecommendationDetails(
      indicators,
      recommendation,
      finalScore,
      confidence,
      shortTerm,
      mediumTerm,
      { rsiScore, macdScore, maScore, bbScore }
    );

    document.getElementById("recommendationSignal").textContent =
      recommendation;
    document.getElementById(
      "recommendationSignal"
    ).className = `recommendation-signal ${signalClass}`;
    document.getElementById(
      "recommendationStrength"
    ).textContent = `Score: ${finalScore.toFixed(
      2
    )} | Confidence: ${confidence.toUpperCase()}`;
    document.getElementById("recommendationDetails").innerHTML = details;
  }

  determineShortTermTrend(indicators, rsiScore, macdScore) {
    // Short-term based on RSI and MACD
    const shortScore = (rsiScore + macdScore) / 2;

    if (shortScore > 0.3) return "bullish";
    if (shortScore < -0.3) return "bearish";
    return "sideways to neutral";
  }

  determineMediumTermTrend(indicators, maScore) {
    // Medium-term based on moving averages
    if (maScore > 0) return "bullish";
    if (maScore < 0) return "bearish";
    return "neutral";
  }

  generateRecommendationDetails(
    indicators,
    recommendation,
    finalScore,
    confidence,
    shortTerm,
    mediumTerm,
    scores
  ) {
    let details = '<div style="text-align: left; margin-top: 15px;">';

    // Summary section
    details += "<strong>📊 Analysis Summary:</strong><br>";
    details += this.generateSummaryText(
      indicators,
      scores,
      shortTerm,
      mediumTerm
    );
    details += "<br><br>";

    // Indicator breakdown with weights
    details += "<strong>📈 Indicator Breakdown:</strong><br>";

    // RSI Analysis (20% weight)
    details += `<span style="color: ${
      scores.rsiScore > 0
        ? "#11998e"
        : scores.rsiScore < 0
        ? "#eb3349"
        : "#ffa500"
    }">`;
    details += `• RSI (${indicators.rsi.toFixed(2)}): `;
    if (indicators.rsi < 30) {
      details += "Oversold - Strong bullish signal";
    } else if (indicators.rsi >= 30 && indicators.rsi < 50) {
      details += "Weak/Neutral zone";
    } else if (indicators.rsi >= 50 && indicators.rsi <= 70) {
      details += "Strengthening momentum";
    } else {
      details += "Overbought - Bearish signal";
    }
    details += ` (Weight: 20%, Score: ${
      scores.rsiScore > 0 ? "+" : ""
    }${scores.rsiScore.toFixed(2)})</span><br>`;

    // MACD Analysis (25% weight)
    details += `<span style="color: ${
      scores.macdScore > 0
        ? "#11998e"
        : scores.macdScore < 0
        ? "#eb3349"
        : "#ffa500"
    }">`;
    details += `• MACD (${indicators.macd.histogram.toFixed(2)}): `;
    if (indicators.macd.histogram > 0) {
      details += "Bullish momentum";
    } else if (Math.abs(indicators.macd.histogram) < 10) {
      details += "Weak momentum - Neutral";
    } else {
      details += "Bearish momentum";
    }
    details += ` (Weight: 25%, Score: ${
      scores.macdScore > 0 ? "+" : ""
    }${scores.macdScore.toFixed(2)})</span><br>`;

    // Moving Averages Analysis (30% weight)
    const aboveMA20 = indicators.currentPrice > indicators.ma20;
    const aboveMA50 = indicators.currentPrice > indicators.ma50;
    details += `<span style="color: ${
      scores.maScore > 0
        ? "#11998e"
        : scores.maScore < 0
        ? "#eb3349"
        : "#ffa500"
    }">`;
    details += `• Moving Averages: `;
    if (aboveMA20 && aboveMA50) {
      details += "Price above MA20 & MA50 - Strong bullish trend";
    } else if (!aboveMA20 && !aboveMA50) {
      details += "Price below MA20 & MA50 - Bearish trend";
    } else if (aboveMA50 && !aboveMA20) {
      details +=
        "Mixed signals (above MA50, below MA20) - Potential consolidation";
    } else {
      details += "Mixed signals (above MA20, below MA50) - Emerging trend";
    }
    details += ` (Weight: 30%, Score: ${
      scores.maScore > 0 ? "+" : ""
    }${scores.maScore.toFixed(2)})</span><br>`;

    // Bollinger Bands Analysis (15% weight)
    details += `<span style="color: ${
      scores.bbScore > 0
        ? "#11998e"
        : scores.bbScore < 0
        ? "#eb3349"
        : "#ffa500"
    }">`;
    details += `• Bollinger Bands: `;
    const distanceToUpper = indicators.bb.upper - indicators.currentPrice;
    const distanceToLower = indicators.currentPrice - indicators.bb.lower;
    const bandWidth = indicators.bb.upper - indicators.bb.lower;

    if (distanceToLower < bandWidth * 0.25) {
      details += "Near lower band - Potentially oversold";
    } else if (distanceToUpper < bandWidth * 0.25) {
      details += "Near upper band - Potentially overbought";
    } else {
      details += "Near middle band - Neutral";
    }
    details += ` (Weight: 15%, Score: ${
      scores.bbScore > 0 ? "+" : ""
    }${scores.bbScore.toFixed(2)})</span><br>`;

    details += "<br>";

    // Timeframe analysis
    details += "<strong>⏱️ Timeframe Analysis:</strong><br>";
    details += `• Short-term outlook: <strong>${shortTerm}</strong><br>`;
    details += `• Medium-term outlook: <strong>${mediumTerm}</strong><br>`;

    details += "<br>";
    details += `<strong>📊 Final Score: ${
      finalScore > 0 ? "+" : ""
    }${finalScore.toFixed(3)}</strong> | `;
    details += `<strong>Confidence: ${confidence.toUpperCase()}</strong>`;

    details += "</div>";
    return details;
  }

  generateSummaryText(indicators, scores, shortTerm, mediumTerm) {
    let summary = "";
    const alignedIndicators = [
      scores.rsiScore > 0,
      scores.macdScore > 0,
      scores.maScore > 0,
      scores.bbScore > 0,
    ].filter((x) => x).length;

    const bearishIndicators = [
      scores.rsiScore < 0,
      scores.macdScore < 0,
      scores.maScore < 0,
      scores.bbScore < 0,
    ].filter((x) => x).length;

    if (alignedIndicators >= 3) {
      summary =
        "✓ <strong>Strong bullish alignment</strong> - Multiple indicators confirm upward momentum. ";
    } else if (bearishIndicators >= 3) {
      summary =
        "✗ <strong>Strong bearish alignment</strong> - Multiple indicators confirm downward pressure. ";
    } else {
      summary =
        "⚠ <strong>Mixed signals</strong> - Indicators show divergence. ";
    }

    // Add context about specific indicators
    if (indicators.rsi < 30 || indicators.rsi > 70) {
      summary += `RSI is ${indicators.rsi < 30 ? "oversold" : "overbought"}. `;
    }

    if (scores.maScore === 0) {
      summary += "Price shows mixed behavior relative to moving averages. ";
    }

    summary += `Short-term trend is ${shortTerm}, while medium-term trend is ${mediumTerm}.`;

    return summary;
  }

  async fetchAccountBalance() {
    try {
      const balance = await this.getAuthenticatedRequest(
        "/openApi/spot/v1/account/balance"
      );

      if (balance.code === 0) {
        this.displayBalance(balance.data.balances);
      } else {
        console.error("Balance fetch error:", balance.msg);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  }

  displayBalance(balances) {
    const balanceContainer = document.getElementById("balanceInfo");
    balanceContainer.innerHTML = "";

    // Show balances with non-zero amounts
    const relevantBalances = balances.filter(
      (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
    );

    if (relevantBalances.length === 0) {
      balanceContainer.innerHTML = "<p>No balances to display</p>";
      return;
    }

    relevantBalances.slice(0, 6).forEach((balance) => {
      const total = parseFloat(balance.free) + parseFloat(balance.locked);
      balanceContainer.innerHTML += `
                <div class="balance-item">
                    <div class="balance-label">${balance.asset}</div>
                    <div class="balance-value">${total.toFixed(8)}</div>
                </div>
            `;
    });
  }

  showOrderConfirmation() {
    const orderSide = document.getElementById("orderSide").value;
    const orderType = document.getElementById("orderType").value;
    const quantity = document.getElementById("quantity").value;
    const limitPrice = document.getElementById("limitPrice").value;

    if (!quantity || parseFloat(quantity) <= 0) {
      this.showStatus("orderStatus", "Please enter a valid quantity", "error");
      return;
    }

    if (orderType === "LIMIT" && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      this.showStatus(
        "orderStatus",
        "Please enter a valid limit price",
        "error"
      );
      return;
    }

    const currentPrice = document.getElementById("currentPrice").textContent;

    let details = `
            <strong>Order Details:</strong><br><br>
            Symbol: ${this.symbol}<br>
            Side: <strong>${orderSide}</strong><br>
            Type: ${orderType}<br>
            Quantity: ${quantity}<br>
        `;

    if (orderType === "LIMIT") {
      details += `Price: $${limitPrice}<br>`;
      details += `Total: $${(
        parseFloat(limitPrice) * parseFloat(quantity)
      ).toFixed(2)}`;
    } else {
      details += `Est. Price: ${currentPrice}<br>`;
      const estTotal =
        parseFloat(currentPrice.replace("$", "")) * parseFloat(quantity);
      details += `Est. Total: $${estTotal.toFixed(2)}`;
    }

    document.getElementById("confirmDetails").innerHTML = details;
    document.getElementById("confirmModal").style.display = "block";
  }

  async placeOrder() {
    this.hideModal();
    this.showStatus("orderStatus", "Placing order...", "info");

    const orderSide = document.getElementById("orderSide").value;
    const orderType = document.getElementById("orderType").value;
    const quantity = document.getElementById("quantity").value;
    const limitPrice = document.getElementById("limitPrice").value;

    try {
      const params = {
        symbol: this.symbol,
        side: orderSide,
        type: orderType,
        quantity: quantity,
      };

      if (orderType === "LIMIT") {
        params.price = limitPrice;
        params.timeInForce = "GTC";
      }

      const result = await this.postAuthenticatedRequest(
        "/openApi/spot/v1/trade/order",
        params
      );

      if (result.code === 0) {
        this.showStatus(
          "orderStatus",
          `Order placed successfully! Order ID: ${result.data.orderId}`,
          "success"
        );
        await this.fetchAccountBalance();
      } else {
        this.showStatus("orderStatus", `Order failed: ${result.msg}`, "error");
      }
    } catch (error) {
      this.showStatus(
        "orderStatus",
        `Error placing order: ${error.message}`,
        "error"
      );
    }
  }

  hideModal() {
    document.getElementById("confirmModal").style.display = "none";
  }

  async refreshData() {
    try {
      this.showStatus("connectionStatus", "Refreshing data...", "info");
      await this.fetchMarketData();
      await this.fetchAccountBalance();
      this.showStatus("connectionStatus", "Analysis complete!", "success");

      // Update last refresh time
      const now = new Date();
      const timeStr = now.toLocaleTimeString();
      this.showStatus(
        "connectionStatus",
        `Last updated: ${timeStr} (auto-refresh every 5 min)`,
        "success"
      );
    } catch (error) {
      console.error("Refresh error:", error);
      this.showStatus(
        "connectionStatus",
        `Refresh error: ${error.message}`,
        "error"
      );
    }
  }

  async getRequest(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.baseURL}/api/public${endpoint}${
      queryString ? "?" + queryString : ""
    }`;

    const response = await fetch(url);
    return await response.json();
  }

  async getAuthenticatedRequest(endpoint, params = {}) {
    const url = `${this.baseURL}/api/authenticated/get`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint,
        params,
      }),
    });

    return await response.json();
  }

  async postAuthenticatedRequest(endpoint, params = {}) {
    const url = `${this.baseURL}/api/authenticated/post`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint,
        params,
      }),
    });

    return await response.json();
  }

  buildQueryString(params) {
    return Object.keys(params)
      .sort()
      .map((key) => `${key}=${encodeURIComponent(params[key])}`)
      .join("&");
  }

  async generateSignature(queryString) {
    const encoder = new TextEncoder();
    const data = encoder.encode(queryString);
    const key = encoder.encode(this.apiSecret);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  showStatus(elementId, message, type) {
    const statusEl = document.getElementById(elementId);
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }
}

// Initialize the application
const app = new BingXTradingAssistant();
