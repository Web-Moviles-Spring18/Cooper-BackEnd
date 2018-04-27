const neo4j = require("neo4j-driver").v1;

type UriObject = {
  protocol: string;
  host: string;
  port: string | number;
};

export { Schema } from "./Schema";
export { model } from "./model";

export let session: any;
export function connect({protocol = "bolt", host = "localhost", dbPath = "", port = 7474}, {user = "neo4j", password = "neo4j"}) {
  session = neo4j.driver(
    `${protocol}://${host}:${port}/${dbPath}`,
    neo4j.auth.basic(user, password)
  ).session();
}
