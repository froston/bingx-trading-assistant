const axios = require("axios");
const crypto = require("crypto");
const config = require("./config");
require("dotenv").config();

/**
 * BingX API Client
 * Handles all API interactions with BingX perpetual futures
 */
class BingXAPI {
  constructor() {
    this.apiKey = process.env.BINGX_API_KEY;
    this.apiSecret = process.env.BINGX_API_SECRET;
    this.testMode = config.bot.testMode;

    if (config.bot.testMode) {
      this.baseURL = "https://open-api-vst.bingx.com";
    } else {
      this.baseURL = "https://open-api.bingx.com";
    }
  }

  /**
   * Generate signature for authenticated requests
   */
  generateSignature(params) {
    const queryString = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");

    return crypto
      .createHmac("sha256", this.apiSecret)
      .update(queryString)
      .digest("hex");
  }

  /**
   * Make authenticated API request
   */
  async request(method, endpoint, params = {}) {
    try {
      const timestamp = Date.now();
      const requestParams = {
        ...params,
        timestamp,
      };

      requestParams.signature = this.generateSignature(requestParams);

      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          "X-BX-APIKEY": this.apiKey,
        },
      };

      if (method === "GET") {
        config.params = requestParams;
      } else {
        config.data = requestParams;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(
        `Error de API: ${error.response?.data?.msg || error.message}`
      );
      throw error;
    }
  }

  /**
   * Get latest kline/candlestick data
   */
  async getKlines(symbol, interval, limit = 100) {
    try {
      const params = {
        symbol,
        interval,
        limit,
      };

      const response = await this.request(
        "GET",
        "/openApi/swap/v3/quote/klines",
        params
      );

      if (response.code === 0 && response.data) {
        return response.data.map((candle) => ({
          time: candle.time,
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
          volume: parseFloat(candle.volume),
        }));
      }
      return [];
    } catch (error) {
      console.error("Error al obtener velas:", error.message);
      return [];
    }
  }

  /**
   * Get account balance
   */
  async getBalance() {
    if (this.testMode) {
      return { asset: "USDT", balance: 100, availableMargin: 100 };
    }
    try {
      const response = await this.request(
        "GET",
        "/openApi/swap/v3/user/balance"
      );

      if (response.code === 0 && response.data) {
        const usdtBalance = response.data.find((b) => b.asset === "USDT");
        return {
          asset: "USDT",
          balance: parseFloat(usdtBalance?.balance || 0),
          availableMargin: parseFloat(usdtBalance?.availableMargin || 0),
        };
      }
      return { asset: "USDT", balance: 0, availableMargin: 0 };
    } catch (error) {
      console.error("Error al obtener saldo:", error.message);
      return { asset: "USDT", balance: 0, availableMargin: 0 };
    }
  }

  /**
   * Get current positions
   */
  async getPositions(symbol) {
    try {
      const params = { symbol };
      const response = await this.request(
        "GET",
        "/openApi/swap/v2/user/positions",
        params
      );

      if (response.code === 0 && response.data) {
        return response.data.map((pos) => ({
          symbol: pos.symbol,
          side: pos.positionSide,
          size: parseFloat(pos.positionAmt),
          entryPrice: parseFloat(pos.avgPrice),
          unrealizedProfit: parseFloat(pos.unrealizedProfit),
          leverage: parseFloat(pos.leverage),
        }));
      }
      return [];
    } catch (error) {
      console.error("Error al obtener posiciones:", error.message);
      return [];
    }
  }

  /**
   * Place a market order (or test order if in test mode)
   */
  async placeOrder(symbol, side, quantity, stopLoss = null, takeProfit = null) {
    try {
      const endpoint = "/openApi/swap/v2/trade/order";

      const params = {
        symbol,
        side: side.toUpperCase(), // BUY or SELL
        positionSide: side.toUpperCase() === "BUY" ? "LONG" : "SHORT",
        type: "MARKET",
        quantity,
      };

      if (!this.testMode) {
        if (takeProfit) {
          params.takeProfit = JSON.stringify({
            type: "TAKE_PROFIT_MARKET",
            stopPrice: parseFloat(takeProfit),
            price: parseFloat(takeProfit),
            workingType: "MARK_PRICE",
          });
        }

        if (stopLoss) {
          params.stopLoss = JSON.stringify({
            type: "STOP_MARKET",
            stopPrice: parseFloat(stopLoss),
            price: parseFloat(stopLoss),
            workingType: "MARK_PRICE",
          });
        }
      }

      const response = await this.request("POST", endpoint, params);

      if (response.code === 0 && response.data) {
        return {
          success: true,
          orderId: response.data.order?.orderId,
          symbol,
          side,
          quantity,
        };
      }

      return { success: false, error: response.msg };
    } catch (error) {
      console.error("Error al colocar orden:", error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Close position
   */
  async closePosition(symbol, side, quantity) {
    // To close a LONG, we SELL; to close a SHORT, we BUY
    const closeSide = side === "LONG" ? "SELL" : "BUY";
    return await this.placeOrder(symbol, closeSide, quantity);
  }

  /**
   * Set leverage for symbol
   */
  async setLeverage(symbol, leverage) {
    try {
      const params = {
        symbol,
        leverage: leverage.toString(),
        side: "BOTH",
      };

      const response = await this.request(
        "POST",
        "/openApi/swap/v2/trade/leverage",
        params
      );
      return response.code === 0;
    } catch (error) {
      console.error("Error al configurar apalancamiento:", error.message);
      return false;
    }
  }
}

module.exports = BingXAPI;
