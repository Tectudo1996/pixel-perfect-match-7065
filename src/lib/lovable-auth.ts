import { createLovableAuth, type OAuthProvider } from "@lovable.dev/cloud-auth-js";
import { cloudClient } from "@/lib/cloud-client";

const lovableAuth = createLovableAuth();

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovableAuthClient = {
  signInWithOAuth: async (provider: OAuthProvider, options?: SignInOptions) => {
    const result = await lovableAuth.signInWithOAuth(provider, options);

    if (result.redirected || result.error) return result;

    try {
      await cloudClient.auth.setSession(result.tokens);
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
};