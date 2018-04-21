const konst = require('./constants');

module.exports = function SmsError(message) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.code = konst.ERR_INSITE_SMS;
};

require('util').inherits(module.exports, Error);
