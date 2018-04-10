import * as passport from "passport";
import * as request from "request";
import * as passportLocal from "passport-local";
import * as passportFacebook from "passport-facebook";
import { default as User, UserType, AuthToken } from "../models/User";
import { Request, Response, NextFunction } from "express";
import { Neo4jError, INode } from "neo4js";

const LocalStrategy = passportLocal.Strategy;
const FacebookStrategy = passportFacebook.Strategy;

passport.serializeUser<any, any>((user, done) => {
  done(undefined, user.email);
});

passport.deserializeUser((email, done) => {
  User.findOne({ email: email.toString() }, done);
});

function capitalizeFirstLetter(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

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
  profileFields: ["id", "name", "email", "link", "gender"],
  passReqToCallback: true
}, (req: Request, accessToken: string, refreshToken: string, profile: passportFacebook.Profile, done: Function) => {
  if (req.user) {
    User.findOne({ facebook: profile.id }, (err, existingUser) => {
      if (err) { return done(err); }
      if (existingUser) {
        done(err);
      } else {
        User.findOne({ email: req.user.email }, (err, user: any) => {
          if (err) { return done(err); }
          user.facebook = profile.id;
          if (user.tokens) {
            user.tokens.push({ kind: "facebook", accessToken });
          } else {
            user.tokens = [{ kind: "facebook", accessToken }];
          }
          user.name = user.name || `${profile.name.givenName} ${profile.name.familyName}`;
          if (!user.gender && profile._json.gender) {
            user.gender = capitalizeFirstLetter(profile._json.gender);
          }
          user.picture = user.picture || `https://graph.facebook.com/${profile.id}/picture?type=large`;
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
          if (user.tokens) {
            user.tokens.push({ kind: "facebook", accessToken });
          } else {
            user.tokens = [{ kind: "facebook", accessToken }];
          }
          user.name = `${profile.name.givenName} ${profile.name.familyName}`;
          if (profile._json.gender) {
            user.gender = capitalizeFirstLetter(profile._json.gender);
          }
          user.picture = `https://graph.facebook.com/${profile.id}/picture?type=large`;
          user.location = (profile._json.location) ? profile._json.location.name : "";
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
  if (req.user.tokens && req.user.tokens.find((tkn: AuthToken) => tkn.kind === provider) !== undefined) {
    next();
  } else {
    res.status(403).send("No, you won't!");
  }
};

export default passport;
