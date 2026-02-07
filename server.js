const express = require('express');
const cors = require('cors');
const MetaApi = require('metaapi.cloud-sdk').default;

const app = express();
const PORT = 3001;

// Enable CORS for frontend
app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`\n✅ MetaAPI server running on http://localhost:${PORT}`);
  console.log('\nEndpoints:');
  console.log(`  GET  /health`);
  console.log(`  POST /api/metaapi/accounts`);
  console.log(`  POST /api/metaapi/test-connection\n`);
});
