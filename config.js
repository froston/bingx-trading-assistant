/**
 * Trading Bot Configuration
 * Adjust these parameters to match your trading strategy
 */

module.exports = {
  // === TRADING PAIR ===
  symbol: process.env.SYMBOL || "BTC-USDT", // Default to BTC if not specified

  // === TIMEFRAME ===
  interval: "5m", // 5-minute candles
  candleLimit: 100, // Number of historical candles to fetch

  // === INDICATOR PARAMETERS ===
  indicators: {
    emaFast: 20, // Fast EMA period
    emaSlow: 50, // Slow EMA period

    macd: {
      fast: 12, // MACD fast period
      slow: 26, // MACD slow period
      signal: 9, // MACD signal period
    },

    rsi: {
      period: 14, // RSI period
      overbought: 70, // RSI overbought level
      oversold: 30, // RSI oversold level
    },

    atr: {
      period: 14, // ATR period (for stop loss)
    },

    volume: {
      period: 20, // Average volume lookback period
    },
  },

  // === RISK MANAGEMENT ===
  risk: {
    riskPercentage: 0.25, // Risk 1% of account per trade (1-2% recommended)
    takeProfitMultiplier: 2, // TP = 2× Stop Loss (1.5-2x recommended)
    stopLossATRMultiplier: 1, // Stop loss = 1× ATR
    maxTradesPerDay: 3, // Maximum trades per day (3-5 recommended)
    minPositionSize: 0.000005, // Minimum position size BTC
    maxPositionSize: 0.00002, // Maximum position size BTC
  },

  // === TRADING HOURS ===
  tradingHours: {
    enabled: false, // Enable trading hours restriction
    startHour: 13, // 13:00 UTC (US market open ~9:00 ET)
    endHour: 21, // 21:00 UTC (US market close ~17:00 ET)
  },

  // === BOT BEHAVIOR ===
  bot: {
    checkInterval: 120000, // Interval in milliseconds
    testMode: true, // Run in test mode
    logTrades: true, // Log all trading decisions
    logFile: "trades.log", // Log file name
  },

  // === POSITION MANAGEMENT ===
  position: {
    oneTradeAtATime: true, // Only allow one open position at a time
    closeOnOppositeSignal: true, // Close long if short signal, vice versa
  },
};
