import * as request from "supertest";
import * as app from "../src/app";

import * as chai from "chai";
let expect = chai.expect;

describe("POST /login", () => {
  it("should return some defined error message with valid parameters", (done) => {
    return request(app).post("/login")
      .field("email", "john@me.com")
      .field("password", "Hunter2")
      .expect(400)
      .end(function(err, res) {
        expect(res.error).not.to.be.undefined;
        done();
      });
  });

  it("Should return a success code for a correct login.", (done) => {
    return request(app).post("/login")
      .field("email", "hermes.espinola@gmail.com")
      .field("password", "password")
      .end(function (err, response) {
        expect(response.statusCode).to.equal(200);
        expect('Location', '/account');
        done();
      });
  });
});

describe("POST /signup", () => {
  it("Should return a success code for correct account creation.", (done) => {
    return request(app).post("/signup")
      .field("email", "rodremur@gmail.com")
      .field("password", "abc123456")
      .field("confirmPassword", "abc123456")
      .end(function (err, response) {
        expect(response.statusCode).to.equal(201);
        done();
      });
  });

  it("Should return an error in the creation due to password being too small.", (done) => {
    return request(app).post("/signup")
      .field("email", "example2@gmail.com")
      .field("password", "123")
      .field("confirmPassword", "123")
      .expect(400)
      .end(function (err, res) {
        expect(res.error).not.to.be.undefined;
        done();
      });
  });

  it("Should return an error in the creation due to account already existing.", (done) => {
    return request(app).post("/signup")
      .field("email", "hermes.espinola@gmail.com")
      .field("password", "password")
      .field("confirmPassword", "password")
      .expect(400)
      .end(function (err, res) {
        expect(res.error).not.to.be.undefined;
        done();
      });
  });

  it("Should return an error in the creation due to passwords not matching.", (done) => {
    return request(app).post("/signup")
      .field("email", "example3@gmail.com")
      .field("password", "password")
      .field("confirmPassword", "different")
      .expect(400)
      .end(function (err, res) {
        expect(res.error).not.to.be.undefined;
        done();
      });
  });

  it("Should return an error due to the email being invalid", (done) => {
    return request(app).post("/signup")
      .field("email", "bademail.com")
      .field("password", "password")
      .field("confirmPassword", "password")
      .expect(400)
      .end(function (err, res) {
        expect(res.error).not.to.be.undefined;
        done();
      });
  });
});