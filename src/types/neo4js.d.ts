type Neo4jError = Error & {
  code: string,
  name: string
};

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
type NeoRecord = {
  keys: [string];
  length: number;
  _fields: [ any ];
  _fieldLookup: { [key: string]: number };
};

// query metadata, passed to onCompleted
type ResultSummary = {
  statement: { text: string, paramenters: { [key: string]: NeoType } },
  statementType: "r" | "w" | "rw"
  counters: any // TODO: Write complete ResultSummary interface (useful for auto completition)
};
