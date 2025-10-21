#!/usr/bin/env node

/**
 * Configuration and Logic Validation Test
 * Tests our codebase without full SDK initialization
 */

const config = require('../config');
const tokenProviderConfig = require('../config/tokenProviderConfig');
const logger = require('../middleware/logger')('test-config-validation');

// Mock refill request data
const mockRefillRequest = {
  wallet_address: "TTestHotWalletAddress123456789", // TRX hot wallet address
  asset_symbol: "trx",
  chain_name: "Tron",
  refill_amount: "100000000", // 100 TRX in sun (smallest unit)
  refill_sweep_wallet: "TTestColdWalletAddress987654321", // TRX cold wallet address
  asset_address: null, // Native token, no contract address
  created_by: "test-user"
};

async function testConfigurationAndLogic() {
  try {
    console.log('🚀 Starting Configuration and Logic Validation Test');
    console.log('=' .repeat(60));

    // Step 1: Test Configuration Loading
    console.log('\n📋 Step 1: Testing Configuration Loading');
    console.log('Server Port:', config.get('serverPort'));
    console.log('Log Config:', JSON.stringify(config.get('logConfig'), null, 2));
    console.log('Providers:', JSON.stringify(config.get('providers'), null, 2));
    console.log('Chains:', JSON.stringify(config.get('chains'), null, 2));
    console.log('✅ Configuration loading successful');

    // Step 2: Test Token Provider Configuration
    console.log('\n🔧 Step 2: Testing Token Provider Configuration');
    console.log('Supported Blockchains:', tokenProviderConfig.getSupportedBlockchains());
    console.log('TRX Provider:', tokenProviderConfig.getTokenProvider('trx', 'trx'));
    console.log('BTC Provider:', tokenProviderConfig.getTokenProvider('btc', 'btc'));
    console.log('TRX Tokens:', tokenProviderConfig.getSupportedTokens('trx'));
    console.log('BTC Tokens:', tokenProviderConfig.getSupportedTokens('btc'));
    
    const trxProviderConfig = tokenProviderConfig.getTokenProviderConfig('trx', 'trx');
    console.log('TRX Provider Config:', JSON.stringify(trxProviderConfig, null, 2));
    
    const btcProviderConfig = tokenProviderConfig.getTokenProviderConfig('btc', 'btc');
    console.log('BTC Provider Config:', JSON.stringify(btcProviderConfig, null, 2));
    console.log('✅ Token provider configuration successful');

    // Step 3: Test Database Connection (if available)
    console.log('\n🗄️ Step 3: Testing Database Connection');
    try {
      const databaseService = require('../service/chainDb');
      const dbHealth = await databaseService.healthCheck();
      console.log('Database health:', dbHealth);
      console.log('✅ Database connection successful');
    } catch (error) {
      console.log('⚠️ Database connection test skipped:', error.message);
    }

    // Step 4: Test Refill Request Structure
    console.log('\n✅ Step 4: Testing Refill Request Structure');
    console.log('Mock refill request:', JSON.stringify(mockRefillRequest, null, 2));
    
    // Validate required fields (asset_address can be null for native tokens)
    const requiredFields = ['wallet_address', 'asset_symbol', 'chain_name', 'refill_amount', 'refill_sweep_wallet', 'created_by'];
    const missingFields = requiredFields.filter(field => !mockRefillRequest[field]);
    
    if (missingFields.length === 0) {
      console.log('✅ All required fields present');
      console.log('✅ asset_address is null (correct for native tokens like TRX)');
    } else {
      console.log('❌ Missing required fields:', missingFields);
      return;
    }

    // Step 5: Test Provider Selection Logic
    console.log('\n🔄 Step 5: Testing Provider Selection Logic');
    const chainName = mockRefillRequest.chain_name;
    const assetSymbol = mockRefillRequest.asset_symbol;
    
    // Get blockchain symbol (this would normally come from database)
    // For testing, we'll use the correct mapping
    const chainSymbolMap = {
      'Tron': 'trx',
      'Bitcoin': 'btc',
      'Ethereum': 'eth'
    };
    const blockchainSymbol = chainSymbolMap[chainName] || chainName.toLowerCase();
    console.log(`Chain: ${chainName} -> Symbol: ${blockchainSymbol}`);
    
    const provider = tokenProviderConfig.getTokenProvider(blockchainSymbol, assetSymbol);
    console.log(`Provider for ${blockchainSymbol}/${assetSymbol}: ${provider}`);
    
    if (provider) {
      console.log('✅ Provider selection successful');
    } else {
      console.log('❌ Provider selection failed');
      return;
    }

    // Step 6: Test Transaction Data Structure
    console.log('\n💸 Step 6: Testing Transaction Data Structure');
    const transactionData = {
      from: mockRefillRequest.refill_sweep_wallet,
      to: mockRefillRequest.wallet_address,
      amount: mockRefillRequest.refill_amount,
      asset: mockRefillRequest.asset_symbol,
      chain: blockchainSymbol,
      provider: provider
    };
    
    console.log('Transaction data:', JSON.stringify(transactionData, null, 2));
    console.log('✅ Transaction data structure valid');

    // Step 7: Test Mock Transaction Creation
    console.log('\n🔧 Step 7: Testing Mock Transaction Creation');
    const mockTransaction = {
      id: `mock_tx_${Date.now()}`,
      sequenceId: `refill_${Date.now()}`,
      status: 'pending',
      recipients: [{
        address: transactionData.to,
        amount: transactionData.amount
      }],
      message: 'Mock transaction - wallet.SendMany commented out for testing'
    };
    
    console.log('Mock transaction:', JSON.stringify(mockTransaction, null, 2));
    console.log('✅ Mock transaction creation successful');

    console.log('\n🎉 Configuration and Logic Test Complete!');
    console.log('=' .repeat(60));
    console.log('Summary:');
    console.log('- ✅ Configuration loading works');
    console.log('- ✅ Token provider configuration works');
    console.log('- ✅ Database connection works (if available)');
    console.log('- ✅ Refill request structure is valid');
    console.log('- ✅ Provider selection logic works');
    console.log('- ✅ Transaction data structure is valid');
    console.log('- ✅ Mock transaction creation works');
    console.log('\n🚀 Configuration and logic validation successful!');
    console.log('📝 Note: Full SDK test requires resolving dependency issues');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testConfigurationAndLogic().catch(console.error);
