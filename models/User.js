const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const secret = process.env.SECRET;

const UserSchema = mongoose.Schema({
  username: {
    type: String,
    required: [true, "can't be blank"],
    match: [/^[a-z\.A-Z0-9]+$/, 'is invalid'],
    unique: true,
    index: true
  },
  email: {
    type: String,
    lowercase: true,
    unique: true,
    required: [true, "can't be blank"],
    match: [/\S+@\S+\.\S+/, 'is invalid'],
    index: true
  },
  hash: String,
  salt: String
}, { timestaps: true });

UserSchema.plugin(uniqueValidator, { message: 'is already taken.' });

UserSchema.statics.setPassword = (user, password) => {
  if (!password) return console.error('Empty password');
  user.salt = crypto.randomBytes(16).toString('hex');
  user.hash = crypto.pbkdf2Sync(password, user.salt, 10000, 512, 'sha512').toString('hex');
};

UserSchema.statics.validPassword = (user, password) => (
  crypto.pbkdf2Sync(password, user.salt, 10000, 512, 'sha512').toString('hex') === user.hash
);

UserSchema.statics.generateJWT = (user) => {
  var today = new Date();
  var exp = new Date(today);
  exp.setDate(today.getDate() + 60);

  return jwt.sign({
    id: user._id,
    username: user.username,
    exp: parseInt(exp.getTime() / 1000),
  }, secret);
};

UserSchema.statics.toAuthJSON = (user) => ({
  username: user.username,
  email: user.email,
  token: user.generateJWT()
});

module.exports = mongoose.model('User', UserSchema);
