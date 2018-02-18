import * as bcrypt from "bcrypt-nodejs";
import * as crypto from "crypto";

import { NextFunction } from "express";
import { Schema, model } from "../lib/neo4js";
import { INode, Model, NeoProperties } from "neo4js";
import { default as Pool } from "./Pool";

export type AuthToken = {
  accessToken: string,
  kind: string
};

export type UserType = INode & {
  email: string,
  password: string,
  passwordResetToken?: string,
  passwordResetExpires?: Date,
  tokens?: AuthToken,
  facebook?: string,
  twitter?: string,
  google?: string,
  name?: string,
  gender?: string,
  location?: string,
  picture?: string,
  owns: (pool: INode, props?: NeoProperties) => Promise<void>,
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
  password: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  tokens: Array,
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
  bcrypt.genSalt(10, (err, salt) => {
    if (err) { return next(err); }
    bcrypt.hash(user.password, salt, undefined, (err: Error, hash) => {
      if (err) { return next(err); }
      user.password = hash;
      next();
    });
  });
});

userSchema.pre("findOne", function parseTokens(next: Function) {
  const user = this;
  if (user.tokens) {
    user.tokens = JSON.parse(user.tokens || "{}");
  }
  next();
});

userSchema.methods.comparePassword = function (candidatePassword: string, cb: (err: any, isMatch: any) => any) {
  bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
    cb(err, isMatch);
  });
};

userSchema.relate("owns", Pool);

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
export default User;
