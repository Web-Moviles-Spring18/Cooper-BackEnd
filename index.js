const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config();
const cors = require('cors');
const ddos = require('ddos');

const router = require('./routes');

const app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// Prevent DoS attack using ddos package
// Every request per user increments an internal count. When the count exceeds the limit,
//  The requests are denied with a HTTP 429 Too Many Requests.
// the parameters burst/limit is reasonable for humans use.

const ddos_opt = new ddos({burst: 10, limit: 15});
app.use(ddos_opt.express);

app.use('/api', router);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  res.status(404).send('Not Found');
  next(err);
});

module.exports = app;
