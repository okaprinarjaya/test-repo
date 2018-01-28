const express = require('express');
const bodyParser = require('body-parser');
const logger = require('./commons/logger');
const sms = require('./sms_functions');

const app = express();
const router = express.Router();
const port = 8181;

router.post('/inbound-sms', handleInboundSms);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/insite', router);

app.listen(port);
console.log('Listen on port ' + port);

function handleInboundSms(request, response) {
  sms.saveToSmsLog('inbox', request.body)
    .then(function (smsLogId) {
      const votesInformation = sms.parseText(request.body.text);
      if (votesInformation) {
        processVotes(smsLogId, votesInformation);
      } else {
        sms.reply('Format SMS salah.', 'ERR_INSITE_SMS');
        logger.error('Format SMS salah.');
      }
    })
    .catch(function (error) {
      logger.error(error.message);
    });

  response.status(200).send('OK');
}

function processVotes(smsLogId, votesInformation) {
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
                      sms.reply('Laporan suara berhasil diterima. Terimakasih.', 'OK_INSITE_SMS');
                      logger.info('Laporan suara berhasil diterima. Terimakasih.');
                    })
                    .catch(function (error) {
                      sms.reply(error.message, error.code);
                      logger.error(error.message);
                    });

                })
                .catch(function (error) {
                  sms.reply(error.message, error.code);
                  logger.error(error.message);
                });
            })
            .catch(function (error) {
              sms.reply(error.message, error.code);
              logger.error(error.message);
            });

        })
        .catch(function (error) {
          sms.reply(error.message, error.code);
          logger.error(error.message);
        });

    })
    .catch(function (error) {
      sms.reply(error.message, error.code);
      logger.error(error.message);
    });
}
