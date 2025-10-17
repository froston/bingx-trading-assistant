# BingX Trading Assistant

A simple yet powerful trading tool that analyzes cryptocurrency markets using the BingX API and provides buy/sell recommendations based on technical indicators.

## Features

✨ **Market Analysis**

- Real-time price tracking
- 24-hour statistics (high, low, volume, change)
- Multiple technical indicators

📊 **Technical Indicators**

- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- Moving Averages (20 & 50 period)
- Bollinger Bands

🎯 **Smart Recommendations**

- Automated buy/sell signals
- Signal strength analysis
- Detailed reasoning for recommendations

💰 **Trading Capabilities**

- Place market and limit orders
- Order confirmation system
- Real-time account balance

🎨 **Beautiful UI**

- Modern, responsive design
- Real-time updates
- Easy-to-read indicators

## Getting Started

### Prerequisites

- BingX account with API access
- API Key and Secret from BingX

### How to Get BingX API Keys

1. Log in to your BingX account
2. Go to API Management
3. Create a new API key
4. Save your API Key and Secret (keep them secure!)
5. Enable spot trading permissions

### Installation

1. **Install Node.js** if you haven't already (download from nodejs.org)

2. **Configure API credentials:**

   ```bash
   # Copy the example environment file
   cp .env.example .env

   # Edit .env and add your BingX API credentials
   # BINGX_API_KEY=your_api_key_here
   # BINGX_API_SECRET=your_api_secret_here
   ```

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Start the server:**

   ```bash
   npm start
   ```

5. **Open your browser** and navigate to:
   ```
   http://localhost:3002
   ```

The server acts as a proxy to handle BingX API requests and avoid CORS issues. Your API credentials are stored securely in the `.env` file on your local machine.

### Usage

1. **Select Trading Pair**

   - Choose a trading pair from the dropdown (default: BTC-USDT)

2. **Analyze Market**

   - Click "Analyze Market" button
   - The tool will fetch market data and perform technical analysis
   - Wait for the recommendation to appear

3. **Review Analysis**

   - Check market overview statistics
   - Review technical indicators
   - Read the trading recommendation

4. **Place Orders** (Optional)
   - Select order side (Buy/Sell)
   - Choose order type (Market/Limit)
   - Enter quantity
   - Confirm the order

## Technical Indicators Explained

### RSI (Relative Strength Index)

- **< 30**: Oversold - Strong bullish signal
- **30-50**: Weak/Neutral zone - Hold
- **50-70**: Strengthening momentum - Bullish
- **> 70**: Overbought - Bearish signal

### MACD (Moving Average Convergence Divergence)

- **Positive histogram**: Bullish momentum
- **Negative histogram**: Bearish momentum
- **Close to 0**: Weak momentum - Neutral

### Moving Averages (MA20 & MA50)

- **Price above both MA20 & MA50**: Strong bullish trend
- **Price below both MA20 & MA50**: Bearish trend
- **Mixed position**: Neutral/Hold - Possible consolidation or emerging trend

### Bollinger Bands

- **Price near lower band**: Potentially oversold - Bullish
- **Price near upper band**: Potentially overbought - Bearish
- **Price near middle band**: Neutral

## Recommendation System

The tool uses a **weighted scoring system** that analyzes all indicators with the following weights:

### Indicator Weights:

- **RSI**: 20%
- **MACD**: 25%
- **Moving Averages**: 30% (highest weight)
- **Bollinger Bands**: 15%

### Scoring Method:

Each indicator receives a score from -1 (bearish) to +1 (bullish):

- The final score is calculated using weighted averages
- Scores range from -1.0 (maximum bearish) to +1.0 (maximum bullish)

### Recommendations:

- **STRONG BUY**: Score ≥ 0.5 (High confidence)
- **BUY**: Score ≥ 0.2 (Medium confidence)
- **HOLD**: Score between -0.2 and 0.2 (with bullish/bearish/neutral bias)
- **SELL**: Score ≤ -0.2 (Medium confidence)
- **STRONG SELL**: Score ≤ -0.5 (High confidence)

### Timeframe Analysis:

- **Short-term**: Based on RSI and MACD momentum
- **Medium-term**: Based on Moving Average trends

The system provides trend confirmation when 3+ indicators align in the same direction, indicating a strong signal.

## Security Notes

⚠️ **Important Security Tips:**

- Never share your API keys
- Use API keys with limited permissions
- Consider using a testnet for practice
- Always verify orders before confirming
- Store credentials securely

## Auto-Refresh

The tool automatically refreshes market data every 30 seconds to keep information current.

## Supported Trading Pairs

- BTC-USDT
- ETH-USDT
- BNB-USDT
- SOL-USDT
- XRP-USDT
- ADA-USDT
- DOGE-USDT

You can easily add more pairs by editing the HTML file.

## Troubleshooting

### Connection Issues

- Verify your API credentials are correct
- Check that API has spot trading permissions
- Ensure you have internet connectivity

### Order Failures

- Check account balance
- Verify minimum order quantities
- Ensure trading pair is active

## Disclaimer

⚠️ **Risk Warning:**

- Cryptocurrency trading carries significant risk
- This tool is for informational purposes only
- Always do your own research (DYOR)
- Never invest more than you can afford to lose
- Past performance does not guarantee future results

## Technical Details

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js with Express
- **API**: BingX Spot Trading API
- **Architecture**: Proxy server to handle CORS and secure API communication

## License

Free to use and modify for personal use.

---

**Happy Trading! 🚀**

Remember: The best trades are well-researched trades!
