import express from 'express';
import bodyParser from 'body-parser';
import { Routes } from './router/router';

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const router = express.Router();

app.set('port', (process.env.PORT || 3000));

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});


const routes: Routes = new Routes(router);

app.use(router);

app.listen(app.get('port'), function () {
  console.log('Node app is running at localhost:' + app.get('port'));
});
