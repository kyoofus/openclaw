import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { HookHandler } from "../../src/hooks/hooks.js";
// import type { HookHandler } from "openclaw";


/**
 * 키워드 로거 훅 (Command Event 기반)
 *
 * 모든 명령어 이벤트에서 특정 키워드(장애, 오류 등)를 감지하여
 * 로그를 남기는 커스텀 훅입니다.
 */

// 감지할 키워드 목록
const ALERT_KEYWORDS = [
  // 장애/오류 관련
  "장애",
  "오류",
  "에러",
  "error",
  "failure",
  "failed",
  "exception",
  "crash",
  "다운",
  "timeout",
  "타임아웃",

  // 긴급 상황
  "긴급",
  "urgent",
  "critical",
  "심각",

  // 재고/품절 관련
  "품절",
  "재고 없음",
  "sold out",

  // 서비스 관련
  "서비스 중단",
  "점검",
];

// 로그 파일 경로
const LOG_DIR = path.join(os.homedir(), ".openclaw", "logs");
const LOG_FILE = path.join(LOG_DIR, "keyword-alerts.log");

/**
 * 로그 디렉토리 생성
 */
function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * 텍스트에서 키워드 검색
 */
function findKeywords(text: string): string[] {
  if (!text || typeof text !== "string") {
    return [];
  }

  const lowerText = text.toLowerCase();
  return ALERT_KEYWORDS.filter((keyword) => lowerText.includes(keyword.toLowerCase()));
}

/**
 * 키워드 주변 컨텍스트 추출
 */
function extractContext(text: string, keyword: string, length = 50): string {
  const index = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (index === -1) {
    return "";
  }

  const start = Math.max(0, index - length);
  const end = Math.min(text.length, index + keyword.length + length);
  let context = text.substring(start, end).replace(/\n/g, " ").trim();

  if (start > 0) {
    context = "..." + context;
  }
  if (end < text.length) {
    context = context + "...";
  }

  return context;
}

/**
 * 알림 로그 기록
 */
function logKeywordAlert(
  keywords: string[],
  content: string,
  event: {
    action?: string;
    sessionKey?: string;
    timestamp?: Date;
    context?: Record<string, unknown>;
  },
): void {
  ensureLogDir();

  const logEntry = {
    timestamp: new Date().toISOString(),
    eventAction: event.action || "unknown",
    sessionKey: event.sessionKey || "unknown",
    source: event.context?.commandSource || "unknown",
    senderId: event.context?.senderId || "unknown",
    keywords,
    contexts: keywords.map((kw) => ({
      keyword: kw,
      context: extractContext(content, kw),
    })),
  };

  fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + "\n", "utf-8");

  console.log(`[keyword-logger] 📋 키워드 감지: ${keywords.join(", ")}`);
  console.log(`  액션: ${event.action}`);
  console.log(`  세션: ${event.sessionKey}`);
}

/**
 * Command 이벤트 핸들러
 */
const handler: HookHandler = async (event) => {
  // command 타입 이벤트만 처리
  if (event.type !== "command") {
    return;
  }

  try {
    const context = event.context || {};
    let contentToScan = "";

    // 세션 엔트리에서 텍스트 추출
    if (context.sessionEntry) {
      const entry = context.sessionEntry as Record<string, unknown>;
      if (entry.content) {
        contentToScan +=
          typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content);
      }
      if (entry.messages && Array.isArray(entry.messages)) {
        contentToScan += " " + entry.messages.join(" ");
      }
    }

    // 전체 컨텍스트도 스캔
    contentToScan += " " + JSON.stringify(context);

    // 키워드 검색
    const matchedKeywords = findKeywords(contentToScan);

    if (matchedKeywords.length > 0) {
      logKeywordAlert(matchedKeywords, contentToScan, {
        action: event.action,
        sessionKey: event.sessionKey,
        timestamp: event.timestamp,
        context: context as Record<string, unknown>,
      });

      // 사용자에게 알림 (선택적)
      // event.messages?.push(`📋 키워드 감지됨: ${matchedKeywords.join(", ")}`);
    }
  } catch (err) {
    console.error("[keyword-logger] 오류:", err instanceof Error ? err.message : String(err));
  }
};

export default handler;
