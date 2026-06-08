type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, event: string, meta?: unknown) {
  const payload = {
    ts: new Date().toISOString(),
    service: "mcx",
    level,
    event,
    meta: meta ?? {},
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const mcxLogger = {
  info: (event: string, meta?: unknown) => write("info", event, meta),
  warn: (event: string, meta?: unknown) => write("warn", event, meta),
  error: (event: string, meta?: unknown) => write("error", event, meta),
};
