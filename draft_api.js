const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');

dotenv.config({ path: path.dirname(require.main.filename) + '/.env' });

const app = express();
const port = 8181;

const pool = mysql.createPool({
  connectionLimit: 300,
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
                console.log('resultsQry3', resultsQry3);
                console.log('resultsQry1', resultsQry1);
                console.log('resultsQry5', resultsQry5);
                console.log('resultsQry2', resultsQry2);
                // if (resultsQry3 && resultsQry1 && resultsQry5 && resultsQry2) {
                  //
                // }
              }); // -> 5
            }); // -> 4
          }); // -> 3
        }); // -> 2
      }); // -> 1
    }

    conn.release();
    resp.json({ hola: 'Holaaa hola hola holaaaaa' });
  });
});

app.listen(port, () => {
  console.log('Server listening on port', port);
});
