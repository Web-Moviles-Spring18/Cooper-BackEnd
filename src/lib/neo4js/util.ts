import { SchemaTypeOpts, PropDef, NeoProperties, NeoRecord, NeoType } from "neo4js";

export const isSchemaTypeOpts = (propDef: PropDef): propDef is SchemaTypeOpts => (
  (<SchemaTypeOpts>propDef).type !== undefined
);

export const checkType = (key: string, value: NeoType, propDef: PropDef) => {
  if (value.constructor !== propDef) {
    throw new Error("Type mismatch: "
      + `expected ${key} to be ${(<Function>propDef).name} `
      + `but received ${value.constructor.name}.`);
  }
};

// Stringify a json to neo4j properties.
export const toQueryProps = (object: NeoProperties) => {
  let propsString = "{ ";
  for (const prop in object) {
    propsString += ` ${prop}: ${JSON.stringify(object[prop])}, `;
  }
  if (propsString.length === 2) {
    return "{}";
  }
  return propsString.substr(0, propsString.length - 2) + " }";
};

// extract properties from a neo4j query result (record).
export const createProps = (record: NeoRecord): NeoProperties => {
  const props: NeoProperties = {};
  record.keys.forEach((key: string, i: number) => {
    props[key] = record._fields[i];
  });

  return props;
};

// Neo4j numeric values return in the form { low: number, high: number } for some reason
export const flatNumericProps = (props: { [key: string]: any }) => {
  for (const prop in props) {
    if (props[prop].low) {
      props[prop] = props[prop].low;
    } else if (Array.isArray(props[prop]) && props[prop].low) {
      props[prop].map((intObj: {low: number, high: number}) => intObj.low);
    }
  }
};

// export const isNestedProp = (propDef: PropDef): propDef is NestedProp => (
//   !isSchemaTypeOpts(propDef) && typeof propDef === "object"
// );
