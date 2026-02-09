# Kyofe Hello World Plugin

OpenClaw용 Hello World 플러그인입니다.

## 기능

- **CLI 명령어**: `openclaw hello` → "Hello World" 출력
- **Agent 도구**: `hello_world` → LLM이 호출하여 인사 메시지 반환

## 설치

```bash
# 개발용 링크 설치
openclaw plugins install -l .

# npm으로 설치 (배포 후)
openclaw plugins install kyofe-hello
```

## 사용법

### CLI 명령어

```bash
openclaw hello
# 출력: Hello World
```

### Agent 도구

Agent가 `hello_world` 도구를 호출하면 인사 메시지를 반환합니다.

```typescript
// 도구 호출 예시 (LLM이 자동으로 호출)
hello_world({ name: "OpenClaw" });
// 반환: "Hello, OpenClaw!"

hello_world({});
// 반환: "Hello World"
```

---

## OpenClaw 플러그인 작성 규칙

### 파일 구조

```
plugin-name/
├── package.json           # Node.js 프로젝트 설정 (필수)
├── openclaw.plugin.json   # 플러그인 매니페스트 (필수)
├── index.ts               # 플러그인 메인 파일
└── tsconfig.json          # TypeScript 설정 (선택)
```

### package.json 작성 규칙

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "플러그인 설명",
  "type": "module",
  "openclaw": {
    "extensions": ["./index.ts"]
  },
  "dependencies": {
    "@sinclair/typebox": "^0.32.0"
  }
}
```

| 필드                  | 필수 | 설명                              |
| --------------------- | ---- | --------------------------------- |
| `name`                | ✅   | 플러그인 패키지 이름              |
| `version`             | ✅   | 버전 (SemVer)                     |
| `type`                | ✅   | `"module"` 권장 (ESM)             |
| `openclaw.extensions` | ✅   | 플러그인 진입점 파일 배열         |
| `dependencies`        | 선택 | 도구 매개변수 스키마용 TypeBox 등 |

### openclaw.plugin.json 작성 규칙 (매니페스트)

```json
{
  "id": "plugin-name",
  "name": "Plugin Display Name",
  "description": "플러그인 설명",
  "version": "1.0.0",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

| 필드           | 필수 | 설명                                       |
| -------------- | ---- | ------------------------------------------ |
| `id`           | ✅   | 플러그인 고유 ID                           |
| `configSchema` | ✅   | 플러그인 설정 JSON Schema (빈 스키마 가능) |
| `name`         | 선택 | 표시 이름                                  |
| `description`  | 선택 | 플러그인 설명                              |
| `version`      | 선택 | 버전 정보                                  |
| `kind`         | 선택 | 플러그인 종류 (예: `"memory"`)             |
| `channels`     | 선택 | 등록할 채널 ID 배열                        |
| `providers`    | 선택 | 등록할 프로바이더 ID 배열                  |
| `skills`       | 선택 | 로드할 스킬 디렉토리 배열                  |
| `uiHints`      | 선택 | UI 렌더링용 필드 힌트                      |

### 플러그인 코드 작성 규칙

#### 기본 구조

```typescript
export default function register(api: any) {
  // 플러그인 등록 로직
}
```

또는 객체 형태:

```typescript
export default {
  id: "plugin-name",
  name: "Plugin Name",
  configSchema: {
    /* JSON Schema */
  },
  register(api: any) {
    // 플러그인 등록 로직
  },
};
```

#### CLI 명령어 등록

```typescript
api.registerCli(
  ({ program }) => {
    program
      .command("command-name")
      .description("명령어 설명")
      .action(() => {
        console.log("실행 결과");
      });
  },
  { commands: ["command-name"] },
);
```

#### Agent 도구 등록

```typescript
import { Type } from "@sinclair/typebox";

api.registerTool({
  name: "tool_name", // snake_case 권장
  description: "도구 설명",
  parameters: Type.Object({
    param1: Type.String({ description: "파라미터 설명" }),
    param2: Type.Optional(Type.Number()),
  }),
  async execute(_id, params) {
    return {
      content: [{ type: "text", text: "결과" }],
    };
  },
});
```

#### Gateway RPC 메서드 등록

```typescript
api.registerGatewayMethod("pluginId.methodName", ({ respond }) => {
  respond(true, { result: "data" });
});
```

#### 백그라운드 서비스 등록

```typescript
api.registerService({
  id: "my-service",
  start: () => api.logger.info("서비스 시작"),
  stop: () => api.logger.info("서비스 종료"),
});
```

#### 자동 응답 명령어 등록

```typescript
api.registerCommand({
  name: "mystatus",
  description: "상태 확인",
  handler: (ctx) => ({
    text: `채널: ${ctx.channel}`,
  }),
});
```

### 네이밍 규칙

| 항목           | 규칙                      | 예시               |
| -------------- | ------------------------- | ------------------ |
| Gateway 메서드 | `pluginId.action`         | `voicecall.status` |
| Agent 도구     | `snake_case`              | `hello_world`      |
| CLI 명령어     | kebab-case 또는 camelCase | `my-command`       |

### 설정 스키마 예시

플러그인에 설정이 필요한 경우:

```json
{
  "id": "my-plugin",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "apiKey": { "type": "string" },
      "region": { "type": "string", "default": "us-east-1" }
    },
    "required": ["apiKey"]
  },
  "uiHints": {
    "apiKey": { "label": "API Key", "sensitive": true },
    "region": { "label": "Region", "placeholder": "us-east-1" }
  }
}
```

사용자 설정 위치 (`~/.openclaw/config.json`):

```json
{
  "plugins": {
    "entries": {
      "my-plugin": {
        "enabled": true,
        "config": {
          "apiKey": "xxx",
          "region": "ap-northeast-2"
        }
      }
    }
  }
}
```

---

## 참고 문서

- [OpenClaw Plugins](https://docs.openclaw.ai/plugin)
- [Plugin Manifest](https://docs.openclaw.ai/plugins/manifest)
- [Plugin Agent Tools](https://docs.openclaw.ai/plugins/agent-tools)
