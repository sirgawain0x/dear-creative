type XErrorBody = {
  errors?: Array<{ message?: string; code?: number; title?: string }>;
  title?: string;
  detail?: string;
  message?: string;
};

export async function formatXApiFailure(
  response: Response,
): Promise<string> {
  let body: XErrorBody | undefined;
  try {
    body = (await response.json()) as XErrorBody;
  } catch {
    return `X API HTTP ${response.status}`;
  }

  const firstError = body.errors?.[0];
  if (response.status === 429) {
    const reset = response.headers.get("x-rate-limit-reset");
    const base =
      firstError?.message ??
      body.message ??
      "Rate limit exceeded (HTTP 429)";
    if (reset) {
      return `${base}; x-rate-limit-reset=${reset}`;
    }
    return base;
  }

  if (firstError?.message) {
    return firstError.message;
  }
  if (body.detail) {
    return body.title ? `${body.title}: ${body.detail}` : body.detail;
  }
  if (body.message) {
    return body.message;
  }
  return `X API HTTP ${response.status}`;
}
