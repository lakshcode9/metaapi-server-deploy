const express = require('express');
const cors = require('cors');
const path = require('path');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'MetaAPI server running' });
});

// Get accounts for a given token
app.post('/api/metaapi/accounts', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    console.log('Fetching accounts with token...');
    const metaApi = new MetaApi(token);
    
    // Use the method that works
    const accountsData = await metaApi.metatraderAccountApi.getAccountsWithClassicPagination();
    const accounts = accountsData.items;
    
    console.log(`Found ${accounts.length} accounts`);
    
    // Return clean account data
    const cleanAccounts = accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      login: acc.login,
      server: acc.server,
      region: acc.region,
      state: acc.state,
      connectionStatus: acc.connectionStatus,
      magic: acc.magic
    }));
    
    res.json({ success: true, accounts: cleanAccounts });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch accounts' 
    });
  }
});

// Test connection
app.post('/api/metaapi/test-connection', async (req, res) => {
  try {
    const { token, accountId } = req.body;
    
    if (!token || !accountId) {
      return res.status(400).json({ error: 'Token and accountId are required' });
    }

    console.log(`Testing connection for account ${accountId}...`);
    const metaApi = new MetaApi(token);
    const account = await metaApi.metatraderAccountApi.getAccount(accountId);
    
    // Deploy if needed
    if (account.state !== 'DEPLOYED') {
      await account.deploy();
      await account.waitDeployed();
    }
    
    // Test connection
    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();
    
    const accountInfo = await connection.getAccountInformation();
    
    res.json({ 
      success: true, 
      message: 'Connection successful',
      balance: accountInfo.balance,
      equity: accountInfo.equity,
      currency: accountInfo.currency
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Connection test failed' 
    });
  }
});

// Execute trade
app.post('/api/metaapi/execute-trade', async (req, res) => {
  try {
    const { token, accountId, symbol, direction, volume, stopLoss, takeProfit } = req.body;
    
    if (!token || !accountId || !symbol || !direction || !volume) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: token, accountId, symbol, direction, volume' 
      });
    }

    console.log(`Executing trade: ${direction} ${volume} ${symbol}`);
    const metaApi = new MetaApi(token);
    const account = await metaApi.metatraderAccountApi.getAccount(accountId);
    
    // Ensure account is deployed
    if (account.state !== 'DEPLOYED') {
      console.log('Deploying account...');
      await account.deploy();
      await account.waitDeployed();
    }
    
    // Connect to account
    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();
    
    // Execute trade based on direction
    let result;
    if (direction.toUpperCase() === 'BUY') {
      result = await connection.createMarketBuyOrder(
        symbol,
        parseFloat(volume),
        parseFloat(stopLoss) || undefined,
        parseFloat(takeProfit) || undefined
      );
    } else if (direction.toUpperCase() === 'SELL') {
      result = await connection.createMarketSellOrder(
        symbol,
        parseFloat(volume),
        parseFloat(stopLoss) || undefined,
        parseFloat(takeProfit) || undefined
      );
    } else {
      return res.status(400).json({ 
        success: false,
        error: 'Direction must be BUY or SELL' 
      });
    }
    
    console.log(`Trade executed successfully: Order ${result.orderId}`);
    
    res.json({ 
      success: true,
      result: {
        order: result.orderId,
        position: result.positionId,
        status: 'executed'
      }
    });
  } catch (error) {
    console.error('Trade execution failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Trade execution failed' 
    });
  }
});

// Get open positions
app.post('/api/metaapi/get-positions', async (req, res) => {
  try {
    const { token, accountId } = req.body;
    
    if (!token || !accountId) {
      return res.status(400).json({ error: 'Token and accountId are required' });
    }

    console.log(`Fetching positions for account ${accountId}...`);
    const metaApi = new MetaApi(token);
    const account = await metaApi.metatraderAccountApi.getAccount(accountId);
    
    // Ensure deployed
    if (account.state !== 'DEPLOYED') {
      await account.deploy();
      await account.waitDeployed();
    }
    
    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();
    
    const positions = await connection.getPositions();
    
    console.log(`Found ${positions.length} open positions`);
    
    res.json({ 
      success: true, 
      positions: positions.map(pos => ({
        id: pos.id,
        symbol: pos.symbol,
        type: pos.type,
        volume: pos.volume,
        openPrice: pos.openPrice,
        currentPrice: pos.currentPrice,
        profit: pos.profit,
        swap: pos.swap,
        commission: pos.commission,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        time: pos.time
      }))
    });
  } catch (error) {
    console.error('Failed to fetch positions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch positions' 
    });
  }
});

// Close position
app.post('/api/metaapi/close-position', async (req, res) => {
  try {
    const { token, accountId, positionId } = req.body;
    
    if (!token || !accountId || !positionId) {
      return res.status(400).json({ 
        error: 'Token, accountId, and positionId are required' 
      });
    }

    console.log(`Closing position ${positionId}...`);
    const metaApi = new MetaApi(token);
    const account = await metaApi.metatraderAccountApi.getAccount(accountId);
    
    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();
    
    const result = await connection.closePosition(positionId);
    
    console.log(`Position ${positionId} closed successfully`);
    
    res.json({ 
      success: true,
      result: {
        orderId: result.orderId,
        message: 'Position closed successfully'
      }
    });
  } catch (error) {
    console.error('Failed to close position:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to close position' 
    });
  }
});

// Close all positions (for kill switch)
app.post('/api/metaapi/close-all-positions', async (req, res) => {
  try {
    const { token, accountId } = req.body;
    
    if (!token || !accountId) {
      return res.status(400).json({ error: 'Token and accountId are required' });
    }

    console.log(`Closing all positions for account ${accountId}...`);
    const metaApi = new MetaApi(token);
    const account = await metaApi.metatraderAccountApi.getAccount(accountId);
    
    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();
    
    const positions = await connection.getPositions();
    const results = [];
    
    for (const position of positions) {
      try {
        const result = await connection.closePosition(position.id);
        results.push({ positionId: position.id, success: true, orderId: result.orderId });
      } catch (error) {
        results.push({ positionId: position.id, success: false, error: error.message });
      }
    }
    
    console.log(`Closed ${results.filter(r => r.success).length} of ${positions.length} positions`);
    
    res.json({ 
      success: true,
      message: `Closed ${results.filter(r => r.success).length} positions`,
      results
    });
  } catch (error) {
    console.error('Failed to close all positions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to close all positions' 
    });
  }
});

// Get trade history
app.post('/api/metaapi/get-history', async (req, res) => {
  try {
    const { token, accountId, limit = 20, startTime } = req.body;
    
    if (!token || !accountId) {
      return res.status(400).json({ error: 'Token and accountId are required' });
    }

    console.log(`Fetching history for account ${accountId}...`);
    const metaApi = new MetaApi(token);
    const account = await metaApi.metatraderAccountApi.getAccount(accountId);
    
    // Ensure deployed
    if (account.state !== 'DEPLOYED') {
      await account.deploy();
      await account.waitDeployed();
    }
    
    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();
    
    const historyStartTime = startTime ? new Date(startTime) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deals = await connection.getHistoryDealsByTimeRange(historyStartTime, new Date());
    
    console.log(`Found ${deals.length} historical deals`);
    
    res.json({ 
      success: true, 
      deals: deals.map(deal => ({
        id: deal.id,
        symbol: deal.symbol,
        type: deal.type,
        volume: deal.volume,
        entryPrice: deal.entryPrice,
        price: deal.price,
        profit: deal.profit,
        commission: deal.commission,
        swap: deal.swap,
        time: deal.time,
        platform: deal.platform,
        magic: deal.magic,
        comment: deal.comment
      })).slice(0, limit)
    });
  } catch (error) {
    console.error('Failed to fetch history:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch history' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ MetaAPI server running on http://localhost:${PORT}`);
  console.log('\nEndpoints:');
  console.log(`  GET  /health`);
  console.log(`  POST /api/metaapi/accounts`);
  console.log(`  POST /api/metaapi/test-connection`);
  console.log(`  POST /api/metaapi/execute-trade`);
  console.log(`  POST /api/metaapi/get-positions`);
  console.log(`  POST /api/metaapi/get-history`);
  console.log(`  POST /api/metaapi/close-position`);
  console.log(`  POST /api/metaapi/close-all-positions\n`);
});
