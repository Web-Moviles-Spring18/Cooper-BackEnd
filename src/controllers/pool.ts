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
  req.assert("name", "Pool name must be a alpha string between 3 and 31 characters").isAlpha().isLength({ min: 3, max: 31 });
  req.assert("private", "Private must be a boolean").isBoolean();
  req.assert("total", "Total must be a number").isNumeric();
  req.assert("currency", "Currency must be a length 3 alpha string").isAlpha().isLength({ max: 3, min: 3 });
  req.assert("paymentMethod", "Payment method must be a alpha string").isAlpha();
  req.assert("location", "Location must be a LatLnog").optional().isLatLong();
  req.assert("ends", "Ends must be a date").toDate();
  req.assert("starts", "Ends must be a date").optional().toDate();

  const errors = req.validationErrors();

  if (errors) {
    return res.status(400).send(errors);
  }

  const pool = new Pool({
    name: req.body.name,
    private: req.body.private,
    total: req.body.total,
    currency: req.body.currency,
    paymentMethod: req.body.paymentMethod,
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
