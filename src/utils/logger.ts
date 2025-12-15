import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import pino from "pino";
import { LOG_DIR } from "../config";

// logs dir
const logDir: string = join(__dirname, LOG_DIR || "../logs");

if (!existsSync(logDir)) {
  mkdirSync(logDir);
}

// Create separate log directories
const debugLogDir = join(logDir, "debug");
const errorLogDir = join(logDir, "error");

if (!existsSync(debugLogDir)) {
  mkdirSync(debugLogDir, { recursive: true });
}

if (!existsSync(errorLogDir)) {
  mkdirSync(errorLogDir, { recursive: true });
}

// Get current date for log filename
const getCurrentDate = () => new Date().toISOString().split("T")[0];

// Pino configuration
const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: {
    targets: [
      // Console transport with pretty printing
      {
        target: "pino-pretty",
        level: "debug",
        options: {
          colorize: true,
          translateTime: "yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
          singleLine: false,
        },
      },
      // Debug log file - logs everything (debug and above)
      {
        target: "pino/file",
        level: "debug",
        options: {
          destination: join(debugLogDir, `${getCurrentDate()}.log`),
          mkdir: true,
        },
      },
      // Error log file - logs only errors
      {
        target: "pino/file",
        level: "error",
        options: {
          destination: join(errorLogDir, `${getCurrentDate()}.log`),
          mkdir: true,
        },
      },
    ],
  },
});

// Stream for Morgan or other HTTP loggers
const stream = {
  write: (message: string) => {
    logger.info(message.substring(0, message.lastIndexOf("\n")));
  },
};

export { logger, stream };
