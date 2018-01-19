const User = require('../models/User.js');
const router = require('express').Router();
const { signin, login } = require('../controllers/users');

router.post('/', signin);

router.post('/login', login);

module.exports = router;
