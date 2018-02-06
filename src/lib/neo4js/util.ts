import { SchemaTypeOpts, PropDef, NodeProperties, NeoRecord } from "neo4js";

export const isSchemaTypeOpts = (propDef: PropDef): propDef is SchemaTypeOpts => (
  (<SchemaTypeOpts>propDef).type !== undefined
);

export const toQueryProps = (object: NodeProperties) => {
  let propsString = "{ ";
  for (const prop in object) {
    propsString += ` ${prop}: ${JSON.stringify(object[prop])}, `;
  }
  return propsString.substr(0, propsString.length - 2) + " }";
};

export const createProps = (record: NeoRecord): NodeProperties => {
  const props: NodeProperties = {};
  record.keys.forEach((key: string, i: number) => {
    props[key] = record._fields[i];
  });

  return props;
};

// export const isNestedProp = (propDef: PropDef): propDef is NestedProp => (
//   !isSchemaTypeOpts(propDef) && typeof propDef === "object"
// );
