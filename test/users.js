process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const User = require('../models/User');
const messages = require('../constants/responseConstants');

let chai = require('chai');
let server = require('../bin/www');
let should = chai.should();
chai.use(require('chai-http'));

describe('Users', () => {
    //Before each test we empty the database
  before(done => {
      User.remove({}, (err) => {
         done();
      });
  });

  describe('/POST users', () => {
    it('Should reject when there is no password', done => {
      const user = {
        username: 'test.username',
        email: 'test@email.com'
      };
      chai.request(server).post('/users').send(user).end((err, res) => {
        res.should.have.status(400);
        res.text.should.be.a('string');
        res.text.should.be.eql(messages.MISSING_PASSWORD);
        done();
      });
    });

    it('Should reject when there is no username or email', done => {
      const user = {
        password: 'test.password'
      };
      chai.request(server).post('/users').send(user).end((err, res) => {
        res.should.have.status(400);
        res.text.should.be.a('string');
        res.text.should.be.eql(messages.MISSING_USERNAME);
        done();
      });
    });

    it('Should reject invalid email', done => {
      const user = {
        username: 'testusername',
        password: 'test.password',
        email: 'test@.com'
      };
      chai.request(server).post('/users').send(user).end((err, res) => {
        res.should.have.status(400);
        res.body.should.be.a('object');
        res.body.should.have.property('email');
        res.body.email.should.be.a('object');
        res.body.email.should.have.property('message');
        res.body.email.message.should.be.a('string');
        res.body.email.message.should.be.eql(messages.INVALID_EMAIL);
        done();
      });
    });

    it('Should reject invalid username', done => {
      const user = {
        username: 'test.$#!)(#!)',
        email: 'test@email.com',
        password: 'test.password'
      };
      chai.request(server).post('/users').send(user).end((err, res) => {
        res.should.have.status(400);
        res.body.should.be.a('object');
        res.body.should.have.property('username');
        res.body.username.should.be.a('object');
        res.body.username.should.have.property('message');
        res.body.username.message.should.be.a('string');
        res.body.username.message.should.be.eql(messages.INVALID_USERNAME);
        done();
      });
    });

    it('Should create a new user', done => {
      const user = {
        username: 'test.username',
        email: 'test@email.com',
        password: 'test.password'
      };
      chai.request(server).post('/users').send(user).end((err, res) => {
        res.should.have.status(200);
        res.text.should.be.a('string');
        res.text.should.be.eql(messages.SIGNIN_SUCCESS);
        done();
      });
    });

    it('Should reject an already taken username', done => {
      const user = {
        username: 'test.username',
        email: 'test2@email.com',
        password: 'test.password'
      };
      chai.request(server).post('/users').send(user).end((err, res) => {
        res.should.have.status(400);
        res.body.should.be.a('object');
        res.body.should.have.property('username');
        res.body.username.should.be.a('object');
        res.body.username.should.have.property('message');
        res.body.username.message.should.be.a('string');
        res.body.username.message.should.be.eql(messages.USERNAME_OR_EMAIL_TAKEN);
        done();
      });
    });

    it('Should reject an already taken email', done => {
      const user = {
        username: 'test.username2',
        email: 'test@email.com',
        password: 'test.password'
      };
      chai.request(server).post('/users').send(user).end((err, res) => {
        res.should.have.status(400);
        res.body.should.be.a('object');
        res.body.should.have.property('email');
        res.body.email.should.be.a('object');
        res.body.email.should.have.property('message');
        res.body.email.message.should.be.a('string');
        res.body.email.message.should.be.eql(messages.USERNAME_OR_EMAIL_TAKEN);
        done();
      });
    });

  });
});
