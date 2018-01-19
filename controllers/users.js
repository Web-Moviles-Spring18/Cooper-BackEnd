const User = require('../models/User.js');
const jwt = require('jsonwebtoken');
const {
  MISSING_PASSWORD,
  SIGNIN_SUCCESS,
  MISSING_USERNAME,
  SERVER_ERROR,
  WRONG_CREDENTIALS
} = require('../constants/responseConstants');

const secret = process.env.SECRET;

module.exports = {
  signin(req, res) {
    return new Promise((resolve) => {
      const {username, email, password} = req.body;
      if (!password) {
        return res.status(400).send(MISSING_PASSWORD);
      }
      const user = User({username, email});
      User.setPassword(user, password);
      user.save((err, user) => {
        if (err) {
          res.status(500).send(err.message);
          return console.error(err);
        }
        res.status(200).send(SIGNIN_SUCCESS);
        resolve('Success');
      });
    }).catch((err) => {
      res.status(301).send(err.message);
    });
  },

  login(req, res) {
    return new Promise((resolve) => {
      const {username, email, password} = req.body;
      if (!username) {
        res.status(400).send(MISSING_USERNAME);
        resolve('Failed');
      }
      User.findOne({ username }, 'hash salt', (err, user) => {
        if (err) {
          res.status(500).send(SERVER_ERROR);
        }
        if (User.validPassword(user, password)) {
          const token = jwt.sign({
            email: user.email,
            username: user.username
          }, secret, {
            expiresIn: '48h'
          });
          return res.status(200).json({ token });
        } else {
          res.status(400).send(WRONG_CREDENTIALS);
        }
        resolve('Success');
      });
    }).catch((err) => {
      res.status(301).send(err.message);
    });
  }
};
