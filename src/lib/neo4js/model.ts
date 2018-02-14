import { session } from ".";
import { Schema } from "./Schema";
import { isSchemaTypeOpts, toQueryProps, createProps } from "./util";
import { NeoRecord, ResultSummary, SchemaTypeOpts, Neo4jError, NodeProperties, FindCallback, PropDef, NeoType, ISchema, INode } from "neo4js";
import { NextFunction } from "express";

const defaultErrorHandler = console.error;

// Create a model to create new nodes
export const model = (label: string, schema: Schema) => {
  let canCreateConstraint = true;
  session.run("CALL db.constraints()").subscribe({
    onNext(record: NeoRecord) {
      canCreateConstraint = false;
    },

    onCompleted(summary: ResultSummary) {
      if (canCreateConstraint) {
        schema.uniqueProps.forEach(prop => {
          session.run(`CREATE CONSTRAINT ON (n:${label}) ASSERT n.${prop} IS UNIQUE`).subscribe({
            onCompleted(summary: ResultSummary) {
              console.log(`Succesfully created unique constraint for ${label}.${prop}`);
            }
          });
        });
      }
    }
  });

  // run indexing query
  if (schema.indexed) {
    const queryParams = schema.indexes.join(",");
    session.run(`CREATE INDEX ON :${label}(${queryParams})`).subscribe({
      onCompleted(summary: ResultSummary) {
        console.log(`Succesfully created index for label ${label}`);
      }
    });
  }

  return class NeoNode implements INode {
    [key: string]: NeoType | Function | ISchema;
    schema: ISchema;
    constructor(properties: NodeProperties = undefined) {
      if (properties) {
        for (const key in properties) {
          this[key] = properties[key];
        }
      }

      for (const functionName in schema.methods) {
        this[functionName] = schema.methods[functionName].bind(this);
      }
      // this.schema = schema;
    }

    // TODO: update if saving an existing node
    async save(fn: (err: Error) => void = defaultErrorHandler): Promise<this> {
      try {
        if (schema.preHooks.has("save")) {
          schema.preHooks.get("save").call(this, () => { _save(this, label, schema, fn); });
        } else {
          _save(this, label, schema, fn);
        }
        return this;
      } catch (e) {
        fn(e);
      }
    }

    static async findAll(next: FindCallback, limit?: number) {
      let query = `MATCH (n:${label}) RETURN n`;
      if (limit > 0) {
        query += ` LIMIT ${limit}`;
      }
      session.run(query).subscribe({
        onNext(record: NeoRecord) {
          record._fields.forEach((node: any) => {
            for (const prop in node.properties) {
              if (node.properties[prop].low) {
                node.properties[prop] = node.properties[prop].low;
              } else if (Array.isArray(node.properties[prop]) &&
                node.properties[prop][0].low) {
                node.properties[prop] =
                  node.properties[prop].map((intObj: {low: number, high: number}) => intObj.low);
              }
            }
            next(undefined, <INode>new NeoNode(node.properties));
          });
        },

        onError(err: Neo4jError) {
          next(err, undefined);
        }
      });
    }

    static async find(match: NodeProperties, next: FindCallback, limit?: number) {
      const matchString = toQueryProps(match);

      let query = `MATCH (n:${label} ${matchString === "{}" ? "" : matchString}) RETURN n`;
      if (limit > 0) {
        query += ` LIMIT ${limit}`;
      }
      let found = false;
      session.run(query).subscribe({
        onCompleted(asdasd: any) {
          if (!found) {
            next(undefined, undefined);
          }
        },

        onNext(record: NeoRecord) {
          record._fields.forEach((node: any) => {
            for (const prop in node.properties) {
              if (node.properties[prop].low) {
                node.properties[prop] = node.properties[prop].low;
              } else if (Array.isArray(node.properties[prop]) &&
                node.properties[prop].low) {
                node.properties[prop].map((intObj: {low: number, high: number}) => intObj.low);
              }
            }
            found = true;
            next(undefined, <INode>new NeoNode(node.properties));
          });
        },

        onError(err: Neo4jError) {
          console.error(err);
          next(err, undefined);
        }
      });
    }

    static async findOne(match: NodeProperties, next: FindCallback) {
      if (schema.preHooks.has("findOne")) {
        schema.preHooks.get("findOne").call(this, () => { this.find(match, next, 1); });
      } else {
        this.find(match, next, 1);
      }
      if (schema.afterHooks.has("findOne")) {
        schema.afterHooks.get("findOne").call(this, (err: Error) => {
          if (err) { console.error(err); }
        });
      }
    }

    static async remove(match: NodeProperties, next: Function) {
      const matchString = toQueryProps(match);
      if (matchString === "{}") {
        throw new Error("This would delete the whole User label, if you really want to please use drop()");
      }
      const query = `MATCH (n:${label} ${matchString}) DETACH DELETE n`;

      session.run(query).subscribe({
        onCompleted() { next(); },
        onError: next
      });
    }

    static async drop(next: Function) {
      const query = `MATCH (n:${label}) DETACH DELETE n`;

      session.run(query).subscribe({
        onCompleted() { next(); },
        onError: next
      });
    }
  };
};

const checkType = (key: string, value: NeoType, propDef: PropDef) => {
  if (value.constructor !== propDef) {
    throw new Error("Type mismatch: "
      + `expected ${key} to be ${(<Function>propDef).name} `
      + `but received ${value.constructor.name}`);
  }
};

const _save = (self: any, label: String, schema: Schema,
  fn: (err: Error) => void, err?: Error) => {
  if (err) { return fn(err); }

  // Check for required properties
  const missingProps = schema.requiredProps.filter(v => !self.hasOwnProperty(v));
  if (missingProps.length > 0) {
    throw new Error(`Missing required properties: ${missingProps}`);
  }

  // Save properties defined in the schema
  let propsString = "{ ";
  for (const key in schema.properties) if (self[key]) {
    // Validate fields
    const propDef = schema.properties[key];
    if (isSchemaTypeOpts(propDef)) {
      const opts = (<SchemaTypeOpts>propDef);
      checkType(key, self[key], opts.type);
      if (opts.uppercase) {
        self[key] = (<string>self[key]).toUpperCase();
      }
      if (opts.lowercase) {
        self[key] = (<string>self[key]).toLowerCase();
      }
      if (opts.enum && opts.enum.indexOf(self[key]) === -1) {
        throw new Error(`${self[key]} not in enum definition of ${key}`);
      }
      if (opts.match && !(<string>self[key]).match(opts.match)) {
        throw new Error(`${key} must match ${opts.match}`);
      }
    } else {
      checkType(key, self[key], propDef);
    }

    propsString += `${key}: ${JSON.stringify(self[key])}, `;
  }
  propsString = propsString.substr(0, propsString.length - 2) + " }";
  const query = `CREATE (n:${label} ${propsString}) RETURN n`;
  session.run(query).subscribe({
    onCompleted(summary: ResultSummary) {
      console.log("Succesfully created new node");
      fn(undefined);
    },
    onNext(record: NeoRecord) {
      if (process.env.NODE_ENV === "development") {
        console.log(record);
      }
    },
    onError: fn
  });

  if (schema.afterHooks.has("save")) {
    schema.afterHooks.get("save").call(self);
  }
};
