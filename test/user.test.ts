import * as request from "supertest";
import * as app from "../src/app";

let chai = require('chai');
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
});
