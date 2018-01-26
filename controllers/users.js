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
        res.status(400).send(MISSING_PASSWORD);
        resolve('Success');
      } else if (!username || !email) {
        res.status(400).send(MISSING_USERNAME);
      } else {
        const user = User({username, email});
        User.setPassword(user, password);
        user.save((err, user) => {
          if (err) {
            return res.status(400).send(err.errors);
            resolve('Success');
          }
          res.status(200).send(SIGNIN_SUCCESS);
          resolve('Success');
        });
      }
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
        } else if(!user) {
          res.status(400).send(WRONG_CREDENTIALS);
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
