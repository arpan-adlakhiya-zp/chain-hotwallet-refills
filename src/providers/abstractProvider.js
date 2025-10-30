/**
 * Abstract Provider Base Class for Wallet Refill Services
 * All provider implementations should extend this class
 */
class AbstractProvider {
  constructor(config, secret) {
    this._config = config;
    this._secret = secret;
  }

  get config() {
    return this._config;
  }

  set config(config) {
    this._config = config;
  }

  get secret() {
    return this._secret;
  }

  set secret(secret) {
    this._secret = secret;
  }

  /**
   * Initialize the provider with configuration
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async init() {
    return;
  }

  /**
   * Get token balance for a wallet
   * @param {Object} token - Token configuration object
   * @returns {Promise<string>} Balance in atomic units
   */
  async getTokenBalance(token) {
    throw new Error('getTokenBalance() method must be implemented by provider');
  }

  /**
   * Create a transfer request from cold wallet to hot wallet
   * @param {Object} transferData - Transfer configuration
   * @returns {Promise<Object>} Transfer request result
   */
  async createTransferRequest(transferData) {
    throw new Error('createTransferRequest() method must be implemented by provider');
  }

  /**
   * Validate provider credentials and configuration
   * @returns {Promise<{success: boolean, error?: string, code?: string}>}
   */
  async validateCredentials() {
    throw new Error('validateCredentials() method must be implemented by provider');
  }


  /**
   * Get provider name
   * @returns {string} Provider name
   */
  static getProviderName() {
    throw new Error('getProviderName() method must be implemented by provider');
  }


  /**
   * Get provider health status
   * @returns {Promise<{success: boolean, status?: string, error?: string, code?: string}>}
   */
  async getHealthStatus() {
    try {
      const validation = await this.validateCredentials();
      return {
        success: validation.success,
        status: validation.success ? 'healthy' : 'unhealthy',
        error: validation.error,
        code: validation.code
      };
    } catch (error) {
      return {
        success: false,
        status: 'unhealthy',
        error: error.message,
        code: 'HEALTH_CHECK_ERROR'
      };
    }
  }
}

module.exports = AbstractProvider;
