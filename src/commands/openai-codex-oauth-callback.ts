import type { OAuthCredentials } from "@mariozechner/pi-ai";
import { writeOAuthCredentials } from "./onboard-auth.js";

const EXPIRES_BUFFER_MS = 5 * 60 * 1000;

export type OpenAICodexTokenExchangeResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export function parseOpenAICodexCallbackInput(
  input: string,
): { code: string; state?: string } | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: "No input provided" };
  }

  // Support "code#state" format shown by some browser flows.
  const hashIndex = trimmed.indexOf("#");
  if (hashIndex > 0) {
    const code = trimmed.slice(0, hashIndex).trim();
    const state = trimmed.slice(hashIndex + 1).trim();
    if (!code) {
      return { error: "Missing authorization code before '#'" };
    }
    return state ? { code, state } : { code };
  }

  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code")?.trim();
    const state = url.searchParams.get("state")?.trim() || undefined;
    if (!code) {
      return { error: "Missing 'code' parameter in URL" };
    }
    return { code, state };
  } catch {
    return { code: trimmed };
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split(".");
  if (segments.length !== 3 || !segments[1]) {
    return null;
  }
  try {
    const json = Buffer.from(segments[1], "base64url").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function extractOpenAICodexAccountId(accessToken: string): string | undefined {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) {
    return undefined;
  }
  const explicit =
    typeof payload.account_id === "string"
      ? payload.account_id
      : typeof payload.accountId === "string"
        ? payload.accountId
        : undefined;
  if (explicit?.trim()) {
    return explicit.trim();
  }
  const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
  return sub || undefined;
}

function coerceExpiresAt(expiresInSeconds: number, now: number): number {
  const value = now + Math.max(0, Math.floor(expiresInSeconds)) * 1000 - EXPIRES_BUFFER_MS;
  return Math.max(value, now + 30_000);
}

export function buildOpenAICodexOAuthCredentials(params: {
  tokenResponse: OpenAICodexTokenExchangeResponse;
  now?: number;
  email?: string;
  accountId?: string;
}): OAuthCredentials {
  const now = params.now ?? Date.now();
  const access = params.tokenResponse.access_token?.trim();
  const refresh = params.tokenResponse.refresh_token?.trim();
  const expiresIn = params.tokenResponse.expires_in;

  if (!access) {
    throw new Error("OpenAI token exchange returned no access_token");
  }
  if (!refresh) {
    throw new Error("OpenAI token exchange returned no refresh_token");
  }
  if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn)) {
    throw new Error("OpenAI token exchange returned no valid expires_in");
  }

  const accountId = params.accountId?.trim() || extractOpenAICodexAccountId(access);
  const email = params.email?.trim();

  return {
    access,
    refresh,
    expires: coerceExpiresAt(expiresIn, now),
    ...(accountId ? { accountId } : {}),
    ...(email ? { email } : {}),
  };
}

export async function storeOpenAICodexOAuthResponse(params: {
  tokenResponse: OpenAICodexTokenExchangeResponse;
  agentDir?: string;
  now?: number;
  email?: string;
  accountId?: string;
}): Promise<{ profileId: string; credentials: OAuthCredentials }> {
  const credentials = buildOpenAICodexOAuthCredentials({
    tokenResponse: params.tokenResponse,
    now: params.now,
    email: params.email,
    accountId: params.accountId,
  });
  await writeOAuthCredentials("openai-codex", credentials, params.agentDir);
  const profileLabel =
    typeof credentials.email === "string" && credentials.email.trim()
      ? credentials.email.trim()
      : "default";
  return {
    profileId: `openai-codex:${profileLabel}`,
    credentials,
  };
}
