const schema = {
  appName: 'CHAIN_REFILL',
  config: {
    type: 'object',
    properties: {
      serverPort: {
        type: 'number',
        default: 3000
      },
      authEnabled: {
        type: 'boolean',
        default: true
      },
      authPublicKey: {
        type: 'string'
      },
      jwtMaxLifetimeInSeconds: {
        type: 'number',
        default: 300
      },
      cronEnabled: {
        type: 'boolean',
        default: true
      },
      cronIntervalInMs: {
        type: 'number',
        default: 30000
      },
      pendingAlertThresholdInSeconds: {
        type: 'number',
        default: 1800  // 30 minutes in seconds
      },
      slackWebhookUrl: {
        type: 'string'
      },
      logConfig: {
        type: 'object',
        properties: {
          logFile: { type: 'string' },
          logLevel: { type: 'string' },
          logPath: { type: 'string' },
          logAdapter: { type: 'string' },
          service: { type: 'string' }
        },
        required: ['logFile', 'logLevel', 'logPath', 'logAdapter', 'service']
      },
      providers: {
        type: 'object',
        properties: {
          liminal: {
            type: 'object',
            properties: {
              env: { type: 'string' }
            },
            required: ['env']
          },
          fireblocks: {
            type: 'object',
            properties: {
              apiBaseUrl: { type: 'string' }
            },
            required: ['apiBaseUrl']
          }
        },
        required: ['liminal', 'fireblocks']
      }
    },
    required: ['serverPort', 'logConfig', 'providers', 'authEnabled', 'cronEnabled']
  },
  secret: {
    type: 'object',
    properties: {
      chainDb: {
        type: 'object',
        properties: {
          host: {
            type: 'string'
          },
          port: {
            type: 'number'
          },
          user: {
            type: 'string'
          },
          password: {
            type: 'string'
          },
          name: {
            type: 'string'
          }
        },
        required: ['host', 'port', 'user', 'password', 'name']
      },
      liminal: {
        type: 'object',
        properties: {
          clientId: {
            type: 'string'
          },
          clientSecret: {
            type: 'string'
          },
          AuthAudience: {
            type: 'string'
          }
        },
        required: ['clientId', 'clientSecret', 'AuthAudience']
      },
      fireblocks: {
        type: 'object',
        properties: {
          apiKey: {
            type: 'string'
          },
          privateKey: {
            type: 'string'
          }
        },
        required: ['apiKey', 'privateKey']
      },
      liminalTsmCredentials: {
        type: 'object',
        properties: {
          userID: {
            type: 'string'
          },
          url: {
            type: 'string'
          },
          password: {
            type: 'string'
          },
          publicKey: {
            type: 'string'
          }
        },
        required: ['userID', 'url', 'password', 'publicKey']
      },
      callbackPrivateKey: {
        type: 'string'
      }
    },
    required: ['chainDb', 'liminal', 'fireblocks', 'callbackPrivateKey']
  }
};

module.exports = schema;
