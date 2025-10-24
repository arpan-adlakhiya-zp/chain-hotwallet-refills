// This configurations are only used during migration this file path is set in .sequelizerc
const {DB_HOST,DB_USER,DB_PASSWORD,DB_NAME,DB_PORT} = process.env;

// TODO: remove for test/prod
const config = require('../../config');
const dbConfig = config.getSecret('chainDb');

module.exports = {
  development: {
    username: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.name,
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'postgres',
    logging: false,
  },
  test: {
    username: DB_USER,
    password: `${DB_PASSWORD}`,
    database: DB_NAME,
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'postgres',
    logging: false,
  },
  production: {
    username: DB_USER,
    password: `${DB_PASSWORD}`,
    database: DB_NAME,
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
};
