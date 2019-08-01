import express from 'express';
import { ConnectionConfig, Connection, createConnection } from 'mysql';
const app = express();
const mysqlConfig: ConnectionConfig = {
  host: 'remotemysql.com',
  database: 'BkMfl7pWj2',
  user: 'BkMfl7pWj2',
  password: 'xlzJtt2zTl',
  port: 3306
};

app.set('port', (process.env.PORT || 3000));
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.get('/test', function (req, res) {
  const connection: Connection = createConnection(mysqlConfig);
  connection.connect();
  connection.query('select * from test_table', (error, result) => {
    res.send(error ? error : result);
  });
  connection.end();
});

app.listen(app.get('port'), function () {
  console.log('Node app is running at localhost:' + app.get('port'));
});
