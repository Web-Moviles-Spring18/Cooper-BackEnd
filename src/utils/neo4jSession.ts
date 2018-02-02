import { NextFunction } from "express";

const nodeEnv = process.env.NODE_ENV || "development";
const dbUri = `${process.env.NEO4J_URI}/cooper_${nodeEnv}`;
const dbUser = process.env.NEO4J_USER;
const dbPassword = process.env.NEO4J_PASSWORD;
const neo4j = require("neo4j-driver").v1;

export const session = neo4j.driver(dbUri, neo4j.auth.basic(dbUser, dbPassword)).session();

type SchemaType = StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor;

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

type NeoType = string | boolean | number | Date;
type PropDef = SchemaType | SchemaTypeOpts;

const isSchemaTypeOpts = (propDef: PropDef): propDef is SchemaTypeOpts => (
  (<SchemaTypeOpts>propDef).type !== undefined
);

// Schema properties can be one of:
// String constructor
// Number constructor
// Boolean constructor
// Date constructor
// SchemaTypeOpts
// TODO: add ArrayConstructor for all these
interface SchemaProperties {
  [key: string]: PropDef;
}

// properties to create a new node with a model.
interface NodeProperties {
  [key: string]: NeoType;
}

// The result of a query.
type Record = {
  keys: [string];
  length: number;
  _fields: [ {
    identity: {
      low: number,
      high: number
    },
    labels: [string],
    properties?: NodeProperties
    } ];
  _fieldLookup: { [key: string]: number };
};

// query metadata, passed to onCompleted
type ResultSummary = {
  statement: { text: string, paramenters: { [key: string]: NeoType } },
  statementType: "r" | "w" | "rw"
  counters: any // TODO: Write complete ResultSummary interface (useful for auto completition)
};

export class Schema {
  properties: SchemaProperties;
  afterHooks: Map<string, NextFunction>;
  preHooks: Map<string, NextFunction>;
  indexed: boolean = false;
  indexes: Array<string> = [];
  uniqueProps: Array<string> = [];
  requiredProps: Array<string> = [];

  constructor(properties: SchemaProperties) {
    this.preHooks = new Map<string, NextFunction>();
    this.afterHooks = new Map<string, NextFunction>();
    this.properties = properties;

    for (const key in properties) {
      const propDef = properties[key];
      if ((<SchemaTypeOpts>propDef).index) {
        if ((<SchemaTypeOpts>propDef).required === false) {
          throw new Error("Indexed property cannot be unrequired");
        } else {
          (<SchemaTypeOpts>propDef).required = true;
        }
        this.indexes.push(key);
      }

      // Indexed properties are inheritly unique.
      if ((<SchemaTypeOpts>propDef).unique && !(<SchemaTypeOpts>propDef).index) {
        this.uniqueProps.push(key);
      }

      if ((<SchemaTypeOpts>propDef).required) {
        this.requiredProps.push(key);
      }
    }

    this.indexed = this.indexes.length > 0;
  }
  pre(name: string, callback: NextFunction) {
    this.preHooks.set(name, callback);
  }
  after(name: string, callback: NextFunction) {
    this.afterHooks.set(name, callback);
  }
}

const defaultErrorHandler = (err: Error) => {
  console.error(err);
};

const value2Prop = (value: NeoType) => (
  typeof value === "number" ? value : `'${value}'`
);

// Create a model to create new nodes
export const model = (label: string, schema: Schema) => {
  // run indexing query
  if (schema.indexed) {
    const queryParams = schema.indexes.join(",");
    session.run(`CREATE INDEX ON :${label}(${queryParams})`).subscribe({
      onCompleted(summary: ResultSummary) {
        console.log(`Succesfully created index for label ${label}`);
      },
      onError: console.error
    });
  }

  schema.uniqueProps.forEach(prop => {
    session.run(`CREATE CONSTRAINT ON (n:${label}) ASSERT n.${prop} IS UNIQUE`).subscribe({
      onCompleted(summary: ResultSummary) {
        console.log(`Succesfully created unique constraint for ${label}.${prop}`);
      },
      onError: console.error
    });
  });

  return class Node {
    [key: string]: any;
    constructor(properties: NodeProperties = undefined) {
      if (properties) {
        for (const key in properties) {
          this[key] = properties[key];
        }
      }
    }

    async save(fn: (err: Error) => void = defaultErrorHandler): Promise<this> {
      const checkType = (key: string, value: NeoType, propDef: PropDef) => {
        if (value.constructor !== propDef) {
          throw new Error("Type mismatch: "
            + `expected ${key} to be a ${(<Function>propDef).name} `
            + `but received a ${value.constructor.name}`);
        }
      };

      try {
        const _save = (err?: Error) => {
          if (err) { return fn(err); }

          // Check for required properties
          const missingProps = schema.requiredProps.filter(v => !this.hasOwnProperty(v));
          if (missingProps.length > 0) {
            throw new Error(`Missing required properties: ${missingProps}`);
          }

          // Save properties defined in the schema
          let propsString = "{";
          for (const key in schema.properties) if (this[key]) {
            // Validate fields
            const propDef = schema.properties[key];
            if (isSchemaTypeOpts(propDef)) {
              const opts = (<SchemaTypeOpts>propDef);
              checkType(key, this[key], opts.type);
              if (opts.uppercase) {
                this[key] = (<string>this[key]).toUpperCase();
              }
              if (opts.lowercase) {
                this[key] = (<string>this[key]).toLowerCase();
              }
              if (opts.enum && opts.enum.indexOf(this[key]) === -1) {
                throw new Error(`${this[key]} not in enum definition of ${key}`);
              }
              if (opts.match && !(<string>this[key]).match(opts.match)) {
                throw new Error(`${key} must match ${opts.match}`);
              }
            } else {
              checkType(key, this[key], propDef);
            }

            propsString += `${key}: ${value2Prop(this[key])}, `;
          }
          propsString = propsString.substr(0, propsString.length - 2) + " }";

          const query = `CREATE (n:${label} ${propsString}) RETURN n`;
          session.run(query).subscribe({
            onNext(record: Record) {
              // IDEA: Chain queries?
            },
            onCompleted(summary: ResultSummary) {
              console.log(summary);
              console.log("Succesfully created new node");
            },
            onError: fn
          });

          if (schema.afterHooks.has("save")) {
            schema.afterHooks.get("save").call(this);
          }
        };

        if (schema.preHooks.has("save")) {
          schema.preHooks.get("save").call(this, _save);
        } else {
          _save();
        }
        return this;
      } catch (e) {
        fn(e);
      }
    }
  };
};
