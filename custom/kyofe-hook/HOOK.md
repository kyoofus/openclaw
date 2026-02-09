---
name: kyofe-hook
description: "명령어 처리 시 특정 키워드를 감지하여 로그를 남기는 훅"
homepage: https://docs.openclaw.ai/hooks
metadata: { "openclaw": { "emoji": "📋", "events": ["command"], "requires": {} } }
---

# Keyword Logger Hook

모든 명령어 이벤트에서 특정 키워드(장애, 오류 등)를 감지하여 로그를 남기는 커스텀 훅입니다.

## What It Does

- 모든 명령어 이벤트를 리슨합니다
- 세션 컨텍스트에서 "장애", "오류" 등 사전 정의된 키워드를 검색합니다
- 키워드가 발견되면 타임스탬프와 함께 로그 파일에 기록합니다

## Configuration

`~/.openclaw/logs/keyword-alerts.log` 파일에 로그가 기록됩니다.

## Use Cases

- 시스템 장애/오류 키워드 모니터링
- 명령어 처리 과정에서 이상 징후 감지
- 감사(Audit) 및 컴플라이언스 목적 로깅

## Requirements

없음
