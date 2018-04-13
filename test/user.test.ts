import * as request from "supertest";
import * as app from "../src/app";
import * as chai from "chai";
import * as mocha from "mocha";
import { default as User } from "../src/models/User";

process.env.NODE_ENV = "test";

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
describe("POST /signup", () => {
  it("should be able to sign-up", (done) => {
    return request(app).post("/signup")
    .send(newUserCredentials)
    .end((err: Error, res: Response) => {
      expect(res.status).to.equal(201);
      done();
    });
  });
});

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
});

// Login con datos correctos
describe("POST /login", () => {
  it("Should return 200", (done) => {
    return request(app).post("/login")
      .send(newUserCredentials)
      .expect(200)
      .end(function(err, res) {
        expect(res.status).to.equal(200);
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
      .send(newUserCredentials)
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

// describe("")

afterAll(() => {
  console.log("After all");
  User.remove(newUserCredentials, () => {
    console.log("Test user removed.");
  });
});
