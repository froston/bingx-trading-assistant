# BingX Crypto Trading Bot

Automated cryptocurrency day trading bot for BingX using a trend-following + breakout hybrid strategy.

## 🎯 Trading Strategy

### Strategy Type

**Trend-Following + Breakout Hybrid**  
The bot rides short-term trends and enters on strong momentum after consolidation.

### Timeframe

- **Default**: 5-minute candles
- **Trading Pair**: BTC-USDT (configurable)

---

## 📈 Technical Indicators

| Indicator    | Settings          | Purpose                              |
| ------------ | ----------------- | ------------------------------------ |
| **EMA Fast** | 20 periods        | Trend direction (short-term)         |
| **EMA Slow** | 50 periods        | Trend direction (long-term)          |
| **MACD**     | 12, 26, 9         | Momentum and crossover signals       |
| **RSI**      | 14 periods        | Overbought/oversold conditions       |
| **ATR**      | 14 periods        | Volatility and stop loss calculation |
| **Volume**   | 20-period average | Confirmation of breakouts            |

---

## 🟢 Long Entry Rules

All conditions must be met:

1. ✅ **Uptrend**: EMA(20) > EMA(50)
2. ✅ **Breakout**: Price closes above recent resistance
3. ✅ **Momentum**: MACD line crosses above signal line
4. ✅ **Not Overbought**: RSI < 70
5. ✅ **Volume Confirmation**: Current volume > 20-period average

---

## 🔴 Short Entry Rules

All conditions must be met:

1. ✅ **Downtrend**: EMA(20) < EMA(50)
2. ✅ **Breakdown**: Price breaks below recent support
3. ✅ **Momentum**: MACD line crosses below signal line
4. ✅ **Not Oversold**: RSI > 30
5. ✅ **Volume Confirmation**: Current volume > 20-period average

---

## 🚪 Exit Strategy

### Take Profit

- **Default**: 2× Stop Loss distance
- **Alternative**: Exit when MACD shows opposite cross
- **Example**: If stop loss = 0.5%, take profit = 1.0%

### Stop Loss

Uses the **more conservative** of:

- Recent swing low (for longs) / swing high (for shorts)
- 1× ATR from entry price

---

## 💰 Risk Management

| Parameter             | Default         | Description                           |
| --------------------- | --------------- | ------------------------------------- |
| **Risk per Trade**    | 2%              | Maximum account risk per single trade |
| **Position Sizing**   | Auto-calculated | `(Account × Risk%) / (Entry - Stop)`  |
| **Take Profit Ratio** | 2:1             | Risk/reward ratio                     |
| **Max Trades/Day**    | 3               | Prevents overtrading                  |
| **Min Position Size** | $10 USDT        | Minimum order size in USDT            |
| **Max Position Size** | $100 USDT       | Maximum order size in USDT            |

---

## ⏰ Trading Hours

- **Enabled**: Yes (configurable)
- **Active Hours**: 13:00 - 21:00 UTC
  - Aligns with US market open (~9:00 ET to 5:00 PM ET)
- **Purpose**: Focus on high-liquidity periods

---

## 🎚️ Configuration

All settings can be adjusted in `config.js`:

### Modify Risk Settings

```javascript
risk: {
  riskPercentage: 1.5,        // Change to 1-2%
  takeProfitMultiplier: 2,    // Change to 1.5-2x
  stopLossATRMultiplier: 1,   // Multiplier for ATR-based stops
  maxTradesPerDay: 5,         // Limit daily trades
}
```

### Adjust Indicators

```javascript
indicators: {
  emaFast: 20,                // Fast EMA period
  emaSlow: 50,                // Slow EMA period
  macd: {
    fast: 12,
    slow: 26,
    signal: 9
  },
  rsi: {
    period: 14,
    overbought: 70,
    oversold: 30
  }
}
```

### Change Trading Pair

The trading pair is now configurable via environment variable or defaults to BTC:

```javascript
symbol: process.env.SYMBOL || 'BTC-USDT',  // Default to BTC if not specified
interval: '5m',               // Change to 1m, 15m, 1h, etc.
```

Use the npm scripts for quick switching between coins (see Quick Start section).

### Trading Hours

```javascript
tradingHours: {
  enabled: true,              // Set false to trade 24/7
  startHour: 13,              // 13:00 UTC
  endHour: 21                 // 21:00 UTC
}
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

Create a `.env` file:

```
BINGX_API_KEY=your_api_key_here
BINGX_API_SECRET=your_api_secret_here
```

### 3. Test Mode (Recommended First)

```bash
npm run test
```

This validates orders without executing real trades.

### 4. Run with Specific Cryptocurrency

The bot supports quick scripts for different cryptocurrencies:

**Test Mode (No real orders):**

```bash
npm run btc      # Bitcoin (default)
npm run eth      # Ethereum
npm run bnb      # Binance Coin
npm run sol      # Solana
```

**Live Trading:**

```bash
npm run btc:live  # Bitcoin live
npm run eth:live  # Ethereum live
npm run bnb:live  # Binance Coin live
npm run sol:live  # Solana live
```

### 5. Default Live Trading

```bash
npm start         # Runs BTC in test mode by default
```

---

## 📊 Bot Behavior

- ✅ Checks market every **30 seconds**
- ✅ Fetches latest **100 candles** for analysis
- ✅ Logs all decisions to `trades.log`
- ✅ Records trades to `trades.json`
- ✅ **One position at a time** (default)
- ✅ Auto-closes on opposite signal
- ✅ Respects daily trade limits

---

## 📝 Trade Logging

The bot maintains two log files:

### `trades.log`

Human-readable log of all bot activities:

```
[2025-10-19T10:30:00.000Z] 🟢 LONG ENTRY SIGNAL DETECTED!
[2025-10-19T10:30:01.000Z]    ✓ Uptrend (EMA20: 43250 > EMA50: 43100)
[2025-10-19T10:30:01.000Z]    ✓ MACD bullish cross
[2025-10-19T10:30:02.000Z] ✅ LONG ORDER PLACED SUCCESSFULLY!
```

### `trades.json`

Structured trade data for analysis (one JSON object per line):

```json
{
  "action": "ENTRY",
  "type": "LONG",
  "entryPrice": "43250.00",
  "stopLoss": "43000.00",
  "takeProfit": "43750.00",
  "positionSize": "0.023",
  "riskAmount": "5.75",
  "riskRewardRatio": "2.00"
}
```

---

## ⚠️ Important Notes

### Risk Warning

- Crypto trading carries significant risk
- Past performance ≠ future results
- Only trade with capital you can afford to lose
- Always test thoroughly before live trading

### Best Practices

1. **Start in test mode** to validate strategy
2. **Use small position sizes** initially
3. **Monitor the bot regularly**, especially first few days
4. **Keep API keys secure** - never share or commit them
5. **Review daily trade logs** to understand bot decisions

### Recommended Settings for Beginners

```javascript
risk: {
  riskPercentage: 1,          // Conservative 1%
  maxTradesPerDay: 3,         // Fewer trades
}
```

---

## 🛠️ Stopping the Bot

Press `CTRL + C` to gracefully shut down the bot. It will:

- Stop monitoring the market
- NOT automatically close open positions (manage manually if needed)
- Save final logs

---

## 📞 Support

- BingX API Documentation: https://bingx-api.github.io/docs/
- Create API keys: https://bingx.com/en-us/account/api/

---

## 📜 License

MIT License - Use at your own risk.
