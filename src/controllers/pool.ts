import { default as Pool, PoolType } from "../models/Pool";
import { default as User, UserType } from "../models/User";
import { Request, Response, NextFunction } from "express";
import { INode } from "neo4js";
const request = require("express-validator");

/**
 * POST /pool
 * Create a new pool.
 */
export let postPool = (req: Request, res: Response, next: NextFunction) => {
  req.assert("name", "Pool name must be a alpha string between 3 and 31 characters").isAscii().isLength({ min: 3, max: 31 });
  req.assert("private", "Private must be a boolean").isBoolean();
  req.assert("total", "Total must be a number").optional().isNumeric();
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
    User.findOne({ email: req.user.email }, (err, user: UserType) => {
      if (err) { return next(err); }
      user.owns(pool).then(() => {
        user.participatesIn(pool).then(() => {
          res.status(200).send({
            message: "Pool created!",
            pool
          });
        }).catch((err) => {
          console.error(err);
          res.status(500).send("Something went wrong.");
        });
      }).catch((err: Error) => {
        res.status(400).send(err.message);
      });
    });
  });
};

/**
 * POST /join/:invite
 * Join an existing pool.
 */
 export let getJoinPool = (req: Request, res: Response, next: NextFunction) => {
   Pool.findOne({ invite: req.params.invite }, (err, pool) => {
     if (err) { return next(err); }
     if (!pool) {
       return res.status(404).send("Pool not found.");
     }

     // TODO: Create a method to see if a node is already related to other.
     req.user.participatesIn(pool, { debt: 0, paid: 0 }).then(() => {
       res.status(200).send("Succesfully joined pool!");
     }).catch((err: Error) => {
       console.error(err);
       res.status(500).send("Something went wrong.");
     });
   });
 };
