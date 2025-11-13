const jwt = require('jsonwebtoken');
const logger = require("../../middleware/logger")("signingUtil");
const config = require("../../config");

class SigningUtil {
  constructor () {
    this.callbackPrivateKey = config.getSecret('callbackPrivateKey');
    this.jwtMaxLifetimeInSeconds = config.get('jwtMaxLifetimeInSeconds') || 300;
  }

  /**
   * Signs response with private key
   * @param {Object} response - Response to sign
   * @returns {string} Signed response
   */
  signResponse(response) {
    try {
      const dateNow = Math.floor(Date.now() / 1000);
      
      const signedResponse = jwt.sign({
          ...response,
          iat: dateNow,
          exp: dateNow + this.jwtMaxLifetimeInSeconds
        }, this.callbackPrivateKey, { algorithm: "RS256" });

      logger.info(`Response signed with private key`);
      logger.debug(`Signed response: ${signedResponse}`);

      return signedResponse;
    } catch (error) {
      logger.error(`Error signing response: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new SigningUtil();
