import * as async from "async";
import * as crypto from "crypto";
import * as bcrypt from "bcrypt-nodejs";
import * as passport from "passport";
import { default as User, AuthToken, UserType } from "../models/User";
import { Request, Response, NextFunction } from "express";
import { IVerifyOptions } from "passport-local";
import { INode, Neo4jError, Relationship } from "neo4js";
const imgur: any = require("imgur");

import * as sgMail from "@sendgrid/mail";
import * as Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_KEY);
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

imgur.setClientId(process.env.IMGUR_CLIENT_ID);

/**
 * POST /login
 * Sign in using email and password.
 */
export let login = (req: Request, res: Response, next: NextFunction) => {
  req.assert("email", "Email is not valid").isEmail();
  req.assert("password", "Password cannot be blank").notEmpty();
  req.sanitize("email").normalizeEmail({ gmail_remove_dots: false });

  const errors = req.validationErrors();

  if (errors) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error on login attempt:");
      console.error(errors);
    }
    return res.status(400).send(errors);
  }

  passport.authenticate("local", (err: Error, user: UserType, info: IVerifyOptions) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(400).send(info.message);
    }
    req.logIn(user, (err: Error) => {
      if (err) {
        return next(err);
      }
      res.status(200).send("Success! You are logged in.");
    });
  })(req, res, next);
};

/**
 * GET /logout
 * Log out.
 */
export let logout = (req: Request, res: Response) => {
  req.logout();
  res.status(200).send("Logged out.");
};

/**
 * POST /signup
 * Create a new local account.
 */
export let signup = (req: Request, res: Response, next: NextFunction) => {
  req.assert("email", "Email is not valid").isEmail();
  req.assert("password", "Password must be at least 4 characters long").len({ min: 4 });
  req.assert("confirmPassword", "Passwords do not match").equals(req.body.password);
  req.sanitize("email").normalizeEmail({ gmail_remove_dots: false });

  // optional
  req.assert("name", "Name must be a string").optional().isAscii();
  req.assert("gender", "Gender must be a string").optional().isIn(["Male", "Female"]);
  req.assert("location", "Location must be a string").optional().isAlphanumeric();
  req.assert("pictureURL", "PictureURL should be an URL").optional().isURL();
  req.assert("picture", "Picture should be a Base 64 string").optional();

  const errors = req.validationErrors();

  if (errors) {
    return res.status(400).send(errors);
  }

  const user = new User({
    email: req.body.email,
    password: req.body.password
  });

  if (req.body.name) {
    user.name = req.body.name;
  }
  if (req.body.gender) {
    user.gender = req.body.gender;
  }
  if (req.body.location) {
    user.location = req.body.location;
  }
  if (req.body.fcmToken) {
    user.fcmToken = req.body.fcmToken;
    console.log(`New fcmToken from ${req.body.email}: ${req.body.fcmToken}`);
  }

  User.findOne({ email: req.body.email }, (err, existingUser) => {
    if (err) { next(err); }
    if (process.env.NODE_ENV === "development") {
      console.log(existingUser);
    }
    if (existingUser) {
      return res.status(400).send("Account with that email address already exists.");
    }
    bcrypt.genSalt(10, (err, salt) => {
      if (err) { return next(err); }
      bcrypt.hash(<string>user.password, salt, undefined, (err: Error, hash: string) => {
        if (err) { return next(err); }
        user.password = hash;
        const saveUser = () => {
          user.save((err: Error) => {
            if (err) {
              return next(err);
            }
            req.logIn(user, (err: Error) => {
              if (err) {
                return next(err);
              }
              res.status(201).send("Success! User registered.");
            });
          });
        };
        if (req.body.picture) {
          imgur.uploadBase64(req.body.picture).then((res: any) => {
            user.picture = res.data.link;
            saveUser();
          }).catch((err: Error) => {
            console.error(err.message);
            res.status(500).send("There was en error uploading the image.");
          });
        } else {
          if (req.body.pictureURL) {
            user.picture = req.body.pictureURL;
          }
          saveUser();
        }
      });
    });
  });
};

/**
 * POST /user/update_payment
 * Create a new stripe customer and payment source
 * or update this user's defualt payment source.
 */
export let postUpdatePayment = (req: Request, res: Response, next: NextFunction) => {
  req.assert("token", "Stripe token string is required.").isAscii();

  const errors = req.validationErrors();
  if (errors) {
    return res.status(400).send(errors);
  }

  if (!req.user.customer) {
    stripe.customers.create({
      email: req.user.email,
      source: req.body.token
    }, function(err: any, customer: Stripe.customers.ICustomer) {
      if (err) {
        return next(err);
      }

      req.user.customer = customer.id;
      req.user.save((err: Error) => {
        if (err) {
          return next(err);
        }
        res.status(201).send({
          message: "Payment information added!",
          ...customer
        });
      });
    });
  } else {
    stripe.customers.update(req.user.customer, {
      default_source: req.body.token
    }, function(err: any, customer: Stripe.customers.ICustomer) {
      if (err) {
        next(err);
      }
      res.status(201).send({
        message: "Payment information added!",
        ...customer
      });
    });
  }
};

/**
 * DELETE /user/update_payment
 * Create a new stripe customer and payment source
 * or update this user's defualt payment source.
 */
export let deletePayment = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user.customer) {
    delete req.user.customer;
    req.user.save((err: Neo4jError) => {
      if (err) {
        next(err);
      }
      res.status(200).send("Profile information has been updated.");
    });
  } else {
    stripe.customers.update(req.user.customer, {
      default_source: req.body.token
    }, function(err: any, customer: Stripe.customers.ICustomer) {
      if (err) {
        next(err);
      }
      res.status(201).send({
        message: "Payment information updated!",
        ...customer
      });
    });
  }
};

/**
 * GET /user/search/:name
 * Find users that match name.
 */
export let searchUser = (req: Request, res: Response, next: NextFunction) => {
  req.assert("search", "Email must be an email").isEmail();
  User.findLike({
    name: `(?i).*${req.params.name}.*`,
    email: `(?i).*${req.params.name}.*`
  }, {}, (err, users) => {
    if (err) {
      return next(err);
    }
    users.forEach((user) => {
      delete user.password;
      delete user.label;
      delete user.tokens;
    });
    res.status(200).send(users);
  }, -1, "OR");
};

export let getUser = (req: Request, res: Response) => {
  User.findById(req.params.id, (err, user: UserType) => {
    if (err) {
      return res.status(500).send("Something went wrong. Please try again later.");
    } else if (!user) {
      return res.status(404).send(`User with id ${req.params.id} not found.`);
    } else {
      delete user.password;
      delete user.label;
      delete user.tokens;
      res.status(200).send(user);
    }
  });
};

/**
 * GET /account
 * Profile page.
 */
export let account = (req: Request, res: Response) => {
  delete req.user.password;
  delete req.user.label;
  delete req.user.tokens;
  res.status(200).send(req.user);
};

/**
 * POST /account/profile
 * Update profile information.
 */
export let postUpdateProfile = (req: Request, res: Response, next: NextFunction) => {
  if (req.body.email) {
    req.assert("email", "Please enter a valid email address.").isEmail();
    req.sanitize("email").normalizeEmail({ gmail_remove_dots: false });
  }

  req.assert("pictureURL", "PictureURL should be an URL").optional().isURL();
  req.assert("picture", "Picture should be a Base 64 string").optional();
  req.assert("gender", "Please enter 'Male' or 'Female'").optional().isIn(["Male", "Female"]);
  const errors = req.validationErrors();

  if (errors) {
    return res.status(400).send(errors);
  }

  User.findOne({ email: req.user.email }, (err, user: UserType) => {
    if (err) {
      return next(err);
    }
    user.email = req.body.email || user.email;
    user.name = req.body.name || user.name || "";
    user.gender = req.body.gender || user.gender || "";
    user.location = req.body.location || user.location || "";
    user.fcmToken = req.body.fcmToken || user.fcmToken || "";
    const saveUser = () => {
      user.save((err: Neo4jError) => {
        if (process.env.NODE_ENV == "development") {
          console.error(err);
        }
        if (err) {
          return res.status(400).send("The email address you have entered is already associated with an account.");
        }
        res.status(200).send("Profile information has been updated.");
      });
    };

    if (req.body.picture) {
      imgur.uploadBase64(req.body.picture).then((res: any) => {
        user.picture = res.data.link;
        saveUser();
      }).catch((err: Error) => {
        console.error(err.message);
        res.status(500).send("There was en error uploading the image.");
      });
    } else {
      if (req.body.pictureURL) {
        user.picture = req.body.pictureURL;
      }
      saveUser();
    }
  });
};

/**
 * POST /account/password
 * Update current password.
 */
export let postUpdatePassword = (req: Request, res: Response, next: NextFunction) => {
  req.assert("password", "Password must be at least 4 characters long").len({ min: 4 });
  req.assert("confirmPassword", "Passwords do not match").equals(req.body.password);

  const errors = req.validationErrors();

  if (errors) {
    return res.status(400).send(errors);
  }

  User.findOne({ email: req.user.email }, (err: Error, user: UserType) => {
    if (err) {
      return next(err);
    }
    user.password = req.body.password;
    user.save((err: Neo4jError) => {
      if (err) {
        return next(err);
      }
      res.status(200).send("Password has been changed.");
    });
  });
};

/**
 * POST /friend/request/:uid
 * Send friend request to the user with the given id.
 */
export let getSendFriendRequest = (req: Request, res: Response, next: NextFunction) => {
  if (req.params.uid < 0) {
    return res.status(400).send("Id cannot be < 0");
  }
  User.findById(req.params.uid, (err, notYourFriend: UserType) => {
    if (err) {
      return next(err);
    }
    if (!notYourFriend) { return res.status(404).send("User not found D:"); }
    notYourFriend.hasRelationWith("friendRequest", <any>req.user, "any", (err, isFriend) => {
      if (err) { return next(err); }
      if (isFriend) { return res.status(400).send("A friend request for or from this user already exists."); }
      req.user.friendRequest(notYourFriend);
      res.status(200).send("Friend request sent!");
    });
  });
};

/**
 * GET /friend/requests
 * See your friend requests.
 */
export let getFriendRequests = (req: Request, res: Response, next: NextFunction) => {
  req.user.getRelated("friendRequest", User, "in", (err: Error, notYourFriends: Relationship[]) => {
    if (err) {
      return next(err);
    }
    notYourFriends.forEach((pair) => {
      delete pair.node.password;
      delete pair.node.label;
      delete pair.node.tokens;
    });
    return res.status(200).send(notYourFriends.map((pair) => pair.node));
  });
};

/**
 * GET /profile/friends
 * All user account.
 */
export let getFriends = (req: Request, res: Response, next: NextFunction) => {
  req.user.getRelated("friendOf", User, "any", (err: Error, friends: Relationship[]) => {
    if (err) {
      return next(err);
    }
    friends.forEach((pair) => {
      delete pair.node.password;
      delete pair.node.label;
      delete pair.node.tokens;
    });
    return res.status(200).send(friends.map((pair) => pair.node));
  });
};

/**
 * GET /friend/accept/:uid
 * Accept a friend request.
 */
export let getAcceptFriendRequest = (req: Request, res: Response, next: NextFunction) => {
  if (req.params.uid < 0) {
    return res.status(400).send("Id cannot be < 0");
  }
  User.findById(req.params.uid, (err, user: UserType) => {
    if (err) {
      return next(err);
    }
    if (!user) { return res.status(404).send(`User with id ${req.params.uid} not found.`); }
    req.user.hasRelationWith("friendRequest", user, "in", (err: Error, hasFriendRequest: boolean) => {
      if (err) {
        return next(err);
      }
      if (!hasFriendRequest) { return res.status(401).send("No friend request found."); }
      user.friendOf(<any>req.user).then(() => {
        user.removeRelation("friendRequest", <any>req.user, (err: Error) => {
          if (err) { next(err); }
        });
        res.status(200).send(`Congratulations! ${user.name || user.email} is now your friend.`);
      }).catch((_) => {
        res.status(500).send("Something went wrong, please try again later.");
      });
    });
  });
};

/**
 * GET /friend/decline/:uid
 * Decline a friend request.
 */
export let getDeclineFriendRequest = (req: Request, res: Response, next: NextFunction) => {
  if (req.params.uid < 0) {
    return res.status(400).send("Id cannot be < 0");
  }
  User.findById(req.params.uid, (err, user: UserType) => {
    if (err) {
      return next(err);
    }
    if (!user) { return res.status(404).send(`User with id ${req.params.uid} not found.`); }
    req.user.hasRelationWith("friendRequest", user, "in", (err: Error, hasFriendRequest: boolean) => {
      if (err) {
        return next(err);
      }
      if (!hasFriendRequest) { return res.status(401).send("No friend request found."); }
      user.removeRelation("friendRequest", <any>req.user, (err: Error) => {
        if (err) {
          return next(err);
        }
        res.status(200).send(`Friend request from ${user.name || user.email} declined.`);
      });
    });
  });
};

/**
 * GET /account/delete
 * Delete user account.
 */
export let getDeleteAccount = (req: Request, res: Response, next: NextFunction) => {
  User.remove({ email: req.user.email }, (err: Neo4jError) => {
    if (err) {
      return next(err);
    }
    req.logout();
    res.status(200).send("Your account has been deleted.");
  });
};

/**
 * GET /account/unlink/:provider
 * Unlink OAuth provider.
 */
export let getOauthUnlink = (req: Request, res: Response, next: NextFunction) => {
  const provider = req.params.provider;
  User.findOne({ email: req.user.email }, (err, user: any) => {
    if (err) {
      return next(err);
    }
    user[provider] = undefined;
    user.tokens = user.tokens.filter((token: AuthToken) => token.kind !== provider);
    user.save((err: Error) => {
      if (err) {
        return next(err);
      }
      res.status(200).send(`${provider} account has been unlinked`);
    });
  });
};

/**
 * GET /reset/:token
 * Verify reset token
 */
export let getReset = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return res.status(401).send("You are already logged in.");
  }
  User.findOne({ passwordResetToken: req.params.token }, (err, user) => {
      if (err) {
        return next(err);
      }
      if (!user  || user.passwordResetToken < Date.now()) {
        return res.status(403).send("Password reset token is invalid or has expired.");
      }

      res.status(200).send("Password reset token is valid.");
  });
};

/**
 * POST /reset/:token
 * Process the reset password request.
 */
export let postReset = (req: Request, res: Response, next: NextFunction) => {
  req.assert("password", "Password must be at least 4 characters long.").len({ min: 4 });
  req.assert("confirmPassword", "Passwords must match.").equals(req.body.password);

  const errors = req.validationErrors();

  if (errors) {
    return res.status(400).send(errors);
  }

  async.waterfall([
    function resetPassword(done: Function) {
      User
        .findOne({ passwordResetToken: req.params.token }, (err, user: any) => {
          if (err) { return done(next(err), user); }
          if (!user || user.passwordResetToken < Date.now()) {
            done(new Error("User not found"));
          }
          user.password = req.body.password;
          user.passwordResetToken = undefined;
          user.passwordResetExpires = undefined;
          user.save((err: Neo4jError) => {
            if (err) {
              return next(err);
            }
            req.logIn(user, (err: Error) => {
              done(err, user);
            });
          });
        });
    },
    function sendResetPasswordEmail(user: UserType, done: Function) {
      const msg = {
        to: user.emai.toString(),
        from: "service@cooper.com",
        subject: "Your password has been changed",
        text: `Hello,\n\nThis is a confirmation that the password for your account ${user.email} has just been changed.\n`
      };
      sgMail.send(msg, false, (err: Error) => {
        if (err) {
          done(err);
        }
        res.status(200).send(`An e-mail has been sent to ${user.email} with further instructions.`);
      });
    }
  ], (err: Error) => {
    if (err) {
      return next(err);
    }
    res.status(500).send("Something went terribly wrong");
  });
};

/**
 * POST /forgot
 * Create a random token, then the send user an email with a reset link.
 */
export let forgot = (req: Request, res: Response, next: NextFunction) => {
  req.assert("email", "Please enter a valid email address.").isEmail();
  req.sanitize("email").normalizeEmail({ gmail_remove_dots: false });

  const errors = req.validationErrors();

  if (errors) {
    return res.status(400).send(errors);
  }

  async.waterfall([
    function createRandomToken(done: Function) {
      crypto.randomBytes(16, (err, buf) => {
        const token = buf.toString("hex");
        done(err, token);
      });
    },
    function setRandomToken(token: AuthToken, done: Function) {
      User.findOne({ email: req.body.email }, (err, user: any) => {
        if (err) { return done(err); }
        if (!user) { return done(new Error("User not found")); }
        user.passwordResetToken = token;
        user.passwordResetExpires = Date.now() + 3600000; // 1 hour
        user.save((err: Error) => {
          done(err, token, user);
        });
      });
    },
    function sendForgotPasswordEmail(token: AuthToken, user: UserType, done: Function) {
      const msg = {
        to: user.email.toString(),
        from: "service@cooper.com",
        subject: "Reset your password on Cooper",
        text: `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
          Please click on the following link, or paste this into your browser to complete the process:\n\n
          http://${req.headers.host}/reset/${token}\n\n
          If you did not request this, please ignore this email and your password will remain unchanged.\n`
      };
      sgMail.send(msg, false, (err: Error) => {
        if (err) {
          done(err);
        }
        res.status(200).send(`An e-mail has been sent to ${user.email} with further instructions.`);
      });
    }
  ], (err: Error) => {
    if (err) {
      if (err.message === "User not found") {
        return res.status(200).send(`An e-mail has been sent to ${req.body.email} with further instructions.`);
      }
      return next(err);
    }
    res.status(500).send("Something went terribly wrong");
  });
};
