import * as request from "supertest";
import * as app from "../src/app";

import * as chai from "chai";
let expect = chai.expect;

const userCredentials = {
    email: 'hermes.espinola@gmail.com',
    password: 'password'
}

let authenticatedUser = request.agent(app);

before((done) => {
    authenticatedUser
        .post('/login')
        .send(userCredentials)
        .end(function (err, response) {
            expect(response.statusCode).to.equal(200);
            expect('Location', '/account');
            done();
        });
});

describe("GET /logout", () => {
    it("Should return a success code for a correct logout.", (done) => {
        request(app).get("/logout")
            .end(function (err, response) {
                expect(response.statusCode).to.equal(200);
                done();
            });
    });
});

describe("GET /account", () => {
    it("Should return a success code for to the profile GET request if the user is logged in.", (done) => {
        authenticatedUser.get('/profile')
            .end(function (err, response) {
                expect(response.statusCode).to.equal(200);
                done();
            });
    });

    it('If the user is not logged in, it should return a 302 response.', function (done) {
        request(app).get('/account')
            .expect(302, done);
    });
});

describe("POST /account/profile", () => {
    it("Should return a successful code for the profile update", (done) => {
        return authenticatedUser.post("/account/profile")
            .field("name", "Marco")
            .field("gender", "Male")
            .end(function (err, response) {
                expect(response.statusCode).to.equal(200);
                done();
            });
    });

    it("Should return an existing error if the information provided is incorrect", (done) => {
        return authenticatedUser.post("/account/profile")
            .field("name", "Marco")
            .field("gender", "Helicopter")
            .expect(400)
            .end(function (err, res) {
                expect(res.error).not.to.be.undefined;
                done();
            });
    });

    it('If the user is not logged in, it should return a 302 response.', function (done) {
        request(app).get('/account/profile')
            .field("name", "Marco")
            .field("gender", "Helicopter")
            .expect(302, done);
    });
});

describe("POST /account/password", () => {
    it("Should return a successful code for the password update", (done) => {
        return authenticatedUser.post("/account/password")
            .field("password", "qwerty123")
            .field("confirmPassword", "qwerty123")
            .end(function (err, response) {
                expect(response.statusCode).to.equal(200);
                done();
            });
    });

    it("Should return an existing error if the information provided is incorrect", (done) => {
        return authenticatedUser.post("/account/password")
            .field("password", "qwerty123")
            .field("confirmPassword", "asdf123")
            .expect(400)
            .end(function (err, res) {
                expect(res.error).not.to.be.undefined;
                done();
            });
    });

    it('If the user is not logged in, it should return a 302 response.', function (done) {
        request(app).get('/account/password')
            .field("password", "qwerty123")
            .field("confirmPassword", "qwerty123")
            .expect(302, done);
    });
});