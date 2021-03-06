const express = require('express');
const bodyParser = require('body-parser');
const logger = require('./commons/logger');
const sms = require('./sms_functions');
const konst = require('./commons/constants');

const app = express();
const router = express.Router();
const port = process.env.SMS_SERVER_PORT;

router.post('/inbound-sms', handleInboundSms);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/insite', router);

app.listen(port, function () {
  console.log('Listen on port ' + port);
});

function handleInboundSms(request, response) {
  const defaultDstNum = process.env.DEFAULT_DESTINATION_NUMBER;
  const destinationNumber = defaultDstNum === 'NULL' ? request.body.msisdn : defaultDstNum;

  sms.saveToSmsLog('inbox', request.body)
    .then(function (smsLogId) {
      const votesInformation = sms.parseText(request.body.text);
      if (votesInformation) {
        processVotes(smsLogId, votesInformation, destinationNumber);
      } else {
        const msg = "Format SMS yang anda kirim salah." +
          "\nSeharusnya," +
          "\nPASSKEY TotalSuaraSemuaCalon TotalSuaraCalon1 TotalSuaraCalon2 TotalSuaraCalon3\n" +
          "Contoh: 2617A 250 100 50 100";

        sms.reply(msg, konst.ERR_INSITE_SMS, destinationNumber);
        logger.error('Format SMS yang anda kirim salah.');
      }
      response.status(200).send('OK');
    })
    .catch(function (error) {
      logger.error(error.message);
      response.status(200).send('OK');
    });
}

function processVotes(smsLogId, votesInformation, destinationNumber) {
  sms.checkPassKey(votesInformation.passKey, votesInformation.sc)
    .then(function (results) {

      sms.checkAllowToSendVotesReport(results[0]["election_id"])
        .then(function () {

          sms.checkElectionTotalCandidates(
            results[0]["election_id"],
            votesInformation.totalVoteDetailList.length
          )
            .then(function () {

              sms.checkCandidatesTotalVotesDetail(votesInformation)
                .then(function () {

                  sms.saveVotes(smsLogId, votesInformation)
                    .then(function () {
                      sms.reply('Laporan suara berhasil diterima. Terimakasih.', konst.OK_INSITE_SMS, destinationNumber);
                      logger.info('Laporan suara berhasil diterima. Terimakasih.');
                    })
                    .catch(function (error) {
                      sms.reply(error.message, error.code, destinationNumber);
                      logger.error(error.message);
                    });

                })
                .catch(function (error) {
                  sms.reply(error.message, error.code, destinationNumber);
                  logger.error(error.message);
                });
            })
            .catch(function (error) {
              sms.reply(error.message, error.code, destinationNumber);
              logger.error(error.message);
            });

        })
        .catch(function (error) {
          sms.reply(error.message, error.code, destinationNumber);
          logger.error(error.message);
        });

    })
    .catch(function (error) {
      sms.reply(error.message, error.code, destinationNumber);
      logger.error(error.message);
    });
}
