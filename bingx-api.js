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
        const candles = response.data.map((candle) => ({
          time: candle.time,
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
          volume: parseFloat(candle.volume),
        }));

        // BingX returns candles in descending order (newest first)
        // Reverse to get oldest first (standard for technical indicators)
        return candles.reverse();
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
    try {
      const response = await this.request(
        "GET",
        "/openApi/swap/v3/user/balance"
      );

      if (response.code === 0 && response.data) {
        const usdtBalance = response.data.find((b) =>
          b.asset === this.testMode ? "VST" : "USDT"
        );
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
          positionId: pos.positionId,
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
   * Place a LIMIT order at a specific price
   * Useful for BOS strategy where we want to enter at specific retracement levels
   */
  async placeLimitOrder(
    symbol,
    side,
    quantity,
    limitPrice,
    stopLoss = null,
    takeProfit = null
  ) {
    try {
      const endpoint = "/openApi/swap/v2/trade/order";

      const params = {
        symbol,
        side: side.toUpperCase(), // BUY or SELL
        positionSide: side.toUpperCase() === "BUY" ? "LONG" : "SHORT",
        type: "LIMIT",
        price: parseFloat(limitPrice),
        quantity,
        timeInForce: "GTC", // Good Till Cancel
      };

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

      const response = await this.request("POST", endpoint, params);

      if (response.code === 0 && response.data) {
        return {
          success: true,
          orderId: response.data.order?.orderId,
          symbol,
          side,
          quantity,
          limitPrice,
        };
      }

      return { success: false, error: response.msg };
    } catch (error) {
      console.error("Error al colocar orden LIMIT:", error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel an open order by order ID
   */
  async cancelOrder(symbol, orderId) {
    try {
      const endpoint = "/openApi/swap/v2/trade/order";
      const params = {
        symbol,
        orderId,
      };

      const response = await this.request("DELETE", endpoint, params);

      if (response.code === 0) {
        return {
          success: true,
          orderId,
        };
      }

      return { success: false, error: response.msg };
    } catch (error) {
      console.error("Error al cancelar orden:", error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all open orders for a symbol
   */
  async getOpenOrders(symbol) {
    try {
      const endpoint = "/openApi/swap/v2/trade/openOrders";
      const params = { symbol };

      const response = await this.request("GET", endpoint, params);

      if (response.code === 0 && response.data) {
        return response.data.map((order) => ({
          orderId: order.orderId,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          price: parseFloat(order.price),
          quantity: parseFloat(order.origQty),
          status: order.status,
        }));
      }

      return [];
    } catch (error) {
      console.error("Error al obtener órdenes abiertas:", error.message);
      return [];
    }
  }

  /**
   * Close position by position ID
   */
  async closePosition(positionId) {
    try {
      const endpoint = "/openApi/swap/v2/trade/closePosition";

      const params = {
        positionId,
      };

      const response = await this.request("POST", endpoint, params);

      if (response.code === 0 && response.data) {
        return {
          success: true,
          orderId: response.data.order?.orderId,
          positionId,
        };
      }

      return { success: false, error: response.msg };
    } catch (error) {
      console.error("Error al cerrar posición:", error.message);
      return { success: false, error: error.message };
    }
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
