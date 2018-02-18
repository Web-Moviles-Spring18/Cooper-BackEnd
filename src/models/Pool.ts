import { NextFunction } from "express";
import { Schema, model } from "../lib/neo4js";
import { INode } from "neo4js";
import { UserType } from "./User";

export type PoolType = INode & {
  name: string,
  private: boolean,
  location: string,
  picture: string
};

const poolSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  private: Boolean,
  paymentMethod: {
    type: String,
    required: true,
    enum: ["cash", "credit"]
  },
  location: String,
  picture: String
});

poolSchema.methods.invite = (user: UserType) => {

};

const Pool = model("Pool", poolSchema);
export default Pool;
