const schema = {
    appName: 'CHAIN_REFILL',
    config: {
        type: 'object',
        properties: {
            serverPort: {
                type: 'number',
                default: 3000
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
            },
            chains: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        chainName: { type: 'string' },
                        provider: { type: 'string' },
                        tokens: {
                            type: 'array',
                            items: { type: 'string' }
                        },
                        liminal: {
                            type: 'object',
                            properties: {
                                walletId: { type: 'string' }
                            }
                        },
                        fireblocks: {
                            type: 'object',
                            properties: {
                                apiBaseUrl: { type: 'string' }
                            }
                        }
                    },
                    required: ['chainName', 'provider', 'tokens']
                }
            }
        },
        required: ['serverPort', 'logConfig', 'providers']
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
            }
        },
        required: ['chainDb', 'liminal', 'fireblocks']
    }
};

module.exports = schema;
