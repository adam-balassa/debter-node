const express = require('express')
const app = express()
var bodyParser = require('body-parser')
const config = require('./config');

app.use(bodyParser.json({limit: '50mb'}))
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}))
app.set('trust proxy', 1)

app.use(express.static('assets'))
app.set('view engine', 'ejs')
app.set('views', 'view')

app.get('/', (req, res) => {
    res.send('Mizu');
})

app.use(function (req, res) {
  res.redirect('/404')
})


app.listen(config.port, 'localhost', () => {
    console.log('Server started on port ' + config.port);
});

module.exports = app;