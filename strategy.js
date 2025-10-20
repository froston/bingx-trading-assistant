const Indicators = require("./indicators");

/**
 * Trading Strategy Implementation
 * Implements trend-following + breakout hybrid strategy
 */
class Strategy {
  /**
   * Check if we're in an uptrend (EMA20 > EMA50)
   */
  static isUptrend(emaFast, emaSlow) {
    return emaFast > emaSlow;
  }

  /**
   * Check if we're in a downtrend (EMA20 < EMA50)
   */
  static isDowntrend(emaFast, emaSlow) {
    return emaFast < emaSlow;
  }

  /**
   * Check LONG entry conditions
   *
   * Rules:
   * 1. EMA20 > EMA50 (uptrend)
   * 2. Price closes above recent resistance or breaks range
   * 3. MACD line crosses above signal line
   * 4. RSI < 70 (not overbought)
   * 5. Volume above average of last 20 candles
   */
  static checkLongEntry(indicators, config) {
    const reasons = [];
    const failures = [];

    // Check if all required indicators are available
    if (
      !indicators.emaFast ||
      !indicators.emaSlow ||
      !indicators.macd ||
      indicators.rsi === null ||
      !indicators.atr
    ) {
      return { signal: false, reasons: ["Datos insuficientes para análisis"] };
    }

    // 1. Uptrend check
    if (this.isUptrend(indicators.emaFast, indicators.emaSlow)) {
      reasons.push(
        `✓ Tendencia alcista (EMA20: ${indicators.emaFast.toFixed(
          2
        )} > EMA50: ${indicators.emaSlow.toFixed(2)})`
      );
    } else {
      failures.push(
        `✗ Sin tendencia alcista (EMA20: ${indicators.emaFast.toFixed(
          2
        )} < EMA50: ${indicators.emaSlow.toFixed(2)})`
      );
    }

    // 2. Breakout check
    if (indicators.bullishBreakout) {
      reasons.push("✓ Ruptura alcista detectada");
    } else {
      failures.push("✗ Sin ruptura alcista");
    }

    // 3. MACD bullish cross
    if (indicators.macd.bullishCross) {
      reasons.push(
        `✓ Cruce alcista MACD (MACD: ${indicators.macd.macd.toFixed(
          4
        )} > Señal: ${indicators.macd.signal.toFixed(4)})`
      );
    } else {
      failures.push(
        `✗ Sin cruce alcista MACD (MACD: ${indicators.macd.macd?.toFixed(
          4
        )} vs Señal: ${indicators.macd.signal?.toFixed(4)})`
      );
    }

    // 4. RSI not overbought
    if (indicators.rsi < config.indicators.rsi.overbought) {
      reasons.push(
        `✓ RSI no sobrecomprado (${indicators.rsi.toFixed(2)} < ${
          config.indicators.rsi.overbought
        })`
      );
    } else {
      failures.push(
        `✗ RSI sobrecomprado (${indicators.rsi.toFixed(2)} >= ${
          config.indicators.rsi.overbought
        })`
      );
    }

    // 5. Volume confirmation
    if (indicators.volumeSpike) {
      reasons.push("✓ Pico de volumen confirmado");
    } else {
      failures.push("✗ Sin pico de volumen");
    }

    // Minimum 3 conditions must be met
    const allConditionsMet = reasons.length >= 3;

    return {
      signal: allConditionsMet,
      type: "LONG",
      reasons: [...reasons, ...failures],
      indicators,
    };
  }

  /**
   * Check SHORT entry conditions
   *
   * Rules:
   * 1. EMA20 < EMA50 (downtrend)
   * 2. Price breaks recent support
   * 3. MACD crosses below signal
   * 4. RSI > 30 (not oversold)
   * 5. Volume confirmation
   */
  static checkShortEntry(indicators, config) {
    const reasons = [];
    const failures = [];

    // Check if all required indicators are available
    if (
      !indicators.emaFast ||
      !indicators.emaSlow ||
      !indicators.macd ||
      indicators.rsi === null ||
      !indicators.atr
    ) {
      return { signal: false, reasons: ["Datos insuficientes para análisis"] };
    }

    // 1. Downtrend check
    if (this.isDowntrend(indicators.emaFast, indicators.emaSlow)) {
      reasons.push(
        `✓ Tendencia bajista (EMA20: ${indicators.emaFast.toFixed(
          2
        )} < EMA50: ${indicators.emaSlow.toFixed(2)})`
      );
    } else {
      failures.push(
        `✗ Sin tendencia bajista (EMA20: ${indicators.emaFast.toFixed(
          2
        )} > EMA50: ${indicators.emaSlow.toFixed(2)})`
      );
    }

    // 2. Breakdown check
    if (indicators.bearishBreakdown) {
      reasons.push("✓ Ruptura bajista detectada");
    } else {
      failures.push("✗ Sin ruptura bajista");
    }

    // 3. MACD bearish cross
    if (indicators.macd.bearishCross) {
      reasons.push(
        `✓ Cruce bajista MACD (MACD: ${indicators.macd.macd.toFixed(
          4
        )} < Señal: ${indicators.macd.signal.toFixed(4)})`
      );
    } else {
      failures.push(
        `✗ Sin cruce bajista MACD (MACD: ${indicators.macd.macd?.toFixed(
          4
        )} vs Señal: ${indicators.macd.signal?.toFixed(4)})`
      );
    }

    // 4. RSI not oversold
    if (indicators.rsi > config.indicators.rsi.oversold) {
      reasons.push(
        `✓ RSI no sobrevendido (${indicators.rsi.toFixed(2)} > ${
          config.indicators.rsi.oversold
        })`
      );
    } else {
      failures.push(
        `✗ RSI sobrevendido (${indicators.rsi.toFixed(2)} <= ${
          config.indicators.rsi.oversold
        })`
      );
    }

    // 5. Volume confirmation
    if (indicators.volumeSpike) {
      reasons.push("✓ Pico de volumen confirmado");
    } else {
      failures.push("✗ Sin pico de volumen");
    }

    // Minimum 3 conditions must be met
    const allConditionsMet = reasons.length >= 3;

    return {
      signal: allConditionsMet,
      type: "SHORT",
      reasons: [...reasons, ...failures],
      indicators,
    };
  }

  /**
   * Calculate stop loss price
   * Uses the lower of: swing low or (current price - 1×ATR)
   */
  static calculateStopLoss(
    type,
    currentPrice,
    atr,
    swingLow,
    swingHigh,
    config
  ) {
    const atrMultiplier = config.risk.stopLossATRMultiplier;

    if (type === "LONG") {
      const atrStopLoss = currentPrice - atr * atrMultiplier;
      const stopLoss = swingLow ? Math.max(swingLow, atrStopLoss) : atrStopLoss;
      return stopLoss;
    } else if (type === "SHORT") {
      const atrStopLoss = currentPrice + atr * atrMultiplier;
      const stopLoss = swingHigh
        ? Math.min(swingHigh, atrStopLoss)
        : atrStopLoss;
      return stopLoss;
    }

    return null;
  }

  /**
   * Calculate take profit price
   * TP = Entry + (Entry - StopLoss) × TPMultiplier
   */
  static calculateTakeProfit(type, entryPrice, stopLoss, config) {
    const tpMultiplier = config.risk.takeProfitMultiplier;
    const stopDistance = Math.abs(entryPrice - stopLoss);

    if (type === "LONG") {
      return entryPrice + stopDistance * tpMultiplier;
    } else if (type === "SHORT") {
      return entryPrice - stopDistance * tpMultiplier;
    }

    return null;
  }

  /**
   * Check if we should exit based on opposite MACD cross
   */
  static shouldExitOnIndicator(position, indicators) {
    if (!indicators.macd) return false;

    if (position.side === "LONG" && indicators.macd.bearishCross) {
      return {
        exit: true,
        reason: "Cruce bajista MACD mientras está en posición LONG",
      };
    }

    if (position.side === "SHORT" && indicators.macd.bullishCross) {
      return {
        exit: true,
        reason: "Cruce alcista MACD mientras está en posición SHORT",
      };
    }

    return { exit: false };
  }

  /**
   * Check if within trading hours
   */
  static isWithinTradingHours(config) {
    if (!config.tradingHours.enabled) return true;

    const now = new Date();
    const currentHour = now.getUTCHours();

    return (
      currentHour >= config.tradingHours.startHour &&
      currentHour < config.tradingHours.endHour
    );
  }

  /**
   * Analyze market and generate trading signals
   */
  static analyze(candles, config) {
    const indicators = Indicators.computeAll(candles, config);

    const longSignal = this.checkLongEntry(indicators, config);
    const shortSignal = this.checkShortEntry(indicators, config);

    return {
      indicators,
      longSignal,
      shortSignal,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = Strategy;
