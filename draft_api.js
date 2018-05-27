const path = require('path');
const dotenv = require('dotenv');
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

// Query 1
const qry1 = (err, results) => {
  return new Promise((resolve, reject) => {
    if (err) {
      reject(null);
    } else {
      resolve(results);
    }
  });
};

const qry2 = (err, results) => {
  //
};

const qry3 = (err, results) => {
  //
};

app.post('/suara-masuk-draft', (req, resp) => {
  pool.getConnection(async (err, conn) => {
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

      const strQry1 = "SELECT COALESCE(SUM(total_suara),0) AS total " +
        "FROM tmp_suara_masuk " +
        "WHERE `relawan_id` = ? " +
        "AND deleted = 'false'";

      const strQry2 = "SELECT COALESCE(SUM(total_suara),0) AS total " +
        "FROM tmp_suara_masuk " +
        "WHERE relawan_id = ? " +
        "AND kelurahan_id = ?";

      const qry1Result = await conn.query(strQry1, [relawan_id], qry1);
      const qry2Result = await conn.query(strQry2, [relawan_id, kelurahan_id], qry2);
      // const qry3Result = await conn.query('', qry3);

      console.log('qry1Result', qry1Result);
      console.log('qry2Result', qry2Result);
      resp.json({ result1: qry1Result, result2: qry2Result });
    }

    conn.release();
  });
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.listen(port, () => {
  console.log('Server listening on port', port);
});
