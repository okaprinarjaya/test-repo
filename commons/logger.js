const dotenv = require('dotenv');
const winston = require('winston');
const moment = require('moment');
const path = require('path');

const rootPath = path.dirname(require.main.filename);
dotenv.config({ path: rootPath + '/.env' });

const myFormat = winston.format.printf(function(info) {
  const dttm = moment(info.timestamp).format('dddd, MMMM Do YYYY, HH:mm:ss');
  return dttm + '\t' + info.level.toUpperCase() + '\t' + info.message;
});

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.label({ label: 'Label' }),
    winston.format.timestamp(),
    myFormat
  ),
  colorize: true,
  transports: [
    new winston.transports.File({
      filename: path.resolve(rootPath + '/logs/request.log')
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console());
}

module.exports = logger;
