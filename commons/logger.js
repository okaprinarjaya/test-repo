const dotenv = require('dotenv');
const winston = require('winston');
const moment = require('moment');
const path = require('path');

dotenv.load();

const myFormat = winston.format.printf(function(info) {
  const dttm = moment(info.timestamp).format('dddd, MMMM Do YYYY, HH:mm:ss');
  return dttm + '\t' + info.level.toUpperCase() + '\t' + info.message;
});

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.label({ label: 'Wohoooo' }),
    winston.format.timestamp(),
    myFormat
  ),
  colorize: true,
  transports: [
    new winston.transports.File({
      filename: path.resolve('./logs/request.log')
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console());
}

module.exports = logger;
