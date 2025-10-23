const BingXAPI = require("./bingx-api");
const BOSStrategy = require("./strategies/bos-strategy");
const RiskManager = require("./risk-manager");
const config = require("./config");
const fs = require("fs");
const notifier = require("node-notifier");

/**
 * Main Trading Bot
 * Continuously monitors market and executes trades based on strategy
 */
class TradingBot {
  constructor() {
    this.api = new BingXAPI();
    this.riskManager = new RiskManager(config);
    this.strategy = new BOSStrategy();
    this.isRunning = false;
    this.currentPosition = null;
    this.lastAnalysis = null;
  }

  /**
   * Log message to console and optionally to file
   */
  log(message, writeToFile = true) {
    const timestamp = new Date().toLocaleString();
    const logMessage = `[${timestamp}] ${message}`;

    console.log(logMessage);

    if (writeToFile && config.bot.logTrades) {
      fs.appendFileSync(config.bot.logFile, logMessage + "\n");
    }
  }

  notify(params) {
    notifier.notify({ sound: true, wait: false, ...params });
  }

  /**
   * Start the trading bot
   */
  async start() {
    this.log("🚀 Iniciando Bot de Trading BingX (Estrategia BOS)...");
    this.log(`📊 Símbolo: ${config.symbol}`);
    this.log(`⏱️ Timeframe Superior: ${config.timeframes.higher}`);
    this.log(`⏱️ Timeframe Inferior: ${config.timeframes.lower}`);
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
    if (!this.strategy.isWithinTradingHours(config)) {
      this.log("⏰ Fuera del horario de trading - omitiendo análisis");
      return;
    }

    // Check daily trade limit
    if (!this.riskManager.canTradeToday()) {
      this.log("📊 Máximo de operaciones por día alcanzado - omitiendo");
      return;
    }

    // Fetch latest market data for both timeframes
    const candles4H = await this.api.getKlines(
      config.symbol,
      config.timeframes.higher,
      config.timeframes.higherCandleLimit
    );

    const candles5M = await this.api.getKlines(
      config.symbol,
      config.timeframes.lower,
      config.timeframes.lowerCandleLimit
    );

    const minCandles4H = Math.max(config.indicators.ema200 + 10, 60);
    if (!candles4H || candles4H.length < minCandles4H) {
      this.log(
        `⚠️ Datos de velas 4H insuficientes: obtenidas ${
          candles4H?.length || 0
        }, requeridas ${minCandles4H}`
      );
      this.log(
        `   Nota: La API puede tener límites. EMA actual: ${config.indicators.ema200}`
      );
      return;
    }

    if (!candles5M || candles5M.length < 30) {
      this.log(
        `⚠️ Datos de velas 5M insuficientes: obtenidas ${
          candles5M?.length || 0
        }, requeridas 30`
      );
      return;
    }

    this.log(
      `📈 Obtenidas ${candles4H.length} velas 4H y ${candles5M.length} velas 5M`
    );
    this.log(
      `🪙 Precio Actual [${config.symbol}]: $${candles4H[
        candles4H.length - 1
      ].close.toFixed(2)}`
    );

    // Analyze market (multi-timeframe)
    const analysis = this.strategy.analyze(candles4H, candles5M, config);
    this.lastAnalysis = analysis;

    this.displayIndicators(analysis.indicators4H, analysis.indicators5M);
    this.displayStrategyState(analysis.state);

    // Get current positions
    const positions = await this.api.getPositions(config.symbol);
    this.currentPosition = positions.length > 0 ? positions[0] : null;

    if (this.currentPosition && this.currentPosition.size !== 0) {
      this.log(
        `📍 Posición Actual: ${this.currentPosition.side} ${this.currentPosition.size} @ $${this.currentPosition.entryPrice}`
      );

      // Check if we should exit based on indicators
      const exitSignal = this.strategy.shouldExitOnIndicator(
        this.currentPosition,
        analysis.indicators4H
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
  displayIndicators(indicators4H, indicators5M) {
    this.log("📊 Indicadores Técnicos 4H:");
    this.log(`   EMA200: ${indicators4H.ema200?.toFixed(2) || "N/D"}`);
    this.log(`   Precio: ${indicators4H.currentPrice?.toFixed(2) || "N/D"}`);
    this.log(`   ATR: ${indicators4H.atr?.toFixed(2) || "N/D"}`);

    this.log("📊 Indicadores Técnicos 5M:");
    this.log(`   Precio: ${indicators5M.currentPrice?.toFixed(2) || "N/D"}`);
    this.log(`   ATR: ${indicators5M.atr?.toFixed(2) || "N/D"}`);
  }

  /**
   * Display BOS strategy state
   */
  displayStrategyState(state) {
    this.log("🎯 Estado de Estrategia BOS:");
    this.log(`   Tendencia 4H: ${state.trend4H || "N/D"}`);

    if (state.bos4H && state.bos4H.detected) {
      this.log(
        `   BOS 4H: ${
          state.bos4H.type
        } detectado en $${state.bos4H.breakLevel.toFixed(2)}`
      );
      this.log(
        `   Impulso 4H: $${state.bos4H.impulse.start.toFixed(
          2
        )} → $${state.bos4H.impulse.end.toFixed(
          2
        )} (${state.bos4H.impulse.size.toFixed(2)})`
      );
    } else {
      this.log(`   BOS 4H: No detectado`);
    }

    if (state.retracementZone4H) {
      this.log(
        `   Zona Retroceso 4H: $${state.retracementZone4H.low.toFixed(
          2
        )} - $${state.retracementZone4H.high.toFixed(2)}`
      );
      this.log(
        `   En Zona de Retroceso: ${state.inRetracementZone ? "SÍ ✓" : "NO"}`
      );
    }

    if (state.bos5M && state.bos5M.detected) {
      this.log(
        `   BOS 5M: ${
          state.bos5M.type
        } confirmado en $${state.bos5M.breakLevel.toFixed(2)}`
      );
    }

    if (state.entryProposed) {
      this.log(`   💡 Entrada Propuesta: $${state.entryPrice.toFixed(2)}`);
      this.log(`   🛡️ Stop Loss: $${state.stopLoss.toFixed(2)}`);
      this.log(`   🎯 Take Profit: $${state.takeProfit.toFixed(2)}`);
    }
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
      longSignal.reasons.forEach((reason) => this.log(`   ${reason}`));
    }

    // Check SHORT signal
    if (shortSignal.signal) {
      this.log("🔴 ¡SEÑAL DE ENTRADA SHORT DETECTADA!");
      shortSignal.reasons.forEach((reason) => this.log(`   ${reason}`));

      await this.enterPosition("SHORT", indicators);
    } else if (shortSignal.reasons.length > 0) {
      this.log("⚪ Sin señal SHORT:");
      shortSignal.reasons.forEach((reason) => this.log(`   ${reason}`));
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

      this.log(`💼 Saldo de Cuenta: $${accountBalance.toFixed(2)}`);

      if (accountBalance < 10) {
        this.log("⚠️ Saldo insuficiente para operar");
        return;
      }

      // For BOS strategy, entry/SL/TP are already calculated in the strategy
      const entryPrice = indicators.entryPrice || indicators.currentPrice;
      const stopLoss =
        indicators.stopLoss ||
        this.strategy.calculateStopLoss(
          type,
          entryPrice,
          indicators.atr,
          indicators.swingLow,
          indicators.swingHigh,
          config
        );
      const takeProfit =
        indicators.takeProfit ||
        this.strategy.calculateTakeProfit(type, entryPrice, stopLoss, config);

      // Calculate position size
      const positionSize = this.riskManager.calculatePositionSize(
        accountBalance,
        entryPrice,
        stopLoss
      );

      // Format position size
      /* const formattedSize = this.riskManager.formatPositionSize(
        positionSize,
        config.symbol
      ); */
      const formattedSize = positionSize;

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
      this.log(`   Tamaño de Posición: ${formattedSize}`);
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

        this.notify({
          title: `🎯 ${type} Trade Opened`,
          message: `${config.symbol}\nEntry: $${summary.entryPrice}\nSize: ${
            summary.positionSize
          }\nR:R 1:${summary.riskRewardRatio}${
            config.bot.testMode ? " (Test Mode)" : ""
          }`,
        });

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

    if (!this.currentPosition.positionId) {
      this.log("⚠️ No se encontró ID de posición");
      return;
    }

    try {
      this.log(`\n🚪 Cerrando posición ${this.currentPosition.side}...`);
      this.log(`   Position ID: ${this.currentPosition.positionId}`);

      const result = await this.api.closePosition(
        this.currentPosition.positionId
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
          exitPrice:
            this.lastAnalysis?.indicators4H?.currentPrice ||
            this.lastAnalysis?.indicators5M?.currentPrice,
          pnl: this.currentPosition.unrealizedProfit,
          orderId: result.orderId,
          positionId: this.currentPosition.positionId,
          testMode: config.bot.testMode,
          timestamp: new Date().toLocaleString(),
        });

        // Reset strategy state after closing position
        this.strategy.resetState();
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
