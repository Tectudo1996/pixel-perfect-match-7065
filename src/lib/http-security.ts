const PRIVATE_PATH_PREFIXES = [
  "/api/",
  "/auth",
  "/reset-password",
  "/dashboard",
  "/radar",
  "/meu-radar",
  "/inteligencia",
  "/favoritos",
  "/estudio",
  "/perfil",
  "/configuracoes",
  "/admin",
  "/onboarding",
  "/produto/",
];

export function applySecurityHeaders(request: Request, response: Response) {
  const headers = response.headers;

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );

  const pathname = new URL(request.url).pathname;
  const privateRoute = PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );

  if (privateRoute) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  if (pathname.startsWith("/api/")) {
    headers.set("Cache-Control", "no-store, max-age=0");
    appendVary(headers, "Authorization");
  }

  if (!headers.has("X-Request-Id")) {
    headers.set("X-Request-Id", crypto.randomUUID());
  }

  return response;
}

function appendVary(headers: Headers, value: string) {
  const current = headers.get("Vary");

  if (!current) {
    headers.set("Vary", value);
    return;
  }

  const values = current.split(",").map((item) => item.trim().toLowerCase());

  if (!values.includes(value.toLowerCase())) {
    headers.set("Vary", current + ", " + value);
  }
}
