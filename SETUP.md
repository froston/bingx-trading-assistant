# Quick Setup Guide

## Step 1: Create your `.env` file

Copy the example file and edit it with your credentials:

**On Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**On Windows (CMD):**
```cmd
copy .env.example .env
```

**On macOS/Linux:**
```bash
cp .env.example .env
```

## Step 2: Edit the `.env` file

Open `.env` in your text editor and replace the placeholder values:

```
BINGX_API_KEY=your_actual_api_key_here
BINGX_API_SECRET=your_actual_api_secret_here
PORT=3002
```

## Step 3: Install dependencies

```bash
npm install
```

## Step 4: Start the server

```bash
npm start
```

## Step 5: Open in browser

Navigate to: http://localhost:3002

---

## Important Security Notes

- **NEVER** commit your `.env` file to git
- The `.env` file is already in `.gitignore`
- Keep your API keys secure and private
- Consider using API keys with limited permissions for testing

## Troubleshooting

### Error: "BINGX_API_KEY and BINGX_API_SECRET must be set"

This means your `.env` file is missing or not configured correctly. Make sure:
1. The file is named exactly `.env` (not `.env.txt`)
2. The keys are spelled correctly
3. There are no extra spaces around the `=` sign
4. You've saved the file after editing

### Error: "Port 3002 is already in use"

Change the PORT in your `.env` file to a different number (e.g., 3003, 3004)

### Cannot connect to BingX API

1. Verify your API credentials are correct
2. Check that your API key has the necessary permissions
3. Ensure you have internet connectivity

