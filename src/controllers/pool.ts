import { default as Pool, PoolType } from "../models/Pool";
import { default as User, UserType } from "../models/User";
import { Request, Response, NextFunction } from "express";
import { INode, Relationship } from "neo4js";
import * as request from "express-validator";

/**
 * POST /pool
 * Create a new pool.
 */
export let postPool = (req: Request, res: Response, next: NextFunction) => {
  req.assert("name", "Pool name must be a alpha string between 3 and 31 characters").isAscii().isLength({ min: 3, max: 31 });
  req.assert("private", "Private must be a boolean").isBoolean();
  req.assert("paymentMethod", "Payment method must be credit or cash").isIn(["credit", "cash"]);
  req.assert("location", "Location must be a LatLnog").optional().isLatLong();
  req.assert("ends", "Ends must be a date").optional().toDate();
  req.assert("starts", "Ends must be a date").optional().toDate();
  req.assert("currency", "Currency must be one of usd or mxn").isIn(["usd", "mxn"]);

  const errors = req.validationErrors();

  if (errors) {
    return res.status(400).send(errors);
  }

  const pool = new Pool({
    name: req.body.name,
    private: req.body.private,
    total: req.body.total || 0,
    currency: req.body.currency,
    paymentMethod: req.body.paymentMethod,
    ends: req.body.ends || new Date()
  });

  if (req.body.location) {
    pool.location = req.body.location;
  }
  if (req.body.starts) {
    pool.starts = req.body.starts;
  }

  pool.save((err: Error) => {
    if (err) { return next(err); }
    req.user.owns(pool).then(() => {
      req.user.participatesIn(pool).then(() => {
        res.status(200).send({
          message: "Pool created!",
          pool
        });
      }).catch((err: Error) => {
        console.error(err);
        res.status(500).send("Something went wrong.");
      });
    }).catch((err: Error) => {
      res.status(400).send(err.message);
    });
  });
};

/**
 * POST /pool/:id
 * Update status of a user in a pool (i.e.: amount, etc.).
 * Requires owner status.
 */
export let postUpdateUserPool = (req: Request, res: Response, next: NextFunction) => {
  req.assert("userInfo").isJSON();
  req.assert("userInfo.debt", "Must be a number").optional().isNumeric();
  req.assert("userInfo.paid", "Must be a number").optional().isNumeric();

  Pool.findById(req.params.id, (err, pool: PoolType) => {
    if (err) { return next(err); }
    if (!pool) {
      return res.status(404).send("Pool not found.");
    }

    req.user.hasRelationWith("owns", pool, "any", (err: Error, userOwnsPool: boolean) => {
      if (err) { return next(err); }
      if (!userOwnsPool) {
        return res.status(401).send("You don't own this pool");
      }

      req.assert("userEmail", "Invalid email").isEmail();
      req.sanitize("userEmail").normalizeEmail({ gmail_remove_dots: false });

      pool.getRelated("participatesIn", User, "in", (err, participants) => {
        let totalPaid = req.body.userInfo.debt || 0;
        participants.forEach((pair) => {
          if ((<any>pair.relation).paid && pair.node.email !== req.body.userEmail) {
            totalPaid += (<any>pair.relation).paid;
          }
        });
        if (totalPaid > pool.total) {
          return res.status(400).send(`Too much debt for user ${req.body.userEmail}`);
        }
        pool.updateRelation({ email: req.body.userEmail }, {
          debt: req.body.userInfo.debt, paid: req.body.userInfo.paid
        }, () => {
          res.status(200).send("User information updated.");
        });
      });
    });
  });
};

/**
 * POST /pool/:id/invite
 * Send an invite link to another user, only if the user owns the pool
 */
export let postInvite = (req: Request, res: Response, next: NextFunction) => {
  if (req.user.email === req.body.email) {
    return res.status(400).send("You cannot invite yourself.");
  }
  Pool.findById(req.params.id, (err, pool: PoolType) => {
    if (err) { return next(err); }
    if (!pool) {
      return res.status(404).send("Pool not found.");
    }
    req.user.hasRelationWith("owns", pool, "any", (err: Error, userOwnsPool: boolean) => {
      if (err) { return next(err); }
      if (!userOwnsPool) {
        return res.status(401).send("You don't own this pool.");
      }

      req.assert("email", "Invalid email").isEmail();
      req.sanitize("email").normalizeEmail({ gmail_remove_dots: false });
      User.findOne({ email: req.body.email }, (err, user: UserType) => {
        if (err) { return next(err); }
        if (!user) {
          return res.status(404).send("User not found D:");
        }

        pool.inviteUser(req.user, user, (err, result) => {
          if (err) {
            console.error(err);
            return next(err);
          }
          if (process.env.NODE_ENV === "develop") {
            console.log(result);
          }
          res.status(200).send("Invitation sent!");
        });
      });
    });
  });
};

/**
 * GET /pool/:id
 * Accept Invitation to join a pool.
 */
export let getAcceptInvite = (req: Request, res: Response, next: NextFunction) => {
  Pool.findById(req.params.id, (err, pool: PoolType) => {
    if (err) { return next(err); }
    if (!pool) { return res.status(404).send(`Pool with id ${req.params.id} not found.`); }
    req.user.hasRelationWith("invitedTo", pool, "out", (err: Error, hasInivitation: boolean) => {
      if (err) { return next(err); }
      if (!hasInivitation) { return res.status(401).send("No friend request found."); }
      req.user.participatesIn(pool, { debt: 0, paid: 0 }).then(() => {
        pool.removeRelation("invitedTo", req.user, (err: Error) => {
          if (err) { next(err); }
        });
        res.status(200).send(`Congratulations! You just joined ${pool.name}.`);
      }).catch((err: Error) => {
        console.error(err);
        res.status(500).send("Something went wrong, please try again later.");
      });
    });
  });
};

/**
 * GET /pool/:id
 * See pool detail.
 */
export let getPool = (req: Request, res: Response, next: NextFunction) => {
  Pool.findById(req.params.id, (err: Error, pool: PoolType) => {
    if (err) { return next(err); }
    if (!pool) {
      return res.status(404).send("Pool not found.");
    }

    pool.getRelated("participatesIn", User, "in", (err: Error, participants) => {
      if (err) { return next(err); }
      let totalPaid = 0;
      participants.forEach((pair) => {
        delete pair.node.password;
        delete pair.node.label;
        delete pair.node.tokens;
        // FIXME: define relation type
        if ((<any>pair.relation).paid) {
          totalPaid += (<any>pair.relation).paid;
        }
      });
      pool.totalPaid = totalPaid;
      delete pool.invite;
      return res.status(200).send({ pool, participants });
    });
  });
};

/**
 * GET /pool/search/:name
 * Find pools that match name.
 */
export let searchPool = (req: Request, res: Response, next: NextFunction) => {
  Pool.findLike({ name: `(?i).*${req.params.name}.*` }, {}, (err, pools) => {
    if (err) { return next(err); }
    pools.forEach((pool) => {
      delete pool.invite;
    })
    res.status(200).send(pools);
  });
};

/**
 * GET /profile/pools
 * Get all pools that the logged in user participants in.
 */
export let getMyPools = (req: Request, res: Response, next: NextFunction) => {
  req.user.getRelated("participatesIn", Pool, "out", (err: Error, pools: Relationship[]) => {
    if (err) { return next(err); }
    pools.forEach((pair) => {
      delete pair.node.invite;
    });
    return res.status(200).send(pools);
  });
};

/**
 * GET /profile/pools
 * Get all pools that the logged in user participants in.
 */
export let getInvitedToPools = (req: Request, res: Response, next: NextFunction) => {
  req.user.getRelated("invitedTo", Pool, "out", (err: Error, pools: Relationship[]) => {
    if (err) { return next(err); }
    pools.forEach((pair) => {
      delete pair.node.invite;
    });
    return res.status(200).send(pools);
  });
};

/**
 * GET /profile/own/pools
 * Get all pools that the logged in user participants in.
 */
export let getOwnPools = (req: Request, res: Response, next: NextFunction) => {
  req.user.getRelated("owns", Pool, "out", (err: Error, pools: Relationship[]) => {
    if (err) { return next(err); }
    return res.status(200).send(pools);
  });
};

/**
 * GET /join/:invite
 * Join an existing pool.
 */
 export let getJoinPool = (req: Request, res: Response, next: NextFunction) => {
   Pool.findOne({ invite: req.params.invite }, (err, pool: PoolType) => {
     if (err) { return next(err); }
     if (!pool) {
       return res.status(404).send("Pool not found.");
     }

     pool.hasRelationWith("participatesIn", req.user, "in", (err, exists) => {
       if (!exists) {
         req.user.participatesIn(pool, { debt: 0, paid: 0 }).then(() => {
           res.status(200).send("Succesfully joined pool!");
         }).catch((err: Error) => {
           console.error(err);
           res.status(500).send("Something went wrong.");
         });
       } else {
         res.status(400).send("User already joined pool.");
       }
     });
   });
 };
