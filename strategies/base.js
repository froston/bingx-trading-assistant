const Indicators = require("../indicators");

/**
 * Base Strategy Class
 * Provides common functionality and template methods for trading strategies
 *
 * To create a new strategy:
 * 1. Extend this class
 * 2. Override checkLongEntry() and checkShortEntry() methods
 * 3. Optionally override shouldExitOnIndicator() for custom exit logic
 */
class BaseStrategy {
  constructor(name = "BaseStrategy") {
    this.name = name;
  }

  /**
   * Template method for analyzing market conditions
   * Override this if you need custom analysis flow
   */
  analyze(candles, config) {
    const indicators = this.computeIndicators(candles, config);

    const longSignal = this.checkLongEntry(indicators, config);
    const shortSignal = this.checkShortEntry(indicators, config);

    return {
      indicators,
      longSignal,
      shortSignal,
      timestamp: new Date().toISOString(),
      strategy: this.name,
    };
  }

  /**
   * Compute technical indicators
   * Override this if you need custom indicators
   */
  computeIndicators(candles, config) {
    return Indicators.computeAll(candles, config);
  }

  /**
   * Check LONG entry conditions
   * MUST be overridden by child classes
   */
  checkLongEntry(indicators, config) {
    throw new Error(
      `${this.name}: checkLongEntry() must be implemented by child class`
    );
  }

  /**
   * Check SHORT entry conditions
   * MUST be overridden by child classes
   */
  checkShortEntry(indicators, config) {
    throw new Error(
      `${this.name}: checkShortEntry() must be implemented by child class`
    );
  }

  /**
   * Check if should exit based on indicators
   * Override this for custom exit logic
   */
  shouldExitOnIndicator(position, indicators) {
    if (!indicators.macd) return { exit: false };

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

  // ==================== UTILITY METHODS ====================

  /**
   * Check if we're in an uptrend (EMA20 > EMA50)
   */
  isUptrend(emaFast, emaSlow) {
    return emaFast > emaSlow;
  }

  /**
   * Check if we're in a downtrend (EMA20 < EMA50)
   */
  isDowntrend(emaFast, emaSlow) {
    return emaFast < emaSlow;
  }

  /**
   * Calculate stop loss price
   * Uses the lower of: swing low or (current price - 1×ATR)
   */
  calculateStopLoss(type, currentPrice, atr, swingLow, swingHigh, config) {
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
  calculateTakeProfit(type, entryPrice, stopLoss, config) {
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
   * Check if within trading hours
   */
  isWithinTradingHours(config) {
    if (!config.tradingHours.enabled) return true;

    const now = new Date();
    const currentHour = now.getUTCHours();

    return (
      currentHour >= config.tradingHours.startHour &&
      currentHour < config.tradingHours.endHour
    );
  }

  /**
   * Validate that all required indicators are available
   */
  validateIndicators(indicators) {
    return (
      indicators.emaFast &&
      indicators.emaSlow &&
      indicators.macd &&
      indicators.rsi !== null &&
      indicators.atr
    );
  }

  /**
   * Create standard signal response object
   */
  createSignalResponse(signal, type, reasons, indicators) {
    return {
      signal,
      type,
      reasons,
      indicators,
    };
  }

  /**
   * Helper to check multiple conditions and track results
   * Returns { passed: number, reasons: [], failures: [] }
   */
  checkConditions(conditions) {
    const reasons = [];
    const failures = [];

    for (const condition of conditions) {
      if (condition.met) {
        reasons.push(condition.successMessage);
      } else {
        failures.push(condition.failureMessage);
      }
    }

    return {
      passed: reasons.length,
      reasons,
      failures,
      allReasons: [...reasons, ...failures],
    };
  }
}

module.exports = BaseStrategy;
