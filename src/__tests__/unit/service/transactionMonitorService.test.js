const transactionMonitor = require('../../../service/transactionMonitorService');
const refillTransactionService = require('../../../service/refillTransactionService');
const databaseService = require('../../../service/chainDb');
const config = require('../../../config');
const { sendSlackAlert } = require('../../../utils/slackAlerts');

jest.mock('../../../service/refillTransactionService');
jest.mock('../../../service/chainDb');
jest.mock('../../../config', () => ({
  get: jest.fn(),
  getSecret: jest.fn((key) => {
    if (key === 'chainDb') {
      return {
        host: 'localhost',
        port: 5432,
        user: 'test',
        password: 'test',
        name: 'testdb'
      };
    }
    return null;
  }),
  getAllConfig: jest.fn()
}));
jest.mock('../../../utils/slackAlerts');
jest.mock('../../../middleware/logger');

describe('TransactionMonitorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transactionMonitor.stop(); // Ensure monitor is stopped before each test
  });

  afterEach(() => {
    transactionMonitor.stop(); // Clean up after each test
  });

  describe('start', () => {
    it('should start monitoring with specified interval', () => {
      jest.useFakeTimers();
      
      transactionMonitor.start(5000);
      
      expect(transactionMonitor.isRunning).toBe(true);
      expect(transactionMonitor.intervalId).toBeDefined();
      
      jest.clearAllTimers();
      transactionMonitor.stop();
      jest.useRealTimers();
    });

    it('should not start if already running', () => {
      jest.useFakeTimers();
      
      transactionMonitor.start(5000);
      const firstIntervalId = transactionMonitor.intervalId;
      
      transactionMonitor.start(5000);
      
      expect(transactionMonitor.intervalId).toBe(firstIntervalId);
      
      jest.clearAllTimers();
      transactionMonitor.stop();
      jest.useRealTimers();
    });
  });

  describe('stop', () => {
    it('should stop the monitor', () => {
      jest.useFakeTimers();
      
      transactionMonitor.start(5000);
      transactionMonitor.stop();
      
      expect(transactionMonitor.isRunning).toBe(false);
      expect(transactionMonitor.intervalId).toBeNull();
      
      jest.useRealTimers();
    });

    it('should handle stop when not running', () => {
      expect(() => transactionMonitor.stop()).not.toThrow();
    });
  });

  describe('getPendingTransactions', () => {
    it('should fetch and combine pending and processing transactions', async () => {
      const pendingTxns = [
        { refillRequestId: 'REQ001', status: 'PENDING', createdAt: '2025-10-31T10:00:00Z' }
      ];
      const processingTxns = [
        { refillRequestId: 'REQ002', status: 'PROCESSING', createdAt: '2025-10-31T09:00:00Z' }
      ];

      databaseService.getTransactionsByStatus
        .mockResolvedValueOnce(pendingTxns)
        .mockResolvedValueOnce(processingTxns);

      const result = await transactionMonitor.getPendingTransactions();

      expect(result).toHaveLength(2);
      // Should be sorted oldest first
      expect(result[0].refillRequestId).toBe('REQ002'); // Older
      expect(result[1].refillRequestId).toBe('REQ001'); // Newer
    });

    it('should handle empty results', async () => {
      databaseService.getTransactionsByStatus.mockResolvedValue([]);

      const result = await transactionMonitor.getPendingTransactions();

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      databaseService.getTransactionsByStatus.mockRejectedValue(new Error('DB error'));

      const result = await transactionMonitor.getPendingTransactions();

      expect(result).toEqual([]);
    });
  });

  describe('checkAndUpdateTransaction', () => {
    it('should check transaction status and update if changed', async () => {
      const transaction = {
        refillRequestId: 'REQ001',
        status: 'PENDING',
        provider: 'fireblocks',
        providerTxId: 'fb-123'
      };

      refillTransactionService.checkAndUpdateTransactionFromProvider.mockResolvedValue({
        success: true,
        data: {
          refillRequestId: 'REQ001',
          status: 'COMPLETED'
        }
      });

      await transactionMonitor.checkAndUpdateTransaction(transaction);

      // Should pass the full transaction object, not just ID
      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledWith(transaction);
    });

    it('should log when status unchanged', async () => {
      const transaction = {
        refillRequestId: 'REQ002',
        status: 'PROCESSING'
      };

      refillTransactionService.checkAndUpdateTransactionFromProvider.mockResolvedValue({
        success: true,
        data: {
          refillRequestId: 'REQ002',
          status: 'PROCESSING' // Same status
        }
      });

      await transactionMonitor.checkAndUpdateTransaction(transaction);

      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalled();
    });

    it('should handle check failures gracefully', async () => {
      const transaction = {
        refillRequestId: 'REQ003',
        status: 'PENDING'
      };

      refillTransactionService.checkAndUpdateTransactionFromProvider.mockResolvedValue({
        success: false,
        error: 'Provider error'
      });

      // Should not throw
      await expect(
        transactionMonitor.checkAndUpdateTransaction(transaction)
      ).resolves.not.toThrow();
    });

    it('should throw on unexpected errors', async () => {
      const transaction = {
        refillRequestId: 'REQ004',
        status: 'PENDING'
      };

      refillTransactionService.checkAndUpdateTransactionFromProvider.mockRejectedValue(
        new Error('Unexpected error')
      );

      await expect(
        transactionMonitor.checkAndUpdateTransaction(transaction)
      ).rejects.toThrow('Unexpected error');
    });
  });

  describe('monitorPendingTransactions', () => {
    it('should monitor all pending transactions', async () => {
      const mockTransactions = [
        { refillRequestId: 'REQ001', status: 'PENDING' },
        { refillRequestId: 'REQ002', status: 'PROCESSING' }
      ];

      databaseService.getTransactionsByStatus
        .mockResolvedValueOnce(mockTransactions)
        .mockResolvedValueOnce([]);

      refillTransactionService.checkAndUpdateTransactionFromProvider.mockResolvedValue({
        success: true,
        data: { status: 'COMPLETED' }
      });

      await transactionMonitor.monitorPendingTransactions();

      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledTimes(2);
      // Should pass transaction objects, not just IDs
      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledWith(
        expect.objectContaining({ refillRequestId: 'REQ001' })
      );
      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledWith(
        expect.objectContaining({ refillRequestId: 'REQ002' })
      );
    });

    it('should handle no pending transactions', async () => {
      databaseService.getTransactionsByStatus.mockResolvedValue([]);

      await transactionMonitor.monitorPendingTransactions();

      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).not.toHaveBeenCalled();
    });

    it('should continue monitoring even if one transaction check fails', async () => {
      const mockTransactions = [
        { refillRequestId: 'REQ001', status: 'PENDING' },
        { refillRequestId: 'REQ002', status: 'PROCESSING' }
      ];

      databaseService.getTransactionsByStatus
        .mockResolvedValueOnce(mockTransactions)
        .mockResolvedValueOnce([]);

      refillTransactionService.checkAndUpdateTransactionFromProvider
        .mockRejectedValueOnce(new Error('First failed'))
        .mockResolvedValueOnce({ success: true, data: { status: 'COMPLETED' } });

      await transactionMonitor.monitorPendingTransactions();

      // Both should be called despite first one failing
      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed transaction statuses correctly', async () => {
      const mockTransactions = [
        { refillRequestId: 'REQ001', status: 'PENDING' },
        { refillRequestId: 'REQ002', status: 'PROCESSING' },
        { refillRequestId: 'REQ003', status: 'PROCESSING' },
        { refillRequestId: 'REQ004', status: 'PENDING' }
      ];

      databaseService.getTransactionsByStatus
        .mockResolvedValueOnce([mockTransactions[0], mockTransactions[3]]) // PENDING
        .mockResolvedValueOnce([mockTransactions[1], mockTransactions[2]]); // PROCESSING

      // Mock different status responses
      refillTransactionService.checkAndUpdateTransactionFromProvider
        .mockResolvedValueOnce({ success: true, data: { status: 'PROCESSING' } })    // PENDING → PROCESSING
        .mockResolvedValueOnce({ success: true, data: { status: 'PROCESSING' } })    // PROCESSING → PROCESSING (unchanged)
        .mockResolvedValueOnce({ success: true, data: { status: 'COMPLETED' } })     // PROCESSING → COMPLETED
        .mockResolvedValueOnce({ success: true, data: { status: 'FAILED' } });       // PENDING → FAILED

      await transactionMonitor.monitorPendingTransactions();

      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledTimes(4);
    });

    it('should handle transactions transitioning to COMPLETED', async () => {
      const mockTransactions = [
        { refillRequestId: 'REQ_COMPLETE', status: 'PROCESSING' }
      ];

      databaseService.getTransactionsByStatus
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockTransactions);

      refillTransactionService.checkAndUpdateTransactionFromProvider.mockResolvedValue({
        success: true,
        data: {
          refillRequestId: 'REQ_COMPLETE',
          status: 'COMPLETED',
          txHash: '0xabc123'
        }
      });

      await transactionMonitor.monitorPendingTransactions();

      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledWith(
        expect.objectContaining({ refillRequestId: 'REQ_COMPLETE' })
      );
    });

    it('should handle transactions transitioning to FAILED', async () => {
      const mockTransactions = [
        { refillRequestId: 'REQ_FAIL', status: 'PROCESSING' }
      ];

      databaseService.getTransactionsByStatus
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockTransactions);

      refillTransactionService.checkAndUpdateTransactionFromProvider.mockResolvedValue({
        success: true,
        data: {
          refillRequestId: 'REQ_FAIL',
          status: 'FAILED',
          message: 'Insufficient funds'
        }
      });

      await transactionMonitor.monitorPendingTransactions();

      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledWith(expect.objectContaining({ refillRequestId: 'REQ_FAIL' }));
    });

    it('should handle Fireblocks intermediate statuses (SUBMITTED, BROADCASTING, etc)', async () => {
      const mockTransactions = [
        { refillRequestId: 'REQ_SUBMIT', status: 'PENDING' },
        { refillRequestId: 'REQ_BROADCAST', status: 'PROCESSING' },
        { refillRequestId: 'REQ_CONFIRM', status: 'PROCESSING' }
      ];

      databaseService.getTransactionsByStatus
        .mockResolvedValueOnce([mockTransactions[0]])
        .mockResolvedValueOnce([mockTransactions[1], mockTransactions[2]]);

      // Mock Fireblocks intermediate statuses that all map to PROCESSING
      refillTransactionService.checkAndUpdateTransactionFromProvider
        .mockResolvedValueOnce({ success: true, data: { status: 'PROCESSING' } })  // SUBMITTED → PROCESSING
        .mockResolvedValueOnce({ success: true, data: { status: 'PROCESSING' } })  // BROADCASTING → PROCESSING
        .mockResolvedValueOnce({ success: true, data: { status: 'PROCESSING' } }); // CONFIRMING → PROCESSING

      await transactionMonitor.monitorPendingTransactions();

      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledTimes(3);
    });

    it('should handle large batch of transactions efficiently', async () => {
      // Simulate 50 pending transactions
      const mockTransactions = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        refillRequestId: `REQ_${String(i + 1).padStart(3, '0')}`,
        status: i % 2 === 0 ? 'PENDING' : 'PROCESSING'
      }));

      databaseService.getTransactionsByStatus
        .mockResolvedValueOnce(mockTransactions.filter(t => t.status === 'PENDING'))
        .mockResolvedValueOnce(mockTransactions.filter(t => t.status === 'PROCESSING'));

      refillTransactionService.checkAndUpdateTransactionFromProvider.mockResolvedValue({
        success: true,
        data: { status: 'PROCESSING' }
      });

      await transactionMonitor.monitorPendingTransactions();

      // All 50 should be checked
      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledTimes(50);
    });

    it('should handle partial failures in batch processing', async () => {
      const mockTransactions = [
        { refillRequestId: 'REQ_SUCCESS_1', status: 'PENDING' },
        { refillRequestId: 'REQ_FAIL', status: 'PENDING' },
        { refillRequestId: 'REQ_SUCCESS_2', status: 'PROCESSING' },
        { refillRequestId: 'REQ_ERROR', status: 'PROCESSING' },
        { refillRequestId: 'REQ_SUCCESS_3', status: 'PENDING' }
      ];

      databaseService.getTransactionsByStatus
        .mockResolvedValueOnce([mockTransactions[0], mockTransactions[1], mockTransactions[4]])
        .mockResolvedValueOnce([mockTransactions[2], mockTransactions[3]]);

      // Mix of successes and failures
      refillTransactionService.checkAndUpdateTransactionFromProvider
        .mockResolvedValueOnce({ success: true, data: { status: 'COMPLETED' } })
        .mockResolvedValueOnce({ success: false, error: 'Provider timeout' })
        .mockResolvedValueOnce({ success: true, data: { status: 'PROCESSING' } })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true, data: { status: 'FAILED' } });

      await transactionMonitor.monitorPendingTransactions();

      // All 5 should be attempted
      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledTimes(5);
      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledWith(expect.objectContaining({ refillRequestId: 'REQ_SUCCESS_1' }));
      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledWith(expect.objectContaining({ refillRequestId: 'REQ_FAIL' }));
      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledWith(expect.objectContaining({ refillRequestId: 'REQ_SUCCESS_2' }));
      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledWith(expect.objectContaining({ refillRequestId: 'REQ_ERROR' }));
      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledWith(expect.objectContaining({ refillRequestId: 'REQ_SUCCESS_3' }));
    });

    it('should process transactions in order (oldest first)', async () => {
      const mockTransactions = [
        { refillRequestId: 'REQ_NEW', status: 'PENDING', createdAt: '2025-10-31T12:00:00Z' },
        { refillRequestId: 'REQ_OLD', status: 'PENDING', createdAt: '2025-10-31T10:00:00Z' },
        { refillRequestId: 'REQ_MEDIUM', status: 'PROCESSING', createdAt: '2025-10-31T11:00:00Z' }
      ];

      databaseService.getTransactionsByStatus
        .mockResolvedValueOnce([mockTransactions[0], mockTransactions[1]])
        .mockResolvedValueOnce([mockTransactions[2]]);

      refillTransactionService.checkAndUpdateTransactionFromProvider.mockResolvedValue({
        success: true,
        data: { status: 'PROCESSING' }
      });

      await transactionMonitor.monitorPendingTransactions();

      // Check order - oldest first (now passing transaction objects)
      const calls = refillTransactionService.checkAndUpdateTransactionFromProvider.mock.calls;
      expect(calls[0][0].refillRequestId).toBe('REQ_OLD');     // 10:00 - oldest
      expect(calls[1][0].refillRequestId).toBe('REQ_MEDIUM');  // 11:00
      expect(calls[2][0].refillRequestId).toBe('REQ_NEW');     // 12:00 - newest
    });

    it('should handle empty PENDING and non-empty PROCESSING', async () => {
      const processingOnly = [
        { refillRequestId: 'REQ_PROC', status: 'PROCESSING' }
      ];

      databaseService.getTransactionsByStatus
        .mockResolvedValueOnce([])                  // No PENDING
        .mockResolvedValueOnce(processingOnly);     // Has PROCESSING

      refillTransactionService.checkAndUpdateTransactionFromProvider.mockResolvedValue({
        success: true,
        data: { status: 'COMPLETED' }
      });

      await transactionMonitor.monitorPendingTransactions();

      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledWith(expect.objectContaining({ refillRequestId: 'REQ_PROC' }));
    });

    it('should handle non-empty PENDING and empty PROCESSING', async () => {
      const pendingOnly = [
        { refillRequestId: 'REQ_PEND', status: 'PENDING' }
      ];

      databaseService.getTransactionsByStatus
        .mockResolvedValueOnce(pendingOnly)         // Has PENDING
        .mockResolvedValueOnce([]);                 // No PROCESSING

      refillTransactionService.checkAndUpdateTransactionFromProvider.mockResolvedValue({
        success: true,
        data: { status: 'PROCESSING' }
      });

      await transactionMonitor.monitorPendingTransactions();

      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalledWith(expect.objectContaining({ refillRequestId: 'REQ_PEND' }));
    });

    it('should handle status updates with provider_status field', async () => {
      const mockTransactions = [
        { refillRequestId: 'REQ_STATUS', status: 'PENDING', providerStatus: null }
      ];

      databaseService.getTransactionsByStatus
        .mockResolvedValueOnce(mockTransactions)
        .mockResolvedValueOnce([]);

      // Mock provider returning raw status that gets mapped
      refillTransactionService.checkAndUpdateTransactionFromProvider.mockResolvedValue({
        success: true,
        data: {
          status: 'PROCESSING',  // Mapped status
          providerStatus: 'SUBMITTED'  // Raw Fireblocks status
        }
      });

      await transactionMonitor.monitorPendingTransactions();

      expect(refillTransactionService.checkAndUpdateTransactionFromProvider).toHaveBeenCalled();
    });
  });

  describe('checkAndAlertLongPending', () => {
    beforeEach(() => {
      config.get.mockImplementation((key) => {
        if (key === 'slackWebhookUrl') return 'https://hooks.slack.com/test';
        if (key === 'pendingAlertThresholdInSeconds') return 1800; // 30 minutes
        return null;
      });
    });

    it('should skip alert when Slack webhook URL is not configured', async () => {
      config.get.mockReturnValue(null); // No webhook URL

      const transactions = [
        { refillRequestId: 'REQ001', status: 'PENDING', updatedAt: new Date(Date.now() - 2000 * 1000) }
      ];
      const results = [
        { status: 'fulfilled', value: { data: { status: 'PENDING' } } }
      ];

      await transactionMonitor.checkAndAlertLongPending(transactions, results);

      expect(sendSlackAlert).not.toHaveBeenCalled();
    });

    it('should send alert for long-pending transactions', async () => {
      const oneHourAgo = new Date(Date.now() - 3600 * 1000);
      const transactions = [
        {
          refillRequestId: 'REQ001',
          status: 'PENDING',
          provider: 'fireblocks',
          updatedAt: oneHourAgo.toISOString()
        }
      ];
      const results = [
        { status: 'fulfilled', value: { data: { status: 'PENDING' } } }
      ];

      await transactionMonitor.checkAndAlertLongPending(transactions, results);

      expect(sendSlackAlert).toHaveBeenCalledTimes(1);
      const alertMessage = sendSlackAlert.mock.calls[0][0];
      expect(alertMessage).toContain('REQ001');
      expect(alertMessage).toContain('Refill Alert');
    });

    it('should not alert for transactions that completed during update cycle', async () => {
      const oneHourAgo = new Date(Date.now() - 3600 * 1000);
      const transactions = [
        {
          refillRequestId: 'REQ001',
          status: 'PENDING',
          provider: 'fireblocks',
          updatedAt: oneHourAgo.toISOString()
        }
      ];
      const results = [
        { status: 'fulfilled', value: { data: { status: 'COMPLETED' } } } // Completed during update
      ];

      await transactionMonitor.checkAndAlertLongPending(transactions, results);

      expect(sendSlackAlert).not.toHaveBeenCalled();
    });

    it('should not alert for transactions below threshold', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 300 * 1000); // 5 minutes ago
      const transactions = [
        {
          refillRequestId: 'REQ001',
          status: 'PENDING',
          provider: 'fireblocks',
          updatedAt: fiveMinutesAgo.toISOString()
        }
      ];
      const results = [
        { status: 'fulfilled', value: { data: { status: 'PENDING' } } }
      ];

      await transactionMonitor.checkAndAlertLongPending(transactions, results);

      expect(sendSlackAlert).not.toHaveBeenCalled();
    });

    it('should group multiple long-pending transactions in single alert', async () => {
      const oneHourAgo = new Date(Date.now() - 3600 * 1000);
      const transactions = [
        {
          refillRequestId: 'REQ001',
          status: 'PENDING',
          provider: 'fireblocks',
          updatedAt: oneHourAgo.toISOString()
        },
        {
          refillRequestId: 'REQ002',
          status: 'PROCESSING',
          provider: 'liminal',
          updatedAt: oneHourAgo.toISOString()
        }
      ];
      const results = [
        { status: 'fulfilled', value: { data: { status: 'PENDING' } } },
        { status: 'fulfilled', value: { data: { status: 'PROCESSING' } } }
      ];

      await transactionMonitor.checkAndAlertLongPending(transactions, results);

      expect(sendSlackAlert).toHaveBeenCalledTimes(1);
      const alertMessage = sendSlackAlert.mock.calls[0][0];
      expect(alertMessage).toContain('REQ001');
      expect(alertMessage).toContain('REQ002');
      expect(alertMessage).toContain('2 transaction(s)');
    });

    it('should handle errors gracefully', async () => {
      sendSlackAlert.mockRejectedValue(new Error('Slack API error'));

      const oneHourAgo = new Date(Date.now() - 3600 * 1000);
      const transactions = [
        {
          refillRequestId: 'REQ001',
          status: 'PENDING',
          provider: 'fireblocks',
          updatedAt: oneHourAgo.toISOString()
        }
      ];
      const results = [
        { status: 'fulfilled', value: { data: { status: 'PENDING' } } }
      ];

      // Should not throw
      await expect(transactionMonitor.checkAndAlertLongPending(transactions, results))
        .resolves.not.toThrow();
    });

    it('should use custom pendingAlertThresholdInSeconds from config', async () => {
      config.get.mockImplementation((key) => {
        if (key === 'slackWebhookUrl') return 'https://hooks.slack.com/test';
        if (key === 'pendingAlertThresholdInSeconds') return 600; // 10 minutes
        return null;
      });

      const fifteenMinutesAgo = new Date(Date.now() - 900 * 1000);
      const transactions = [
        {
          refillRequestId: 'REQ001',
          status: 'PENDING',
          provider: 'fireblocks',
          updatedAt: fifteenMinutesAgo.toISOString()
        }
      ];
      const results = [
        { status: 'fulfilled', value: { data: { status: 'PENDING' } } }
      ];

      await transactionMonitor.checkAndAlertLongPending(transactions, results);

      expect(sendSlackAlert).toHaveBeenCalled();
    });
  });

  describe('formatPendingAlert', () => {
    it('should format alert message correctly for single transaction', () => {
      const longPendingTxns = [
        {
          refillRequestId: 'REQ001',
          status: 'PENDING',
          provider: 'fireblocks',
          timePendingSec: 3600, // 1 hour
          updatedAt: new Date(Date.now() - 3600 * 1000).toISOString()
        }
      ];

      const message = transactionMonitor.formatPendingAlert(longPendingTxns, 1800);

      expect(message).toContain('REQ001');
      expect(message).toContain('PENDING');
      expect(message).toContain('fireblocks');
      expect(message).toContain('1.0 hours');
      expect(message).toContain('Refill Alert: 1 transaction(s)');
    });

    it('should format alert message correctly for multiple transactions', () => {
      const longPendingTxns = [
        {
          refillRequestId: 'REQ001',
          status: 'PENDING',
          provider: 'fireblocks',
          timePendingSec: 3600,
          updatedAt: new Date(Date.now() - 3600 * 1000).toISOString()
        },
        {
          refillRequestId: 'REQ002',
          status: 'PROCESSING',
          provider: 'liminal',
          timePendingSec: 1800,
          updatedAt: new Date(Date.now() - 1800 * 1000).toISOString()
        }
      ];

      const message = transactionMonitor.formatPendingAlert(longPendingTxns, 1800);

      expect(message).toContain('REQ001');
      expect(message).toContain('REQ002');
      expect(message).toContain('2 transaction(s)');
    });

    it('should display minutes for transactions under 1 hour', () => {
      const longPendingTxns = [
        {
          refillRequestId: 'REQ001',
          status: 'PENDING',
          provider: 'fireblocks',
          timePendingSec: 1800, // 30 minutes
          updatedAt: new Date(Date.now() - 1800 * 1000).toISOString()
        }
      ];

      const message = transactionMonitor.formatPendingAlert(longPendingTxns, 1800);

      expect(message).toContain('30 minutes');
      expect(message).not.toContain('hours');
    });
  });
});

