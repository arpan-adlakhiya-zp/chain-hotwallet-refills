# Chain Hotwallet Refills Service

[![Node Version](https://img.shields.io/badge/node-%3E%3D18.x-brightgreen)](package.json)

The Chain Hot Wallet Refill service automates hot wallet refills through integration with the Mythyaverse system. The service accepts and validates refill requests, initiates cold-to-hot wallet transfers through supported providers (Fireblocks, Liminal), and provides near real-time transaction status tracking with automated monitoring and alerting capabilities.

## Table of Contents

- [Key Features](#key-features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Development](#development)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Production Deployment](#production-deployment)
- [Monitoring & Alerts](#monitoring--alerts)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Key Features

- **Multi-Provider Support**: Seamlessly integrates with Fireblocks and Liminal custody providers
- **Request Validation**: Comprehensive validation including wallet addresses, balances, cooldown periods, and asset locking
- **Idempotency**: Prevents duplicate transactions using unique ID
- **Asset-Based Locking**: Ensures only one refill per asset can be in-flight at a time
- **Transaction Monitoring**: Background cron job polls provider APIs for transaction status updates
- **Slack Alerts**: Automated alerts for transactions pending longer than configured threshold
- **JWT Authentication**: JWT-based authentication for API endpoints
- **Comprehensive Logging**: Structured logging for debugging and audit trails
- **Health Checks**: Built-in health check endpoint for monitoring

## Architecture

The service follows a layered architecture pattern:

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer (Express)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Routes     │  │  Controller  │  │ Middleware   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    Service Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Refill     │  │ Validation   │  │ Transaction  │   │
│  │   Service    │  │   Service    │  │   Monitor    │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Provider Layer                        │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │  Fireblocks  │  │   Liminal    │                     │
│  │   Provider   │  │   Provider   │                     │
│  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Database Layer (PostgreSQL)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Models     │  │   Helpers    │  │  Migrations  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Request Flow:**
1. External system sends refill request with JWT token (if auth enabled)
2. Authentication middleware validates JWT and extracts request data
3. Controller receives request and calls refill service
4. Validation service performs comprehensive checks (balances, cooldown, asset locking)
5. Refill service creates transaction record and initiates transfer via provider
6. Background monitor polls provider APIs and updates transaction status
7. External system queries status endpoint for refill transaction updates

## Prerequisites

- **Node.js**: >= 18.x
- **PostgreSQL**: >= 12.x
- **npm**: >= 8.x
- **Docker**: >= 20.x (for containerized deployment)

## Installation & Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd chain-hotwallet-refills
```

### 2. Install Dependencies

```bash
# Using Node Version Manager (recommended)
source ~/.nvm/nvm.sh && nvm use 18

# Install dependencies
npm install
```

> **Note**: Ensure to have the updated `.npmrc` file in the root of the directory for the dependencies to be installed successfully.

### 3. Configuration Files

There are two confirguration files required for the project:
1. `.CHAIN_REFILL_CONFIGrc`
2. `.CHAIN_REFILL_SECRETrc`

Rename the example configuration files and remove `.example` from the end. Update the required details for database, providers, authentication and alerting.

> **Note**: See `src/config/schema.js` for complete configuration schema and required fields.

### 4. Database Setup

```bash
# Run migrations
npx sequelize-cli db:migrate
```

### 5. Start Development Server

```bash
npm run dev  # Uses nodemon for auto-reload
```

The service will start on `http://localhost:3001` (or configured port).

## Development

### Available Scripts

```bash
npm start              # Start production server
npm run dev            # Start development server with auto-reload
npm test               # Run all tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run test:unit      # Run unit tests only
npm run test:integration  # Run integration tests only
npm run test:e2e       # Run end-to-end tests (requires DB)
```

### Development Workflow

1. **Make code changes** in `src/` directory
2. **Write/update tests** in `src/__tests__/`
3. **Run tests** to ensure everything passes:
   ```bash
   npm test
   ```
4. **Check coverage** to maintain quality:
   ```bash
   npm run test:coverage
   ```
5. **Test locally** using the development server:
   ```bash
   npm run dev
   ```

## Testing

Refer to the comprehensive [testing guide](src/__tests__/README.md).

## API Documentation

### Base URL

```
Development: http://localhost:3001/v1
Production:  https://api.example.com/v1
```

### Authentication

When `authEnabled: true`, all endpoints require JWT authentication:

- **POST requests**: Signed JWT token in raw request body
- **GET requests**: Signed JWT token in `Authorization: Bearer <token>` header

JWT payload must include `exp` (Expiration time) and `iat` (Issued At Time) claims and must not exceed the configured `jwtMaxLifetimeInSeconds` seconds.

### Endpoints

## API Endpoints

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | `/v1/health` | Health check | No |
| POST | `/v1/wallet/refill` | Process refill request | Yes |
| GET | `/v1/wallet/refill/status/:refill_request_id` | Check transaction status | Yes |

For request and response payloads, please refer to `testing.postman_collection.json` file.

## Production Deployment

### Production Checklist

- [ ] **Database SSL**: Enable SSL in `src/database/config/config.js`:
  ```javascript
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
  ```

- [ ] **Authentication**: Ensure `authEnabled: true` and valid `authPublicKey` in production

- [ ] **JWT Lifetime**: Ensure appropriate JWT lifetime is set in `jwtMaxLifetimeInSeconds`

- [ ] **Logging**: Configure appropriate log level and rotation in production

- [ ] **Health Monitoring**: Set up monitoring for `/v1/health` endpoint

- [ ] **Slack Alerts**: Configure `slackWebhookUrl` for production alerts and appropriate `pendingAlertThresholdInSeconds`

- [ ] **Transaction Monitor**: Ensure `cronEnabled: true` and appropriate `cronIntervalInMs`

### Stage Environment

For staging environments, follow production guidelines but:
- Use staging provider credentials (testnet/sandbox)
- Enable verbose logging for debugging
- Use staging database instance
- Configure staging Slack channel for alerts

## Monitoring & Alerts

### Health Checks

Monitor the `/v1/health` endpoint to ensure service availability:

```bash
curl https://api.example.com/v1/health
```

### Transaction Monitoring

The service includes a background transaction monitor that:
- Polls provider APIs every 30 seconds (configurable via `cronIntervalInMs`)
- Updates transaction status in database
- Sends Slack alerts for transactions pending longer than `pendingAlertThresholdInSeconds` (default: 30 minutes)

### Slack Alerts

When `slackWebhookUrl` is configured, the service sends grouped alerts for long-pending transactions:

```
Refill Alert: 2 transaction(s) pending for over 30 minutes

1. REQ_12345
   • Status: `PENDING`
   • Provider: fireblocks
   • Pending for: 1.0 hours
   • Last updated: 2025-11-07T10:00:00.000Z

2. REQ_67890
   • Status: `PROCESSING`
   • Provider: liminal
   • Pending for: 45 minutes
   • Last updated: 2025-11-07T10:15:00.000Z

_Monitor cycle: 2025-11-07T11:00:00.000Z_
```

### Logging

Structured logs are written to `logs/` directory with the following levels:
- **INFO**: Normal operations, request processing
- **DEBUG**: Detailed debugging information
- **ERROR**: Errors and exceptions

## Troubleshooting

### Common Issues

**Issue**: `npm install` fails with authentication errors
- **Solution**: Ensure `.npmrc` is configured correctly for your npm registry

**Issue**: Database connection fails
- **Solution**: Verify database credentials in `.CHAIN_REFILL_SECRETrc` and ensure database is accessible

**Issue**: Provider initialization fails
- **Solution**: Check provider credentials in `.CHAIN_REFILL_SECRETrc` and verify API endpoints are accessible

**Issue**: JWT authentication fails
- **Solution**: Verify `authPublicKey` matches the private key used to sign tokens, check JWT expiration and lifetime

**Issue**: Transaction monitor not updating status
- **Solution**: Verify `cronEnabled: true`, check provider API connectivity, review logs for errors

### Debug Mode

Enable debug logging by setting `logLevel: "debug"` in configuration:

```json
{
  "logConfig": {
    "logLevel": "debug",
    ...
  }
}
```
