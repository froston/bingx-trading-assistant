const BingXAPI = require("./bingx-api");
const Strategy = require("./strategy");
const RiskManager = require("./risk-manager");
const config = require("./config");
const fs = require("fs");

/**
 * Main Trading Bot
 * Continuously monitors market and executes trades based on strategy
 */
class TradingBot {
  constructor() {
    this.api = new BingXAPI();
    this.riskManager = new RiskManager(config);
    this.isRunning = false;
    this.currentPosition = null;
    this.lastAnalysis = null;
  }

  /**
   * Log message to console and optionally to file
   */
  log(message, writeToFile = true) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;

    console.log(logMessage);

    if (writeToFile && config.bot.logTrades) {
      fs.appendFileSync(config.bot.logFile, logMessage + "\n");
    }
  }

  /**
   * Start the trading bot
   */
  async start() {
    this.log("🚀 Starting BingX Trading Bot...");
    this.log(`📊 Symbol: ${config.symbol}`);
    this.log(`⏱️  Interval: ${config.interval}`);
    this.log(
      `${
        config.bot.testMode
          ? "🧪 TEST MODE - No real orders will be placed"
          : "⚠️  LIVE MODE - Real orders will be placed"
      }`
    );

    // Set leverage (optional, adjust as needed)
    // await this.api.setLeverage(config.symbol, 1);

    this.isRunning = true;
    this.runLoop();
  }

  /**
   * Stop the trading bot
   */
  stop() {
    this.log("🛑 Stopping trading bot...");
    this.isRunning = false;
  }

  /**
   * Main trading loop
   */
  async runLoop() {
    while (this.isRunning) {
      try {
        await this.tick();
      } catch (error) {
        this.log(`❌ Error in main loop: ${error.message}`);
        console.error(error);
      }

      // Wait before next check
      await this.sleep(config.bot.checkInterval);
    }
  }

  /**
   * Single iteration of the bot logic
   */
  async tick() {
    this.log("\n" + "=".repeat(80));
    this.log("🔄 Checking market conditions...");

    // Check if within trading hours
    if (!Strategy.isWithinTradingHours(config)) {
      this.log("⏰ Outside trading hours - skipping analysis");
      return;
    }

    // Check daily trade limit
    if (!this.riskManager.canTradeToday()) {
      this.log("📊 Maximum trades per day reached - skipping");
      return;
    }

    // Fetch latest market data
    const candles = await this.api.getKlines(
      config.symbol,
      config.interval,
      config.candleLimit
    );

    if (!candles || candles.length < config.indicators.emaSlow + 10) {
      this.log("⚠️  Insufficient candle data");
      return;
    }

    this.log(`📈 Fetched ${candles.length} candles`);
    this.log(
      `   Current Price: $${candles[candles.length - 1].close.toFixed(2)}`
    );

    // Analyze market
    const analysis = Strategy.analyze(candles, config);
    this.lastAnalysis = analysis;

    this.displayIndicators(analysis.indicators);

    // Get current positions
    const positions = await this.api.getPositions(config.symbol);
    this.currentPosition = positions.length > 0 ? positions[0] : null;

    if (this.currentPosition && this.currentPosition.size !== 0) {
      this.log(
        `\n📍 Current Position: ${this.currentPosition.side} ${this.currentPosition.size} @ $${this.currentPosition.entryPrice}`
      );

      // Check if we should exit based on indicators
      const exitSignal = Strategy.shouldExitOnIndicator(
        this.currentPosition,
        analysis.indicators
      );
      if (exitSignal.exit) {
        this.log(`🚪 Exit signal detected: ${exitSignal.reason}`);
        await this.closePosition();
        return;
      }

      // If we have a position and closeOnOppositeSignal is enabled
      if (config.position.closeOnOppositeSignal) {
        const oppositeSignal =
          this.currentPosition.side === "LONG"
            ? analysis.shortSignal.signal
            : analysis.longSignal.signal;

        if (oppositeSignal) {
          this.log("🔄 Opposite signal detected - closing current position");
          await this.closePosition();
          return;
        }
      }

      this.log("✓ Holding current position");
    } else {
      // No position - check for entry signals
      if (config.position.oneTradeAtATime && this.currentPosition) {
        this.log(
          "⏳ One trade at a time mode - waiting for current position to close"
        );
        return;
      }

      await this.checkEntrySignals(analysis);
    }
  }

  /**
   * Display current indicator values
   */
  displayIndicators(indicators) {
    this.log("\n📊 Technical Indicators:");
    this.log(`   EMA20: ${indicators.emaFast?.toFixed(2) || "N/A"}`);
    this.log(`   EMA50: ${indicators.emaSlow?.toFixed(2) || "N/A"}`);
    this.log(`   MACD: ${indicators.macd?.macd?.toFixed(4) || "N/A"}`);
    this.log(`   Signal: ${indicators.macd?.signal?.toFixed(4) || "N/A"}`);
    this.log(`   RSI: ${indicators.rsi?.toFixed(2) || "N/A"}`);
    this.log(`   ATR: ${indicators.atr?.toFixed(2) || "N/A"}`);
    this.log(`   Volume Spike: ${indicators.volumeSpike ? "YES" : "NO"}`);
  }

  /**
   * Check for entry signals and execute trades
   */
  async checkEntrySignals(analysis) {
    const { longSignal, shortSignal, indicators } = analysis;

    this.log("\n🎯 Signal Analysis:");

    // Check LONG signal
    if (longSignal.signal) {
      this.log("🟢 LONG ENTRY SIGNAL DETECTED!");
      longSignal.reasons.forEach((reason) => this.log(`   ${reason}`));
      await this.enterPosition("LONG", indicators);
    } else if (longSignal.reasons.length > 0) {
      this.log("⚪ No LONG signal:");
      longSignal.reasons
        .slice(0, 2)
        .forEach((reason) => this.log(`   ${reason}`));
    }

    // Check SHORT signal
    if (shortSignal.signal) {
      this.log("🔴 SHORT ENTRY SIGNAL DETECTED!");
      shortSignal.reasons.forEach((reason) => this.log(`   ${reason}`));
      await this.enterPosition("SHORT", indicators);
    } else if (shortSignal.reasons.length > 0) {
      this.log("⚪ No SHORT signal:");
      shortSignal.reasons
        .slice(0, 2)
        .forEach((reason) => this.log(`   ${reason}`));
    }
  }

  /**
   * Enter a new position
   */
  async enterPosition(type, indicators) {
    try {
      // Get account balance
      const balance = await this.api.getBalance();
      const accountBalance = balance.availableMargin;

      this.log(`\n💼 Account Balance: $${accountBalance.toFixed(2)}`);

      if (accountBalance < 10) {
        this.log("⚠️  Insufficient balance to trade");
        return;
      }

      // Calculate stop loss and take profit
      const entryPrice = indicators.currentPrice;
      const stopLoss = Strategy.calculateStopLoss(
        type,
        entryPrice,
        indicators.atr,
        indicators.swingLow,
        indicators.swingHigh,
        config
      );

      const takeProfit = Strategy.calculateTakeProfit(
        type,
        entryPrice,
        stopLoss,
        config
      );

      // Calculate position size
      const positionSize = this.riskManager.calculatePositionSize(
        accountBalance,
        entryPrice,
        stopLoss
      );

      // Format position size
      const formattedSize = this.riskManager.formatPositionSize(
        positionSize,
        config.symbol
      );

      // Validate trade
      if (
        !this.riskManager.validateTrade(
          accountBalance,
          entryPrice,
          stopLoss,
          formattedSize
        )
      ) {
        this.log("⚠️  Trade rejected by risk management");
        return;
      }

      // Check sufficient balance
      if (
        !this.riskManager.hasSufficientBalance(
          accountBalance,
          formattedSize,
          entryPrice
        )
      ) {
        return;
      }

      // Get trade summary
      const summary = this.riskManager.getTradeSummary(
        type,
        entryPrice,
        stopLoss,
        takeProfit,
        formattedSize,
        accountBalance
      );

      this.log("\n🎯 TRADE SETUP:");
      this.log(`   Type: ${summary.type}`);
      this.log(`   Entry: $${summary.entryPrice}`);
      this.log(`   Stop Loss: $${summary.stopLoss}`);
      this.log(`   Take Profit: $${summary.takeProfit}`);
      this.log(`   Position Size: ${summary.positionSize}`);
      this.log(`   Risk: $${summary.riskAmount} (${summary.riskPercentage}%)`);
      this.log(`   Reward: $${summary.rewardAmount}`);
      this.log(`   R:R Ratio: 1:${summary.riskRewardRatio}`);

      // Place order
      const side = type === "LONG" ? "BUY" : "SELL";
      const order = await this.api.placeOrder(
        config.symbol,
        side,
        formattedSize,
        stopLoss,
        takeProfit
      );

      if (order.success) {
        this.log(`\n✅ ${type} ORDER PLACED SUCCESSFULLY!`);
        this.log(`   Order ID: ${order.orderId}`);
        this.log(`   ${config.bot.testMode ? "(Test Order)" : ""}`);

        this.riskManager.recordTrade();

        // Log trade to file
        this.logTradeToFile({
          action: "ENTRY",
          ...summary,
          orderId: order.orderId,
          testMode: config.bot.testMode,
        });
      } else {
        this.log(`❌ Order failed: ${order.error}`);
      }
    } catch (error) {
      this.log(`❌ Error entering position: ${error.message}`);
      console.error(error);
    }
  }

  /**
   * Close current position
   */
  async closePosition() {
    if (!this.currentPosition || this.currentPosition.size === 0) {
      this.log("⚠️  No position to close");
      return;
    }

    try {
      this.log(`\n🚪 Closing ${this.currentPosition.side} position...`);

      const result = await this.api.closePosition(
        config.symbol,
        this.currentPosition.side,
        Math.abs(this.currentPosition.size)
      );

      if (result.success) {
        this.log(`✅ Position closed successfully!`);
        this.log(
          `   P&L: $${
            this.currentPosition.unrealizedProfit?.toFixed(2) || "N/A"
          }`
        );

        this.logTradeToFile({
          action: "EXIT",
          type: this.currentPosition.side,
          exitPrice: this.lastAnalysis?.indicators?.currentPrice,
          pnl: this.currentPosition.unrealizedProfit,
          orderId: result.orderId,
          testMode: config.bot.testMode,
          timestamp: new Date().toISOString(),
        });

        this.currentPosition = null;
      } else {
        this.log(`❌ Failed to close position: ${result.error}`);
      }
    } catch (error) {
      this.log(`❌ Error closing position: ${error.message}`);
      console.error(error);
    }
  }

  /**
   * Log trade details to file
   */
  logTradeToFile(trade) {
    const logEntry = JSON.stringify(trade) + "\n";
    fs.appendFileSync("trades.json", logEntry);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Start the bot
const bot = new TradingBot();

// Handle graceful shutdown
process.on("SIGINT", () => {
  bot.log("\n👋 Received shutdown signal");
  bot.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  bot.log("\n👋 Received termination signal");
  bot.stop();
  process.exit(0);
});

// Start the bot
bot.start().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
