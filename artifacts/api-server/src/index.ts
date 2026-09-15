import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port);

server.once("listening", () => {
  logger.info({ port }, "Server listening");
});

server.once("error", (err: NodeJS.ErrnoException) => {
  const message =
    err.code === "EADDRINUSE"
      ? `Port ${port} is already in use. Stop the existing server before starting another one.`
      : "Error listening on port";

  logger.error({ err, port }, message);
  process.exitCode = 1;
});

const shutdown = (signal: NodeJS.Signals) => {
  logger.info({ signal }, "Shutting down server");

  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error while shutting down server");
      process.exitCode = 1;
    }

    process.exit();
  });
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
