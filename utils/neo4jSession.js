const host = process.env.HOST || 'localhost';
const port = normalizePort(process.env.PORT || '3001');
const dbPort = process.env.DB_PORT || '27017';
const nodeEnv = process.env.NODE_ENV || 'development';
const dbUri = `bolt://${host}:${dbPort}/cooper_${nodeEnv}`;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;

const neo4j = require('neo4j-driver').v1;

module.exports = neo4j.driver(
  dbUri,
  neo4j.auth.basic(dbUser, dbPassword)
).session();
