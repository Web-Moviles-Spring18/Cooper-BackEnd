import * as express from "express";
import * as compression from "compression";  // compresses requests
import * as session from "express-session";
import * as bodyParser from "body-parser";
import * as logger from "morgan";
import * as lusca from "lusca";
import * as dotenv from "dotenv";
import * as path from "path";
import * as passport from "passport";
import * as redis from "connect-redis";
import * as expressValidator from "express-validator";
import * as bluebird from "bluebird";
import * as bcrypt from "bcrypt-nodejs";
import * as crypto from "crypto";
import * as neo from "./lib/neo4js";
import * as cors from "cors";

// Load environment variables from .env file, where API keys and passwords are configured
dotenv.config();
const RedisStore = redis(session);
const host = process.env.HOST || "localhost";
const neo4jPort = process.env.NEO4J_PORT || "7474";
const dbPath = `cooper_${process.env.NODE_ENV}`;
neo.connect({ host, port: neo4jPort, dbPath }, {
  user: process.env.NEO4J_USER,
  password: process.env.NEO4J_PASSWORD,
});

// Controllers (route handlers)
import * as userController from "./controllers/user";
import * as apiController from "./controllers/api";
import * as contactController from "./controllers/contact";
import * as poolController from "./controllers/pool";

// API keys and Passport configuration
import * as auth from "./config/passport";

// Create Express server
const app = express();

// Options for cors midddleware
const options = {
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "X-Access-Token"],
  credentials: true,
  methods: "GET, HEAD, OPTIONS, PUT, PATCH, POST, DELETE",
  origin: "*",
  preflightContinue: false
};

// use cors middleware
app.use(cors(options));

// Express configuration
app.set("port", process.env.PORT || 3000);
app.set("securePort", process.env.SECURE_PORT || 3443);
app.use(compression());
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());

const redisPort = process.env.REDIS_PORT;
app.use(session({
  name: "cooper.sid",
  resave: false,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET,
  store: new RedisStore({ host, port: redisPort })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(lusca.xframe("SAMEORIGIN"));
app.use(lusca.xssProtection(true));
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});
app.use((req, res, next) => {
  // After successful login, redirect back to the intended page
  if (!req.user &&
    req.path !== "/login" &&
    req.path !== "/signup" &&
    !req.path.match(/^\/auth/) &&
    !req.path.match(/\./)) {
    req.session.returnTo = req.path;
  } else if (req.user &&
    req.path == "/account") {
    req.session.returnTo = req.path;
  }
  next();
});
app.use(express.static(path.join(__dirname, "public"), { maxAge: 31557600000 }));

/**
 * Primary app routes.
 */
app.get("/hello", (req, res) => res.status(200).send("Hello there!"));
app.post("/login", userController.login);
app.get("/logout", userController.logout);
app.post("/forgot", userController.forgot);
app.get("/reset/:token", userController.getReset);
app.post("/reset/:token", userController.postReset);
app.post("/signup", userController.signup);

/**
 * User routes.
 */
app.get("/user/:email", auth.isAuthenticated, userController.getUser);
app.get("/user/search/:name", userController.searchUser);

/**
 * Pool routes.
 */
app.post("/pool", auth.isAuthenticated, poolController.postPool);
app.post("/pool/:id/invite", auth.isAuthenticated, poolController.postInvite);
app.post("/pool/:id/pay", auth.isAuthenticated, poolController.postPayPool);
app.post("/pool/:id", auth.isAuthenticated, poolController.postUpdateUserPool);
app.get("/join/:invite", auth.isAuthenticated, poolController.getJoinPool);
app.get("/pool/accept/:id", auth.isAuthenticated, poolController.getAcceptInvite);
app.get("/pool/decline/:id", auth.isAuthenticated, poolController.getDeclineInvite);
app.get("/pool/:id", auth.isAuthenticated, poolController.getPool);
app.get("/pool/:id/users/debt", auth.isAuthenticated, poolController.getUsersWithDebt);
app.get("/pool/:id/users/overpaid", auth.isAuthenticated, poolController.getUsersOverpaid);

/**
 * Profile routes.
 */
app.get("/profile/pools", auth.isAuthenticated, poolController.getMyPools);
app.get("/profile/own/pools", auth.isAuthenticated, poolController.getOwnPools);
app.get("/pool/search/:name", poolController.searchPool);
app.get("/profile/friends", auth.isAuthenticated, userController.getFriends);
app.get("/profile/friends/requests", auth.isAuthenticated, userController.getFriendRequests);

/**
 * Friends routes.
 */
app.get("/friend/request/:uid", auth.isAuthenticated, userController.getFriendRequest);
app.get("/friend/accept/:uid", auth.isAuthenticated, userController.getAcceptFriendRequest);
app.get("/friend/decline/:uid", auth.isAuthenticated, userController.getDeclineFriendRequest);
// IDEA: public pools between friends, private pools only by invitation.
// IDEA: Find friends with facebook.

// app.get("/contact", contactController.getContact);
// app.post("/contact", contactController.postContact);


/**
 * Account routes.
 */
app.get("/account", auth.isAuthenticated, userController.account);
app.post("/account/update_payment", auth.isAuthenticated, userController.postUpdatePayment);
app.delete("/account/payment", auth.isAuthenticated, userController.deletePayment);
app.post("/account/profile", auth.isAuthenticated, userController.postUpdateProfile);
app.post("/account/password", auth.isAuthenticated, userController.postUpdatePassword);
app.get("/account/delete", auth.isAuthenticated, userController.getDeleteAccount);
app.get("/account/unlink/:provider", auth.isAuthenticated, userController.getOauthUnlink);

// facebook login
app.get("/api/facebook", auth.isAuthenticated, auth.isAuthorized, apiController.getFacebook);

/**
 * OAuth authentication routes. (Sign in)
 */
app.get("/auth/facebook", passport.authenticate("facebook", { scope: ["email", "public_profile"] }));
app.get("/auth/facebook/callback", passport.authenticate("facebook", { failureMessage: "Something went terribly wrong", failWithError: true }), (req, res) => {
  res.status(200).send("success! Loged in with facebook.");
});

// enable pre-flight
app.options("*", cors(options));

module.exports = app;
