/**
 * Token Provider Configuration
 * 
 * This file reads token configurations from the .CHAIN_REFILL_CONFIGrc file.
 * Uses the new simplified config structure with chains section.
 */

const config = require('./index');

/**
 * Get the provider for a specific token and blockchain
 * @param {string} chainSymbol - The blockchain symbol (btc, trx, eth, etc.)
 * @param {string} tokenSymbol - The token symbol
 * @returns {string|null} Provider name or null if not found
 */
function getTokenProvider(chainSymbol, tokenSymbol) {
  const chains = config.get('chains');
  if (!chains || !Array.isArray(chains)) {
    return null;
  }
  
  // Find the chain configuration
  const chainConfig = chains.find(chain => chain.chainName === chainSymbol);
  if (!chainConfig) {
    return null;
  }
  
  // Check if token is supported for this blockchain
  const supportedTokens = chainConfig.tokens || [];
  if (!supportedTokens.includes(tokenSymbol.toLowerCase())) {
    return null;
  }
  
  return chainConfig.provider;
}

/**
 * Get provider configuration for a specific token
 * @param {string} chainSymbol - The blockchain symbol (btc, trx, eth, etc.)
 * @param {string} tokenSymbol - The token symbol
 * @returns {Object|null} Provider configuration or null if not found
 */
function getTokenProviderConfig(chainSymbol, tokenSymbol) {
  const chains = config.get('chains');
  if (!chains || !Array.isArray(chains)) {
    return null;
  }
  
  // Find the chain configuration
  const chainConfig = chains.find(chain => chain.chainName === chainSymbol);
  if (!chainConfig) {
    return null;
  }
  
  const providerName = chainConfig.provider;
  
  // Get global provider config
  const globalProviderConfig = config.get(`providers.${providerName}`);
  if (!globalProviderConfig) {
    return null;
  }
  
  // Start with global config
  const providerConfig = {
    provider: providerName,
    ...globalProviderConfig
  };
  
  // Add chain-specific provider config if it exists
  if (chainConfig[providerName]) {
    Object.assign(providerConfig, chainConfig[providerName]);
  }
  
  return providerConfig;
}

/**
 * Get all supported tokens for a blockchain
 * @param {string} chainSymbol - The blockchain symbol (btc, trx, eth, etc.)
 * @returns {Array} Array of supported token symbols
 */
function getSupportedTokens(chainSymbol) {
  const chains = config.get('chains');
  if (!chains || !Array.isArray(chains)) {
    return [];
  }
  
  const chainConfig = chains.find(chain => chain.chainName === chainSymbol);
  return chainConfig ? (chainConfig.tokens || []) : [];
}

/**
 * Get all supported blockchains
 * @returns {Array} Array of supported blockchain symbols
 */
function getSupportedBlockchains() {
  const chains = config.get('chains');
  if (!chains || !Array.isArray(chains)) {
    return [];
  }
  
  return chains.map(chain => chain.chainName);
}

/**
 * Get blockchain configuration
 * @param {string} chainSymbol - The blockchain symbol (btc, trx, eth, etc.)
 * @returns {Object|null} Blockchain configuration or null if not found
 */
function getBlockchainConfig(chainSymbol) {
  const chains = config.get('chains');
  if (!chains || !Array.isArray(chains)) {
    return null;
  }
  
  return chains.find(chain => chain.chainName === chainSymbol) || null;
}

/**
 * Get the active provider for a blockchain
 * @param {string} chainSymbol - The blockchain symbol (btc, trx, eth, etc.)
 * @returns {string|null} Active provider name or null if not found
 */
function getActiveProvider(chainSymbol) {
  const chains = config.get('chains');
  if (!chains || !Array.isArray(chains)) {
    return null;
  }
  
  const chainConfig = chains.find(chain => chain.chainName === chainSymbol);
  return chainConfig ? chainConfig.provider : null;
}

module.exports = {
  getTokenProvider,
  getTokenProviderConfig,
  getSupportedTokens,
  getSupportedBlockchains,
  getBlockchainConfig,
  getActiveProvider
};
