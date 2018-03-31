import { session } from ".";
import { Schema } from "./Schema";
import { isSchemaTypeOpts, toQueryProps, createProps, checkType, flatNumericProps, isRegExp, toRegExQuery, isRelationTypeOpts } from "./util";
import { NeoRecord, ResultSummary, SchemaTypeOpts, Neo4jError, NeoProperties, FindCallback, PropDef, NeoType, ISchema, INode, Model, Relationship } from "neo4js";
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
      // Add uniqueProps to indexes after creating the constraints
      // since unique properties are inheritly single-property indexes.
      schema.indexes = schema.indexes.concat(schema.uniqueProps);
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

  // A class that represents the defined model
  // TODO: create our own _id property since it will be deprecated in Neo4j
  return class NeoNode implements INode {
    [key: string]: NeoType | Function | ISchema;
    _id?: number;
    label: string;

    constructor(properties: NeoProperties = undefined, uid?: number) {
      this.label = label;
      if (properties) {
        for (const key in properties) {
          this[key] = properties[key];
        }
      }

      // if an id already exists this node is already in the database.
      if (Number.isInteger(uid)) {
        this._id = uid;
      }

      // add functions to models
      for (const functionName in schema.methods) {
        this[functionName] = schema.methods[functionName].bind(this);
      }

      // Create relation function, build custom query and check for relation properties
      for (const relationName in schema.relations) {
        // Check for properties
        const properties = schema.relations[relationName].properties;
        const model = schema.relations[relationName].model;
        this[relationName] = async (other: NeoNode, props?: NeoProperties): Promise<void> => {
          if (!(other instanceof model)) {
            throw new Error(`Wrong node type: ${(<NeoNode>other).label} in relation ${relationName}.`);
          }

          // TODO: Check that properties meet propDef.
          // TODO: Put default properties defined in propDef.
          for (const propName in properties) {
            const propDef = properties[propName];
            props = props === undefined ? {} : props;
            if (isRelationTypeOpts(propDef)) {
              if (props[propName] === undefined) {
                props[propName] = propDef.default;
              }
              props[propName] = checkType(propName, props[propName], propDef.type);
            } else {
              props[propName] = checkType(propName, props[propName], propDef);
            }
          }
          const query = `MATCH (a:${label}), (b:${other.label}) ` +
          `WHERE ID(a) = ${this._id} AND ID(b) = ${other._id} ` +
          `CREATE (a)-[r:${relationName} ${toQueryProps(props)}]->(b) ` +
          `RETURN r`;
          session.run(query).subscribe({
            onCompleted() { },
            onNext() { },
            onError(err: Neo4jError) { throw err; }
          });
        };
      }
    }

    async save(fn: (err: Error) => void = defaultErrorHandler): Promise<this> {
      try {
        // execute pre and after hooks
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

    async updateRelationById(otherId: number, newProps: NeoProperties, next: NextFunction) {
      // TODO: check with relationTypeDef
      const query = `MATCH (n:${label})-[r]-(v) ` +
                  `WHERE ID(n) = ${this._id} AND ID(v) = ${otherId}` +
                  `SET r = ${toQueryProps(newProps)}`;

      session.run(query).subscribe({
        onCompleted(summary: ResultSummary) {
          console.log(summary);
        },
        onNext(record: NeoRecord) {
          console.log(record);
        },
        onError(err: Neo4jError) {
          console.error(err);
        }
      });
      next();
    }

    async updateRelation(match: NeoProperties, newProps: NeoProperties, next: NextFunction) {
      const query = `MATCH (n:${label})-[r]-(v ${toQueryProps(match)}) ` +
                  `WHERE ID(n) = ${this._id} ` +
                  `SET r = ${toQueryProps(newProps)}`;

      session.run(query).subscribe({
        onCompleted(summary: ResultSummary) {
          console.log(summary);
        },
        onNext(record: NeoRecord) {
          console.log(record);
        },
        onError(err: Neo4jError) {
          console.error(err);
        }
      });
      next();
    }

    // TODO: Pagination
    static async findAll(next: FindCallback, limit?: number): Promise<void> {
      let query = `MATCH (n:${label}) RETURN n`;
      if (limit > 0) {
        query += ` LIMIT ${limit}`;
      }
      session.run(query).subscribe({
        onCompleted() { },

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
            const uid = record._fields[0].identity.low;
            next(undefined, <INode>new NeoNode(node.properties, uid));
          });
        },

        onError(err: Neo4jError) {
          next(err, undefined);
        }
      });
    }

    static async findById(id: number, next: FindCallback) {
      const query = `MATCH (n) where ID(n) = ${id} RETURN n`;
      let found = false;
      session.run(query).subscribe({
        onCompleted() {
          if (!found) {
            next(undefined, undefined);
          }
        },

        onNext(record: NeoRecord) {
          // IDEA: Create an interface for a RawNode (the result in _fields)
          record._fields.forEach((node: any) => {
            flatNumericProps(node.properties);
            found = true;
            const uid = record._fields[0].identity.low;
            next(undefined, <INode>new NeoNode(node.properties, uid));
          });
        },

        onError(err: Neo4jError) {
          if (process.env.NODE_ENV === "development") {
            console.error(err);
          }
          next(err, undefined);
        }
      });
    }

    async getRelationWith(relName: String, otherModel: Model, otherId: number, direction: "any" | "in" | "out", next: (err: Neo4jError, res: Relationship) => void) {
      const relStr = direction === "out" ? `-[r:${relName}]->` :
                     direction === "in"  ? `<-[r:${relName}]-` :
                                            `-[r:${relName}]-`;
      const query = `MATCH (u:${label})${relStr}(v) ` +
                    `WHERE ID(u) = ${this._id} AND ID(v) = ${otherId} ` +
                    `RETURN r, v`;

      session.run(query).subscribe({
        onCompleted(sum: ResultSummary) { },

        onNext(response: NeoRecord) {
          const relation = response._fields[0].properties;
          const nodeFields = response._fields[1];
          nodeFields.properties._id = nodeFields.identity.low;
          flatNumericProps(nodeFields.properties);
          flatNumericProps(relation);
          const node = new otherModel(nodeFields.properties);
          next(undefined, { relation, node });
        },

        onError(err: Neo4jError) {
          next(err, undefined);
        }
      });
    }

    async getRelated(relName: String, otherModel: Model, direction: "any" | "in" | "out", next: (err: Neo4jError, res: Relationship[]) => void) {
      const relStr = direction === "out" ? `-[r:${relName}]->` :
                     direction === "in"  ? `<-[r:${relName}]-` :
                                            `-[r:${relName}]-`;
      const query = `MATCH (u:${label})${relStr}(v) WHERE ID(u) = ${this._id} RETURN r, v`;
      const pairs: Relationship[] = [];
      session.run(query).subscribe({
        onCompleted(sum: ResultSummary) {
          next(undefined, pairs);
        },

        onNext(response: NeoRecord) {
          const relation = response._fields[0].properties;
          const node = response._fields[1];
          node.properties._id = node.identity.low;
          flatNumericProps(node.properties);
          flatNumericProps(relation);
          pairs.push({ relation, node: new otherModel(node.properties) });
        },

        onError(err: Neo4jError) {
          next(err, undefined);
        }
      });
    }

    async hasRelation(relName: String, otherMatch: NeoProperties, next: (err: Neo4jError, res: boolean) => void) {
      const query = `MATCH (u:${label}), (v ${toQueryProps(otherMatch)}) ` +
      `WHERE ID(u) = ${this._id} ` +
      `RETURN EXISTS((u)-[:${relName}]-(v))`;

      session.run(query).subscribe({
        onCompleted(summary: ResultSummary) { },

        onNext(record: NeoRecord) {
          next(undefined, record._fields[0]);
        },

        onError(err: Neo4jError) {
          if (process.env.NODE_ENV === "development") {
            console.error(err);
          }
          next(err, undefined);
        }
      });
    }

    async hasRelationWith(name: String, other: NeoNode, direction: "any" | "in" | "out", next: (err: Neo4jError, res: boolean) => void) {
      const relStr = direction === "out" ? `-[:${name}]->` :
                     direction === "in"  ? `<-[:${name}]-` :
                                            `-[:${name}]-`;
      const query = `MATCH (u:${label}), (v:${other.label}) ` +
                    `WHERE ID(u) = ${this._id} AND ID(v) = ${other._id} ` +
                    `RETURN EXISTS((u)${relStr}(v))`;

      session.run(query).subscribe({
        onCompleted(summary: ResultSummary) { },

        onNext(record: NeoRecord) {
          next(undefined, record._fields[0]);
      },

        onError(err: Neo4jError) {
          if (process.env.NODE_ENV === "development") {
            console.error(err);
          }
          next(err, undefined);
        }
      });
    }

    static async findLike(like: { [key: string]: string }, match: NeoProperties, next: (err: Error, result: INode[]) => void, limit?: number, separator: "OR" | "AND" = "AND") {
      const where = toRegExQuery("n", like, separator);
      const matchString = toQueryProps(match);
      let query = `MATCH (n:${label} ${matchString === "{}" ? "" : matchString}) ${where} RETURN n`;
      if (limit > 0) {
        query += ` LIMIT ${limit}`;
      }
      const nodes: INode[] = [];
      let found = false;
      session.run(query).subscribe({
        onCompleted() {
          if (!found) {
            next(undefined, undefined);
          } else {
            next(undefined, nodes);
          }
        },

        onNext(record: NeoRecord) {
          record._fields.forEach((node: any) => {
            flatNumericProps(node.properties);
            const uid = record._fields[0].identity.low;
            found = true;
            nodes.push(<INode>new NeoNode(node.properties, uid));
          });
        },

        onError(err: Neo4jError) {
          if (process.env.NODE_ENV === "development") {
            console.error(err);
          }
          next(err, undefined);
        }
      });
    }

    static async find(match: NeoProperties, next: (err: Error, result: INode[]) => void, limit?: number) {
      const matchString = toQueryProps(match);

      let query = `MATCH (n:${label} ${matchString === "{}" ? "" : matchString}) RETURN n`;
      if (limit > 0) {
        query += ` LIMIT ${limit}`;
      }
      let found = false;
      const nodes: INode[] = [];
      session.run(query).subscribe({
        onCompleted() {
          if (!found) {
            next(undefined, undefined);
          } else {
            next(undefined, nodes);
          }
        },

        onNext(record: NeoRecord) {
          record._fields.forEach((node: any) => {
            flatNumericProps(node.properties);
            const uid = record._fields[0].identity.low;
            found = true;
            nodes.push(<INode>new NeoNode(node.properties, uid));
          });
        },

        onError(err: Neo4jError) {
          if (process.env.NODE_ENV === "development") {
            console.error(err);
          }
          next(err, undefined);
        }
      });
    }

    static async findOne(match: NeoProperties, next: FindCallback) {
      const _findOne = (match: NeoProperties, next: FindCallback) => {
        const matchString = toQueryProps(match);

        const query = `MATCH (n:${label} ${matchString === "{}" ? "" : matchString}) RETURN n LIMIT 1`;
        let found = false;
        session.run(query).subscribe({
          onCompleted() {
            if (!found) {
              next(undefined, undefined);
            }
          },

          onNext(record: NeoRecord) {
            record._fields.forEach((node: any) => {
              flatNumericProps(node.properties);
              const uid = record._fields[0].identity.low;
              found = true;
              next(undefined, <INode>new NeoNode(node.properties, uid));
            });
          },

          onError(err: Neo4jError) {
            if (process.env.NODE_ENV === "development") {
              console.error(err);
            }
            next(err, undefined);
          }
        });
      };

      if (schema.preHooks.has("findOne")) {
        _findOne(match, (err, node) => {
          if (err) { return next(err, node); }
          schema.preHooks.get("findOne").call(node, () => next(err, node));
          if (schema.afterHooks.has("findOne")) {
            schema.afterHooks.get("findOne").call(node, (err: Error) => {
              if (err) { console.error(err); }
            });
          }
        });
      } else {
        _findOne(match, (err, node) => {
          next(err, node);
          if (schema.afterHooks.has("findOne")) {
            schema.afterHooks.get("findOne").call(node, (err: Error) => {
              if (err) { console.error(err); }
            });
          }
        });
      }
    }

    async removeRelation(name: string, other: NeoNode, next: Function) {
      const query = `MATCH (u:${label})-[r:${name}]-(v:${other.label}) ` +
                    `WHERE ID(u) = ${this._id} AND ID(v) = ${other._id} ` +
                    `DELETE r`;
      session.run(query).subscribe({
        onCompleted() { next(); },
        onNext() { },
        onError: next
      });
    }

    static async remove(match: NeoProperties, next: Function) {
      const matchString = toQueryProps(match);
      if (matchString === "{}") {
        throw new Error("This would delete the whole User label, " +
          "if you really want to, use drop()");
      }
      const query = `MATCH (n:${label} ${matchString}) DETACH DELETE n`;

      session.run(query).subscribe({
        onCompleted() { next(); },
        onNext() { },
        onError: next
      });
    }

    static async drop(next: Function) {
      const query = `MATCH (n:${label}) DETACH DELETE n`;

      session.run(query).subscribe({
        onCompleted() { next(); },
        onNext() { },
        onError: next
      });
    }
  };
};

const _save = (self: INode, label: String, schema: Schema,
  fn: (err: Error) => void, err?: Error) => {
  if (err) { return fn(err); }

  // Check for required properties
  const missingProps = schema.requiredProps.filter(v => !self.hasOwnProperty(v));
  if (missingProps.length > 0) {
    throw new Error(`Missing required properties: ${missingProps}.`);
  }

  // Save properties defined in the schema
  let propsString = "{ ";
  for (const key in schema.properties) if (self.hasOwnProperty(key)) {
    // Validate fields
    const propDef = schema.properties[key];
    const value = (<NeoType>self[key]);
    if (isSchemaTypeOpts(propDef)) {
      const opts = (<SchemaTypeOpts>propDef);
      self[key] = checkType(key, value, opts.type);
      if (opts.uppercase) {
        self[key] = (<string>self[key]).toUpperCase();
      } else if (opts.lowercase) {
        self[key] = (<string>self[key]).toLowerCase();
      }
      if (opts.enum && opts.enum.indexOf(value) === -1) {
        throw new Error(`${self[key]} not in enum definition of ${key}.`);
      }
      if (opts.match && !(<string>self[key]).match(opts.match)) {
        throw new Error(`${key} must match ${opts.match}.`);
      }
    } else {
      checkType(key, value, propDef);
    }

    propsString += `${key}: ${JSON.stringify(self[key])}, `;
  }
  propsString = propsString.substr(0, propsString.length - 2) + " }";
  let query: string, msg: string;

  // If the id exists, then the node already exists in Neo4j
  if (!self._id) {
    query = `CREATE (n:${label} ${propsString}) RETURN n`;
    msg = "Succesfully created new node.";
  } else {
    query = `MATCH (n:${label}) WHERE ID(n) = ${self._id} SET n = ${propsString} RETURN n`;
    msg = "Succesfully updated new node.";
  }
  session.run(query).subscribe({
    onCompleted(summary: ResultSummary) {
      console.info(msg);
      fn(undefined);
    },
    onNext(record: NeoRecord) {
      self._id = record._fields[0].identity.low;
      console.log(self._id);
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
