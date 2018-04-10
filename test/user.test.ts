import * as request from "supertest";
import * as app from "../src/app";
import * as chai from "chai";
import * as mocha from "mocha";

const expect = chai.expect;
const assert = chai.assert;

const newUserCredentials = {
  email: "sergio.profe@gmail.com",
  password: "contraseña",
  confirmPassword: "contraseña"
};

const userCredentials = {
  email: "hermes.espinola@gmail.com",
  password: "contraseña"
};

const authenticatedUser = request.agent(app);
beforeAll((done) => {
  authenticatedUser
    .post("/login")
    .send({ email: "hermes.espinola@gmail.com", password: "contraseña" })
    .end(function (err, res) {
      console.log(res.status);
      done();
    });
});

describe("POST /signup", () => {
  it("should be able to sign-up", (done) => {
    return request(app).post("/signup")
    .send(newUserCredentials)
    .end(function(err, res) {
      // console.log(res.error);
      expect(res.status).to.equal(201);
      done();
    });
  });
});

// Test de Login con datos incorrectos
describe("POST /login", () => {
  it("should return some defined error message with valid parameters", (done) => {
    return request(app).post("/login")
      .field("email", "john@me.com")
      .field("password", "Hunter2")
      .expect(400)
      .end(function(err, res) {
        expect(res.error).not.to.be.undefined;
        // console.log(res.error);
        done();
      });
  });
});

// Login con datos correctos
describe("POST /login", () => {
  it("Should return 200", (done) => {
    return request(app).post("/login")
      .send(userCredentials)
      .expect(200)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
        // console.log(res.status);
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

describe("GET /account", () => {
  it("should return a 200 response if the user is logged in", function(done) {
    authenticatedUser.get("/account")
    .expect(200, done);
  });
  it("should return a 401 response Unauthorized", function(done) {
    request(app).get("/account")
    .expect(401, done);
  });
});

describe("GET /account", () => {
  it("should return a 200 response if the user is logged in", function(done) {
    authenticatedUser.get("/account")
    .expect(200, done);
  });
  it("should return a 401 response Unauthorized", function(done) {
    request(app).get("/account")
    .expect(401, done);
  });
});
