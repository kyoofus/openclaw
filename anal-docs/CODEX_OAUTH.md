# OpenClaw Codex OAuth 처리 방식

이 문서는 OpenClaw에서 OpenAI Codex OAuth를 어떻게 처리하는지, 저장소의 소스 코드와 공식 문서를 기준으로 정리한 내용입니다.

## 1) 로그인 시작 경로

OpenClaw에서 Codex OAuth는 다음 커맨드로 시작합니다.

```bash
openclaw onboard --auth-choice openai-codex
openclaw models auth login --provider openai-codex
```

근거:
- `docs/providers/openai.md:45`
- `docs/providers/openai.md:48`

## 2) OAuth 플로우 실행 방식

온보딩 처리에서 `loginOpenAICodex`를 호출해 OpenAI Codex OAuth를 수행합니다.

- 로컬 환경: 브라우저 오픈
- 원격/VPS 환경: URL 출력 후 redirect URL/authorization code 수동 입력

근거:
- `src/commands/auth-choice.apply.openai.ts:154`
- `src/commands/auth-choice.apply.openai.ts:145`
- `src/commands/oauth-flow.ts:21`

## 3) 인증 프로토콜 (문서 기준)

문서에서는 Codex OAuth를 PKCE 플로우로 설명합니다.

1. verifier/challenge + state 생성
2. `https://auth.openai.com/oauth/authorize?...` 오픈
3. `http://127.0.0.1:1455/auth/callback` 콜백 수신 시도
4. 실패 시 redirect URL/code 수동 입력
5. `https://auth.openai.com/oauth/token`에서 토큰 교환
6. `{ access, refresh, expires, accountId }` 저장

근거:
- `docs/concepts/oauth.md:88`
- `docs/concepts/oauth.md:91`
- `docs/concepts/oauth.md:94`
- `docs/concepts/oauth.md:95`

## 4) 저장 구조

획득한 OAuth 자격증명은 `auth-profiles.json`에 `type: "oauth"`로 저장됩니다.

- profileId 규칙: `${provider}:${email}`
- email이 없으면 `default`

근거:
- `src/commands/onboard-auth.credentials.ts:9`
- `src/commands/onboard-auth.credentials.ts:19`

Auth profile 저장 경로 해석:
- `src/agents/auth-profiles/paths.ts:9`
- `docs/concepts/oauth.md:43`

## 5) 런타임 사용 및 자동 갱신

런타임에서 OAuth credential을 사용할 때:

- `expires`가 미래면 access token 그대로 사용
- 만료면 파일 락 후 refresh 수행
- 갱신 결과를 `auth-profiles.json`에 다시 저장

근거:
- `src/agents/auth-profiles/oauth.ts:36`
- `src/agents/auth-profiles/oauth.ts:55`
- `src/agents/auth-profiles/oauth.ts:84`
- `src/agents/auth-profiles/oauth.ts:94`

## 6) Codex CLI 재사용 경로 상태

문서에는 Codex CLI 재사용(`~/.codex/auth.json`) 안내가 남아 있습니다.

근거:
- `docs/start/wizard-cli-reference.md:132`

다만 코드 기준 현재 상태는:

- `codex-cli` auth choice는 deprecated 처리
- `openai-codex:codex-cli` 프로필은 deprecated 대상으로 정리 유도

근거:
- `src/commands/onboard.ts:35`
- `src/agents/auth-profiles/constants.ts:8`
- `src/commands/doctor-auth.ts:145`

## 결론

현재 OpenClaw의 표준 Codex 인증 경로는 `openai-codex` OAuth 로그인이며,
토큰은 agent별 `auth-profiles.json`을 중심으로 관리되고, 만료 시 자동 refresh가 동작합니다.


## codex login cli를 직접 사용하는가요?

기본/권장 경로로는 **직접 `codex login` CLI를 사용하지 않습니다**.

- OpenClaw는 자체 명령(`openclaw ... --auth-choice openai-codex`, `openclaw models auth login --provider openai-codex`)에서 OAuth를 실행합니다.
- 과거 `codex-cli` 선택지는 코드에서 deprecated 처리되어 있습니다 (`src/commands/onboard.ts:35`).
- 문서에 `~/.codex/auth.json` 재사용 언급은 남아 있지만, 현재 코드 흐름 기준 표준은 OpenClaw 내부 OAuth 경로입니다.


## http://127.0.0.1:1455/auth/callback  에서  OpenAI의 응답을 어떻게 처리하는지 무엇을 저장하는지 알려주세요.



`http://127.0.0.1:1455/auth/callback` 응답 처리는 OpenClaw 코드에서 직접 파싱하기보다, `@mariozechner/pi-ai`의 `loginOpenAICodex(...)`에 위임됩니다.

핵심 동작은 이렇게 확인됩니다.

1. OpenClaw가 하는 일 (콜백 처리 전후)
- `loginOpenAICodex` 호출: `src/commands/auth-choice.apply.openai.ts:154`
- OAuth URL 표시/브라우저 열기 처리: `src/commands/oauth-flow.ts:24`
- 콜백 자동 수신이 안 되면 redirect URL/code를 사용자에게 붙여넣게 함: `src/commands/oauth-flow.ts:21`, `src/commands/oauth-flow.ts:40`

2. 콜백 URL에서 OpenAI 응답을 어떻게 처리하나
- 문서 기준 플로우: authorize -> `127.0.0.1:1455/auth/callback` 캡처 -> token 교환  
  `docs/concepts/oauth.md:91`, `docs/concepts/oauth.md:92`, `docs/concepts/oauth.md:94`
- OpenClaw 저장소에는 콜백 파싱/토큰 교환의 세부 구현 함수가 없고(의존 라이브러리 내부), OpenClaw는 결과 `creds`를 받아 저장합니다.

3. 무엇을 저장하나
- 문서 명시: `{ access, refresh, expires, accountId }` 저장  
  `docs/concepts/oauth.md:95`
- 실제 저장 코드: `writeOAuthCredentials("openai-codex", creds, ...)`  
  `src/commands/auth-choice.apply.openai.ts:161`
- 저장 형식: `type: "oauth"`, `provider`, 그리고 `...creds` 전체  
  `src/commands/onboard-auth.credentials.ts:19`
- 프로필 ID: `openai-codex:<email>` (email 없으면 `default`)  
  `src/commands/onboard-auth.credentials.ts:14`
- 저장 파일: agent별 `auth-profiles.json`  
  경로 해석 코드 `src/agents/auth-profiles/paths.ts:9`, 문서 `docs/concepts/oauth.md:43`

추가로, 설정에도 `openai-codex:default`를 OAuth 프로필로 연결합니다 (`src/commands/auth-choice.apply.openai.ts:163`).

## auth-profiles.json

```json
{
  "version": 1,
  "profiles": {
    "openai-codex:default": {
      "type": "oauth",
      "provider": "openai-codex",
      "access": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE5MzQ0ZTY1LWJiYzktNDRkMS1hOWQwLWY5N3TnN6dJaWeRyVasrbtVOKpB8RdnkZUUsiC85cQ6jgLZ6PyTjI4WV2U",
      "refresh": "rt_vYPD9cRaAfU5tvmTuf6DNsr4oorJo5XO9HFZtp2LToY.XW25GjzFAUCUwGozP5WYke730kPIVBCLlOf1gzL4f8I",
      "expires": 1771026496048,
      "accountId": "3b477772-1d10-4b0a-adc6-d393fcafbbc5"
    }
  },
  "lastGood": {
    "openai-codex": "openai-codex:default"
  },
  "usageStats": {
    "openai-codex:default": {
      "lastUsed": 1770694114001,
      "errorCount": 0
    }
  }
}

```


## 인증 응답 콜백 처리

```typescript
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

````
