import * as errorHandler from "errorhandler";
import * as fs from "fs";
import * as https from "https";

const app = require("./app");
const options = {
  key: fs.readFileSync("keys/agent2-key.pem"),
  cert: fs.readFileSync("keys/agent2-cert.crt")
};

/**
 * Error Handler. Provides full stack - remove for production
 */
if (process.env.NODE_ENV !== "production") {
  app.use(errorHandler());
}

/**
 * Start Express server.
 */

const server = app.listen(app.get("port"), () => {
  console.log(("  App is running at http://localhost:%d in %s mode"), app.get("port"), app.get("env"));
  console.log("  Press CTRL-C to stop\n");
});

export = https.createServer(options, app).listen(app.get("securePort"), 1, () => {
  console.log(("  App is running at https://localhost:%d in %s mode"), app.get("securePort"), app.get("env"));
  console.log("  Press CTRL-C to stop\n");
});
