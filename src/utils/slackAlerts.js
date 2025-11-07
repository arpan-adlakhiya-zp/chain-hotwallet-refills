const axios = require('axios');
const logger = require('../middleware/logger')('SlackAlerts');
const config = require("../config");
const slackWebhookUrl = config.get("slackWebhookUrl");

async function sendSlackAlert(alertMessage) {
    const message = {
        text: alertMessage
    };
    const headers = { 'Content-Type': 'application/json' };
    try {
        await axios.post(slackWebhookUrl, message, { headers });
    } catch (error) {
        logger.error(`Unable to send slack alert message: "${alertMessage}", error: ${error.message}`);
    }
}

module.exports = { sendSlackAlert };