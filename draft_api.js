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

const fAbc = (conn, rows) => {
  const promises = [];
  for (let x = 0; x < rows.length; x++) {
    promises.push(
      new Promise(resolve => {
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
                  // Prepare inserts
                  if (
                    resultsQry3[0]['kuota_kk'] > resultsQry1[0]['total'] &&
                    resultsQry5[0]['jumlah_kk'] > resultsQry2[0]['total']
                  ) {

                    (async () => {
                      for (let p = 0; p < kuisioner.length; p++) {
                        await new Promise(resolve => {
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
                            conn.query("INSERT INTO suara_masuk SET ?", values, () => {
                              resolve(1);
                            });
                          } catch (errr) {
                            console.log(err.code);
                            resolve(1);
                          }
                        });
                      }
                    })().then(result => {
                      resolve(result);
                    });
                  }
                }); // -> 5
              }); // -> 4
            }); // -> 3
          }); // -> 2
        }); // -> 1
      })
    )
  }

  return promises;
};

app.post('/suara-masuk-draft', (req, resp) => {
  pool.getConnection((err, conn) => {
    const rows = req.body.data;

    Promise
      .all(fAbc(conn, rows))
      .then(() => {
        conn.release();
        resp.json({ output: responseList });
      });

    // Construct ouput / response
    /*const responseList = [];
    for (let x = 0; x < rows.length; x++) {
      const item = rows[x];
      const responden_id = item['responden_id'];

      const strQry7 = "SELECT COUNT(1) AS jumlah FROM responden_info WHERE kode_responden = ?";
      conn.query(strQry7, [responden_id], (errQry7, resultsQry7) => {
        const listItem = { responden_id: responden_id };
        if (resultsQry7[0]['jumlah'] > 0) {
          listItem.status = 'success';
        } else {
          listItem.status = 'failed';
        }

        responseList.push(listItem);
      });
    }*/
  });
});

app.listen(port, () => {
  console.log('Server listening on port', port);
});
