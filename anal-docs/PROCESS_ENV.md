# OpenClaw의 `process.env` 활용 정리

이 문서는 OpenClaw 코드베이스에서 `process.env`가 실제로 어떻게 사용되는지 정리합니다.

## 1) 로딩/우선순위

OpenClaw는 시작 시점에 환경 변수를 아래 흐름으로 반영합니다.

1. 프로세스가 이미 가진 환경 변수 (부모 셸/daemon)
2. 현재 작업 디렉터리의 `.env`
3. 전역 `.env` (`~/.openclaw/.env` 또는 `$OPENCLAW_STATE_DIR/.env`)
4. config 파일의 `env` 블록 (`openclaw.json`)
5. 선택적 login-shell env fallback (`env.shellEnv.enabled` 또는 `OPENCLAW_LOAD_SHELL_ENV=1`)

핵심 특징:

- 기존 값이 있으면 덮어쓰지 않는(non-overriding) 방식이 기본입니다.
- config의 `env`를 먼저 반영한 뒤 `${VAR}` 치환을 수행합니다.

관련 코드:

- `src/cli/run-main.ts`: `loadDotEnv()` 호출
- `src/infra/dotenv.ts`: CWD `.env` + 전역 `.env` 로드 (`override: false`)
- `src/config/io.ts`: `applyConfigEnv()` 후 `resolveConfigEnvVars()` 수행

## 2) config `env` 블록 사용

`openclaw.json`에서 두 방식 모두 지원합니다.

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-..."
    }
  }
}
```

동작:

- `env.vars`와 `env.<KEY>` 모두 수집해서 `process.env`에 반영
- 이미 `process.env[KEY]`가 있으면 유지

관련 코드:

- `src/config/env-vars.ts`
- `src/config/io.ts` (`applyConfigEnv`)

## 3) `${VAR}` 치환 규칙

config 문자열 값에서 `${VAR_NAME}` 문법을 지원합니다.

```json5
{
  models: {
    providers: {
      "vercel-gateway": {
        apiKey: "${VERCEL_GATEWAY_API_KEY}"
      }
    }
  }
}
```

규칙:

- 변수명 패턴: 대문자/숫자/언더스코어 (`[A-Z_][A-Z0-9_]*`)
- `$${VAR}`는 이스케이프되어 리터럴 `${VAR}`로 남음
- 참조한 env가 없거나 빈 문자열이면 `MissingEnvVarError` 발생

관련 코드:

- `src/config/env-substitution.ts`

## 4) Shell Env Fallback

옵션으로 login shell에서 env를 읽어와 누락된 키만 채웁니다.

- 활성화: `OPENCLAW_LOAD_SHELL_ENV=1` 또는 `env.shellEnv.enabled: true`
- 타임아웃: `OPENCLAW_SHELL_ENV_TIMEOUT_MS` 또는 `env.shellEnv.timeoutMs`

주의:

- 기대 키(expected keys) 중 하나라도 이미 존재하면 fallback 전체를 건너뜁니다.
- 이미 있는 키는 개별 반영 단계에서도 덮어쓰지 않습니다.

관련 코드:

- `src/infra/shell-env.ts`
- `src/config/io.ts` (`SHELL_ENV_EXPECTED_KEYS`, `loadShellEnvFallback`)

## 5) 채널/도구에서의 일반 패턴

실제 기능 코드에서는 대체로 다음 순서를 따릅니다.

- 계정별 config 값
- 전역 config 값(기본 계정)
- `process.env` fallback (대개 기본 계정만 허용)

예시:

- Telegram: `src/telegram/token.ts`
- Slack: `src/slack/accounts.ts`
- Discord: `src/discord/token.ts`
- Web Search API 키: `src/agents/tools/web-search.ts`

## 6) 기타 공통 처리

- 레거시 env alias 정규화: `Z_AI_API_KEY`가 있고 `ZAI_API_KEY`가 비어 있으면 복사
  - 코드: `src/infra/env.ts` (`normalizeZaiEnv`)
- 자식 프로세스 실행 시 env merge
  - 코드: `src/process/exec.ts` (`{ ...process.env, ...env }`)

## 7) 운영 시 권장 사용 방식

1. 민감값은 OS 환경 변수 또는 `.env`에 보관
2. config에는 가능하면 `${VAR}` 참조 형태 사용
3. daemon/서비스로 띄울 때는 서비스 환경 변수(launchd/systemd)도 명시적으로 설정
4. `env.shellEnv`는 “셸에만 키가 있고 서비스 환경에는 없는” 상황에서만 선택적으로 사용
