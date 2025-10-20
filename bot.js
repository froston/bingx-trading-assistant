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
    this.log("🚀 Iniciando Bot de Trading BingX...");
    this.log(`📊 Símbolo: ${config.symbol}`);
    this.log(`⏱️ Intervalo: ${config.interval}`);
    this.log(
      `${
        config.bot.testMode
          ? "🧪 MODO PRUEBA - No se colocarán órdenes reales"
          : "⚠️ MODO EN VIVO - Se colocarán órdenes reales"
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
    this.log("🛑 Deteniendo bot de trading...");
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
        this.log(`❌ Error en el bucle principal: ${error.message}`);
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
    this.log("🔄 Verificando condiciones del mercado...");

    // Check if within trading hours
    if (!Strategy.isWithinTradingHours(config)) {
      this.log("⏰ Fuera del horario de trading - omitiendo análisis");
      return;
    }

    // Check daily trade limit
    if (!this.riskManager.canTradeToday()) {
      this.log("📊 Máximo de operaciones por día alcanzado - omitiendo");
      return;
    }

    // Fetch latest market data
    const candles = await this.api.getKlines(
      config.symbol,
      config.interval,
      config.candleLimit
    );

    if (!candles || candles.length < config.indicators.emaSlow + 10) {
      this.log("⚠️ Datos de velas insuficientes");
      return;
    }

    this.log(`📈 Obtenidas ${candles.length} velas`);
    this.log(
      `🪙 Precio Actual [${config.symbol}]: $${candles[
        candles.length - 1
      ].close.toFixed(2)}`
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
        `\n📍 Posición Actual: ${this.currentPosition.side} ${this.currentPosition.size} @ $${this.currentPosition.entryPrice}`
      );

      // Check if we should exit based on indicators
      const exitSignal = Strategy.shouldExitOnIndicator(
        this.currentPosition,
        analysis.indicators
      );
      if (exitSignal.exit) {
        this.log(`🚪 Señal de salida detectada: ${exitSignal.reason}`);
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
          this.log("🔄 Señal opuesta detectada - cerrando posición actual");
          await this.closePosition();
          return;
        }
      }

      this.log("✓ Manteniendo posición actual");
    } else {
      // No position - check for entry signals
      if (config.position.oneTradeAtATime && this.currentPosition) {
        this.log(
          "⏳ Modo una operación a la vez - esperando cierre de posición actual"
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
    this.log("📊 Indicadores Técnicos:");
    this.log(`   EMA20: ${indicators.emaFast?.toFixed(2) || "N/D"}`);
    this.log(`   EMA50: ${indicators.emaSlow?.toFixed(2) || "N/D"}`);
    this.log(`   MACD: ${indicators.macd?.macd?.toFixed(4) || "N/D"}`);
    this.log(`   Señal: ${indicators.macd?.signal?.toFixed(4) || "N/D"}`);
    this.log(`   RSI: ${indicators.rsi?.toFixed(2) || "N/D"}`);
    this.log(`   ATR: ${indicators.atr?.toFixed(2) || "N/D"}`);
    this.log(`   Pico de Volumen: ${indicators.volumeSpike ? "SÍ" : "NO"}`);
  }

  /**
   * Check for entry signals and execute trades
   */
  async checkEntrySignals(analysis) {
    const { longSignal, shortSignal, indicators } = analysis;

    this.log("🎯 Análisis de Señales:");

    // Check LONG signal
    if (longSignal.signal) {
      this.log("🟢 ¡SEÑAL DE ENTRADA LONG DETECTADA!");
      longSignal.reasons.forEach((reason) => this.log(`   ${reason}`));
      await this.enterPosition("LONG", indicators);
    } else if (longSignal.reasons.length > 0) {
      this.log("⚪ Sin señal LONG:");
      longSignal.reasons
        .slice(0, 2)
        .forEach((reason) => this.log(`   ${reason}`));
    }

    // Check SHORT signal
    if (shortSignal.signal) {
      this.log("🔴 ¡SEÑAL DE ENTRADA SHORT DETECTADA!");
      shortSignal.reasons.forEach((reason) => this.log(`   ${reason}`));
      await this.enterPosition("SHORT", indicators);
    } else if (shortSignal.reasons.length > 0) {
      this.log("⚪ Sin señal SHORT:");
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

      this.log(`\n💼 Saldo de Cuenta: $${accountBalance.toFixed(2)}`);

      if (accountBalance < 10) {
        this.log("⚠️ Saldo insuficiente para operar");
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
        this.log("⚠️ Operación rechazada por gestión de riesgo");
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

      this.log("🎯 CONFIGURACIÓN DE OPERACIÓN:");
      this.log(`   Tipo: ${summary.type}`);
      this.log(`   Entrada: $${summary.entryPrice}`);
      this.log(`   Stop Loss: $${summary.stopLoss}`);
      this.log(`   Take Profit: $${summary.takeProfit}`);
      this.log(`   Tamaño de Posición: ${summary.positionSize}`);
      this.log(
        `   Riesgo: $${summary.riskAmount} (${summary.riskPercentage}%)`
      );
      this.log(`   Recompensa: $${summary.rewardAmount}`);
      this.log(`   Ratio R:R: 1:${summary.riskRewardRatio}`);

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
        this.log(`✅ ¡ORDEN ${type} COLOCADA EXITOSAMENTE!`);
        this.log(`   ID de Orden: ${order.orderId}`);
        this.log(`   ${config.bot.testMode ? "(Orden de Prueba)" : ""}`);

        this.riskManager.recordTrade();

        // Log trade to file
        this.logTradeToFile({
          action: "ENTRY",
          ...summary,
          orderId: order.orderId,
          testMode: config.bot.testMode,
        });
      } else {
        this.log(`❌ Orden fallida: ${order.error}`);
      }
    } catch (error) {
      this.log(`❌ Error al entrar en posición: ${error.message}`);
      console.error(error);
    }
  }

  /**
   * Close current position
   */
  async closePosition() {
    if (!this.currentPosition || this.currentPosition.size === 0) {
      this.log("⚠️ No hay posición para cerrar");
      return;
    }

    try {
      this.log(`\n🚪 Cerrando posición ${this.currentPosition.side}...`);

      const result = await this.api.closePosition(
        config.symbol,
        this.currentPosition.side,
        Math.abs(this.currentPosition.size)
      );

      if (result.success) {
        this.log(`✅ ¡Posición cerrada exitosamente!`);
        this.log(
          `   P&L: $${
            this.currentPosition.unrealizedProfit?.toFixed(2) || "N/D"
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
        this.log(`❌ Error al cerrar posición: ${result.error}`);
      }
    } catch (error) {
      this.log(`❌ Error al cerrar posición: ${error.message}`);
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
  bot.log("\n👋 Señal de apagado recibida");
  bot.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  bot.log("\n👋 Señal de terminación recibida");
  bot.stop();
  process.exit(0);
});

// Start the bot
bot.start().catch((error) => {
  console.error("Error fatal:", error);
  process.exit(1);
});
