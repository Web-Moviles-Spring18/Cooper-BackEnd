import { default as Pool } from "../models/Pool";
import { default as User, UserType } from "../models/User";
import { Request, Response, NextFunction } from "express";
const request = require("express-validator");

/**
 * POST /pool
 * Create a new pool.
 */
export let postPool = (req: Request, res: Response, next: NextFunction) => {
  req.assert("name", "Pool name is not valid").isAlpha();
  req.assert("private", "Private must be a boolean").isBoolean();

  const errors = req.validationErrors();

  if (errors) {
    return res.status(400).send(errors);
  }

  const pool = new Pool({
    name: req.body.name,
    private: req.body.private
  });

  pool.save((err: Error) => {
    if (err) { return next(err); }
    User.findOne({ email: req.user.email }, (err, user: UserType) => {
      if (err) { return next(err); }
      user.owns(pool).then(() => {
        res.status(200).send("Pool created! kinda");
      }).catch((err: Error) => {
        res.status(400).send(err.message);
      });
    });
  });
};
