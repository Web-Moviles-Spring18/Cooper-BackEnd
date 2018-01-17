const router = require('express').Router();
const User = require('../models/User.js');

router.get('/hi', (req, res) => res.status(200).send("Hi!"));

module.exports = router;
