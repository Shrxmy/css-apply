import "server-only";

const SUPPORTED_LANGUAGES = new Set(["javascript", "typescript", "python"]);
const MAX_SOURCE_LENGTH = 20_000;
const MAX_INPUT_LENGTH = 5_000;
const MAX_TIMEOUT_MS = 5_000;

export type CodeExecutionRequest = {
  language: "javascript" | "typescript" | "python";
  source: string;
  stdin?: string;
  timeoutMs?: number;
};

export type CodeExecutionResult = {
  status: "COMPLETED" | "TIMEOUT" | "RUNTIME_ERROR" | "SERVICE_ERROR";
  stdout: string;
  stderr: string;
  durationMs?: number;
};

/**
 * Calls an isolated execution service. Never evaluate applicant code in the
 * Next.js process. The endpoint must enforce container/network/filesystem
 * limits independently of this application-level validation.
 */
export async function executeTechDevCode(
  request: CodeExecutionRequest,
): Promise<CodeExecutionResult> {
  const endpoint = process.env.TECHDEV_CODE_EXECUTION_URL;
  const token = process.env.TECHDEV_CODE_EXECUTION_TOKEN;
  if (!endpoint || !token) {
    throw new Error("TechDev code execution service is not configured");
  }
  if (!SUPPORTED_LANGUAGES.has(request.language)) {
    throw new Error("Unsupported code language");
  }
  if (request.source.length > MAX_SOURCE_LENGTH) {
    throw new Error("Source code is too large");
  }
  if ((request.stdin || "").length > MAX_INPUT_LENGTH) {
    throw new Error("Program input is too large");
  }

  const timeoutMs = Math.min(Math.max(request.timeoutMs || 2_000, 250), MAX_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs + 2_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        language: request.language,
        source: request.source,
        stdin: request.stdin || "",
        timeoutMs,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return { status: "SERVICE_ERROR", stdout: "", stderr: "Execution service request failed" };
    }
    const data = (await response.json()) as Partial<CodeExecutionResult>;
    return {
      status:
        data.status === "COMPLETED" ||
        data.status === "TIMEOUT" ||
        data.status === "RUNTIME_ERROR"
          ? data.status
          : "SERVICE_ERROR",
      stdout: typeof data.stdout === "string" ? data.stdout.slice(0, MAX_OUTPUT_LENGTH) : "",
      stderr: typeof data.stderr === "string" ? data.stderr.slice(0, MAX_OUTPUT_LENGTH) : "",
      durationMs: typeof data.durationMs === "number" ? data.durationMs : undefined,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { status: "TIMEOUT", stdout: "", stderr: "Execution timed out" };
    }
    return { status: "SERVICE_ERROR", stdout: "", stderr: "Execution service unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

const MAX_OUTPUT_LENGTH = 20_000;
