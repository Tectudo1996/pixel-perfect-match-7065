import { supabaseAdmin } from "@/integrations/supabase/client.server";

export class ApiAuthError extends Error {
  readonly status = 401;
  readonly code = "AUTH_REQUIRED";

  constructor(message = "Sua sessão expirou. Entre novamente.") {
    super(message);
  }
}

export async function requireApiUserId(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiAuthError("Entre novamente para continuar.");
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw new ApiAuthError("Entre novamente para continuar.");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new ApiAuthError();
  }

  return data.user.id;
}
