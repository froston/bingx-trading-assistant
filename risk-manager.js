/**
 * Risk Management Module
 * Handles position sizing, risk calculation, and trade limits
 */
class RiskManager {
  constructor(config) {
    this.config = config;
    this.tradesExecutedToday = 0;
    this.lastResetDate = new Date().toDateString();
  }

  /**
   * Reset daily trade counter if it's a new day
   */
  checkAndResetDailyCounter() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.tradesExecutedToday = 0;
      this.lastResetDate = today;
      console.log("📅 New trading day - trade counter reset");
    }
  }

  /**
   * Check if we've reached max trades for the day
   */
  canTradeToday() {
    this.checkAndResetDailyCounter();
    return this.tradesExecutedToday < this.config.risk.maxTradesPerDay;
  }

  /**
   * Increment daily trade counter
   */
  recordTrade() {
    this.tradesExecutedToday++;
    console.log(
      `📊 Trades today: ${this.tradesExecutedToday}/${this.config.risk.maxTradesPerDay}`
    );
  }

  /**
   * Calculate position size based on risk percentage and stop distance
   *
   * Formula: Position Size = (Account Balance × Risk %) / |Entry Price - Stop Loss|
   *
   * @param {number} accountBalance - Total account balance in USDT
   * @param {number} entryPrice - Planned entry price
   * @param {number} stopLoss - Stop loss price
   * @returns {number} Position size in base asset (e.g., BTC)
   */
  calculatePositionSize(accountBalance, entryPrice, stopLoss) {
    const riskAmount = accountBalance * (this.config.risk.riskPercentage / 100);
    const stopDistance = Math.abs(entryPrice - stopLoss);

    if (stopDistance === 0) {
      console.error(
        "⚠️  Stop distance is zero - cannot calculate position size"
      );
      return 0;
    }

    let positionSize = riskAmount / stopDistance;

    // Apply min/max limits
    if (positionSize < this.config.risk.minPositionSize) {
      console.log(
        `⚠️  Position size ${positionSize.toFixed(6)} below minimum, using ${
          this.config.risk.minPositionSize
        }`
      );
      positionSize = this.config.risk.minPositionSize;
    }

    if (positionSize > this.config.risk.maxPositionSize) {
      console.log(
        `⚠️  Position size ${positionSize.toFixed(
          6
        )} above maximum, capping at ${this.config.risk.maxPositionSize}`
      );
      positionSize = this.config.risk.maxPositionSize;
    }

    return positionSize;
  }

  /**
   * Validate if a trade meets risk criteria
   */
  validateTrade(accountBalance, entryPrice, stopLoss, positionSize) {
    const stopDistance = Math.abs(entryPrice - stopLoss);
    const potentialLoss = stopDistance * positionSize;
    const riskPercentage = (potentialLoss / accountBalance) * 100;

    console.log("\n💰 Risk Analysis:");
    console.log(`   Account Balance: $${accountBalance.toFixed(2)}`);
    console.log(`   Entry Price: $${entryPrice.toFixed(2)}`);
    console.log(`   Stop Loss: $${stopLoss.toFixed(2)}`);
    console.log(
      `   Stop Distance: $${stopDistance.toFixed(2)} (${(
        (stopDistance / entryPrice) *
        100
      ).toFixed(2)}%)`
    );
    console.log(`   Position Size: ${positionSize.toFixed(6)}`);
    console.log(
      `   Max Risk: $${potentialLoss.toFixed(2)} (${riskPercentage.toFixed(
        2
      )}%)`
    );

    // Check if risk is within acceptable range
    if (riskPercentage > this.config.risk.riskPercentage * 1.5) {
      console.log(
        `⚠️  Risk too high: ${riskPercentage.toFixed(2)}% > ${(
          this.config.risk.riskPercentage * 1.5
        ).toFixed(2)}%`
      );
      return false;
    }

    return true;
  }

  /**
   * Calculate position value in USDT
   */
  calculatePositionValue(positionSize, price) {
    return positionSize * price;
  }

  /**
   * Check if account has sufficient balance for trade
   */
  hasSufficientBalance(accountBalance, positionSize, entryPrice, leverage = 1) {
    const requiredMargin = (positionSize * entryPrice) / leverage;
    const safetyBuffer = 1.1; // 10% buffer for fees and slippage

    const required = requiredMargin * safetyBuffer;

    console.log(
      `   Required Margin: $${required.toFixed(2)} (with ${(
        (safetyBuffer - 1) *
        100
      ).toFixed(0)}% buffer)`
    );
    console.log(`   Available Balance: $${accountBalance.toFixed(2)}`);

    if (accountBalance < required) {
      console.log(
        `⚠️  Insufficient balance: $${accountBalance.toFixed(
          2
        )} < $${required.toFixed(2)}`
      );
      return false;
    }

    return true;
  }

  /**
   * Format position size to appropriate precision
   */
  formatPositionSize(size, symbol) {
    // BTC typically uses 3 decimal places, adjust as needed for other symbols
    if (symbol.includes("BTC")) {
      return parseFloat(size.toFixed(3));
    } else if (symbol.includes("ETH")) {
      return parseFloat(size.toFixed(2));
    } else {
      return parseFloat(size.toFixed(4));
    }
  }

  /**
   * Get trade summary for logging
   */
  getTradeSummary(
    type,
    entryPrice,
    stopLoss,
    takeProfit,
    positionSize,
    accountBalance
  ) {
    const stopDistance = Math.abs(entryPrice - stopLoss);
    const takeProfitDistance = Math.abs(takeProfit - entryPrice);
    const riskAmount = stopDistance * positionSize;
    const rewardAmount = takeProfitDistance * positionSize;
    const riskRewardRatio = rewardAmount / riskAmount;

    return {
      type,
      entryPrice: entryPrice.toFixed(2),
      stopLoss: stopLoss.toFixed(2),
      takeProfit: takeProfit.toFixed(2),
      positionSize: positionSize.toFixed(6),
      riskAmount: riskAmount.toFixed(2),
      rewardAmount: rewardAmount.toFixed(2),
      riskRewardRatio: riskRewardRatio.toFixed(2),
      riskPercentage: ((riskAmount / accountBalance) * 100).toFixed(2),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = RiskManager;
