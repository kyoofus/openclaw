# OpenClaw CLI 동작 구조 정리

이 문서는 `npm/pnpm -g`로 설치된 `openclaw` CLI가 어떤 경로로 실행되고, `openclaw gateway` 같은 명령이 코드에서 어떻게 등록/처리되는지 정리한 문서입니다.

## 1) 글로벌 설치 시 `openclaw`가 실행되는 이유

패키지의 `bin` 필드가 `openclaw` 명령을 `openclaw.mjs`에 연결합니다.

- `package.json:8`
- `package.json:9`

즉 글로벌 설치 후 셸에서 `openclaw ...`를 실행하면 `openclaw.mjs`가 진입점이 됩니다.

## 2) 부트스트랩: `openclaw.mjs` -> `src/entry.ts` -> `runCli`

### 2-1. `openclaw.mjs`

`openclaw.mjs`는 매우 얇은 부트스트랩입니다.

- Node shebang 진입: `openclaw.mjs:1`
- 컴파일 캐시 활성화 시도: `openclaw.mjs:6`
- 최종적으로 빌드 산출물 import:
  - `./dist/entry.js`: `openclaw.mjs:50`
  - `./dist/entry.mjs`: `openclaw.mjs:52`

즉, 실제 CLI 로직은 `dist/entry.*` (원본은 `src/entry.ts`)로 넘어갑니다.

### 2-2. `src/entry.ts`

여기서 런타임 전처리를 수행합니다.

- warning filter/환경 정규화: `src/entry.ts:11`, `src/entry.ts:12`
- `--dev`, `--profile` 파싱 및 env 적용:
  - 파싱: `src/entry.ts:149`
  - 적용: `src/entry.ts:157`
- 마지막에 `runCli(process.argv)` 호출: `src/entry.ts:163`

또한 `--no-color`면 `NO_COLOR/FORCE_COLOR`를 세팅합니다 (`src/entry.ts:14`).

## 3) 메인 CLI 파이프라인 (`run-main.ts`)

`runCli`의 핵심 순서는 다음과 같습니다.

1. `.env` 로드 + env 정규화
2. route-first 최적화 시도
3. Commander program 빌드
4. primary subcommand lazy preload
5. 파싱/실행

근거:

- `.env`/env 정규화: `src/cli/run-main.ts:29`, `src/cli/run-main.ts:30`
- route-first: `src/cli/run-main.ts:36`
- 프로그램 생성: `src/cli/run-main.ts:43`, `src/cli/run-main.ts:44`
- `--update` -> `update` rewrite: `src/cli/run-main.ts:16`, `src/cli/run-main.ts:17`, `src/cli/run-main.ts:55`
- primary subcommand preload: `src/cli/run-main.ts:57`, `src/cli/run-main.ts:59`, `src/cli/run-main.ts:60`
- 최종 parse: `src/cli/run-main.ts:71`

## 4) Commander 기반 명령 등록 구조

### 4-1. 프로그램 구성

`buildProgram()`이 공통 틀을 만듭니다.

- help/전역 옵션 등록: `configureProgramHelp`: `src/cli/program/build-program.ts:12`
- preAction hook 등록: `src/cli/program/build-program.ts:13`
- 명령 레지스트리 등록: `src/cli/program/build-program.ts:15`

전역 옵션 `--dev`, `--profile` help 표시는 `src/cli/program/help.ts:39`, `src/cli/program/help.ts:43`입니다.

### 4-2. 명령 레지스트리

`commandRegistry`에 top-level 명령군이 등록됩니다.

- 레지스트리 선언: `src/cli/program/command-registry.ts:115`
- `subclis` 항목이 별도 서브 CLI 묶음을 연결: `src/cli/program/command-registry.ts:152`
- 실제 등록 루프: `src/cli/program/command-registry.ts:166`, `src/cli/program/command-registry.ts:171`

## 5) Sub CLI(예: `gateway`) 등록 방식

`src/cli/program/register.subclis.ts`의 `entries` 배열이 서브 CLI 카탈로그입니다.

- 엔트리 목록: `src/cli/program/register.subclis.ts:34`
- `gateway` 엔트리: `src/cli/program/register.subclis.ts:44`
- `daemon`(legacy alias) 엔트리: `src/cli/program/register.subclis.ts:52`

### Lazy 등록 방식

OpenClaw는 기본적으로 서브커맨드를 lazy 등록합니다.

- lazy 비활성화 env: `OPENCLAW_DISABLE_LAZY_SUBCOMMANDS` (`src/cli/program/register.subclis.ts:16`)
- placeholder 등록 + 실제 호출 시 재파싱: `src/cli/program/register.subclis.ts:269`
- 전체 진입 함수: `src/cli/program/register.subclis.ts:292`

즉 `openclaw gateway`를 치면 처음에는 placeholder가 받고, 실제 액션 시점에 `registerGatewayCli()`를 로드해 실행합니다.

## 6) `openclaw gateway`가 실행되는 실제 경로

### 6-1. 등록

`registerGatewayCli()`에서 `gateway` 커맨드를 생성합니다.

- 함수: `src/cli/gateway-cli/register.ts:121`
- `program.command("gateway")`: `src/cli/gateway-cli/register.ts:124`
- `gateway run`도 같은 러너를 붙임: `src/cli/gateway-cli/register.ts:133`, `src/cli/gateway-cli/register.ts:134`

핵심은 `addGatewayRunCommand()`가 `gateway`와 `gateway run` 둘 다에 `.action()`을 붙인다는 점입니다.

- `addGatewayRunCommand` 정의: `src/cli/gateway-cli/run.ts:311`
- 내부 `.action(async (opts) => runGatewayCommand(opts))`: `src/cli/gateway-cli/run.ts:353`

그래서 아래 둘은 같은 실행기로 들어갑니다.

- `openclaw gateway`
- `openclaw gateway run`

### 6-2. 실행 시 옵션/검증

`runGatewayCommand()`는 다음을 처리합니다.

- dev profile/`--dev --reset` 검증: `src/cli/gateway-cli/run.ts:55`, `src/cli/gateway-cli/run.ts:58`
- dev 설정 자동 생성: `src/cli/gateway-cli/run.ts:92`
- 포트 계산 (`resolveGatewayPort`): `src/cli/gateway-cli/run.ts:101`
- auth/bind 검증(토큰/패스워드 요구): `src/cli/gateway-cli/run.ts:224`, `src/cli/gateway-cli/run.ts:237`, `src/cli/gateway-cli/run.ts:250`
- 최종 게이트웨이 루프 실행: `runGatewayLoop` 호출 (`src/cli/gateway-cli/run.ts` 내부)

## 7) Route-First 최적화 (일부 명령의 빠른 경로)

일부 명령은 Commander 전체 파싱 전에 빠르게 라우팅됩니다.

- 진입 함수: `src/cli/route.ts:22`
- 비활성화 env: `OPENCLAW_DISABLE_ROUTE_FIRST` (`src/cli/route.ts:23`)
- 명령 경로 추출/라우팅: `src/cli/route.ts:30`, `src/cli/route.ts:34`

대상 route는 `command-registry.ts`의 `RouteSpec`들입니다.

- `routeHealth`: `src/cli/program/command-registry.ts:39`
- `routeStatus`: `src/cli/program/command-registry.ts:54`
- `routeSessions`: `src/cli/program/command-registry.ts:72`
- `routeAgentsList`: `src/cli/program/command-registry.ts:89`
- `routeMemoryStatus`: `src/cli/program/command-registry.ts:99`

## 8) CLI 명령을 새로 만드는 방법 (이 저장소 기준)

### A. 기존 top-level 그룹에 명령 추가

예: `status`, `doctor`처럼 바로 루트에서 쓰는 명령.

1. `src/commands/*`에 실제 비즈니스 로직 함수 작성
2. 해당 register 파일에서 Commander wiring
  - 예: `src/cli/program/register.status-health-sessions.ts`
  - 예: `src/cli/program/register.maintenance.ts`
3. 필요하면 `RouteSpec` 추가 (`src/cli/program/command-registry.ts`)

### B. 새 sub CLI 그룹 추가

예: `openclaw <newgroup> ...`

1. `src/cli/<newgroup>-cli.ts`에 `register<NewGroup>Cli(program)` 작성
2. `src/cli/program/register.subclis.ts`의 `entries`에 `{ name, description, register }` 추가
3. 필요 시 plugin 초기화/설정 로드 패턴을 기존 `pairing/plugins` 항목처럼 반영

### C. `openclaw gateway`처럼 “루트 실행 + 하위 run” 동시 지원

`addGatewayRunCommand()` 패턴을 쓰면 됩니다.

- 루트 커맨드(`gateway`)와 하위 `run` 양쪽에 동일 `.action()` 부착
- 옵션 스키마/검증/실행 함수 공유

## 9) 운영 관점 요약

- 글로벌 실행 연결은 `package.json`의 `bin`이 담당
- 실제 실행 코어는 `src/entry.ts` -> `src/cli/run-main.ts`
- CLI wiring은 Commander + registry + lazy subcommand 구조
- `openclaw gateway`는 등록 단계에서 run 액션을 직접 달아둔 패턴
- 성능/UX를 위해 일부 명령은 route-first로 빠르게 처리
