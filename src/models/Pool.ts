import { NextFunction } from "express";
import { Schema, model } from "../lib/neo4js";
import { INode } from "neo4js";
import { UserType } from "./User";
import * as crypto from "crypto";
import * as sgMail from "@sendgrid/mail";
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export type PoolType = INode & {
  name: string,
  private: boolean,
  invite: String,
  paymentMethod: "cash" | "credit",
  currency: "usd" | "mxn",
  location?: {
    lat: number,
    long: number
  },
  starts?: Date,
  ends: Date,
  picture?: string,
  inviteUser: (from: UserType, user: UserType, cb: (err: Error, result: any) => void) => void
};

const poolSchema = new Schema({
  name: {
    type: String,
    required: true,
    index: true
  },
  private: Boolean,
  invite: {
    type: String,
    required: true,
    index: true
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ["cash", "credit"]
  },
  currency: {
    type: String,
    required: true,
    enum: ["usd", "mxn"]
  },
  total: {
    type: Number,
    required: true
  },
  location: String,
  starts: Date,
  ends: {
    type: Date,
    required: true
  },
  picture: String
});

poolSchema.pre("save", function createInvite(next: Function) {
  const pool = this;

  // Convert location to string.
  if (pool.location) {
    pool.location = JSON.stringify(pool.location);
  }

  if (pool._id) { return; } // If the pool already exists don't overwrite the invite link

  // Create a random invite link for this pool
  crypto.randomBytes(16, (err, buf) => {
    pool.invite = buf.toString("hex");
    next();
  });
});

poolSchema.methods.inviteUser = function(from: UserType, user: UserType, cb: (err: Error, result: any) => void) {
  const pool: PoolType = this;
  const displayName = from.name ? from.name : "Someone";
  const msg = {
    to: user.email,
    subject: `${displayName} invited you to the ${pool.name} pool!`,
    from: "service@cooper.com",
    text: `Hello,\n\n${displayName} just invited you to join his pool. \n\n` +
    `If you want to join, please click the following link:\n` +
    `${process.env.HOST_URI}/join/${pool.invite}`
  };
  sgMail.send(msg, false, cb);
};

const Pool = model("Pool", poolSchema);
export default Pool;
