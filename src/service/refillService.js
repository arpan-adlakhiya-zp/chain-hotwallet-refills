const logger = require("../middleware/logger")("refillService");
const refillValidationService = require("./refillValidationService");
const refillTransactionService = require("./refillTransactionService");
const providerService = require("./providerService");
const refillUtils = require("./utils/utils");
const BigNumber = require('bignumber.js');

class RefillService {
  constructor() {
    this.initialized = false;
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
      await providerService.initialize();
      this.initialized = true;
      logger.info('Refill service initialized with providers');
    } catch (error) {
      logger.error(`Failed to initialize refill service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the providers map
   * @returns {Map} Map of initialized providers
   */
  get providers() {
    return providerService.getProviders();
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
      // Validate required fields before processing the refill request
      const fieldValidation = refillValidationService.validateRequiredFields(refillData);
      if (!fieldValidation.success) {
        logger.error(`Missing required fields in refill request: ${fieldValidation.error}, result: ${JSON.stringify(fieldValidation, null, 2)}`);
        return fieldValidation;
      }

      // Ensure service is initialized
      await this.initialize();

      const refillRequestId = refillData.refill_request_id;
      logger.info(`Processing refill request for wallet: ${refillData.wallet_address}, request ID: ${refillRequestId}`);

      logger.debug(`Refill data: ${JSON.stringify(refillData, null, 2)}`);

      // Validate the refill request
      const validationResult = await refillValidationService.validateRefillRequest(refillData);
      if (!validationResult.success) {
        logger.error(`Refill request validation failed: ${validationResult.error}, result: ${JSON.stringify(validationResult, null, 2)}`);
        return {
          success: false,
          error: validationResult.error,
          code: validationResult.code,
          data: validationResult.data
        };
      }

      const validatedData = validationResult.data.details;
      logger.debug(`Validated Data: ${JSON.stringify(validatedData, null, 2)}`);
      logger.info(`Refill request validated successfully for wallet: ${refillData.wallet_address}, request ID: ${refillRequestId}`);
      
      const provider = validationResult.data.provider;
      const providerName = provider.constructor.getProviderName();

      // Create initial transaction record on successful validation
      const transactionData = {
        refillRequestId: refillRequestId,
        provider: providerName,
        status: 'PENDING',
        amountAtomic: validatedData.refillAmountAtomic,
        amount: refillData.refill_amount,  // Human-readable amount
        tokenSymbol: validatedData.asset.symbol,
        chainName: validatedData.blockchain.name,  // Blockchain name
        assetId: validatedData.asset.id,  // Asset has FK to wallet and blockchain
        providerStatus: null  // Will be set when provider responds
      };

      const createTransactionResult = await refillTransactionService.createRefillTransaction(transactionData);
      if (!createTransactionResult.success) {
        logger.error(`Failed to create transaction record: ${createTransactionResult.error}`);
        return {
          success: false,
          error: 'Failed to create transaction record',
          code: 'TRANSACTION_CREATION_ERROR',
          data: createTransactionResult.data
        };
      }

      logger.info(`Selected provider: ${providerName}`);

      // Initiate transaction with selected provider
      const transactionResult = await this.initiateRefill(validatedData, provider, refillRequestId);
      if (!transactionResult.success) {
        logger.error(`Failed to initiate refill: ${transactionResult.error}`);

        // Update transaction record with error
        if (refillRequestId) {
          await refillTransactionService.updateRefillTransaction(refillRequestId, {
            status: 'FAILED',
            message: transactionResult.error
          });
        }
        return {
          success: false,
          error: transactionResult.error,
          code: transactionResult.code,
          data: transactionResult.data
        };
      }

      const txnStatus = refillTransactionService.mapProviderStatusToInternal(providerName, transactionResult.data.status);

      // Update transaction record on success
      await refillTransactionService.updateRefillTransaction(refillRequestId, {
        status: txnStatus,
        providerTxId: transactionResult.data.transferId,
        providerStatus: transactionResult.data.status,
        externalTxId: transactionResult.data.externalTxId
      });

      logger.info(`Refill request initiated successfully. Transaction ID: ${transactionResult.data.transferId}, Provider: ${providerName}`);

      return {
        success: true,
        error: null,
        code: null,
        data: {
          refillRequestId: refillRequestId,
          transactionId: transactionResult.data.transferId,
          walletAddress: refillData.wallet_address,
          assetSymbol: refillData.asset_symbol,
          refillAmount: refillData.refill_amount,
          status: txnStatus,
          provider: providerName,
          transferRequest: transactionResult.data.transferRequest
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
   * @param {string} refillRequestId - External refill request ID for tracking
   * @returns {Promise<Object>}
   *   - success {boolean}: true if the refill request is initiated successfully, false otherwise.
   *   - error {string}: the error message if the refill request is not initiated successfully.
   *   - code {string}: the error code if the refill request is not initiated successfully.
   *   - data {Object}: the data if the refill request is initiated successfully.
   */
  async initiateRefill(validatedData, provider, refillRequestId) {
    try {
      logger.info(`Initiating refill transfer request with provider: ${provider.constructor.getProviderName()}, request ID: ${refillRequestId}`);

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
        blockchain: validatedData.blockchain.symbol,
        contractAddress: validatedData.asset.contractAddress,
        externalTxId: `${refillRequestId}_refill`, // For idempotency
        coldWalletConfig: validatedData.asset.sweepWalletConfig
      };

      const transferRequest = await provider.createTransferRequest(transferData);

      logger.info(`Transfer request submitted successfully with ${provider.constructor.getProviderName()}`);

      return {
        success: true,
        error: null,
        code: null,
        data: {
          refillRequestId: refillRequestId,
          transferId: transferRequest.id || transferRequest.transferId || transferRequest.transactionId,
          externalTxId: transferRequest.externalTxId,
          status: transferRequest.status,
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

}

module.exports = new RefillService();
