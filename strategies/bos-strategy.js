const BaseStrategy = require("./base");

/**
 * BOS (Break of Structure) Multi-Timeframe Strategy
 *
 * Strategy Rules:
 * 1. 4H Timeframe Analysis:
 *    - Bullish trend if close > EMA200
 *    - Bearish trend if close < EMA200
 *    - Detect BOS (Break of Structure) in favor of trend
 *
 * 2. After BOS on 4H:
 *    - Calculate retracement zone 50-61.8% of the impulse that broke
 *
 * 3. 5M Confirmation:
 *    - When price touches the 50-61.8% zone (from 4H impulse)
 *    - Wait for BOS on 5M in favor of the trend
 *
 * 4. Entry:
 *    - Once 5M BOS confirmed, propose LIMIT entry at 50-61.8% of 5M BOS impulse
 *    - SL behind the pivot
 *    - Optional TPs
 */
class BOSStrategy extends BaseStrategy {
  constructor() {
    super("BOSStrategy");

    // Strategy state management
    this.state = {
      // 4H analysis
      trend4H: null, // 'BULLISH' or 'BEARISH'
      bos4H: null, // { detected: true, type: 'BULLISH', impulse: {...} }
      retracementZone4H: null, // { low: 0.5 level, high: 0.618 level }

      // 5M confirmation
      inRetracementZone: false,
      bos5M: null,
      entryZone5M: null,

      // Entry management
      entryProposed: false,
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
    };
  }

  /**
   * Override analyze method for multi-timeframe analysis
   */
  analyze(candles4H, candles5M, config) {
    // Compute indicators for both timeframes
    const indicators4H = this.computeIndicators(candles4H, config);
    const indicators5M = this.computeIndicators(candles5M, config);

    // Step 1: Analyze 4H trend
    this.analyzeTrend4H(candles4H, indicators4H);

    // Step 2: Detect BOS on 4H
    this.detectBOS4H(candles4H, indicators4H);

    // Step 3: Calculate retracement zone if BOS detected
    if (this.state.bos4H && this.state.bos4H.detected) {
      this.calculateRetracementZone4H(candles4H);
    }

    // Step 4: Check if price is in retracement zone
    this.checkRetracementZone(indicators4H.currentPrice);

    // Step 5: If in retracement zone, look for 5M BOS confirmation
    if (this.state.inRetracementZone) {
      this.detectBOS5M(candles5M, indicators5M);
    }

    // Step 6: If 5M BOS confirmed, calculate entry zone
    if (
      this.state.bos5M &&
      this.state.bos5M.detected &&
      !this.state.entryProposed
    ) {
      this.calculateEntryZone5M(candles5M);
    }

    // Generate signals
    const longSignal = this.checkLongEntry(indicators4H, indicators5M, config);
    const shortSignal = this.checkShortEntry(
      indicators4H,
      indicators5M,
      config
    );

    return {
      indicators4H,
      indicators5M,
      longSignal,
      shortSignal,
      state: this.state,
      timestamp: new Date().toISOString(),
      strategy: this.name,
    };
  }

  /**
   * Analyze 4H trend based on EMA200
   */
  analyzeTrend4H(candles, indicators) {
    if (!indicators.ema200) {
      this.state.trend4H = null;
      return;
    }

    const currentClose = candles[candles.length - 1].close;

    if (currentClose > indicators.ema200) {
      this.state.trend4H = "BULLISH";
    } else if (currentClose < indicators.ema200) {
      this.state.trend4H = "BEARISH";
    } else {
      this.state.trend4H = null;
    }
  }

  /**
   * Detect Break of Structure (BOS) on 4H timeframe
   * BOS = Price breaks recent high (bullish) or low (bearish) in favor of trend
   */
  detectBOS4H(candles, indicators) {
    if (!this.state.trend4H) {
      this.state.bos4H = null;
      return;
    }

    const lookback = 20; // Look back 20 candles for structure
    if (candles.length < lookback + 2) {
      this.state.bos4H = null;
      return;
    }

    const currentCandle = candles[candles.length - 1];
    const previousCandle = candles[candles.length - 2];
    const structureCandles = candles.slice(-lookback - 2, -1);

    if (this.state.trend4H === "BULLISH") {
      // Find recent swing high
      const swingHigh = Math.max(...structureCandles.map((c) => c.high));

      // BOS occurs when price breaks above swing high
      if (
        currentCandle.close > swingHigh &&
        previousCandle.close <= swingHigh
      ) {
        // Find the impulse (from swing low to break point)
        const swingLow = this.findLastSwingLow(structureCandles);

        this.state.bos4H = {
          detected: true,
          type: "BULLISH",
          breakLevel: swingHigh,
          impulse: {
            start: swingLow,
            end: currentCandle.high,
            size: currentCandle.high - swingLow,
          },
          timestamp: currentCandle.time,
        };
      }
    } else if (this.state.trend4H === "BEARISH") {
      // Find recent swing low
      const swingLow = Math.min(...structureCandles.map((c) => c.low));

      // BOS occurs when price breaks below swing low
      if (currentCandle.close < swingLow && previousCandle.close >= swingLow) {
        // Find the impulse (from swing high to break point)
        const swingHigh = this.findLastSwingHigh(structureCandles);

        this.state.bos4H = {
          detected: true,
          type: "BEARISH",
          breakLevel: swingLow,
          impulse: {
            start: swingHigh,
            end: currentCandle.low,
            size: swingHigh - currentCandle.low,
          },
          timestamp: currentCandle.time,
        };
      }
    }
  }

  /**
   * Calculate 50-61.8% retracement zone from 4H impulse
   */
  calculateRetracementZone4H(candles) {
    if (!this.state.bos4H || !this.state.bos4H.impulse) return;

    const impulse = this.state.bos4H.impulse;

    if (this.state.bos4H.type === "BULLISH") {
      // For bullish: retracement down from the high
      const fib50 = impulse.end - impulse.size * 0.5;
      const fib618 = impulse.end - impulse.size * 0.618;

      this.state.retracementZone4H = {
        high: fib50,
        low: fib618,
        type: "BULLISH",
      };
    } else if (this.state.bos4H.type === "BEARISH") {
      // For bearish: retracement up from the low
      const fib50 = impulse.end + impulse.size * 0.5;
      const fib618 = impulse.end + impulse.size * 0.618;

      this.state.retracementZone4H = {
        low: fib50,
        high: fib618,
        type: "BEARISH",
      };
    }
  }

  /**
   * Check if current price is in the retracement zone
   */
  checkRetracementZone(currentPrice) {
    if (!this.state.retracementZone4H) {
      this.state.inRetracementZone = false;
      return;
    }

    const zone = this.state.retracementZone4H;

    this.state.inRetracementZone =
      currentPrice >= zone.low && currentPrice <= zone.high;
  }

  /**
   * Detect BOS on 5M timeframe (confirmation)
   */
  detectBOS5M(candles, indicators) {
    const lookback = 10; // Look back 10 candles on 5M
    if (candles.length < lookback + 2) {
      this.state.bos5M = null;
      return;
    }

    const currentCandle = candles[candles.length - 1];
    const previousCandle = candles[candles.length - 2];
    const structureCandles = candles.slice(-lookback - 2, -1);

    if (this.state.trend4H === "BULLISH") {
      const swingHigh5M = Math.max(...structureCandles.map((c) => c.high));

      if (
        currentCandle.close > swingHigh5M &&
        previousCandle.close <= swingHigh5M
      ) {
        const swingLow5M = this.findLastSwingLow(structureCandles);

        this.state.bos5M = {
          detected: true,
          type: "BULLISH",
          breakLevel: swingHigh5M,
          impulse: {
            start: swingLow5M,
            end: currentCandle.high,
            size: currentCandle.high - swingLow5M,
          },
          timestamp: currentCandle.time,
        };
      }
    } else if (this.state.trend4H === "BEARISH") {
      const swingLow5M = Math.min(...structureCandles.map((c) => c.low));

      if (
        currentCandle.close < swingLow5M &&
        previousCandle.close >= swingLow5M
      ) {
        const swingHigh5M = this.findLastSwingHigh(structureCandles);

        this.state.bos5M = {
          detected: true,
          type: "BEARISH",
          breakLevel: swingLow5M,
          impulse: {
            start: swingHigh5M,
            end: currentCandle.low,
            size: swingHigh5M - currentCandle.low,
          },
          timestamp: currentCandle.time,
        };
      }
    }
  }

  /**
   * Calculate entry zone (50-61.8% of 5M BOS impulse)
   */
  calculateEntryZone5M(candles) {
    if (!this.state.bos5M || !this.state.bos5M.impulse) return;

    const impulse = this.state.bos5M.impulse;

    if (this.state.bos5M.type === "BULLISH") {
      // Entry zone for long
      const fib50 = impulse.end - impulse.size * 0.5;
      const fib618 = impulse.end - impulse.size * 0.618;

      this.state.entryZone5M = {
        high: fib50,
        low: fib618,
      };

      // Entry at 50% level, SL below 61.8%
      this.state.entryPrice = fib50;
      this.state.stopLoss = fib618 - impulse.size * 0.05; // SL slightly below pivot

      // Calculate TP (optional, 1:2 or 1:3 R:R)
      const riskDistance = this.state.entryPrice - this.state.stopLoss;
      this.state.takeProfit = this.state.entryPrice + riskDistance * 2;

      this.state.entryProposed = true;
    } else if (this.state.bos5M.type === "BEARISH") {
      // Entry zone for short
      const fib50 = impulse.end + impulse.size * 0.5;
      const fib618 = impulse.end + impulse.size * 0.618;

      this.state.entryZone5M = {
        low: fib50,
        high: fib618,
      };

      // Entry at 50% level, SL above 61.8%
      this.state.entryPrice = fib50;
      this.state.stopLoss = fib618 + impulse.size * 0.05; // SL slightly above pivot

      // Calculate TP (optional, 1:2 or 1:3 R:R)
      const riskDistance = this.state.stopLoss - this.state.entryPrice;
      this.state.takeProfit = this.state.entryPrice - riskDistance * 2;

      this.state.entryProposed = true;
    }
  }

  /**
   * Check LONG entry conditions
   */
  checkLongEntry(indicators4H, indicators5M, config) {
    const conditions = [];

    // Must have bullish trend on 4H
    if (this.state.trend4H !== "BULLISH") {
      conditions.push("✗ Tendencia 4H no es alcista");
      return this.createSignalResponse(false, "LONG", conditions, indicators4H);
    }
    conditions.push("✓ Tendencia 4H alcista (Cierre > EMA200)");

    // Must have BOS on 4H
    if (!this.state.bos4H || !this.state.bos4H.detected) {
      conditions.push("✗ No hay BOS alcista en 4H");
      return this.createSignalResponse(false, "LONG", conditions, indicators4H);
    }
    conditions.push(
      `✓ BOS 4H detectado (Break: $${this.state.bos4H.breakLevel.toFixed(2)})`
    );

    // Must have retracement zone calculated
    if (!this.state.retracementZone4H) {
      conditions.push("✗ Zona de retroceso 4H no calculada");
      return this.createSignalResponse(false, "LONG", conditions, indicators4H);
    }
    conditions.push(
      `✓ Zona retroceso 4H: $${this.state.retracementZone4H.low.toFixed(
        2
      )} - $${this.state.retracementZone4H.high.toFixed(2)}`
    );

    // Price must be in retracement zone
    if (!this.state.inRetracementZone) {
      conditions.push("✗ Precio no está en zona de retroceso 4H");
      return this.createSignalResponse(false, "LONG", conditions, indicators4H);
    }
    conditions.push("✓ Precio en zona de retroceso 4H (50-61.8%)");

    // Must have BOS confirmation on 5M
    if (!this.state.bos5M || !this.state.bos5M.detected) {
      conditions.push("✗ Esperando confirmación BOS en 5M");
      return this.createSignalResponse(false, "LONG", conditions, indicators4H);
    }
    conditions.push("✓ BOS 5M confirmado (confirmación alcista)");

    // Must have entry zone calculated
    if (!this.state.entryProposed) {
      conditions.push("✗ Zona de entrada 5M no calculada");
      return this.createSignalResponse(false, "LONG", conditions, indicators4H);
    }
    conditions.push(
      `✓ Entrada propuesta: $${this.state.entryPrice.toFixed(
        2
      )} | SL: $${this.state.stopLoss.toFixed(
        2
      )} | TP: $${this.state.takeProfit.toFixed(2)}`
    );

    // All conditions met
    return this.createSignalResponse(true, "LONG", conditions, {
      ...indicators4H,
      entryPrice: this.state.entryPrice,
      stopLoss: this.state.stopLoss,
      takeProfit: this.state.takeProfit,
    });
  }

  /**
   * Check SHORT entry conditions
   */
  checkShortEntry(indicators4H, indicators5M, config) {
    const conditions = [];

    // Must have bearish trend on 4H
    if (this.state.trend4H !== "BEARISH") {
      conditions.push("✗ Tendencia 4H no es bajista");
      return this.createSignalResponse(
        false,
        "SHORT",
        conditions,
        indicators4H
      );
    }
    conditions.push("✓ Tendencia 4H bajista (Cierre < EMA200)");

    // Must have BOS on 4H
    if (!this.state.bos4H || !this.state.bos4H.detected) {
      conditions.push("✗ No hay BOS bajista en 4H");
      return this.createSignalResponse(
        false,
        "SHORT",
        conditions,
        indicators4H
      );
    }
    conditions.push(
      `✓ BOS 4H detectado (Break: $${this.state.bos4H.breakLevel.toFixed(2)})`
    );

    // Must have retracement zone calculated
    if (!this.state.retracementZone4H) {
      conditions.push("✗ Zona de retroceso 4H no calculada");
      return this.createSignalResponse(
        false,
        "SHORT",
        conditions,
        indicators4H
      );
    }
    conditions.push(
      `✓ Zona retroceso 4H: $${this.state.retracementZone4H.low.toFixed(
        2
      )} - $${this.state.retracementZone4H.high.toFixed(2)}`
    );

    // Price must be in retracement zone
    if (!this.state.inRetracementZone) {
      conditions.push("✗ Precio no está en zona de retroceso 4H");
      return this.createSignalResponse(
        false,
        "SHORT",
        conditions,
        indicators4H
      );
    }
    conditions.push("✓ Precio en zona de retroceso 4H (50-61.8%)");

    // Must have BOS confirmation on 5M
    if (!this.state.bos5M || !this.state.bos5M.detected) {
      conditions.push("✗ Esperando confirmación BOS en 5M");
      return this.createSignalResponse(
        false,
        "SHORT",
        conditions,
        indicators4H
      );
    }
    conditions.push("✓ BOS 5M confirmado (confirmación bajista)");

    // Must have entry zone calculated
    if (!this.state.entryProposed) {
      conditions.push("✗ Zona de entrada 5M no calculada");
      return this.createSignalResponse(
        false,
        "SHORT",
        conditions,
        indicators4H
      );
    }
    conditions.push(
      `✓ Entrada propuesta: $${this.state.entryPrice.toFixed(
        2
      )} | SL: $${this.state.stopLoss.toFixed(
        2
      )} | TP: $${this.state.takeProfit.toFixed(2)}`
    );

    // All conditions met
    return this.createSignalResponse(true, "SHORT", conditions, {
      ...indicators4H,
      entryPrice: this.state.entryPrice,
      stopLoss: this.state.stopLoss,
      takeProfit: this.state.takeProfit,
    });
  }

  /**
   * Reset state after trade execution or invalidation
   */
  resetState() {
    this.state = {
      trend4H: null,
      bos4H: null,
      retracementZone4H: null,
      inRetracementZone: false,
      bos5M: null,
      entryZone5M: null,
      entryProposed: false,
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Find the last swing low before a breakout
   */
  findLastSwingLow(candles, lookback = 5) {
    if (candles.length < lookback) {
      return Math.min(...candles.map((c) => c.low));
    }

    let swingLow = Infinity;

    // Find the lowest point that was a swing low (lower than neighbors)
    for (let i = lookback; i < candles.length - lookback; i++) {
      const isSwingLow =
        candles.slice(i - lookback, i).every((c) => c.low >= candles[i].low) &&
        candles
          .slice(i + 1, i + lookback + 1)
          .every((c) => c.low >= candles[i].low);

      if (isSwingLow && candles[i].low < swingLow) {
        swingLow = candles[i].low;
      }
    }

    // If no swing low found, return overall minimum
    if (swingLow === Infinity) {
      swingLow = Math.min(...candles.map((c) => c.low));
    }

    return swingLow;
  }

  /**
   * Find the last swing high before a breakdown
   */
  findLastSwingHigh(candles, lookback = 5) {
    if (candles.length < lookback) {
      return Math.max(...candles.map((c) => c.high));
    }

    let swingHigh = -Infinity;

    // Find the highest point that was a swing high (higher than neighbors)
    for (let i = lookback; i < candles.length - lookback; i++) {
      const isSwingHigh =
        candles
          .slice(i - lookback, i)
          .every((c) => c.high <= candles[i].high) &&
        candles
          .slice(i + 1, i + lookback + 1)
          .every((c) => c.high <= candles[i].high);

      if (isSwingHigh && candles[i].high > swingHigh) {
        swingHigh = candles[i].high;
      }
    }

    // If no swing high found, return overall maximum
    if (swingHigh === -Infinity) {
      swingHigh = Math.max(...candles.map((c) => c.high));
    }

    return swingHigh;
  }
}

module.exports = BOSStrategy;
