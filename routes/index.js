const router = require('express').Router();
const users = require('./users');

router.get('/hi', (req, res) => res.status(200).send("Hi!"));

router.use('/users', users);

module.exports = router;
