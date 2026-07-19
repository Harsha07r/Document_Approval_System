interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    issues?: readonly string[];
  };
}

/**
 * Mirrors the shape produced by `toHttpResponse` on the server, so every
 * failed request surfaces the same `status`/`code`/`message`/`issues`
 * regardless of which endpoint threw it. Components branch on `status`
 * (409 -> conflict dialog, 422 -> validation toast, anything else -> a
 * generic error toast) instead of re-parsing the response body themselves.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: readonly string[];

  constructor(status: number, code: string, message: string, issues?: readonly string[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body: unknown = contentType.includes("application/json") ? await response.json() : undefined;

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | undefined;
    throw new ApiError(
      response.status,
      errorBody?.error.code ?? "UNKNOWN_ERROR",
      errorBody?.error.message ?? "The request failed.",
      errorBody?.error.issues,
    );
  }

  return body as T;
}
