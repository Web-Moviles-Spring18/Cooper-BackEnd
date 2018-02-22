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
    totalAmount: req.body.totalAmount,
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
    console.log(req.user.owns);
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
 * POST /pool/:id/invite
 * Send an invite link to another user, only if the user owns the pool
 */
export let postInvite = (req: Request, res: Response, next: NextFunction) => {
  Pool.findById(req.params.id, (err, pool: PoolType) => {
    if (err) { return next(err); }
    if (!pool) {
      return res.status(404).send("Pool not found.");
    }
    req.user.hasRelationWith("owns", pool, (err: Error, userOwnsPool: boolean) => {
      if (err) { return next(err); }
      if (!userOwnsPool) {
        return res.status(401).send("You don't own this pool");
      }

      req.assert("email", "Invalid email").isEmail();
      req.sanitize("email").normalizeEmail({ gmail_remove_dots: false });
      User.findOne({ email: req.body.email }, (err, user: UserType) => {
        if (err) { return next(err); }
        if (!user) {
          return res.status(200).send("Invitation sent!.");
        }

        console.log("Should send email");
        res.status(200).send("Invitation sent!.");
        // Send email, how?
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

    pool.getRelated("participatesIn", User, (err: Error, participants) => {
      participants.forEach((pair) => {
        delete pair.node.password;
      });
      return res.status(200).send({ pool, participants });
    });
  });
};

export let getMyPools = (req: Request, res: Response, next: NextFunction) => {
  req.user.getRelated("participatesIn", Pool, (err: Error, pools: Relationship[]) => {
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

     pool.hasRelationWith("participatesIn", req.user, (err, exists) => {
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
