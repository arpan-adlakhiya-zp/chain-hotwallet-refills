const logger = require("../middleware/logger")("refillService");
const refillValidationService = require("./refillValidationService");
const refillUtils = require("./utils/utils");
const BigNumber = require('bignumber.js');

class RefillService {
  constructor() {
    this.initialized = false;
    this.providers = new Map();
  }

  /**
   * Initialize the refill service
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await refillUtils.initializeProviders(this.providers);

      this.initialized = true;
      logger.info('Refill service initialized with providers');
    } catch (error) {
      logger.error(`Failed to initialize refill service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process a refill request
   * @param {Object} refillData - The refill request data
   * @returns {Promise<Object>} The refill result object.
   *   - success {boolean}: true if the refill request is processed successfully, false otherwise.
   *   - error {string}: the error message if the refill request is not processed successfully.
   *   - code {string}: the error code if the refill request is not processed successfully.
   *   - data {Object}: the data if the refill request is processed successfully.
   */
  async processRefillRequestService(refillData) {
    try {
      // Ensure service is initialized
      await this.initialize();

      logger.info(`Processing refill request for wallet: ${refillData.wallet_address}`);

      // Get the provider for this token
      const provider = await refillUtils.getTokenProvider(
        refillData.chain_name,
        refillData.asset_symbol,
        this.providers
      );

      if (!provider) {
        logger.error(`No provider available for blockchain ${refillData.chain_name} and asset ${refillData.asset_symbol}`);
        return {
          success: false,
          error: 'No provider available for this blockchain and asset combination',
          code: 'NO_PROVIDER_AVAILABLE',
          data: {
            chainName: refillData.chain_name,
            assetSymbol: refillData.asset_symbol,
            availableProviders: Array.from(this.providers.keys())
          }
        };
      }

      // Validate the refill request
      refillData.provider = provider; // Pass provider to validation
      const validationResult = await refillValidationService.validateRefillRequest(refillData);
      if (!validationResult.success) {
        logger.error(`Refill request validation failed: ${validationResult.error}`);
        return {
          success: false,
          error: validationResult.error,
          code: validationResult.code,
          data: validationResult.data
        };
      }

      const validatedData = validationResult.data;
      console.log('Validated Data:', JSON.stringify(validatedData, null, 2));
      logger.info(`Refill request validated successfully for wallet: ${refillData.wallet_address}`);

      logger.info(`Selected provider: ${provider.constructor.getProviderName()}`);

      // Initiate transaction with selected provider
      const transactionResult = await this.initiateRefill(validatedData, provider);

      if (!transactionResult.success) {
        return {
          success: false,
          error: transactionResult.error,
          code: transactionResult.code,
          data: transactionResult.data
        };
      }

      logger.info(`Refill request initiated successfully. Transaction ID: ${transactionResult.data.transferId}, Provider: ${provider.constructor.getProviderName()}`);

      return {
        success: true,
        error: null,
        code: null,
        data: {
          transactionId: transactionResult.data.transferId,
          walletAddress: refillData.wallet_address,
          assetSymbol: refillData.asset_symbol,
          refillAmount: refillData.refill_amount,
          status: transactionResult.data.status,
          provider: provider.constructor.getProviderName()
        }
      };

    } catch (error) {
      logger.error(`Error processing refill request: ${error.message}`);
      return {
        success: false,
        error: 'Internal server error while processing refill request',
        code: 'PROCESSING_ERROR',
        data: {
          details: error.message
        }
      };
    }
  }

  /**
   * Initiate a refill transfer request
   * @param {Object} validatedData - The validated data from the refill request
   * @param {Object} provider - The provider instance
   * @returns {Promise<Object>}
   *   - success {boolean}: true if the refill request is initiated successfully, false otherwise.
   *   - error {string}: the error message if the refill request is not initiated successfully.
   *   - code {string}: the error code if the refill request is not initiated successfully.
   *   - data {Object}: the data if the refill request is initiated successfully.
   */
  async initiateRefill(validatedData, provider) {
    try {
      logger.info(`Initiating refill transfer request with provider: ${provider.constructor.getProviderName()}`);

      const atomicAmount = new BigNumber(validatedData.refillAmountAtomic);
      const decimals = new BigNumber(10).pow(validatedData.asset.decimals);
      const amount = atomicAmount.dividedBy(decimals).toString();

      const transferData = {
        coldWalletId: refillUtils.getColdWalletId(validatedData, provider),
        coldWalletAddress: validatedData.asset.refillSweepWallet,
        hotWalletId: refillUtils.getHotWalletId(validatedData, provider),
        hotWalletAddress: validatedData.wallet.address,
        amount: amount,
        asset: validatedData.asset.symbol,
        assetId: provider.constructor.getProviderName() === 'fireblocks' ? validatedData.asset.sweepWalletConfig.fireblocks.assetId : "",
        blockchain: validatedData.blockchain.symbol,
        contractAddress: validatedData.asset.contractAddress
      };

      const transferRequest = await provider.createTransferRequest(transferData);

      logger.info(`Transfer request created successfully with ${provider.constructor.getProviderName()}`);

      return {
        success: true,
        error: null,
        code: null,
        data: {
          transferId: transferRequest.id || transferRequest.transferId || transferRequest.transactionId,
          status: transferRequest.status || 'pending',
          message: transferRequest.message || 'Transfer request created successfully',
          transferRequest: transferRequest
        }
      };

    } catch (error) {
      logger.error(`Error initiating refill: ${error.message}`);
      return {
        success: false,
        error: `Failed to initiate refill with ${provider.constructor.getProviderName()}`,
        code: 'REFILL_INITIATION_ERROR',
        data: {
          details: error.message
        }
      };
    }
  }

  /**
   * Get the status of a refill request
   * @param {string} refillRequestId - The ID of the refill request
   * @param {Object} provider - The provider instance
   * @param {Object} token - The token data
   * @returns {Promise<Object>} The refill status result object.
   *   - success {boolean}: true if the refill status is retrieved successfully, false otherwise.
   *   - error {string}: the error message if the refill status is not retrieved successfully.
   *   - code {string}: the error code if the refill status is not retrieved successfully.
   *   - data {Object}: the data if the refill status is retrieved successfully.
   */
  async getRefillStatus(refillRequestId, provider, token) {
    try {
      logger.info(`Getting refill status for request ID: ${refillRequestId}`);

      const statusResult = await provider.getTransactionStatus(refillRequestId, token);
      
      return {
        success: true,
        error: null,
        code: null,
        data: {
          refillRequestId,
          status: statusResult.status || 'pending',
          message: `Transaction status: ${statusResult.status}`,
          transactionStatus: statusResult
        }
      };
    } catch (error) {
      logger.error(`Error getting refill status: ${error.message}`);
      return {
        success: false,
        error: 'Failed to get refill status',
        code: 'STATUS_CHECK_ERROR',
        data: {
          details: error.message
        }
      };
    }
  }

}

module.exports = new RefillService();
