# Keyword Logger Hook (kyofe-hook)

모든 명령어 이벤트에서 특정 키워드(장애, 오류 등)를 감지하여 로그를 남기는 OpenClaw 커스텀 훅입니다.

## 프로젝트 구조

```
kyofe-hook/
├── HOOK.md          # 훅 메타데이터 및 문서
├── handler.ts       # 핸들러 구현
├── package.json     # 패키지 정보
└── README.md        # 이 파일
```

## 프로젝트 생성 방법

### 1. 훅 디렉토리 생성

```bash
# Managed hooks 위치에 생성 (모든 워크스페이스에서 공유)
mkdir -p ~/.openclaw/hooks/my-hook
cd ~/.openclaw/hooks/my-hook

# 또는 Workspace hooks 위치에 생성 (특정 에이전트 전용)
mkdir -p <workspace>/hooks/my-hook
cd <workspace>/hooks/my-hook
```

### 2. HOOK.md 생성

```yaml
---
name: my-hook
description: "훅에 대한 간단한 설명"
homepage: https://docs.openclaw.ai/hooks
metadata: { "openclaw": { "emoji": "🎯", "events": ["command:new"], "requires": {} } }
---
# My Hook

훅에 대한 상세 문서를 여기에 작성합니다.
```

### 3. handler.ts 생성

```typescript
import type { HookHandler } from "../../src/hooks/hooks.js";

const handler: HookHandler = async (event) => {
  // 원하는 이벤트만 필터링
  if (event.type !== "command" || event.action !== "new") {
    return;
  }

  console.log("[my-hook] 훅이 실행됨!");
  // 커스텀 로직 구현
};

export default handler;
```

### 4. package.json 생성 (선택사항)

```json
{
  "name": "my-hook",
  "version": "0.0.1",
  "type": "module",
  "dependencies": {}
}
```

## 빌드 방법

### 의존성 설치

```bash
npm install
```

### TypeScript 타입 정의 설치 (Node.js 모듈 사용 시)

```bash
npm install --save-dev @types/node
```

### 훅 등록 및 활성화

```bash
# 훅 목록 확인
openclaw hooks list

# 훅 활성화
openclaw hooks enable keyword-logger

# 훅 상태 확인
openclaw hooks check

# 훅 상세 정보 확인
openclaw hooks info keyword-logger
```

## Handler 구현 방법

### 이벤트 타입

```typescript
interface HookEvent {
  type: "command" | "session" | "agent" | "gateway";
  action: string; // 예: 'new', 'reset', 'stop'
  sessionKey: string; // 세션 식별자
  timestamp: Date; // 이벤트 발생 시각
  messages: string[]; // 사용자에게 보낼 메시지를 push
  context: {
    sessionEntry?: SessionEntry;
    sessionId?: string;
    sessionFile?: string;
    commandSource?: string; // 예: 'whatsapp', 'telegram'
    senderId?: string;
    workspaceDir?: string;
    cfg?: OpenClawConfig;
  };
}
```

### 지원하는 이벤트

| 이벤트            | 설명                                 |
| ----------------- | ------------------------------------ |
| `command`         | 모든 명령어 이벤트                   |
| `command:new`     | `/new` 명령어 발행 시                |
| `command:reset`   | `/reset` 명령어 발행 시              |
| `command:stop`    | `/stop` 명령어 발행 시               |
| `agent:bootstrap` | 워크스페이스 부트스트랩 파일 주입 전 |
| `gateway:startup` | 게이트웨이 시작 후                   |

### 핸들러 작성 규칙

#### 1. 이벤트 필터링을 먼저 수행

```typescript
const handler: HookHandler = async (event) => {
  // 관련 없는 이벤트는 빠르게 반환
  if (event.type !== "command" || event.action !== "new") {
    return;
  }
  // 로직 수행
};
```

#### 2. 에러 처리

```typescript
const handler: HookHandler = async (event) => {
  try {
    await riskyOperation(event);
  } catch (err) {
    console.error("[my-hook] 오류:", err instanceof Error ? err.message : String(err));
    // throw하지 않음 - 다른 핸들러가 계속 실행되도록
  }
};
```

#### 3. 핸들러는 빠르게 유지

```typescript
// ✓ 좋음 - 비동기 작업, 즉시 반환
const handler: HookHandler = async (event) => {
  void processInBackground(event); // Fire and forget
};

// ✗ 나쁨 - 명령어 처리를 차단
const handler: HookHandler = async (event) => {
  await slowDatabaseQuery(event);
  await evenSlowerAPICall(event);
};
```

#### 4. 사용자에게 메시지 전송

```typescript
const handler: HookHandler = async (event) => {
  // 사용자에게 메시지 push
  event.messages.push("✨ 훅이 실행되었습니다!");
};
```

## 이 훅의 기능

### 감지 키워드

- 장애/오류: `장애`, `오류`, `에러`, `error`, `failure`, `failed`, `exception`, `crash`, `다운`, `timeout`, `타임아웃`
- 긴급 상황: `긴급`, `urgent`, `critical`, `심각`
- 재고/품절: `품절`, `재고 없음`, `sold out`
- 서비스: `서비스 중단`, `점검`

### 로그 출력 위치

`~/.openclaw/logs/keyword-alerts.log`

### 로그 형식 (JSONL)

```json
{
  "timestamp": "2026-02-06T10:30:00.000Z",
  "eventAction": "new",
  "sessionKey": "agent:main:main",
  "source": "telegram",
  "senderId": "+1234567890",
  "keywords": ["장애", "오류"],
  "contexts": [{ "keyword": "장애", "context": "...시스템 장애가 발생했습니다..." }]
}
```

## 디버깅

### 로그 확인

```bash
# 최근 로그 확인
tail -n 20 ~/.openclaw/logs/keyword-alerts.log

# jq로 보기 좋게 출력
cat ~/.openclaw/logs/keyword-alerts.log | jq .

# 특정 키워드로 필터링
grep '"장애"' ~/.openclaw/logs/keyword-alerts.log | jq .
```

### 게이트웨이 로그 확인

```bash
# macOS
./scripts/clawlog.sh -f

# 기타 플랫폼
tail -f ~/.openclaw/gateway.log
```

## 참고 문서

- [OpenClaw Hooks 문서](https://docs.openclaw.ai/hooks)
- [CLI Reference: hooks](https://docs.openclaw.ai/cli/hooks)
- [Configuration](https://docs.openclaw.ai/gateway/configuration#hooks)
