const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3002;

// Get API credentials from environment variables
const API_KEY = process.env.BINGX_API_KEY;
const API_SECRET = process.env.BINGX_API_SECRET;

// Validate that credentials are set
if (!API_KEY || !API_SECRET) {
  console.error(
    "❌ ERROR: BINGX_API_KEY and BINGX_API_SECRET must be set in .env file"
  );
  console.error(
    "📝 Please copy .env.example to .env and fill in your credentials"
  );
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(".")); // Serve static files from current directory

const BINGX_BASE_URL = "https://open-api.bingx.com";

// Helper function to generate signature
function generateSignature(queryString, apiSecret) {
  return crypto
    .createHmac("sha256", apiSecret)
    .update(queryString)
    .digest("hex");
}

// Helper function to build query string
function buildQueryString(params) {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");
}

// Public endpoint - no authentication required but timestamp needed
app.get("/api/public/*", async (req, res) => {
  try {
    const endpoint = req.params[0];

    // Add timestamp to params for BingX API
    const params = { ...req.query, timestamp: Date.now() };
    const queryString = buildQueryString(params);

    const url = `${BINGX_BASE_URL}/${endpoint}?${queryString}`;

    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Authenticated GET endpoint
app.post("/api/authenticated/get", async (req, res) => {
  try {
    const { endpoint, params } = req.body;

    const timestamp = Date.now();
    const fullParams = { ...params, timestamp };

    const queryString = buildQueryString(fullParams);
    const signature = generateSignature(queryString, API_SECRET);

    const url = `${BINGX_BASE_URL}${endpoint}?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
      headers: {
        "X-BX-APIKEY": API_KEY,
      },
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Authenticated POST endpoint
app.post("/api/authenticated/post", async (req, res) => {
  try {
    const { endpoint, params } = req.body;

    const timestamp = Date.now();
    const fullParams = { ...params, timestamp };

    const queryString = buildQueryString(fullParams);
    const signature = generateSignature(queryString, API_SECRET);

    const url = `${BINGX_BASE_URL}${endpoint}?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-BX-APIKEY": API_KEY,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(
    `🚀 BingX Trading Assistant Server running on http://localhost:${PORT}`
  );
  console.log(`📊 Open your browser and navigate to http://localhost:${PORT}`);
  console.log(`✅ API credentials loaded successfully`);
});
