const { Pool } = require('pg');
const config = require('../config');
const postgresCred = config.getSecret("chainDb")
var sql;
let connected = false; // flag to close connection

function connectToChainDB(databaseName) {
    sql = new Pool({
        host: postgresCred.host,            // Postgres ip address[s] or domain name[s]
        port: postgresCred.port,          // Postgres server port[s]
        database: `${databaseName.toLowerCase()}`,            // Name of database to connect to
        user: postgresCred.user,            // Username of database user
        password: postgresCred.password,            // Password of database user
        ssl: {
            rejectUnauthorized: false,
        }
    });
    connected = true;
}

async function getTokenDetailsFromChainDB(obj) {
    let symbol = obj.externalTxId.split("_")[1].toString();
    const data = await sql.query(`SELECT id, name, symbol, "type", contract_address, is_active, chain_name, native_coin, receiver_config, validator_config, creditor_config, sprayer_config, sweeper_config, hot_wallet_config, history, created_at, updated_at, created_by, updated_by, decimal_places
    FROM tokens
    WHERE symbol = $1`, [symbol])
    if (data.rows.length === 0) return 'Invalid';
    return data.rows[0];
}

async function terminateConnection() {
    if (connected) await sql.end();
}

module.exports = {
    connectToChainDB,
    getTokenDetailsFromChainDB,
    terminateConnection,
    sql
}
