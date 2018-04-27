import * as request from "supertest";
import * as app from "../src/app";
import * as chai from "chai";

process.env.NODE_ENV = "test";

const expect = chai.expect;
const assert = chai.assert;

let friendCookie: string;
let newUserCookie: string;
let friendProfile: {[key: string]: string};
let newUserProfile: {[key: string]: string};

const poolNotOk = {
  name: "Cash test",
  total: "asdasdasd",
  private: true,
  paymentMethod: "maruchan",
  currency: "rupees"
};

const privateOkPool = {
  name: "Carne asada",
  total: 76543,
  private: true,
  paymentMethod: "cash",
  currency: "mxn",
  starts: "2018-04-09T01:47:24.368Z"
};

const poolOk = {
  name: "Pizzas",
  total: 220,
  private: false,
  paymentMethod: "cash",
  currency: "mxn",
  starts: "2018-04-09T01:47:24.368Z",
  ends: "2018-05-09T01:47:24.368Z"
};

const testUser2Credential = {
  email: "test_pool@gmail.com",
  password: "pofmewpfnw",
  confirmPassword: "pofmewpfnw",
  name: "Pool test"
};

const testUserCredentials = {
  email: "julio.profe@gmail.com",
  password: "mamamamamamama",
  confirmPassword: "mamamamamamama",
  name: "El robot del futuro"
};

beforeAll((done) => {
  request(app).post("/signup")
    .send(testUser2Credential)
    .end((err, res) => {
      request(app).post("/login")
        .send(testUser2Credential)
        .end((err, res) => {
          expect(res.header["set-cookie"]).not.to.be.undefined;
          friendCookie = res.header["set-cookie"][0];
          request(app).get("/account")
            .set("Cookie", friendCookie)
            .expect(200)
            .end((err, res) => {
              friendProfile = res.body;
              done();
            });
        });
    });

    request(app).post("/signup")
      .send(testUserCredentials)
      .end((err, res) => {
        request(app).post("/login")
          .send(testUserCredentials)
          .end((err, res) => {
            expect(res.header["set-cookie"]).not.to.be.undefined;
            assert(Array.isArray(res.header["set-cookie"]) && res.header["set-cookie"].length > 0,
                    "'set-cookie' header should be a non empty list");
            newUserCookie = res.header["set-cookie"][0];
            request(app).get("/account")
              .set("Cookie", newUserCookie)
              .expect(200)
              .end((err, res) => {
                newUserProfile = res.body;
                done();
              });
          });
      });
});

let publicPool: any;
let privatePool: any;
describe("POST /pool", () => {
  it("Should create a public pool and return 200 OK.", (done) => {
    request(app).post("/pool")
    .set("Cookie", newUserCookie)
    .send(poolOk)
    .expect(200)
    .end((err, res) => {
      expect(res.body).to.haveOwnProperty("pool");
      publicPool = res.body.pool;
      done();
    });
  });

  it("Should create a private pool and return 200 OK.", (done) => {
    request(app).post("/pool")
    .set("Cookie", friendCookie)
    .send(privateOkPool)
    .expect(200)
    .end((err, res) => {
      expect(res.body).to.haveOwnProperty("pool");
      privatePool = res.body.pool;
      done();
    });
  });

  it("Should return 400 Bad Request.", (done) => {
    request(app).post("/pool")
    .set("Cookie", newUserCookie)
    .send(poolNotOk)
    .expect(400)
    .end((err, res) => {
      assert(Array.isArray(res.body), "body must be an array");
      assert(res.body.length === 3, "Body should return three errors");
      expect(res.body[0].param).not.to.be.undefined;
      expect(res.body[1].param).not.to.be.undefined;
      expect(res.body[2].param).not.to.be.undefined;
      expect(res.body[0].param).to.be.eq("paymentMethod");
      expect(res.body[1].param).to.be.eq("total");
      expect(res.body[2].param).to.be.eq("currency");
      done();
    });
  });
});

describe("GET /pool/:id", () => {
  it("Should return 404 Not Found with -1", (done) => {
    request(app).get("/pool/-1")
    .set("Cookie", newUserCookie)
    .expect(404, done);
  });

  it("Should return 404 Not Found with private pool", (done) => {
    request(app).get(`/pool/${privatePool._id}`)
    .set("Cookie", newUserCookie)
    .expect(404, done);
  });

  it("Should return 200 Ok with private pool of owner", (done) => {
    request(app).get(`/pool/${privatePool._id}`)
    .set("Cookie", friendCookie)
    .expect(200)
    .end((err, res) => {
      expect(res.body.pool).not.to.be.undefined;
      expect(res.body.pool._id).to.be.eq(privatePool._id);
      assert(Array.isArray(res.body.participants), "participants should be an array");
      expect(res.body.participants.length).to.be.eq(1);
      done();
    });
  });
});

describe("DELETE /pool/:id", () => {
  it(`should delete the ${poolOk.name} pool`, (done) => {
    request(app).delete(`/pool/${publicPool._id}`)
    .set("Cookie", newUserCookie)
    .expect(200, done);
  });

  it(`should delete the ${privateOkPool.name} pool`, (done) => {
    request(app).delete(`/pool/${privatePool._id}`)
    .set("Cookie", friendCookie)
    .expect(200, done);
  });
});

describe("GET /account/delete", () => {
  it("should delete the account and return OK", (done) => {
    request(app).get("/account/delete")
    .set("Cookie", newUserCookie)
    .expect(200, done);

    request(app).get("/account/delete")
    .set("Cookie", friendCookie)
    .expect(200, done);
  });
});
