const dotenv = require('dotenv');
const mysql = require('mysql');
const Nexmo = require('nexmo');
const SmsError = require('./commons/sms_error');

dotenv.load();

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

const nexmo = new Nexmo({
  apiKey: process.env.NEXMO_API_KEY,
  apiSecret: process.env.NEXMO_API_SECRET
});

function parseText(text) {
  const pattern = /^(SC)?\s?[0-9A-Za-z]{5} \d+ (\d+\s?)+$/gi;
  if (pattern.test(text)) {
    const textPartsSplit = text.split(" ");
    const textParts = textPartsSplit.map(function (item) {
      return item.toUpperCase();
    });

    var offset = 2;
    if (textParts.includes('SC')) {
      offset = 3;
    }

    const totalVoteDetailList = [];
    const limitParts = textParts.length - offset;

    for (var i = 0; i < limitParts; i++) {
      totalVoteDetailList.push(parseInt(textParts[offset + i]));
    }

    return {
      passKey: textParts[offset - 2].toUpperCase(),
      sc: offset === 3,
      totalVote: parseInt(textParts[offset - 1]),
      totalVoteDetailList: totalVoteDetailList
    };
  }
  return null;
}

function checkPassKey(passKey, sc) {
  return new Promise(function (resolve, reject) {
    pool.getConnection(function (error, connection) {
      const selectParams = [sc ? 'passkey_sc' : 'passkey', passKey];
      connection.query("SELECT election_id FROM `tps` WHERE ?? = ?", selectParams, function (error2, results) {
        connection.release();
        if (error2) {
          reject(error2);

        } else {
          if (results.length > 0) {
            resolve(results);
          } else {
            reject(new SmsError('Passkey tidak valid.'));
          }
        }
      });
    });
  });
}

function checkAllowToSendVotesReport(electionId) {
  return new Promise(function (resolve, reject) {
    const strQry = "SELECT COUNT(*) AS `count` FROM `election` WHERE `id` = ? AND NOW() >= `start_dt`";
    pool.getConnection(function (error, connection) {
      connection.query(strQry, [electionId], function (error2, results) {
        connection.release();
        if (error2) {
          reject(error2);

        } else {
          if (results.length > 0 && results[0].count > 0) {
            resolve(true);
          } else {
            reject(new SmsError('Election belum dibuka, tunggu sampai waktu yang sudah ditentukan.'));
          }
        }
      });
    });
  });
}

function checkElectionTotalCandidates(electionId, totalCandidates) {
  return new Promise(function (resolve, reject) {
    const strQry = "SELECT COUNT(*) AS `count` FROM `paslon` WHERE `election_id` = ?";
    pool.getConnection(function (error, connection) {
      connection.query(strQry, [electionId], function (error, results) {
        connection.release();
        if (error) {
          reject(error);

        } else {
          if (results.length > 0 && results[0].count > 0) {
            if (totalCandidates !== results[0].count) {
              reject(new SmsError('Total jumlah kandidat salah'));
            } else {
              resolve(true);
            }
          } else {
            reject(new SmsError('Belum ada kandidat yang terdaftar pada database'));
          }
        }
      });
    });
  });
}

function checkCandidatesTotalVotesDetail(votesInformation) {
  return new Promise(function (resolve, reject) {
    const totalVotesFromDetail = votesInformation.totalVoteDetailList.reduce(function (accmltr, currentVal) {
      return accmltr + currentVal;
    });

    if (totalVotesFromDetail !== votesInformation.totalVote) {
      reject(new SmsError('Kesalahan: Suara calon dan total suara berbeda.'));
    } else {
      resolve(true);
    }
  });
}

function saveVotes(smsLogId, votesInformation) {
  return new Promise(function (resolve, reject) {
    pool.getConnection(function (error, connection) {
      const strQry = "SELECT paslon.election_id, tps.id AS tps_id, paslon.id AS paslon_id, paslon.des FROM paslon " +
        "JOIN tps ON paslon.election_id = tps.election_id " +
        "WHERE ?? = ? " +
        "ORDER BY paslon.nomor_urut ASC ";

      const selectParams = [votesInformation.sc ? 'tps.passkey_sc' : 'tps.passkey', votesInformation.passKey];

      connection.query(strQry, selectParams, function (error, results) {
        if (error) {
          connection.release();
          reject(error);

        } else {
          const records = [];
          results.forEach(function (item, index) {
            const votesCount = votesInformation.totalVoteDetailList[index];
            records.push([item["tps_id"], smsLogId, item["paslon_id"], votesCount]);
          });

          const strQryInsert = "INSERT INTO ?? (tps_id, sms_log_id, paslon_id, suara) VALUES ?";
          const insertParams = [votesInformation.sc ? 'suara_masuk_spotcheck' : 'suara_masuk', records];

          connection.query(strQryInsert, insertParams, function (error2) {
            connection.release();
            if (error2) {
              reject(error2);
            } else {
              resolve(true);
            }
          });
        }
      });
    });
  });
}

function saveToSmsLog(textType, reqBody) {
  return new Promise(function (resolve, reject) {
    pool.getConnection(function (error, connection) {
      const smsLog = {
        handphone: reqBody["msisdn"],
        msg: reqBody.text,
        msg_type: textType
      };

      connection.query('INSERT INTO sms_log SET ?', smsLog, function (error2, results) {
        connection.release();
        if (error2) {
          reject(error2);
        } else {
          resolve(results.insertId);
        }
      });
    });
  });
}

function reply(text, messageCode, destinationNumber) {
  const enableSms = process.env.ENABLE_SMS;
  if (enableSms === 'Y') {
    if (messageCode === 'ERR_INSITE_SMS' || messageCode === 'OK_INSITE_SMS') {
      nexmo.message.sendSms('INSITE', destinationNumber, text);
    }
  }
}

module.exports.parseText = parseText;
module.exports.checkPassKey = checkPassKey;
module.exports.checkAllowToSendVotesReport = checkAllowToSendVotesReport;
module.exports.checkElectionTotalCandidates = checkElectionTotalCandidates;
module.exports.checkCandidatesTotalVotesDetail = checkCandidatesTotalVotesDetail;
module.exports.saveVotes = saveVotes;
module.exports.saveToSmsLog = saveToSmsLog;
module.exports.reply = reply;
