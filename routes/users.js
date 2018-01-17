const User = require('../models/User.js');
const router = require('express').Router();

router.post('/', (req, res) => {
  try {
    const {username, email, password} = req.body;
    if (!password) {
      return res.status(401).send({message: 'Empty password'});
    }
    const user = User({username, email});
    User.setPassword(user, password);
    user.save((err, user) => {
      if (err) {
        res.status(500).send({message: err.message});
        return console.error(err);
      }
      res.status(200).send(user);
    });
  } catch (e) {
    res.status(301).send(e.message);
  }
});

module.exports = router;
