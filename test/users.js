process.env.NODE_ENV = 'test';

const mongoose = require('mongoose');
const User = require('../models/User');
const messages = require('../constants/responseConstants');

let chai = require('chai');
let server = require('../bin/www');
let should = chai.should();
chai.use(require('chai-http'));

describe('Users', () => {
    beforeEach(done => { //Before each test we empty the database
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
          res.body.should.be.a('string');
          res.body.should.be.eql(messages.MISSING_PASSWORD);
          done();
        });
      });

      it('Should reject when there is no username or email', done => {
        const user = {
          username: 'test.username',
          password: 'test.password'
        };
        chai.request(server).post('/users').send(user).end((err, res) => {
          res.should.have.status(400);
          res.body.should.be.a('string');
          res.body.should.be.eql(messages.MISSING_USERNAME);
          done();
        });
      });

      it('Should reject invalid email', done => {
        const user = {
          username: 'test.username',
          email: 'test@.com'
        };
        chai.request(server).post('/users').send(user).end((err, res) => {
          res.should.have.status(400);
          res.body.should.be.a('string');
          res.body.should.be.eql(messages.INVALID_EMAIL);
          done();
        });
      });

      it('Should reject invalid username', done => {
        const user = {
          username: 'test.$#!)(#!)',
          email: 'test@email.com'
        };
        chai.request(server).post('/users').send(user).end((err, res) => {
          res.should.have.status(400);
          res.body.should.be.a('string');
          res.body.should.be.eql(messages.INVALID_USERNAME);
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
          res.body.should.be.a('string');
          res.body.should.be.eql(messages.SIGNIN_SUCCESS);
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
          res.body.should.be.a('string');
          res.body.should.be.eql(messages.USERNAME_TAKEN);
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
          res.body.should.be.a('string');
          res.body.should.be.eql(messages.EMAIL_TAKEN);
          done();
        });
      });

      it('Should tell you that there is no username or password ', done => {
        const user = {
          username: ' ',
          password: ' '
        };
        chai.request(server).post('/users/login').send(user).end((err, res) => {
          res.should.have.status(400);
          res.text.should.be.a('string');
          res.text.should.be.eql(messages.MISSING_PASSWORD);
          done();
        });
      });

      it('Should tell you username or incorrect password', done => {
        const user = {
          username: 'test.username3',
          password: 'test.password2 '
        };
        chai.request(server).post('/users/login').send(user).end((err, res) => {
          res.should.have.status(400);
          res.text.should.be.a('string');
          res.text.should.be.eql(messages.MISSING_PASSWORD);
          done();
        });
      });
      
      it('Shoul tell you correct username but incorrect password', done => {
        const user = {
          username: 'test.username',
          password: 'test.password2 '
        };
        chai.request(server).post('/users/login').send(user).end((err, res) => {
          res.should.have.status(400);
          res.text.should.be.a('string');
          res.text.should.be.eql(messages.MISSING_PASSWORD);
          done();
        });
      });

      it('Shoul tell you correct password or incorrect username', done => {
        const user = {
          username: 'test.username3',
          password: 'test.password '
        };
        chai.request(server).post('/users/login').send(user).end((err, res) => {
          res.should.have.status(400);
          res.text.should.be.a('string');
          res.text.should.be.eql(messages.MISSING_PASSWORD);
          done();
        });
      });

      it('Shoul tell you correct password and correct username', done => {
        const user = {
          username: 'test.username',
          password: 'test.password '
        };
        chai.request(server).post('/users/login').send(user).end((err, res) => {
          res.should.have.status(400);
          res.text.should.be.a('string');
          res.text.should.be.eql(messages.MISSING_PASSWORD);
          done();
        });
      });


    });
});
