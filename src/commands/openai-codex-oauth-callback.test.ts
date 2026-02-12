import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildOpenAICodexOAuthCredentials,
  extractOpenAICodexAccountId,
  parseOpenAICodexCallbackInput,
  storeOpenAICodexOAuthResponse,
} from "./openai-codex-oauth-callback.js";

const toBase64Url = (value: string) => Buffer.from(value, "utf8").toString("base64url");

const createJwt = (payload: Record<string, unknown>) => {
  const header = toBase64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  return `${header}.${body}.sig`;
};

describe("parseOpenAICodexCallbackInput", () => {
  it("parses full callback URL", () => {
    expect(
      parseOpenAICodexCallbackInput(
        "http://127.0.0.1:1455/auth/callback?code=abc123&state=state987",
      ),
    ).toEqual({ code: "abc123", state: "state987" });
  });

  it("parses code#state", () => {
    expect(parseOpenAICodexCallbackInput("abc123#state987")).toEqual({
      code: "abc123",
      state: "state987",
    });
  });

  it("parses raw code", () => {
    expect(parseOpenAICodexCallbackInput("abc123")).toEqual({ code: "abc123" });
  });

  it("errors when URL is missing code", () => {
    expect(parseOpenAICodexCallbackInput("http://127.0.0.1:1455/auth/callback?state=s")).toEqual({
      error: "Missing 'code' parameter in URL",
    });
  });
});

describe("extractOpenAICodexAccountId", () => {
  it("extracts account_id from jwt payload", () => {
    const token = createJwt({ account_id: "acct_123" });
    expect(extractOpenAICodexAccountId(token)).toBe("acct_123");
  });

  it("falls back to sub", () => {
    const token = createJwt({ sub: "user_1" });
    expect(extractOpenAICodexAccountId(token)).toBe("user_1");
  });
});

describe("storeOpenAICodexOAuthResponse", () => {
  const previousStateDir = process.env.OPENCLAW_STATE_DIR;
  const previousAgentDir = process.env.OPENCLAW_AGENT_DIR;
  const previousPiAgentDir = process.env.PI_CODING_AGENT_DIR;
  let tempStateDir: string | null = null;

  afterEach(async () => {
    if (tempStateDir) {
      await fs.rm(tempStateDir, { recursive: true, force: true });
      tempStateDir = null;
    }
    if (previousStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
    if (previousAgentDir === undefined) {
      delete process.env.OPENCLAW_AGENT_DIR;
    } else {
      process.env.OPENCLAW_AGENT_DIR = previousAgentDir;
    }
    if (previousPiAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousPiAgentDir;
    }
  });

  it("builds credentials and persists them into auth-profiles", async () => {
    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-codex-callback-"));
    const agentDir = path.join(tempStateDir, "agent");
    process.env.OPENCLAW_STATE_DIR = tempStateDir;
    process.env.OPENCLAW_AGENT_DIR = agentDir;
    process.env.PI_CODING_AGENT_DIR = agentDir;

    const token = createJwt({ account_id: "acct_777" });
    const now = 1_000_000;
    const built = buildOpenAICodexOAuthCredentials({
      tokenResponse: {
        access_token: token,
        refresh_token: "refresh_1",
        expires_in: 3600,
      },
      now,
    });
    expect(built.accountId).toBe("acct_777");
    expect(built.expires).toBe(now + 3600 * 1000 - 5 * 60 * 1000);

    const stored = await storeOpenAICodexOAuthResponse({
      tokenResponse: {
        access_token: token,
        refresh_token: "refresh_1",
        expires_in: 3600,
      },
      now,
      agentDir,
    });
    expect(stored.profileId).toBe("openai-codex:default");

    const raw = await fs.readFile(path.join(agentDir, "auth-profiles.json"), "utf8");
    const parsed = JSON.parse(raw) as {
      profiles?: Record<
        string,
        {
          type?: string;
          provider?: string;
          access?: string;
          refresh?: string;
          accountId?: string;
          expires?: number;
        }
      >;
    };

    expect(parsed.profiles?.["openai-codex:default"]).toMatchObject({
      type: "oauth",
      provider: "openai-codex",
      access: token,
      refresh: "refresh_1",
      accountId: "acct_777",
      expires: now + 3600 * 1000 - 5 * 60 * 1000,
    });
  });
});
