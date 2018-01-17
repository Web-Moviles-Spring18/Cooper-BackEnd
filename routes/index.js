const router = require('express').Router();

router.get('/hi', (req, res) => res.send(200, "Hi!"));

module.exports = router;
