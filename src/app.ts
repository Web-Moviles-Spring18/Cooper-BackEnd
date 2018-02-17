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

// API keys and Passport configuration
import * as auth from "./config/passport";

// Create Express server
const app = express();


// Express configuration
app.set("port", process.env.PORT || 3000);
// app.set("views", path.join(__dirname, "../views"));
// app.set("view engine", "pug");
app.use(compression());
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator());

const redisPort = process.env.REDIS_PORT;
app.use(session({
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
app.post("/login", userController.login);
app.get("/logout", userController.logout);
app.post("/forgot", userController.forgot);
app.get("/reset/:token", userController.getReset);
app.post("/reset/:token", userController.postReset);
app.post("/signup", userController.signup);
app.get("/account", auth.isAuthenticated, userController.account);

// app.get("/contact", contactController.getContact);
// app.post("/contact", contactController.postContact);

app.post("/account/profile", auth.isAuthenticated, userController.postUpdateProfile);
app.post("/account/password", auth.isAuthenticated, userController.postUpdatePassword);
app.post("/account/delete", auth.isAuthenticated, userController.postDeleteAccount);
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

module.exports = app;
