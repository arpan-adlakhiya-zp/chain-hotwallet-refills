# Chain Hotwallet Refills

Automated hot wallet refill service - monitors balances and triggers cold-to-hot wallet transfers when thresholds are breached.

## Quick Start

```bash
# Install
npm install

# Run migrations
npx sequelize-cli db:migrate

# Start service
npm start
```

## Configuration

Requires two config files in root:
- `.CHAIN_REFILL_CONFIGrc` - App configuration
- `.CHAIN_REFILL_SECRETrc` - Database & API credentials

See `src/config/schema.js` for full schema.

**Configuration:**
```json
{
  "authEnabled": true,
  "authPublicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
}
```

Set `authEnabled: false` to disable authentication (testing only)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/health` | Health check |
| POST | `/v1/wallet/refill` | Process refill request |
| GET | `/v1/wallet/refill/status/:id` | Check transaction status |

## Testing

```bash
npm test              # Unit + integration tests (241 tests)
npm run test:coverage # With coverage report
npm run test:e2e      # E2E tests (requires DB)
```

## Docker

```bash
docker build -t chain-hotwallet-refills .
docker run -p 3000:3000 chain-hotwallet-refills
```

## Architecture

```
Controller → Service → Provider (Fireblocks/Liminal)
              ↓
         chainDb → Database
```

## Production Notes

- Enable SSL in `src/database/config/config.js` for production
- Configure CORS origins in `src/middleware/expressServer.js`
- Set up monitoring for `/v1/health` endpoint

## License

MIT © Zebpay
