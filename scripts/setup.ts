#!/usr/bin/env npx tsx

/**
 * Interactive setup script for LangGraph Chat UI
 *
 * Usage:
 *   pnpm launch
 *   # or
 *   npx tsx scripts/setup.ts
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawn } from "node:child_process";
import crossSpawn from "cross-spawn";

/**
 * Strip ANSI escape codes from a string.
 */
function stripAnsi(str: string): string {
  return str.replace(
    /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g,
    ""
  );
}

/**
 * Check if a Unicode code point is a full-width (double-width) character.
 */
function isFullWidth(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0x303e) || // CJK Radicals, Kangxi, CJK Symbols
    (code >= 0x3040 && code <= 0x33bf) || // Hiragana, Katakana, Bopomofo, Hangul Compat Jamo
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0xa960 && code <= 0xa97f) || // Hangul Jamo Extended-A
    (code >= 0xac00 && code <= 0xd7af) || // Hangul Syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
    (code >= 0xfe10 && code <= 0xfe19) || // Vertical Forms
    (code >= 0xfe30 && code <= 0xfe6f) || // CJK Compatibility Forms
    (code >= 0xff01 && code <= 0xff60) || // Fullwidth Forms
    (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth Signs
    (code >= 0x20000 && code <= 0x2fffd) || // CJK Extension B+
    (code >= 0x30000 && code <= 0x3fffd) // CJK Extension G+
  );
}

/**
 * Get the visual width of a string in the terminal,
 * accounting for CJK double-width characters and ANSI escape codes.
 */
function getStringWidth(str: string): number {
  const stripped = stripAnsi(str);
  let width = 0;
  for (const char of stripped) {
    const code = char.codePointAt(0)!;
    width += isFullWidth(code) ? 2 : 1;
  }
  return width;
}

/**
 * CJK-aware replacement for note() that correctly handles
 * double-width characters in box-drawing width calculations.
 */
function note(message: string = "", title: string = "") {
  const lines = `\n${message}\n`.split("\n");
  const titleWidth = getStringWidth(title);
  const maxLineWidth = lines.reduce(
    (max, line) => Math.max(max, getStringWidth(line)),
    0
  );
  const boxWidth = Math.max(maxLineWidth, titleWidth) + 2;

  const content = lines
    .map((line) => {
      const padding = boxWidth - getStringWidth(line);
      return `${pc.gray("\u2502")}  ${pc.dim(line)}${" ".repeat(padding)}${pc.gray("\u2502")}`;
    })
    .join("\n");

  process.stdout.write(
    `${pc.gray("\u2502")}\n` +
      `${pc.green("\u25C7")}  ${pc.reset(title)} ${pc.gray("\u2500".repeat(Math.max(boxWidth - titleWidth - 1, 1)) + "\u256E")}\n` +
      `${content}\n` +
      `${pc.gray("\u2570" + "\u2500".repeat(boxWidth + 2) + "\u256F")}\n`
  );
}

function resolveCommand(command: string): string {
  if (process.platform !== "win32") return command;

  switch (command) {
    case "pnpm":
    case "npm":
    case "npx":
      return `${command}.cmd`;
    default:
      return command;
  }
}

/**
 * Run a command asynchronously (allows spinner to animate)
 */
function runAsync(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = crossSpawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      reject(err);
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Command failed with exit code ${code}`);
        (error as Error & { stdout: string; stderr: string }).stdout = stdout;
        (error as Error & { stdout: string; stderr: string }).stderr = stderr;
        reject(error);
      }
    });
  });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");

// ============================================================================
// i18n - Language Detection & Messages
// ============================================================================

type Lang = "ko" | "en";

function detectLanguage(): Lang {
  const lang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || "";
  if (lang.toLowerCase().startsWith("ko")) return "ko";

  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (locale.startsWith("ko")) return "ko";
  } catch {
    // Ignore
  }

  return "en";
}

const LANG = detectLanguage();

const i18n = {
  title: {
    ko: " LangGraph Chat UI 설정 ",
    en: " LangGraph Chat UI Setup ",
  },
  selectRunMode: {
    ko: "실행 모드를 선택하세요:",
    en: "Select run mode:",
  },
  development: {
    ko: "개발 모드",
    en: "Development",
  },
  developmentHint: {
    ko: "핫 리로드가 적용되는 로컬 개발 서버",
    en: "Local dev server with hot reload",
  },
  production: {
    ko: "프로덕션",
    en: "Production",
  },
  productionHint: {
    ko: "프로덕션 빌드 및 배포",
    en: "Build and deploy for production",
  },
  selectAuthMode: {
    ko: "인증 모드를 선택하세요:",
    en: "Select authentication mode:",
  },
  standalone: {
    ko: "Standalone",
    en: "Standalone",
  },
  standaloneHint: {
    ko: "인증 없음",
    en: "No authentication",
  },
  credentials: {
    ko: "Credentials",
    en: "Credentials",
  },
  credentialsHint: {
    ko: "이메일/비밀번호 로그인",
    en: "Email/password login",
  },
  oauth: {
    ko: "OAuth",
    en: "OAuth",
  },
  oauthHint: {
    ko: "Google/GitHub 소셜 로그인",
    en: "Google/GitHub social login",
  },
  oauthDirect: {
    ko: "OAuth Direct",
    en: "OAuth Direct",
  },
  oauthDirectHint: {
    ko: "LangGraph 서버가 OAuth 처리",
    en: "LangGraph server handles OAuth",
  },
  selectOAuthProviders: {
    ko: "OAuth 제공자를 선택하세요:",
    en: "Select OAuth providers:",
  },
  selectDatabase: {
    ko: "데이터베이스를 선택하세요:",
    en: "Select database:",
  },
  recommendedForDev: {
    ko: "개발용 추천",
    en: "Recommended for dev",
  },
  recommended: {
    ko: "추천",
    en: "Recommended",
  },
  notRecommendedForProd: {
    ko: "프로덕션에 비추천",
    en: "Not recommended for production",
  },
  selectDeployTarget: {
    ko: "배포 대상을 선택하세요:",
    en: "Select deployment target:",
  },
  vercelHint: {
    ko: "Next.js에 최적화",
    en: "Recommended for Next.js",
  },
  dockerHint: {
    ko: "Docker 이미지 빌드",
    en: "Build Docker image",
  },
  selfHostedHint: {
    ko: "Node.js로 직접 실행",
    en: "Run with Node.js",
  },
  // Environment variable prompts
  enterLangGraphUrl: {
    ko: "LangGraph 서버 URL:",
    en: "LangGraph server URL:",
  },
  enterGraphId: {
    ko: "Graph ID (Assistant ID):",
    en: "Graph ID (Assistant ID):",
  },
  enterLangSmithApiKey: {
    ko: "LangSmith API Key (트레이싱용, 선택사항):",
    en: "LangSmith API Key (for tracing, optional):",
  },
  langSmithSkip: {
    ko: "건너뛰기",
    en: "Skip",
  },
  langSmithEnter: {
    ko: "API 키 입력",
    en: "Enter API key",
  },
  enterLangSmithProject: {
    ko: "LangSmith 프로젝트 이름:",
    en: "LangSmith project name:",
  },
  enterProductionUrl: {
    ko: "프론트엔드 URL (예: https://chat.example.com):",
    en: "Frontend URL (e.g., https://chat.example.com):",
  },
  enterDatabaseUrl: {
    ko: "데이터베이스 URL:",
    en: "Database URL:",
  },
  enterNextAuthSecret: {
    ko: "NextAuth Secret:",
    en: "NextAuth Secret:",
  },
  autoGenerate: {
    ko: "자동 생성 (권장)",
    en: "Auto-generate (Recommended)",
  },
  manualInput: {
    ko: "직접 입력",
    en: "Enter manually",
  },
  enterGoogleClientId: {
    ko: "Google Client ID:",
    en: "Google Client ID:",
  },
  enterGoogleClientSecret: {
    ko: "Google Client Secret:",
    en: "Google Client Secret:",
  },
  enterGithubClientId: {
    ko: "GitHub Client ID:",
    en: "GitHub Client ID:",
  },
  enterGithubClientSecret: {
    ko: "GitHub Client Secret:",
    en: "GitHub Client Secret:",
  },
  // Branding prompts
  brandingSection: {
    ko: "브랜딩 설정 (선택사항)",
    en: "Branding Settings (Optional)",
  },
  configureBranding: {
    ko: "브랜딩을 설정하시겠습니까?",
    en: "Configure branding?",
  },
  skipBranding: {
    ko: "건너뛰기 (기본값 사용)",
    en: "Skip (use defaults)",
  },
  configureNow: {
    ko: "지금 설정",
    en: "Configure now",
  },
  enterAppName: {
    ko: "앱 이름:",
    en: "App name:",
  },
  enterLogoUrl: {
    ko: "로고 URL (빈 값 = 기본 로고):",
    en: "Logo URL (empty = default logo):",
  },
  enterWelcomeMessage: {
    ko: "웰컴 메시지:",
    en: "Welcome message:",
  },
  // Validation
  urlRequired: {
    ko: "URL을 입력하세요",
    en: "URL is required",
  },
  urlMustStartWithHttp: {
    ko: "URL은 http:// 또는 https://로 시작해야 합니다",
    en: "URL must start with http:// or https://",
  },
  urlInvalid: {
    ko: "올바른 URL을 입력하세요",
    en: "Enter a valid URL",
  },
  secretRequired: {
    ko: "시크릿을 입력하세요",
    en: "Secret is required",
  },
  // Summary & actions
  configSummary: {
    ko: "설정 요약",
    en: "Configuration Summary",
  },
  mode: {
    ko: "모드",
    en: "Mode",
  },
  auth: {
    ko: "인증",
    en: "Auth",
  },
  database: {
    ko: "데이터베이스",
    en: "Database",
  },
  deploy: {
    ko: "배포",
    en: "Deploy",
  },
  proceedWithConfig: {
    ko: "이 설정으로 진행하시겠습니까?",
    en: "Proceed with this configuration?",
  },
  cancelled: {
    ko: "설정이 취소되었습니다.",
    en: "Setup cancelled.",
  },
  generatingEnv: {
    ko: "환경 설정을 생성하는 중...",
    en: "Generating environment configuration...",
  },
  envCreated: {
    ko: "환경 설정 완료!",
    en: "Environment configuration created!",
  },
  installingDeps: {
    ko: "의존성을 설치하는 중...",
    en: "Installing dependencies...",
  },
  depsInstalled: {
    ko: "의존성 설치 완료!",
    en: "Dependencies installed!",
  },
  settingUpDb: {
    ko: "데이터베이스를 설정하는 중...",
    en: "Setting up database...",
  },
  dbReady: {
    ko: "데이터베이스 준비 완료!",
    en: "Database ready!",
  },
  savingSettings: {
    ko: "설정을 저장하는 중...",
    en: "Saving settings...",
  },
  settingsSaved: {
    ko: "설정 저장 완료!",
    en: "Settings saved!",
  },
  startingDevServer: {
    ko: "개발 서버를 시작합니다...",
    en: "Starting development server...",
  },
  pressCtrlC: {
    ko: "Ctrl+C를 눌러 중지",
    en: "Press Ctrl+C to stop",
  },
  deployingToVercel: {
    ko: "Vercel에 배포 중...",
    en: "Deploying to Vercel...",
  },
  vercelNotFound: {
    ko: "Vercel CLI를 찾을 수 없습니다. 설치 중...",
    en: "Vercel CLI not found. Installing...",
  },
  vercelDeployment: {
    ko: "Vercel 배포",
    en: "Vercel Deployment",
  },
  vercelInstructions: {
    ko: "배포 전에 Vercel에서 다음 환경 변수를 설정하세요:",
    en: "Before deploying, configure these environment variables in Vercel:",
  },
  thenRun: {
    ko: "그런 다음 실행:",
    en: "Then run:",
  },
  creatingDockerfile: {
    ko: "Dockerfile을 생성하는 중...",
    en: "Creating Dockerfile...",
  },
  dockerfileCreated: {
    ko: "Dockerfile 생성 완료!",
    en: "Dockerfile created!",
  },
  buildingDocker: {
    ko: "Docker 이미지를 빌드하는 중...",
    en: "Building Docker image...",
  },
  dockerBuilt: {
    ko: "Docker 이미지 빌드 완료!",
    en: "Docker image built!",
  },
  dockerDeployment: {
    ko: "Docker 배포",
    en: "Docker Deployment",
  },
  runContainer: {
    ko: "컨테이너 실행 명령:",
    en: "Run the container with:",
  },
  buildingForProd: {
    ko: "프로덕션 빌드 중...",
    en: "Building for production...",
  },
  buildComplete: {
    ko: "빌드 완료!",
    en: "Build complete!",
  },
  startingProdServer: {
    ko: "프로덕션 서버를 시작합니다...",
    en: "Starting production server...",
  },
  serverRunningAt: {
    ko: "서버 실행 중:",
    en: "Server running at",
  },
  runInBackground: {
    ko: "백그라운드에서 실행하시겠습니까?",
    en: "Run in background?",
  },
  backgroundYes: {
    ko: "예 (pm2 또는 nohup 사용)",
    en: "Yes (using pm2 or nohup)",
  },
  backgroundNo: {
    ko: "아니오 (포그라운드 실행)",
    en: "No (run in foreground)",
  },
  serverStartedBackground: {
    ko: "서버가 백그라운드에서 시작되었습니다",
    en: "Server started in background",
  },
  toStopServer: {
    ko: "서버 중지 방법:",
    en: "To stop the server:",
  },
  langGraphServer: {
    ko: "LangGraph 서버",
    en: "LangGraph Server",
  },
  langGraphGuide: {
    ko: "LangGraph 서버 설정 가이드:",
    en: "LangGraph server setup guide:",
  },
  installDeps: {
    ko: "의존성 설치",
    en: "Install dependencies",
  },
  configureEnv: {
    ko: "환경 설정",
    en: "Configure environment",
  },
  startServer: {
    ko: "서버 시작",
    en: "Start server",
  },
  forMoreDetails: {
    ko: "자세한 내용:",
    en: "For more details, see:",
  },
  seeExampleAt: {
    ko: "예제 참고:",
    en: "See example at:",
  },
  firstRunAdminNotice: {
    ko: "첫 번째로 회원가입한 사용자가 관리자 계정이 됩니다.",
    en: "The first user to sign up will become the admin.",
  },
} as const;

function t(key: keyof typeof i18n): string {
  return i18n[key][LANG];
}

// ============================================================================
// Types
// ============================================================================

type RunMode = "development" | "production";
type AuthMode = "standalone" | "credentials" | "oauth" | "oauth-direct";
type OAuthProvider = "google" | "github";
type Database = "sqlite" | "postgresql" | "mysql";
type DeployTarget = "vercel" | "docker" | "self-hosted";

interface SetupConfig {
  runMode: RunMode;
  authMode: AuthMode;
  oauthProviders: OAuthProvider[];
  database: Database;
  deployTarget?: DeployTarget;
  runInBackground?: boolean;
  // Environment variables
  langGraphUrl: string;
  frontendUrl: string;
  graphId: string;
  databaseUrl?: string;
  nextAuthSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  githubClientId?: string;
  githubClientSecret?: string;
  langSmithApiKey?: string;
  langSmithProject?: string;
  // Branding
  appName?: string;
  logoUrl?: string;
  welcomeMessage?: string;
}

const AUTH_MODE_TO_EXAMPLE: Record<AuthMode, string> = {
  standalone: "standalone",
  credentials: "basic-auth",
  oauth: "google-oauth",
  "oauth-direct": "oauth-direct",
};

function validateHttpUrl(value: string): string | undefined {
  if (!value) return t("urlRequired");

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return t("urlMustStartWithHttp");
    }
  } catch {
    return t("urlInvalid");
  }
}

function getConfiguredPort(frontendUrl: string): string | undefined {
  const match = frontendUrl.match(
    /^https?:\/\/(?:\[[^\]]+\]|[^/:?#]+):(\d+)(?:[/?#]|$)/i
  );
  return match?.[1];
}

function getServerScriptArgs(
  script: "dev" | "start",
  frontendUrl: string
): string[] {
  const port = getConfiguredPort(frontendUrl);
  return port ? [script, "-p", port] : [script];
}

function getServerEnv(frontendUrl: string): NodeJS.ProcessEnv {
  const port = getConfiguredPort(frontendUrl);

  return {
    ...process.env,
    NODE_NO_WARNINGS: "1",
    ...(port ? { PORT: port } : {}),
  };
}

const DEFAULT_BRANDING = {
  appName: "LangGraph Chat",
  logoUrl: "/logo.png",
  welcomeMessage: {
    ko: "무엇이든 물어보세요.",
    en: "Ask me anything.",
  },
};

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.clear();

  p.intro(pc.bgCyan(pc.black(t("title"))));

  const config = await gatherConfig();

  if (!config) {
    p.cancel(t("cancelled"));
    process.exit(0);
  }

  try {
    await runSetup(config);
  } catch (error) {
    p.log.error(String(error));
    process.exit(1);
  }
}

async function gatherConfig(): Promise<SetupConfig | null> {
  // 1. Run mode selection
  const runMode = await p.select({
    message: t("selectRunMode"),
    options: [
      {
        value: "development",
        label: t("development"),
        hint: t("developmentHint"),
      },
      {
        value: "production",
        label: t("production"),
        hint: t("productionHint"),
      },
    ],
  });

  if (p.isCancel(runMode)) return null;
  const isProduction = runMode === "production";

  // 2. Auth mode selection
  const authMode = await p.select({
    message: t("selectAuthMode"),
    options: [
      {
        value: "standalone",
        label: t("standalone"),
        hint: t("standaloneHint"),
      },
      {
        value: "credentials",
        label: t("credentials"),
        hint: t("credentialsHint"),
      },
      {
        value: "oauth",
        label: t("oauth"),
        hint: t("oauthHint"),
      },
      {
        value: "oauth-direct",
        label: t("oauthDirect"),
        hint: t("oauthDirectHint"),
      },
    ],
  });

  if (p.isCancel(authMode)) return null;
  const needsDatabase = authMode === "credentials" || authMode === "oauth";
  const needsOAuth = authMode === "oauth" || authMode === "oauth-direct";

  // 3. OAuth providers (if oauth mode)
  let oauthProviders: OAuthProvider[] = [];

  if (authMode === "oauth") {
    const providers = await p.multiselect({
      message: t("selectOAuthProviders"),
      options: [
        { value: "google", label: "Google" },
        { value: "github", label: "GitHub" },
      ],
      required: true,
    });

    if (p.isCancel(providers)) return null;
    oauthProviders = providers as OAuthProvider[];
  }

  // 4. Database selection (for credentials/oauth)
  let database: Database = "sqlite";

  if (needsDatabase) {
    const dbOptions = isProduction
      ? [
          { value: "postgresql", label: "PostgreSQL", hint: t("recommended") },
          { value: "mysql", label: "MySQL" },
          { value: "sqlite", label: "SQLite", hint: t("notRecommendedForProd") },
        ]
      : [
          { value: "sqlite", label: "SQLite", hint: t("recommendedForDev") },
          { value: "postgresql", label: "PostgreSQL" },
          { value: "mysql", label: "MySQL" },
        ];

    const db = await p.select({
      message: t("selectDatabase"),
      options: dbOptions,
    });

    if (p.isCancel(db)) return null;
    database = db as Database;
  }

  // 5. Deployment target (for production)
  let deployTarget: DeployTarget | undefined;
  let runInBackground: boolean | undefined;

  if (isProduction) {
    const target = await p.select({
      message: t("selectDeployTarget"),
      options: [
        { value: "vercel", label: "Vercel", hint: t("vercelHint") },
        { value: "docker", label: "Docker", hint: t("dockerHint") },
        { value: "self-hosted", label: "Self-hosted", hint: t("selfHostedHint") },
      ],
    });

    if (p.isCancel(target)) return null;
    deployTarget = target as DeployTarget;

    // Ask about background execution for self-hosted
    if (deployTarget === "self-hosted") {
      const bg = await p.select({
        message: t("runInBackground"),
        options: [
          { value: true, label: t("backgroundYes") },
          { value: false, label: t("backgroundNo") },
        ],
      });

      if (p.isCancel(bg)) return null;
      runInBackground = bg as boolean;
    }
  }

  // ============================================================================
  // Environment Variables
  // ============================================================================

  p.log.info(pc.bold(pc.cyan("\n📋 " + (LANG === "ko" ? "환경 변수 설정" : "Environment Variables"))));

  // LangGraph URL
  const langGraphUrl = await p.text({
    message: t("enterLangGraphUrl"),
    initialValue: "http://localhost:2024",
    validate: validateHttpUrl,
  });

  if (p.isCancel(langGraphUrl)) return null;

  // Graph ID
  const graphId = await p.text({
    message: t("enterGraphId"),
    initialValue: "agent",
  });

  if (p.isCancel(graphId)) return null;

  // LangSmith API Key (optional)
  const langSmithApiKey = await p.text({
    message: t("enterLangSmithApiKey"),
    placeholder: "lsv2_pt_xxxxx...",
  });

  if (p.isCancel(langSmithApiKey)) return null;

  // LangSmith Project Name (if API key provided)
  let langSmithProject: string | undefined;
  if (langSmithApiKey) {
    const project = await p.text({
      message: t("enterLangSmithProject"),
      initialValue: "default",
    });

    if (p.isCancel(project)) return null;
    langSmithProject = project || undefined;
  }

  // Frontend URL
  const frontendUrl = await p.text({
    message: t("enterProductionUrl"),
    initialValue: "http://localhost:3000",
    validate: validateHttpUrl,
  });

  if (p.isCancel(frontendUrl)) return null;

  // Database URL (if needed)
  let databaseUrl: string | undefined;

  if (needsDatabase) {
    const defaultDbUrl = getDefaultDatabaseUrl(database);
    const dbUrl = await p.text({
      message: t("enterDatabaseUrl"),
      initialValue: database === "sqlite" ? defaultDbUrl : "",
      placeholder: database !== "sqlite" ? defaultDbUrl : undefined,
      validate: (value) => {
        if (!value) return t("urlRequired");
      },
    });

    if (p.isCancel(dbUrl)) return null;
    databaseUrl = dbUrl;
  }

  // NextAuth Secret (if needed)
  let nextAuthSecret: string | undefined;

  if (needsDatabase) {
    const secretChoice = await p.select({
      message: t("enterNextAuthSecret"),
      options: [
        { value: "auto", label: t("autoGenerate") },
        { value: "manual", label: t("manualInput") },
      ],
    });

    if (p.isCancel(secretChoice)) return null;

    if (secretChoice === "auto") {
      nextAuthSecret = generateRandomSecret();
      // Display the generated secret so user can copy it for LangGraph server
      p.log.info("");
      p.log.success(pc.bold(LANG === "ko" ? "🔑 생성된 NEXTAUTH_SECRET:" : "🔑 Generated NEXTAUTH_SECRET:"));
      p.log.info(pc.cyan(nextAuthSecret));
      p.log.info(pc.dim(LANG === "ko"
        ? "↑ 이 값을 LangGraph 서버의 .env 파일에도 설정하세요 (JWT 토큰 검증용)"
        : "↑ Copy this to your LangGraph server .env file (for JWT token validation)"));
      p.log.info("");
    } else {
      const secret = await p.text({
        message: t("enterNextAuthSecret"),
        placeholder: "your-secret-key",
        validate: (value) => {
          if (!value || value.length < 16) {
            return LANG === "ko" ? "시크릿은 최소 16자 이상이어야 합니다" : "Secret must be at least 16 characters";
          }
        },
      });

      if (p.isCancel(secret)) return null;
      nextAuthSecret = secret;
    }
  }

  // OAuth Credentials
  let googleClientId: string | undefined;
  let googleClientSecret: string | undefined;
  let githubClientId: string | undefined;
  let githubClientSecret: string | undefined;

  if (needsOAuth || oauthProviders.includes("google")) {
    const gClientId = await p.text({
      message: t("enterGoogleClientId"),
      placeholder: "your-google-client-id.apps.googleusercontent.com",
    });

    if (p.isCancel(gClientId)) return null;
    googleClientId = gClientId || undefined;

    if (authMode !== "oauth-direct" && googleClientId) {
      const gClientSecret = await p.text({
        message: t("enterGoogleClientSecret"),
        placeholder: "GOCSPX-xxxxx",
      });

      if (p.isCancel(gClientSecret)) return null;
      googleClientSecret = gClientSecret || undefined;
    }
  }

  if (oauthProviders.includes("github")) {
    const ghClientId = await p.text({
      message: t("enterGithubClientId"),
      placeholder: "your-github-client-id",
    });

    if (p.isCancel(ghClientId)) return null;
    githubClientId = ghClientId || undefined;

    if (githubClientId) {
      const ghClientSecret = await p.text({
        message: t("enterGithubClientSecret"),
        placeholder: "your-github-client-secret",
      });

      if (p.isCancel(ghClientSecret)) return null;
      githubClientSecret = ghClientSecret || undefined;
    }
  }

  // ============================================================================
  // Branding (Optional)
  // ============================================================================

  let appName: string | undefined;
  let logoUrl: string | undefined;
  let welcomeMessage: string | undefined;

  const brandingChoice = await p.select({
    message: t("configureBranding"),
    options: [
      { value: "skip", label: t("skipBranding") },
      { value: "configure", label: t("configureNow") },
    ],
  });

  if (p.isCancel(brandingChoice)) return null;

  if (brandingChoice === "configure") {
    const name = await p.text({
      message: t("enterAppName"),
      initialValue: DEFAULT_BRANDING.appName,
    });

    if (p.isCancel(name)) return null;
    appName = name || undefined;

    const logo = await p.text({
      message: t("enterLogoUrl"),
      placeholder: DEFAULT_BRANDING.logoUrl,
    });

    if (p.isCancel(logo)) return null;
    logoUrl = logo || undefined;

    const welcome = await p.text({
      message: t("enterWelcomeMessage"),
      initialValue: DEFAULT_BRANDING.welcomeMessage[LANG],
    });

    if (p.isCancel(welcome)) return null;
    welcomeMessage = welcome || undefined;
  }

  // ============================================================================
  // Summary
  // ============================================================================

  const summaryLines = [
    `${t("mode")}: ${isProduction ? t("production") : t("development")}`,
    `${t("auth")}: ${authMode}`,
  ];

  if (oauthProviders.length > 0) {
    summaryLines.push(`OAuth: ${oauthProviders.join(", ")}`);
  }

  if (needsDatabase) {
    summaryLines.push(`${t("database")}: ${database}`);
  }

  if (deployTarget) {
    summaryLines.push(`${t("deploy")}: ${deployTarget}`);
  }

  summaryLines.push("");
  summaryLines.push(`LangGraph URL: ${langGraphUrl}`);
  summaryLines.push(`Graph ID: ${graphId}`);
  summaryLines.push(`Frontend URL: ${frontendUrl}`);

  if (databaseUrl) {
    // Mask password in database URL
    const maskedDbUrl = databaseUrl.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
    summaryLines.push(`Database: ${maskedDbUrl}`);
  }

  if (appName) {
    summaryLines.push(`App Name: ${appName}`);
  }

  note(summaryLines.join("\n"), t("configSummary"));

  const confirmed = await p.confirm({
    message: t("proceedWithConfig"),
  });

  if (p.isCancel(confirmed) || !confirmed) return null;

  return {
    runMode: runMode as RunMode,
    authMode: authMode as AuthMode,
    oauthProviders,
    database,
    deployTarget,
    runInBackground,
    langGraphUrl,
    frontendUrl,
    graphId,
    langSmithApiKey: langSmithApiKey || undefined,
    langSmithProject,
    databaseUrl,
    nextAuthSecret,
    googleClientId,
    googleClientSecret,
    githubClientId,
    githubClientSecret,
    appName,
    logoUrl,
    welcomeMessage,
  };
}

async function runSetup(config: SetupConfig) {
  const s = p.spinner();

  // 1. Generate .env file
  s.start(t("generatingEnv"));
  generateEnvFile(config);
  s.stop(t("envCreated"));

  // 2. Install dependencies (use stdio: inherit so progress/errors are visible)
  p.log.step(t("installingDeps"));
  try {
    const installResult = crossSpawn.sync("pnpm", ["install"], {
      cwd: FRONTEND_DIR,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "development" },
    });
    if (installResult.status !== 0) {
      throw new Error(`pnpm install exited with code ${installResult.status}`);
    }
    p.log.success(t("depsInstalled"));
  } catch (error) {
    p.log.error(LANG === "ko" ? "의존성 설치 실패" : "Failed to install dependencies");
    if (error instanceof Error) {
      console.error(error.message);
    }
    throw error;
  }

  // 3. Setup Prisma (if needed)
  const needsDatabase = config.authMode === "credentials" || config.authMode === "oauth";
  if (needsDatabase) {
    s.start(t("settingUpDb"));
    try {
      await runAsync("pnpm", ["exec", "prisma", "generate"], { cwd: FRONTEND_DIR });
      await runAsync("pnpm", ["exec", "prisma", "db", "push", "--skip-generate"], { cwd: FRONTEND_DIR });
      s.stop(t("dbReady"));
    } catch (error) {
      s.stop(LANG === "ko" ? "데이터베이스 설정 실패" : "Failed to setup database");
      if (error instanceof Error && "stderr" in error) {
        console.error((error as { stderr: string }).stderr);
      }
      throw error;
    }

    // 4. Save initial settings to database (if branding was configured)
    if (config.appName || config.logoUrl || config.welcomeMessage) {
      s.start(t("savingSettings"));
      await saveInitialSettings(config);
      s.stop(t("settingsSaved"));
    }
  }

  // 5. Run based on mode
  if (config.runMode === "development") {
    await runDevelopment(config);
  } else {
    await runProduction(config);
  }
}

async function saveInitialSettings(config: SetupConfig) {
  // Create a simple script to insert settings
  const settings: Record<string, unknown> = {};

  if (config.appName) {
    settings["branding.appTitle"] = config.appName;
  }
  if (config.logoUrl) {
    settings["branding.logoUrl"] = config.logoUrl;
  }
  if (config.welcomeMessage) {
    settings["ui.welcomeMessage"] = config.welcomeMessage;
  }

  if (Object.keys(settings).length === 0) return;

  // Use Prisma to insert settings
  const insertScript = `
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    async function main() {
      const settings = ${JSON.stringify(settings)};

      for (const [key, value] of Object.entries(settings)) {
        await prisma.globalSetting.upsert({
          where: { key },
          create: {
            key,
            value: JSON.stringify(value),
            category: key.split('.')[0],
          },
          update: {
            value: JSON.stringify(value),
          },
        });
      }
    }

    main().finally(() => prisma.$disconnect());
  `;

  const scriptPath = path.join(FRONTEND_DIR, "_init-settings.cjs");
  fs.writeFileSync(scriptPath, insertScript);

  try {
    await runAsync("node", [scriptPath], { cwd: FRONTEND_DIR });
  } finally {
    fs.unlinkSync(scriptPath);
  }
}

async function runDevelopment(config: SetupConfig) {
  showLangGraphServerGuide(config);

  p.log.success(pc.green(t("startingDevServer")));
  p.log.info(pc.dim(`${t("serverRunningAt")} ${config.frontendUrl}`));
  p.log.info(pc.dim(`${t("seeExampleAt")} examples/${getExampleName(config)}/`));

  // Show admin account notice for auth modes that have user registration
  if (config.authMode === "credentials" || config.authMode === "oauth") {
    p.log.info("");
    p.log.info(pc.yellow(`💡 ${t("firstRunAdminNotice")}`));
  }

  p.log.info(pc.dim(t("pressCtrlC")));

  // Run dev server and surface its logs so startup failures are actionable.
  const devProcess = crossSpawn(
    "pnpm",
    getServerScriptArgs("dev", config.frontendUrl),
    {
      cwd: FRONTEND_DIR,
      stdio: ["ignore", "inherit", "inherit"],
      env: getServerEnv(config.frontendUrl),
    }
  );

  devProcess.on("error", (err) => {
    p.log.error(`Failed to start dev server: ${err.message}`);
    process.exit(1);
  });

  devProcess.on("close", (code, signal) => {
    if (signal) {
      p.log.error(`Development server exited with signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 1);
  });

  // Handle exit
  process.on("SIGINT", () => {
    devProcess.kill();
    p.outro(pc.green(LANG === "ko" ? "서버가 중지되었습니다." : "Server stopped."));
    process.exit(0);
  });

  // Keep the process alive
  await new Promise(() => {});
}

async function runProduction(config: SetupConfig) {
  const s = p.spinner();

  switch (config.deployTarget) {
    case "vercel":
      await deployToVercel(config);
      break;

    case "docker":
      await buildDocker(config, s);
      break;

    case "self-hosted":
      await runSelfHosted(config, s);
      break;
  }

  showLangGraphServerGuide(config);
}

async function deployToVercel(config: SetupConfig) {
  const s = p.spinner();

  // Check if vercel CLI is installed
  try {
    execSync("vercel --version", { stdio: "ignore" });
  } catch {
    s.start(t("vercelNotFound"));
    await runAsync("npm", ["install", "-g", "vercel"], {});
    s.stop(LANG === "ko" ? "Vercel CLI 설치 완료!" : "Vercel CLI installed!");
  }

  note(
    `${t("vercelInstructions")}

${getEnvVarsForProduction(config)}

${t("thenRun")} ${pc.cyan("cd frontend && vercel")}`,
    t("vercelDeployment")
  );
}

async function buildDocker(config: SetupConfig, s: ReturnType<typeof p.spinner>) {
  // Check if Dockerfile exists
  const dockerfilePath = path.join(FRONTEND_DIR, "Dockerfile");

  if (!fs.existsSync(dockerfilePath)) {
    s.start(t("creatingDockerfile"));
    createDockerfile();
    s.stop(t("dockerfileCreated"));
  }

  s.start(t("buildingDocker"));
  try {
    await runAsync("docker", ["build", "-t", "langgraph-chat-ui", "."], { cwd: FRONTEND_DIR });
    s.stop(t("dockerBuilt"));
  } catch (error) {
    s.stop(LANG === "ko" ? "Docker 빌드 실패" : "Docker build failed");
    if (error instanceof Error && "stderr" in error) {
      console.error((error as { stderr: string }).stderr);
    }
    throw error;
  }

  note(
    `${t("runContainer")}

${pc.cyan(`docker run -d -p 3000:3000 \\
  -e NEXT_PUBLIC_API_URL=${config.langGraphUrl} \\
  -e AUTH_MODE=${config.authMode} \\
  ${config.nextAuthSecret ? `-e NEXTAUTH_SECRET=*** \\
  -e DATABASE_URL=*** \\` : ""}
  langgraph-chat-ui`)}`,
    t("dockerDeployment")
  );
}

async function runSelfHosted(config: SetupConfig, s: ReturnType<typeof p.spinner>) {
  s.start(t("buildingForProd"));
  try {
    await runAsync("pnpm", ["build"], { cwd: FRONTEND_DIR });
    s.stop(t("buildComplete"));
  } catch (error) {
    s.stop(LANG === "ko" ? "빌드 실패" : "Build failed");
    if (error instanceof Error && "stderr" in error) {
      console.error((error as { stderr: string }).stderr);
    }
    throw error;
  }

  if (config.runInBackground) {
    // Try pm2 first, fallback to nohup
    const usePm2 = hasPm2();

    if (usePm2) {
      execSync("pm2 start pnpm --name langgraph-chat-ui -- start", {
        cwd: FRONTEND_DIR,
        stdio: "inherit",
        env: getServerEnv(config.frontendUrl),
      });

      p.log.success(pc.green(t("serverStartedBackground")));
      p.log.info(`${t("serverRunningAt")} ${config.frontendUrl}`);
      p.log.info(pc.dim(`${t("seeExampleAt")} examples/${getExampleName(config)}/`));

      // Show admin account notice for auth modes that have user registration
      if (config.authMode === "credentials" || config.authMode === "oauth") {
        p.log.info("");
        p.log.info(pc.yellow(`💡 ${t("firstRunAdminNotice")}`));
      }

      note(
        `${t("toStopServer")}
${pc.cyan("pm2 stop langgraph-chat-ui")}
${pc.cyan("pm2 delete langgraph-chat-ui")}

# View logs
${pc.cyan("pm2 logs langgraph-chat-ui")}`,
        "pm2"
      );
    } else {
      // Use nohup as fallback
      const logFile = path.join(FRONTEND_DIR, "server.log");
      const pidFile = path.join(FRONTEND_DIR, "server.pid");

      spawn("nohup", ["pnpm", "start"], {
        cwd: FRONTEND_DIR,
        detached: true,
        stdio: ["ignore", fs.openSync(logFile, "a"), fs.openSync(logFile, "a")],
        env: getServerEnv(config.frontendUrl),
      }).unref();

      // Get the PID
      setTimeout(() => {
        try {
          const pid = execSync("pgrep -f 'next start'", { encoding: "utf-8" }).trim();
          fs.writeFileSync(pidFile, pid);
        } catch {
          // Ignore
        }
      }, 2000);

      p.log.success(pc.green(t("serverStartedBackground")));
      p.log.info(`${t("serverRunningAt")} ${config.frontendUrl}`);
      p.log.info(pc.dim(`${t("seeExampleAt")} examples/${getExampleName(config)}/`));

      // Show admin account notice for auth modes that have user registration
      if (config.authMode === "credentials" || config.authMode === "oauth") {
        p.log.info("");
        p.log.info(pc.yellow(`💡 ${t("firstRunAdminNotice")}`));
      }

      note(
        `${t("toStopServer")}
${pc.cyan(`kill $(cat ${pidFile})`)}

# View logs
${pc.cyan(`tail -f ${logFile}`)}`,
        "nohup"
      );
    }
  } else {
    p.log.success(pc.green(t("startingProdServer")));
    p.log.info(pc.dim(`${t("serverRunningAt")} ${config.frontendUrl}`));
    p.log.info(pc.dim(`${t("seeExampleAt")} examples/${getExampleName(config)}/`));

    // Show admin account notice for auth modes that have user registration
    if (config.authMode === "credentials" || config.authMode === "oauth") {
      p.log.info("");
      p.log.info(pc.yellow(`💡 ${t("firstRunAdminNotice")}`));
    }

    p.log.info(pc.dim(t("pressCtrlC")));

    const startProcess = crossSpawn(
      "pnpm",
      getServerScriptArgs("start", config.frontendUrl),
      {
        cwd: FRONTEND_DIR,
        stdio: ["ignore", "inherit", "inherit"],
        env: getServerEnv(config.frontendUrl),
      }
    );

    startProcess.on("error", (err) => {
      p.log.error(`Failed to start server: ${err.message}`);
      process.exit(1);
    });

    startProcess.on("close", (code, signal) => {
      if (signal) {
        p.log.error(`Production server exited with signal ${signal}`);
        process.exit(1);
      }
      process.exit(code ?? 1);
    });

    process.on("SIGINT", () => {
      startProcess.kill();
      p.outro(pc.green(LANG === "ko" ? "서버가 중지되었습니다." : "Server stopped."));
      process.exit(0);
    });

    // Keep the process alive
    await new Promise(() => {});
  }
}

function hasPm2(): boolean {
  try {
    execSync("pm2 --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function generateEnvFile(config: SetupConfig) {
  const lines: string[] = [
    "# =============================================================================",
    "# LangGraph Chat UI Configuration",
    `# Generated by setup script - Mode: ${config.runMode}, Auth: ${config.authMode}`,
    "# =============================================================================",
    "",
    "# LangGraph Server",
    `NEXT_PUBLIC_API_URL=${config.langGraphUrl}`,
    `NEXT_PUBLIC_ASSISTANT_ID=${config.graphId}`,
  ];

  if (config.langSmithApiKey) {
    lines.push(
      "",
      "# LangSmith (Tracing)",
      `LANGSMITH_API_KEY=${config.langSmithApiKey}`,
      `LANGSMITH_PROJECT=${config.langSmithProject || "default"}`
    );
  }

  lines.push(
    "",
    "# Auth Mode",
    `AUTH_MODE=${config.authMode}`,
    `NEXT_PUBLIC_AUTH_MODE=${config.authMode}`
  );

  if (config.nextAuthSecret) {
    lines.push(
      "",
      "# NextAuth Configuration",
      `NEXTAUTH_URL=${config.frontendUrl}`,
      `NEXTAUTH_SECRET=${config.nextAuthSecret}`
    );
  }

  if (config.databaseUrl) {
    lines.push("", "# Database", `DATABASE_URL="${config.databaseUrl}"`);
  }

  if (config.googleClientId) {
    lines.push(
      "",
      "# Google OAuth",
      `GOOGLE_CLIENT_ID=${config.googleClientId}`
    );
    if (config.googleClientSecret) {
      lines.push(`GOOGLE_CLIENT_SECRET=${config.googleClientSecret}`);
    }
  }

  if (config.githubClientId) {
    lines.push(
      "",
      "# GitHub OAuth",
      `GITHUB_CLIENT_ID=${config.githubClientId}`
    );
    if (config.githubClientSecret) {
      lines.push(`GITHUB_CLIENT_SECRET=${config.githubClientSecret}`);
    }
  }

  if (config.authMode === "credentials" || config.authMode === "oauth") {
    lines.push("", "# Registration Policy: open | approval", "REGISTRATION_POLICY=open");
  }

  const envFileName = config.runMode === "production" ? ".env.production" : ".env";
  fs.writeFileSync(path.join(FRONTEND_DIR, envFileName), lines.join("\n") + "\n");

  // Also create .env for production (Next.js needs it at build time)
  if (config.runMode === "production") {
    fs.writeFileSync(path.join(FRONTEND_DIR, ".env"), lines.join("\n") + "\n");
  }
}

function generateRandomSecret(): string {
  try {
    return execSync("openssl rand -base64 32", { encoding: "utf-8" }).trim();
  } catch {
    const crypto = require("node:crypto");
    return crypto.randomBytes(32).toString("base64");
  }
}

function getDefaultDatabaseUrl(database: Database): string {
  switch (database) {
    case "sqlite":
      return "file:./prisma/dev.db";
    case "postgresql":
      return "postgresql://user:password@localhost:5432/dbname";
    case "mysql":
      return "mysql://user:password@localhost:3306/dbname";
  }
}

function getEnvVarsForProduction(config: SetupConfig): string {
  const vars = [
    `NEXT_PUBLIC_API_URL=${config.langGraphUrl}`,
    `AUTH_MODE=${config.authMode}`,
    `NEXT_PUBLIC_AUTH_MODE=${config.authMode}`,
  ];

  if (config.nextAuthSecret) {
    vars.push(
      `NEXTAUTH_URL=${config.frontendUrl}`,
      `NEXTAUTH_SECRET=${config.nextAuthSecret}`
    );
  }

  if (config.databaseUrl) {
    vars.push(`DATABASE_URL=${config.databaseUrl}`);
  }

  if (config.googleClientId) {
    vars.push(`GOOGLE_CLIENT_ID=${config.googleClientId}`);
    if (config.googleClientSecret) {
      vars.push(`GOOGLE_CLIENT_SECRET=${config.googleClientSecret}`);
    }
  }

  if (config.githubClientId) {
    vars.push(`GITHUB_CLIENT_ID=${config.githubClientId}`);
    if (config.githubClientSecret) {
      vars.push(`GITHUB_CLIENT_SECRET=${config.githubClientSecret}`);
    }
  }

  return vars.map((v) => `  ${v}`).join("\n");
}

function createDockerfile() {
  const dockerfile = `FROM node:22.13-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN corepack enable pnpm && pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
`;

  fs.writeFileSync(path.join(FRONTEND_DIR, "Dockerfile"), dockerfile);
}

function getExampleName(config: SetupConfig): string {
  let exampleName = AUTH_MODE_TO_EXAMPLE[config.authMode];

  if (config.authMode === "oauth") {
    if (config.oauthProviders.length > 1) {
      exampleName = "multiple-oauth";
    } else if (config.oauthProviders.includes("github")) {
      exampleName = "github-oauth";
    } else {
      exampleName = "google-oauth";
    }
  }

  return exampleName;
}

function showLangGraphServerGuide(config: SetupConfig) {
  const exampleName = getExampleName(config);

  note(
    `${t("langGraphGuide")}

${pc.cyan(`cd examples/${exampleName}/server`)}

# ${t("installDeps")}
${pc.dim("pip install -e '.[dev]'")}

# ${t("configureEnv")}
${pc.dim("cp .env.example .env")}
${pc.dim("# Edit .env with your API keys")}

# ${t("startServer")}
${pc.dim("langgraph dev")}

${t("forMoreDetails")} ${pc.underline(`examples/${exampleName}/README.md`)}`,
    t("langGraphServer")
  );
}

main().catch(console.error);
