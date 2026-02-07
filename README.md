# MetaAPI Server

Simple Node.js server for MetaAPI integration.

## Deploy to Render

1. Create new repo on GitHub
2. Push this folder
3. On Render.com:
   - New Web Service
   - Connect your repo
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Deploy!

## Environment Variables

None needed - just deploy as-is!

## Endpoints

- `GET /health` - Health check
- `POST /api/metaapi/accounts` - Get accounts (body:
  `{ "token": "your-token" }`)
- `POST /api/metaapi/test-connection` - Test connection (body:
  `{ "token": "your-token", "accountId": "account-id" }`)
