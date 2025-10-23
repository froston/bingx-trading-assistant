const { EMA, MACD, RSI, ATR } = require("technicalindicators");

/**
 * Technical Indicators Calculator
 * Computes EMA, MACD, RSI, ATR and volume analysis
 */
class Indicators {
  /**
   * Calculate Exponential Moving Average
   */
  static calculateEMA(values, period) {
    if (values.length < period) return null;

    const emaResult = EMA.calculate({
      period,
      values,
    });

    return emaResult.length > 0 ? emaResult[emaResult.length - 1] : null;
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  static calculateMACD(
    values,
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9
  ) {
    if (values.length < slowPeriod + signalPeriod) return null;

    const macdResult = MACD.calculate({
      values,
      fastPeriod,
      slowPeriod,
      signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    if (macdResult.length < 2) return null;

    const current = macdResult[macdResult.length - 1];
    const previous = macdResult[macdResult.length - 2];

    return {
      macd: current.MACD,
      signal: current.signal,
      histogram: current.histogram,
      // Check for crossover
      bullishCross:
        previous.MACD <= previous.signal && current.MACD > current.signal,
      bearishCross:
        previous.MACD >= previous.signal && current.MACD < current.signal,
    };
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  static calculateRSI(values, period = 14) {
    if (values.length < period) return null;

    const rsiResult = RSI.calculate({
      values,
      period,
    });

    return rsiResult.length > 0 ? rsiResult[rsiResult.length - 1] : null;
  }

  /**
   * Calculate ATR (Average True Range)
   */
  static calculateATR(candles, period = 14) {
    if (candles.length < period) return null;

    const atrResult = ATR.calculate({
      high: candles.map((c) => c.high),
      low: candles.map((c) => c.low),
      close: candles.map((c) => c.close),
      period,
    });

    return atrResult.length > 0 ? atrResult[atrResult.length - 1] : null;
  }

  /**
   * Calculate average volume over period
   */
  static calculateAverageVolume(candles, period = 20) {
    if (candles.length < period) return null;

    const recentVolumes = candles.slice(-period).map((c) => c.volume);
    const avgVolume = recentVolumes.reduce((sum, v) => sum + v, 0) / period;

    return avgVolume;
  }

  /**
   * Check if current volume is above average (volume spike)
   */
  static isVolumeSpiking(candles, period = 20, multiplier = 1.3) {
    if (candles.length < period + 1) return false;

    const currentVolume = candles[candles.length - 1].volume;
    const avgVolume = this.calculateAverageVolume(candles.slice(0, -1), period);

    // Volume must be 30% above average (more realistic threshold)
    return currentVolume > avgVolume * multiplier;
  }

  /**
   * Find recent swing low (for stop loss on long positions)
   */
  static findSwingLow(candles, lookback = 10) {
    if (candles.length < lookback) return null;

    const recentCandles = candles.slice(-lookback);
    const swingLow = Math.min(...recentCandles.map((c) => c.low));

    return swingLow;
  }

  /**
   * Find recent swing high (for stop loss on short positions)
   */
  static findSwingHigh(candles, lookback = 10) {
    if (candles.length < lookback) return null;

    const recentCandles = candles.slice(-lookback);
    const swingHigh = Math.max(...recentCandles.map((c) => c.high));

    return swingHigh;
  }

  /**
   * Check if price broke recent resistance (bullish breakout)
   */
  static checkBullishBreakout(candles, lookback = 10) {
    if (candles.length < lookback + 1) return false;

    const currentClose = candles[candles.length - 1].close;
    const previousClose = candles[candles.length - 2].close;
    const recentHighs = candles.slice(-lookback - 1, -1).map((c) => c.high);
    const resistance = Math.max(...recentHighs);

    // Price closed above recent resistance OR showing strong momentum
    const percentAboveResistance =
      ((currentClose - resistance) / resistance) * 100;
    return (
      currentClose > resistance ||
      (previousClose <= resistance && currentClose >= resistance * 0.998)
    );
  }

  /**
   * Check if price broke recent support (bearish breakdown)
   */
  static checkBearishBreakdown(candles, lookback = 10) {
    if (candles.length < lookback + 1) return false;

    const currentClose = candles[candles.length - 1].close;
    const previousClose = candles[candles.length - 2].close;
    const recentLows = candles.slice(-lookback - 1, -1).map((c) => c.low);
    const support = Math.min(...recentLows);

    // Price closed below recent support OR showing strong momentum
    const percentBelowSupport = ((support - currentClose) / support) * 100;
    return (
      currentClose < support ||
      (previousClose >= support && currentClose <= support * 1.002)
    );
  }

  /**
   * Compute all indicators for given candle data
   */
  static computeAll(candles, config) {
    const closes = candles.map((c) => c.close);

    return {
      emaFast: this.calculateEMA(closes, config.indicators.emaFast),
      emaSlow: this.calculateEMA(closes, config.indicators.emaSlow),
      ema200: this.calculateEMA(closes, config.indicators.ema200 || 200),
      macd: this.calculateMACD(
        closes,
        config.indicators.macd.fast,
        config.indicators.macd.slow,
        config.indicators.macd.signal
      ),
      rsi: this.calculateRSI(closes, config.indicators.rsi.period),
      atr: this.calculateATR(candles, config.indicators.atr.period),
      avgVolume: this.calculateAverageVolume(
        candles,
        config.indicators.volume.period
      ),
      volumeSpike: this.isVolumeSpiking(
        candles,
        config.indicators.volume.period,
        config.indicators.volume.spikeMultiplier || 1.3
      ),
      swingLow: this.findSwingLow(candles),
      swingHigh: this.findSwingHigh(candles),
      bullishBreakout: this.checkBullishBreakout(candles),
      bearishBreakdown: this.checkBearishBreakdown(candles),
      currentPrice: candles[candles.length - 1].close,
    };
  }
}

module.exports = Indicators;
