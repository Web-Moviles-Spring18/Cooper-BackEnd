import { session } from ".";
import { Schema } from "./Schema";

const defaultErrorHandler = console.error;

const value2Prop = (value: NeoType) => (
  typeof value === "number" ? value : `'${value}'`
);

const isSchemaTypeOpts = (propDef: PropDef): propDef is SchemaTypeOpts => (
  (<SchemaTypeOpts>propDef).type !== undefined
);

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

  return class Node {
    [key: string]: any;
    constructor(properties: NodeProperties = undefined) {
      if (properties) {
        for (const key in properties) {
          this[key] = properties[key];
        }
      }
    }

    async save(fn: (err: Error) => void = defaultErrorHandler,
              next: (res: NeoRecord) => void = () => {}): Promise<this> {
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
          console.log(propsString);
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
