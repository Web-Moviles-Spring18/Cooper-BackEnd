import * as request from "supertest";
import * as app from "../src/app";

import * as chai from "chai";
const expect = chai.expect;
const assert = chai.assert;

/*describe("GET /account", () => {
  it("should return a json with an account", (done) =>{
    return request(app).get("/account")

  });
});*/

const userCredentials = {
  email: "dan@itesm.mx ",
  password: "contraseña"
};

const authenticatedUser = request.agent(app);



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
