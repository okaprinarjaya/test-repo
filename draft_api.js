/*const cluster = require('cluster');

if (cluster.isMaster) {
  for (let i = 0; i < 2; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });

  console.log(`Master ${process.pid} is running`);

} else {*/
  const path = require('path');
  const dotenv = require('dotenv');
  const express = require('express');
  const bodyParser = require('body-parser');
  const mysql = require('mysql');
  const fs = require('fs');

  dotenv.config({ path: path.dirname(require.main.filename) + '/.env' });

  const app = express();
  const port = 8080;

  const pool = mysql.createPool({
    connectionLimit: 30,
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  app.post('/suara-masuk-draft', (req, resp) => {
    pool.getConnection((err, conn) => {
      const rows = req.body.data;

      for (let x = 0; x < rows.length; x++) {
        const item = rows[x];
        const kuisioner = item['kuisioner'];
        const sesi_dtdc_id = item['sesi_dtdc_id'];
        const relawan_id = item['relawan_id'];
        const responden_id = item['responden_id'];
        const kelurahan_id = item['kelurahan_id'];
        const latitute = item['latitute'];
        const longitute = item['longitute'];
        const foto = item['foto'];

        // 1. Inquiry TMP Suara masuk
        const strQry1 = "SELECT COALESCE(SUM(total_suara),0) AS total " +
          "FROM tmp_suara_masuk " +
          "WHERE `relawan_id` = ? " +
          "AND deleted = 'false'";

        conn.query(strQry1, [relawan_id], (err1, resultsQry1) => {

          // 2. Inquiry TMP Suara masuk per Kelurahan
          const strQry2 = "SELECT COALESCE(SUM(total_suara),0) AS total " +
            "FROM tmp_suara_masuk " +
            "WHERE relawan_id = ? " +
            "AND kelurahan_id = ?";

          conn.query(strQry2, [relawan_id, kelurahan_id], (err2, resultsQry2) => {

            // 3. Inquiry data relawan
            const strQry3 = "SELECT kuota_kk FROM relawan WHERE id = ?";

            conn.query(strQry3, [relawan_id], (err3, resultsQry3) => {

              // 4. Inquiry kelurahan get kab_kota_id & kecamatan_id
              const strQry4 = "SELECT kab_kota_id, kecamatan_id FROM kelurahan WHERE id = ?";

              conn.query(strQry4, [kelurahan_id], (err4, resultsQry4) => {

                // 5. Inquiry relawan wilayah
                const strQry5 = "SELECT jumlah_kk FROM tmp_suara_masuk " +
                  "WHERE relawan_id = ? " +
                  "AND kelurahan_id = ? " +
                  "AND deleted = 'false'";

                conn.query(strQry5, [relawan_id, kelurahan_id], (err5, resultsQry5) => {
                  if (!err3 && !err1 && !err5 && !err2) {

                    // Prepare inserts
                    if (
                      resultsQry3[0]['kuota_kk'] > resultsQry1[0]['total'] &&
                      resultsQry5[0]['jumlah_kk'] > resultsQry2[0]['total']
                    ) {

                      for (let p = 0; p < kuisioner.length; p++) {
                        const values = {
                          sesi_dtdc_id: sesi_dtdc_id,
                          questions_id: kuisioner[p]['kuisioner_id'],
                          options_id: kuisioner[p]['pilihan_jawaban_id'],
                          option_other: kuisioner[p]['pilihan_jawaban_lain'],
                          relawan_id: relawan_id,
                          kab_kota_id: resultsQry4[0]['kab_kota_id'],
                          kecamatan_id: resultsQry4[0]['kecamatan_id'],
                          kelurahan_id: kelurahan_id,
                          kode_responden: responden_id,
                          status: '1',
                          ent_by: relawan_id,
                          ent_dt: kuisioner[p]['created_dt'],
                          deleted: 'false'
                        };

                        try {
                          conn.query("INSERT INTO suara_masuk SET ?", values, (errInsert, resultsInsert) => {
                            console.log('errInsert', errInsert.code);
                          });
                        } catch (errr) {
                          console.log(err.code);
                        }
                      }

                      // Inquiry TMP Suara Masuk NEW
                      const strQry6 = "SELECT COALESCE(SUM(total_suara),0) AS total FROM tmp_suara_masuk " +
                        "WHERE relawan_id = ? " +
                        "AND deleted = 'false'";

                      conn.query(strQry6, [relawan_id], (err6, resultsQry6) => {
                        if (resultsQry3[0]['kuota_kk'] === resultsQry6[0]['total']) {
                          const strQryUpdt = "UPDATE relawan SET status = ? WHERE id = ?";
                          conn.query(strQryUpdt, ['TIDAK AKTIF', relawan_id], _ => _);
                        }

                        // Populate responden_info
                        if (kuisioner.length > 0) {
                          const values = {
                            kode_responden: responden_id,
                            latitute: latitute,
                            longitute: longitute,
                            address: '-',
                            ent_by: relawan_id,
                            ent_dt: { toSqlString: () => 'CURRENT_TIMESTAMP()' }
                          };

                          conn.query("INSERT INTO responden_info SET ?", values, _ => _);
                        }

                        // Save image
                        if (foto !== '') {
                          const base64Data = foto.replace(/^data:image\/jpg;base64,/, "");
                          const out = process.env.SAVE_PHOTO_PATH + kelurahan_id + '/';

                          fs.stat(out, (errStat, stats) => {
                            if (errStat && errStat.code === 'ENOENT') {
                              console.log('Save image - check directory existence - errStat', errStat);
                              fs.mkdir(out, errMkdir => {
                                if (!errMkdir) {
                                  fs.writeFile(out + responden_id + '.jpg', base64Data, 'base64', _ => _);
                                }
                              });

                            } else {
                              fs.writeFile(out + responden_id + '.jpg', base64Data, 'base64', _ => _);
                            }
                          });
                        }
                      });
                      /*const strQryInsert = "INSERT INTO suara_masuk (" +
                        "sesi_dtdc_id, " +
                        "questions_id, " +
                        "options_id, " +
                        "option_other, " +
                        "relawan_id, " +
                        "kab_kota_id, " +
                        "kecamatan_id, " +
                        "kelurahan_id, " +
                        "kode_responden, " +
                        "status, " +
                        "ent_by, " +
                        "ent_dt, " +
                        "deleted" +
                        ") VALUES ?";

                      const records = [];
                      for (let p = 0; p < kuisioner.length; p++) {
                        records.push([
                          sesi_dtdc_id,
                          kuisioner[p]['kuisioner_id'],
                          kuisioner[p]['pilihan_jawaban_id'],
                          kuisioner[p]['pilihan_jawaban_lain'],
                          relawan_id,
                          resultsQry4[0]['kab_kota_id'],
                          resultsQry4[0]['kecamatan_id'],
                          kelurahan_id,
                          responden_id,
                          '1',
                          relawan_id,
                          kuisioner[p]['created_dt'],
                          'false'
                        ]);
                      }*/

                      // Do the questionaires insert!
                      /*conn.query(strQryInsert, [records], (errInsert, resultsInsert) =>  {

                        // Inquiry TMP Suara Masuk NEW
                        const strQry6 = "SELECT COALESCE(SUM(total_suara),0) AS total FROM tmp_suara_masuk " +
                          "WHERE relawan_id = ? " +
                          "AND deleted = 'false'";

                        conn.query(strQry6, [relawan_id], (err6, resultsQry6) => {
                          if (resultsQry3[0]['kuota_kk'] === resultsQry6[0]['total']) {
                            const strQryUpdt = "UPDATE relawan SET status = ? WHERE id = ?";
                            conn.query(strQryUpdt, ['TIDAK AKTIF', relawan_id], _ => _);
                          }

                          // Populate responden_info
                          if (kuisioner.length > 0) {
                            const values = {
                              kode_responden: responden_id,
                              latitute: latitute,
                              longitute: longitute,
                              address: '-',
                              ent_by: relawan_id,
                              ent_dt: { toSqlString: () => 'CURRENT_TIMESTAMP()' }
                            };

                            conn.query("INSERT INTO responden_info SET ?", values, _ => _);
                          }

                          // Save image
                          if (foto !== '') {
                            const base64Data = foto.replace(/^data:image\/jpg;base64,/, "");
                            const out = process.env.SAVE_PHOTO_PATH + kelurahan_id + '/';

                            fs.stat(out, (errStat, stats) => {
                              if (errStat && errStat.code === 'ENOENT') {
                                console.log('Save image - check directory existence - errStat', errStat);
                                fs.mkdir(out, errMkdir => {
                                  if (!errMkdir) {
                                    fs.writeFile(out + responden_id + '.jpg', base64Data, 'base64', _ => _);
                                  }
                                });

                              } else {
                                fs.writeFile(out + responden_id + '.jpg', base64Data, 'base64', _ => _);
                              }
                            });
                          }
                        });
                      });*/

                    } else {
                      // Update Status Relawan
                      conn.query("UPDATE relawan SET status = ? WHERE id = ?", ['TIDAK AKTIF', relawan_id], _ => _);
                    }
                  }
                }); // -> 5
              }); // -> 4
            }); // -> 3
          }); // -> 2
        }); // -> 1
      }

      // Construct ouput / response
      //

      conn.release();
      resp.json({ hola: 'Holaaa hola hola holaaaaa' });
    });
  });

  app.listen(port, () => {
    console.log('Server listening on port', port);
  });

  // console.log(`Worker ${process.pid} started`);
// }
