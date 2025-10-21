const config = require('../../config');

const dbConfig = config.getSecret('chainDb');

module.exports = {
  username: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.name,
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: "postgres",
  logging: false,
  pool: {
    max: 5,
    min: 0,
    idle: 60000
  },
  dialectOptions: {
    // ssl: { // TODO: change for stage/prod
    //   require: false,
    //   rejectUnauthorized: false
    // }
  }
};
