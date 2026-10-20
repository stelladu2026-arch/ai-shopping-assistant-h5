/** Covers the entire operation, including reading the response body. No retries. */
export async function withDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("Request timed out");
      error.name = "TimeoutError";
      reject(error);
      controller.abort(error);
    }, Math.max(1, timeoutMs));
  });
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), expired]);
  } finally {
    clearTimeout(timer);
  }
}

export const REQUEST_TIMEOUT_MESSAGE = "等待超过时限，已结束本次等待。未自动重试；如涉及生图，请先核对结果和用量再决定是否重新生成。";

export function requestErrorMessage(error: unknown): string {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
    ? REQUEST_TIMEOUT_MESSAGE
    : "请求未完成，请检查本地服务和网络连接后再试。";
}

export async function fetchJsonResponse<T = any>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 60000,
  fetcher: typeof fetch = fetch,
): Promise<{ response: Response; payload: T }> {
  return withDeadline(async (signal) => {
    const response = await fetcher(url, { ...init, signal });
    const payload = await response.json() as T;
    return { response, payload };
  }, timeoutMs);
}
