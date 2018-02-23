import * as passport from "passport";
import * as request from "request";
import * as passportLocal from "passport-local";
import * as passportFacebook from "passport-facebook";
import * as _ from "lodash";

// import { User, UserType } from '../models/User';
import { default as User, UserType } from "../models/User";
import { Request, Response, NextFunction } from "express";
import { Neo4jError } from "neo4js";

const LocalStrategy = passportLocal.Strategy;
const FacebookStrategy = passportFacebook.Strategy;

passport.serializeUser<any, any>((user, done) => {
  done(undefined, user.email);
});

passport.deserializeUser((email, done) => {
  User.findOne({ email: email.toString() }, (err, user) => {
    done(err, user);
  });
});


/**
 * Sign in using Email and Password.
 */
passport.use(new LocalStrategy({ usernameField: "email" }, (email: string, password: string, done: Function) => {
  User.findOne({ email: email.toLowerCase() }, (err: Neo4jError, user: UserType) => {
    if (err) { return done(err); }
    if (!user) {
      return done(undefined, false, { message: "Invalid email or password." });
    }
    user.comparePassword(password, (err: Error, isMatch: boolean) => {
      if (err) { return done(err); }
      if (isMatch) {
        return done(undefined, user);
      }
      return done(undefined, false, { message: "Invalid email or password." });
    });
  });
}));


/**
 * OAuth Strategy Overview
 *
 * - User is already logged in.
 *   - Check if there is an existing account with a provider id.
 *     - If there is, return an error message. (Account merging not supported)
 *     - Else link new OAuth account with currently logged-in user.
 * - User is not logged in.
 *   - Check if it's a returning user.
 *     - If returning user, sign in and we are done.
 *     - Else check if there is an existing account with user's email.
 *       - If there is, return an error message.
 *       - Else create a new account.
 */


/**
 * Sign in with Facebook.
 */
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_ID,
  clientSecret: process.env.FACEBOOK_SECRET,
  callbackURL: "/auth/facebook/callback",
  profileFields: ["name", "email", "link", "locale", "timezone"],
  passReqToCallback: true
}, (req: any, accessToken: string, refreshToken: string, profile: any, done: Function) => {
  if (req.user) {
    User.findOne({ facebook: profile.id }, (err, existingUser) => {
      if (err) { return done(err); }
      if (existingUser) {
        done(err);
      } else {
        User.findOne({ email: req.user.email }, (err, user: any) => {
          if (err) { return done(err); }
          user.facebook = profile.id;
          user.tokens.push({ kind: "facebook", accessToken });
          user.profile.name = user.profile.name || `${profile.name.givenName} ${profile.name.familyName}`;
          user.profile.gender = user.profile.gender || profile._json.gender;
          user.profile.picture = user.profile.picture || `https://graph.facebook.com/${profile.id}/picture?type=large`;
          user.save((err: Error) => {
            done(err, user);
          });
        });
      }
    });
  } else {
    User.findOne({ facebook: profile.id }, (err, existingUser) => {
      if (err) { return done(err); }
      if (existingUser) {
        return done(undefined, existingUser);
      }
      User.findOne({ email: profile._json.email }, (err, existingEmailUser) => {
        if (err) { return done(err); }
        if (existingEmailUser) {
          done(err);
        } else {
          const user: any = new User();
          user.email = profile._json.email;
          user.facebook = profile.id;
          user.tokens.push({ kind: "facebook", accessToken });
          user.profile.name = `${profile.name.givenName} ${profile.name.familyName}`;
          user.profile.gender = profile._json.gender;
          user.profile.picture = `https://graph.facebook.com/${profile.id}/picture?type=large`;
          user.profile.location = (profile._json.location) ? profile._json.location.name : "";
          user.save((err: Error) => {
            done(err, user);
          });
        }
      });
    });
  }
}));

/**
 * Login Required middleware.
 */
export let isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).send("Not authenticated.");
};

/**
 * Authorization Required middleware.
 */
export let isAuthorized = (req: Request, res: Response, next: NextFunction) => {
  const provider = req.path.split("/").slice(-1)[0];

  if (_.find(req.user.tokens, { kind: provider })) {
    next();
  } else {
    res.status(403).send("No, you won't!");
  }
};
