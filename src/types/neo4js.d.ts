import { NextFunction } from "express-serve-static-core";

type Neo4jError = Error & {
  code: number,
  name: string
};

interface ISchema {
  properties: SchemaProperties;
  afterHooks: Map<string, NextFunction>;
  preHooks: Map<string, NextFunction>;
  indexed: boolean;
  indexes: Array<string>;
  uniqueProps: Array<string>;
  requiredProps: Array<string>;

  pre: (name: string, callback: NextFunction) => void;

  after: (name: string, callback: NextFunction) => void;
}

interface ListConstructor {
    new (): String[] | Number[] | Boolean[] | Date[] | Object[];
}

type SchemaType = StringConstructor | NumberConstructor | BooleanConstructor |
      DateConstructor | ListConstructor;

type SchemaTypeOpts = {
  type: SchemaType;
  unique?: boolean;
  required?: boolean;
  index?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
  enum?: [NeoType];
  match?: string | RegExp;
};

interface INode {
  [key: string]: NeoType | Function | ISchema;
  schema: ISchema;
  _id?: number;
  save: (fn?: (err: Error) => void) => Promise<this>;
}

type FindCallback = (err: Neo4jError, node: INode) => any;
type NeoType = string | boolean | number | Date | String[] |
      Boolean[] | Number[] | Date[]; // | NodeProperties;
type NestedProp = { [key: string]: PropDef };
type PropDef = SchemaType | SchemaTypeOpts; // | NestedProp;

// Schema properties can be one of:
// String constructor
// Number constructor
// Boolean constructor
// Date constructor
// SchemaTypeOpts
interface SchemaProperties {
  [key: string]: PropDef;
}

// properties to create a new node with a model.
interface NodeProperties {
  [key: string]: NeoType;
}

// The result of a query.
type NeoRecord = {
  keys: string[];
  length: number;
  _fields: any;
  _fieldLookup: { [key: string]: number };
};

// query metadata, passed to onCompleted
type ResultSummary = {
  statement: { text: string, paramenters: NodeProperties };
  statementType: "r" | "w" | "rw";
  counters: any;
};
