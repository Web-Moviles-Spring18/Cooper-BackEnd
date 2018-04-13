import * as bcrypt from "bcrypt-nodejs";
import * as crypto from "crypto";

import { NextFunction } from "express";
import { Schema, model } from "../lib/neo4js";
import { INode, Model, NeoProperties } from "neo4js";
import { default as Pool, PoolType } from "./Pool";

export type AuthToken = {
  accessToken: string,
  kind: string
};

export type UserType = INode & {
  email: string,
  password: string,
  passwordResetToken?: string,
  passwordResetExpires?: Date, // TODO: Fix dates bug
  tokens?: AuthToken[],
  facebook?: string,
  twitter?: string,
  google?: string,
  name?: string,
  gender?: string,
  location?: string, // TODO: make this a latLng object
  picture?: string,
  customer?: string,
  owns: (pool: INode) => Promise<void>,
  friendRequest: (user: INode) => Promise<void>,
  friendOf: (friend: INode) => Promise<void>,
  participatesIn: (pool: INode, props?: NeoProperties) => Promise<void>,
  invitedTo: (pool: INode) => Promise<void>;
  comparePassword: (candidatePassword: string, cb: (err: any, isMatch: any) => any) => void,
  gravatar: (size: number) => string
};

const userSchema = new Schema({
  email: {
    type: String,
    lowercase: true,
    required: true,
    match: /\S+@\S+\.\S+/,
    unique: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  customer: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  tokens: String,
  facebook: String,
  twitter: String,
  google: String,
  name: String,
  gender: {
    type: String,
    enum: ["Male", "Female"]
  },
  location: String,
  picture: String
});

userSchema.pre("save", function hashPassword(next: Function) {
  const user = this;
  if (user.tokens) {
    user.tokens = JSON.stringify(user.tokens);
  }
  next();
});

userSchema.pre("findOne", function parseTokens(next: Function) {
  const user = this;
  if (user && user.tokens) {
    user.tokens = JSON.parse(user.tokens || "{}");
  }
  next();
});

userSchema.methods.comparePassword = function (candidatePassword: string, cb: (err: any, isMatch: any) => any) {
  bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
    cb(err, isMatch);
  });
};

/**
 * Helper method for getting user's gravatar.
 */
userSchema.methods.gravatar = (size: number) => {
  if (!size) {
    size = 200;
  }
  if (!this.email) {
    return `https://gravatar.com/avatar/?s=${size}&d=retro`;
  }
  const md5 = crypto.createHash("md5").update(this.email).digest("hex");
  return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
};

const User = model("User", userSchema);

userSchema.relate("friendRequest", User);
userSchema.relate("friendOf", User);
userSchema.relate("owns", Pool);
userSchema.relate("invitedTo", Pool);
userSchema.relate("participatesIn", Pool, {
  debt: {
    type: Number,
    default: 0
  },
  paid: {
    type: Number,
    default: 0
  }
});

export default User;
