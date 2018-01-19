const User = require('../models/User.js');
const jwt = require('jsonwebtoken');

const secret = process.env.SECRET;

module.exports = {
  signin(req, res) {
    return new Promise((resolve) => {
      const {username, email, password} = req.body;
      if (!password) {
        return res.status(401).send({message: 'Empty password'});
      }
      const user = User({username, email});
      User.setPassword(user, password);
      user.save((err, user) => {
        if (err) {
          res.status(500).send({ message: err.message });
          return console.error(err);
        }
        res.status(200).send(user);
        resolve('Success');
      });
    }).catch((err) => {
      res.status(301).send(err.message);
    });
  },

  login(req, res) {
    return new Promise((resolve) => {
      const {username, email, password} = req.body;
      if (!email && !username) {
        res.status(301).send({ message: 'No id' });
        resolve('Failed');
      }
      const id = !!email ? email : username;
      User.findOne({ email }, 'hash salt', (err, user) => {
        if (err) {
          res.status(500).send({ message: 'Something went wrong.' });
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
          res.status(400).send({ message: 'Email or password incorrect.' });
        }
        resolve('Success');
      });
    }).catch((err) => {
      res.status(301).send(err.message);
    });
  }
};
