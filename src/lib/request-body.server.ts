export class RequestBodyError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function readJsonBody(request: Request, maxBytes: number) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("application/json")) {
    throw new RequestBodyError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Envie o corpo da requisição como application/json.",
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyError(413, "PAYLOAD_TOO_LARGE", "O corpo da requisição excede o limite.");
  }

  const text = await request.text();
  const size = new TextEncoder().encode(text).byteLength;

  if (size > maxBytes) {
    throw new RequestBodyError(413, "PAYLOAD_TOO_LARGE", "O corpo da requisição excede o limite.");
  }

  if (!text.trim()) {
    throw new RequestBodyError(400, "EMPTY_BODY", "O corpo da requisição está vazio.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RequestBodyError(
      400,
      "INVALID_JSON",
      "O corpo da requisição não contém JSON válido.",
    );
  }
}
