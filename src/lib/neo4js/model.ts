import { session } from ".";
import { Schema } from "./Schema";
import { isSchemaTypeOpts, toQueryProps, createProps } from "./util";
import { NeoRecord, ResultSummary, SchemaTypeOpts, Neo4jError, NodeProperties, FindCallback, PropDef, NeoType, ISchema, INode } from "neo4js";

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

      // this.schema = schema;
    }

    async save(fn: (err: Error) => void = defaultErrorHandler,
              next: (res: NeoRecord) => void = () => {}): Promise<this> {
      try {
        if (schema.preHooks.has("save")) {
          schema.preHooks.get("save").call(this, _save);
        } else {
          _save(label, schema, next, fn);
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
            next(undefined, new NeoNode(node.properties));
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
      session.run(query).subscribe({
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
            next(undefined, new NeoNode(node.properties));
          });
        },

        onError(err: Neo4jError) {
          next(err, undefined);
        }
      });
    }

    static async findOne(match: NodeProperties, next: FindCallback) {
      this.find(match, next, 1);
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

const _save = (label: String, schema: Schema,
  next: (res: NeoRecord) => void = () => {},
  fn: (err: Error) => void, err?: Error) => {
  if (err) { return fn(err); }

  // Check for required properties
  const missingProps = schema.requiredProps.filter(v => !this.hasOwnProperty(v));
  if (missingProps.length > 0) {
    throw new Error(`Missing required properties: ${missingProps}`);
  }

  // Save properties defined in the schema
  let propsString = "{ ";
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

    propsString += `${key}: ${JSON.stringify(this[key])}, `;
  }
  propsString = propsString.substr(0, propsString.length - 2) + " }";
  const query = `CREATE (n:${label} ${propsString}) RETURN n`;
  session.run(query).subscribe({
    onNext: next,
    onCompleted(summary: ResultSummary) {
      console.log("Succesfully created new node");
    },
    onError: fn
  });

  if (schema.afterHooks.has("save")) {
    schema.afterHooks.get("save").call(this);
  }
};
