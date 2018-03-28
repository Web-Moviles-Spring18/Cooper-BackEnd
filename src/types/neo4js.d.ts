import { NextFunction } from "express-serve-static-core";

type Neo4jError = Error & {
  code: number,
  name: string
};

type Model = new (properties: NeoProperties, uid?: number) => INode;
type Relationship = { relation: NeoProperties, node: INode };

interface INode {
  [key: string]: NeoType | Function | ISchema;
  _id?: number;
  save: (fn?: (err: Error) => void) => Promise<this>;
  getRelated: (relName: String, otherModel: Model, next: (err: Neo4jError, node: Relationship[]) => void) => Promise<void>;
  hasRelation: (name: String, match: NeoProperties, next: (err: Neo4jError, res: boolean) => void) => Promise<void>;
  hasRelationWith: (name: String, other: INode, next: (err: Neo4jError, res: boolean) => void) => Promise<void>;
  updateRelation: (match: NeoProperties, newProps: NeoProperties, next: NextFunction) => Promise<void>;
}

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
type RelationType = SchemaType;

type SchemaTypeOpts = {
  type: SchemaType;
  unique?: boolean;
  required?: boolean;
  index?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
  enum?: NeoType[];
  match?: string | RegExp;
};

type RelationTypeOpts = {
  type: RelationType;
  required?: boolean;
  default?: NeoType;
};

type FindCallback = (err: Neo4jError, node: INode) => any;
type NeoType = string | boolean | number | Date | String[] |
      Boolean[] | Number[] | Date[]; // | NeoProperties;
type NestedProp = { [key: string]: PropDef };
type PropDef = SchemaType | SchemaTypeOpts; // | NestedProp;
type RelationPropDef = RelationType | RelationTypeOpts;

// Schema properties can be one of:
// String constructor
// Number constructor
// Boolean constructor
// Date constructor
// SchemaTypeOpts
interface SchemaProperties {
  [key: string]: PropDef;
}

interface RelationProperties {
  [key: string]: RelationPropDef;
}

// properties to create a new node with a model.
interface NeoProperties {
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
  statement: { text: string, paramenters: NeoProperties };
  statementType: "r" | "w" | "rw";
  counters: any;
};
