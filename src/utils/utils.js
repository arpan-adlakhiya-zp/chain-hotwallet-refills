const _ = require('lodash');

exports.sendErrorResponse = function (res, err) {
    let respMsg = {};
    respMsg.code = _.get(err, 'code', 500);
    if (typeof respMsg.code !== 'number') {
      respMsg.code = 500;
    }
    if (respMsg.code < 400 || respMsg > 599) {
      respMsg.code = 500;
    }
    respMsg.message = _.get(err, 'message', 'Unkown error');
    respMsg.stack = _.get(err, 'stack', '');
    res.status(respMsg.code).json(respMsg);
  };