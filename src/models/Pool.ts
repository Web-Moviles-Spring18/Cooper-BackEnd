import { NextFunction } from "express";
import { Schema, model } from "../lib/neo4js";
import { INode } from "neo4js";
import { UserType } from "./User";
import * as crypto from "crypto";

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
  picture?: string
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

poolSchema.methods.invite = (user: UserType) => {
  // TODO: send email with invite link or a push notification with the invite link?
};

const Pool = model("Pool", poolSchema);
export default Pool;
