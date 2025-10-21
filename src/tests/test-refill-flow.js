#!/usr/bin/env node

/**
 * Test script for cold to hot wallet refill flow
 * This tests the entire codebase without actually sending transactions
 */

const config = require('../config');
const tokenProviderConfig = require('../config/tokenProviderConfig');
const refillService = require('../service/refillService');
// const refillValidationService = require('./src/service/refillValidationService');
// const databaseService = require('./src/service/chainDb');
// const logger = require('./src/middleware/logger')('test-refill-flow');

// Mock transaction data for testing
const mockRefillRequest = {
  wallet_address: "TTestHotWalletAddress123456789", // TRX hot wallet address
  asset_symbol: "trx",
  chain_name: "Tron",
  refill_amount: "100000000", // 100 TRX in sun (smallest unit)
  refill_sweep_wallet: "TTestColdWalletAddress987654321", // TRX cold wallet address
  asset_address: null, // Native token, no contract address
  created_by: "test-user"
};

async function testRefillFlow() {
  try {
    console.log('🚀 Starting Cold to Hot Wallet Refill Flow Test');
    console.log('=' .repeat(60));

  //   // Step 1: Test Configuration Loading
  //   console.log('\n📋 Step 1: Testing Configuration Loading');
  //   console.log('Server Port:', config.get('serverPort'));
  //   console.log('Supported Blockchains:', tokenProviderConfig.getSupportedBlockchains());
  //   console.log('TRX Provider:', tokenProviderConfig.getTokenProvider('trx', 'trx'));
  //   console.log('TRX Provider Config:', JSON.stringify(tokenProviderConfig.getTokenProviderConfig('trx', 'trx'), null, 2));
  //   console.log('✅ Configuration loading successful');

  //   // Step 2: Test Provider Initialization
  //   console.log('\n🔧 Step 2: Testing Provider Initialization');
  //   await refillService.initializeProviders();
  //   console.log('Available providers:', Array.from(refillService.providers.keys()));
  //   console.log('✅ Provider initialization successful');

  //   // Step 3: Test Database Connection
  //   console.log('\n🗄️ Step 3: Testing Database Connection');
  //   const dbHealth = await databaseService.healthCheck();
  //   console.log('Database health:', dbHealth);
  //   console.log('✅ Database connection successful');

  //   // Step 4: Test Refill Request Validation
  //   console.log('\n✅ Step 4: Testing Refill Request Validation');
  //   console.log('Mock refill request:', JSON.stringify(mockRefillRequest, null, 2));
    
  //   // Get provider for validation
  //   const provider = refillService.providers.get('liminal');
  //   if (!provider) {
  //     throw new Error('Liminal provider not available');
  //   }
    
  //   // Add provider to request for validation
  //   mockRefillRequest.provider = provider;
    
  //   const validationResult = await refillValidationService.validateRefillRequest(mockRefillRequest);
  //   console.log('Validation result:', JSON.stringify(validationResult, null, 2));
    
  //   if (validationResult.isValid) {
  //     console.log('✅ Refill request validation successful');
  //   } else {
  //     console.log('❌ Refill request validation failed:', validationResult.error);
  //     return;
  //   }

  //   // Step 5: Test Refill Processing (without actual transaction)
  //   console.log('\n🔄 Step 5: Testing Refill Processing (Mock Mode)');
  //   console.log('Note: wallet.SendMany is commented out - no actual transaction will be sent');
    
  //   const refillResult = await refillService.processRefillRequestService(mockRefillRequest);
  //   console.log('Refill processing result:', JSON.stringify(refillResult, null, 2));
    
  //   if (refillResult.success) {
  //     console.log('✅ Refill processing successful (mock mode)');
  //   } else {
  //     console.log('❌ Refill processing failed:', refillResult.error);
  //   }

  //   console.log('\n🎉 Test Complete!');
  //   console.log('=' .repeat(60));
  //   console.log('Summary:');
  //   console.log('- ✅ Configuration loading works');
  //   console.log('- ✅ Provider initialization works');
  //   console.log('- ✅ Database connection works');
  //   console.log('- ✅ Refill validation works');
  //   console.log('- ✅ Refill processing works (mock mode)');
  //   console.log('\n🚀 Ready for actual testnet transaction!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testRefillFlow().catch(console.error);
