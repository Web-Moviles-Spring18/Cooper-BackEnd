import * as request from "supertest";
import * as app from "../src/app";

process.env.NODE_ENV = "test";

describe("GET /random-url", () => {
  it("should return 404", (done) => {
    request(app).get("/reset")
      .expect(404, done);
  });
});
