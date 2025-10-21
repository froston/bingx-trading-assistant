const BaseStrategy = require("./base");

/**
 * Trend Breakout Strategy
 * Implementation of the original strategy.js logic as an example
 *
 * Entry Rules (LONG):
 * 1. EMA20 > EMA50 (uptrend)
 * 2. Price closes above recent resistance or breaks range
 * 3. MACD line crosses above signal line
 * 4. RSI < 70 (not overbought)
 * 5. Volume above average of last 20 candles
 *
 * Entry Rules (SHORT):
 * 1. EMA20 < EMA50 (downtrend)
 * 2. Price breaks recent support
 * 3. MACD crosses below signal
 * 4. RSI > 30 (not oversold)
 * 5. Volume confirmation
 *
 * Minimum 3 out of 5 conditions must be met for a signal
 */
class TrendBreakoutStrategy extends BaseStrategy {
  constructor() {
    super("TrendBreakoutStrategy");
  }

  /**
   * Check LONG entry conditions
   */
  checkLongEntry(indicators, config) {
    // Validate indicators
    if (!this.validateIndicators(indicators)) {
      return this.createSignalResponse(
        false,
        "LONG",
        ["Datos insuficientes para análisis"],
        indicators
      );
    }

    const conditions = [
      // 1. Uptrend check
      {
        met: this.isUptrend(indicators.emaFast, indicators.emaSlow),
        successMessage: `✓ Tendencia alcista (EMA20: ${indicators.emaFast.toFixed(
          2
        )} > EMA50: ${indicators.emaSlow.toFixed(2)})`,
        failureMessage: `✗ Sin tendencia alcista (EMA20: ${indicators.emaFast.toFixed(
          2
        )} < EMA50: ${indicators.emaSlow.toFixed(2)})`,
      },
      // 2. Breakout check
      {
        met: indicators.bullishBreakout,
        successMessage: "✓ Ruptura alcista detectada",
        failureMessage: "✗ Sin ruptura alcista",
      },
      // 3. MACD bullish cross
      {
        met: indicators.macd.bullishCross,
        successMessage: `✓ Cruce alcista MACD (MACD: ${indicators.macd.macd.toFixed(
          4
        )} > Señal: ${indicators.macd.signal.toFixed(4)})`,
        failureMessage: `✗ Sin cruce alcista MACD (MACD: ${indicators.macd.macd?.toFixed(
          4
        )} vs Señal: ${indicators.macd.signal?.toFixed(4)})`,
      },
      // 4. RSI not overbought
      {
        met: indicators.rsi < config.indicators.rsi.overbought,
        successMessage: `✓ RSI no sobrecomprado (${indicators.rsi.toFixed(
          2
        )} < ${config.indicators.rsi.overbought})`,
        failureMessage: `✗ RSI sobrecomprado (${indicators.rsi.toFixed(2)} >= ${
          config.indicators.rsi.overbought
        })`,
      },
      // 5. Volume confirmation
      {
        met: indicators.volumeSpike,
        successMessage: "✓ Pico de volumen confirmado",
        failureMessage: "✗ Sin pico de volumen",
      },
    ];

    const result = this.checkConditions(conditions);

    // Minimum 3 conditions must be met
    const signal = result.passed >= 3;

    return this.createSignalResponse(
      signal,
      "LONG",
      result.allReasons,
      indicators
    );
  }

  /**
   * Check SHORT entry conditions
   */
  checkShortEntry(indicators, config) {
    // Validate indicators
    if (!this.validateIndicators(indicators)) {
      return this.createSignalResponse(
        false,
        "SHORT",
        ["Datos insuficientes para análisis"],
        indicators
      );
    }

    const conditions = [
      // 1. Downtrend check
      {
        met: this.isDowntrend(indicators.emaFast, indicators.emaSlow),
        successMessage: `✓ Tendencia bajista (EMA20: ${indicators.emaFast.toFixed(
          2
        )} < EMA50: ${indicators.emaSlow.toFixed(2)})`,
        failureMessage: `✗ Sin tendencia bajista (EMA20: ${indicators.emaFast.toFixed(
          2
        )} > EMA50: ${indicators.emaSlow.toFixed(2)})`,
      },
      // 2. Breakdown check
      {
        met: indicators.bearishBreakdown,
        successMessage: "✓ Ruptura bajista detectada",
        failureMessage: "✗ Sin ruptura bajista",
      },
      // 3. MACD bearish cross
      {
        met: indicators.macd.bearishCross,
        successMessage: `✓ Cruce bajista MACD (MACD: ${indicators.macd.macd.toFixed(
          4
        )} < Señal: ${indicators.macd.signal.toFixed(4)})`,
        failureMessage: `✗ Sin cruce bajista MACD (MACD: ${indicators.macd.macd?.toFixed(
          4
        )} vs Señal: ${indicators.macd.signal?.toFixed(4)})`,
      },
      // 4. RSI not oversold
      {
        met: indicators.rsi > config.indicators.rsi.oversold,
        successMessage: `✓ RSI no sobrevendido (${indicators.rsi.toFixed(
          2
        )} > ${config.indicators.rsi.oversold})`,
        failureMessage: `✗ RSI sobrevendido (${indicators.rsi.toFixed(2)} <= ${
          config.indicators.rsi.oversold
        })`,
      },
      // 5. Volume confirmation
      {
        met: indicators.volumeSpike,
        successMessage: "✓ Pico de volumen confirmado",
        failureMessage: "✗ Sin pico de volumen",
      },
    ];

    const result = this.checkConditions(conditions);

    // Minimum 3 conditions must be met
    const signal = result.passed >= 3;

    return this.createSignalResponse(
      signal,
      "SHORT",
      result.allReasons,
      indicators
    );
  }
}

module.exports = TrendBreakoutStrategy;
