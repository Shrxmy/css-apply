type LogLevel = "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const MAX_VALUE_LENGTH = 96;
const SENSITIVE_KEY =
  /(authorization|cookie|email|password|secret|token|api.?key|student.?number|file.?path|signed.?url)/i;

function compactText(value: string) {
  const redacted = value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b[A-Z0-9_-]{40,}\b/gi, "[opaque-value]");
  const singleLine = redacted.replace(/\s+/g, " ").trim();
  return singleLine.length > MAX_VALUE_LENGTH
    ? `${singleLine.slice(0, MAX_VALUE_LENGTH - 1)}…`
    : singleLine;
}

function compactValue(key: string, value: unknown): string {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (value instanceof Error) return value.name || "Error";
  if (typeof value === "string") return compactText(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object") return "[summary omitted]";
  return compactText(String(value));
}

function errorSummary(error: unknown) {
  if (error instanceof Error) {
    const name = error.name || "Error";
    const message = compactText(error.message);
    return message && message !== name ? `${name}: ${message}` : name;
  }
  if (typeof error === "string") return `Error: ${compactText(error)}`;
  return "UnknownError";
}

function formatLine(
  level: LogLevel,
  scope: string,
  event: string,
  context?: LogContext,
  error?: unknown,
) {
  const marker = level === "error" ? "×" : level === "warn" ? "!" : "·";
  const details = Object.entries(context ?? {})
    .map(([key, value]) => `${key}=${compactValue(key, value)}`)
    .join("  ");
  const failure =
    error === undefined ? "" : `error=${errorSummary(error)}`;
  const suffix = [details, failure].filter(Boolean).join("  ");

  return `${marker} ${scope} · ${compactText(event)}${suffix ? ` | ${suffix}` : ""}`;
}

export function createLogger(scope: string) {
  const safeScope = compactText(scope) || "app";

  return {
    info(event: string, context?: LogContext) {
      if (
        process.env.NODE_ENV === "production" &&
        process.env.NEXT_PUBLIC_LOG_LEVEL !== "info"
      ) {
        return;
      }
      console.info(formatLine("info", safeScope, event, context));
    },
    warn(event: string, context?: LogContext) {
      console.warn(formatLine("warn", safeScope, event, context));
    },
    error(event: string, error?: unknown, context?: LogContext) {
      console.error(formatLine("error", safeScope, event, context, error));
    },
  };
}
