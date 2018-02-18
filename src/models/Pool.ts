import { NextFunction } from "express";
import { Schema, model } from "../lib/neo4js";
import { INode } from "neo4js";
import { UserType } from "./User";

export type PoolType = INode & {
  email: string,
  password: string,
  passwordResetToken?: string,
  passwordResetExpires?: Date,
  facebook?: string,
  twitter?: string,
  google?: string,
  name?: string,
  gender?: string,
  location?: string,
  picture?: string,
  comparePassword: (candidatePassword: string, cb: (err: any, isMatch: any) => any) => void,
  gravatar: (size: number) => string
};

const poolSchema = new Schema({
  name: String,
  private: Boolean,
  location: String,
  picture: String
});

poolSchema.methods.invite = (user: UserType) => {

};

const Pool = model("Pool", poolSchema);
export default Pool;
