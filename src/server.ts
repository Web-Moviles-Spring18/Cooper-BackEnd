import * as errorHandler from "errorhandler";
import * as fs from "fs";
import * as https from "https";

const app = require("./app");

/**
 * Error Handler. Provides full stack - remove for production
 */
if (process.env.NODE_ENV !== "production") {
  app.use(errorHandler());
}

/**
 * Start Express server.
 */

if (process.env.NODE_ENV !== "production") {
  const server = app.listen(app.get("port"), () => {
    console.log(("  App is running at http://localhost:%d in %s mode"), app.get("port"), app.get("env"));
    console.log("  Press CTRL-C to stop\n");
  });
} else {
  const options = {
    key: fs.readFileSync(process.env.SSL_KEY || "keys/agent2-key.pem"),
    cert: fs.readFileSync(process.env.SSL_CERT || "keys/agent2-cert.crt")
  };
  https.createServer(options, app).listen(app.get("securePort"), 1, () => {
    console.log(("  App is running at https://localhost:%d in %s mode"), app.get("securePort"), app.get("env"));
    console.log("  Press CTRL-C to stop\n");
  });
}
