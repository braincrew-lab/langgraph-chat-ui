<div align="center">

# LangGraph Chat UI

![LangGraph Chat UI](./assets/chat-interface.png)

**LangGraph 에이전트를 위한 프로덕션 레디 채팅 인터페이스**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

[English](./README_EN.md) | 한국어

[문서](docs/) · [예제](examples/) · [이슈 제보](https://github.com/teddynote-lab/langgraph-chat-ui/issues)

</div>

---

## 목차

- [소개](#소개)
- [주요 기능](#주요-기능)
- [빠른 시작](#빠른-시작)
- [설정](#설정)
- [인증 시스템](#인증-시스템)
- [관리자 대시보드](#관리자-대시보드)
- [보안](#보안)
- [배포](#배포)
- [기술 스택](#기술-스택)
- [기여하기](#기여하기)
- [라이선스](#라이선스)

---

## 소개

LangGraph Chat UI는 [LangGraph](https://github.com/langchain-ai/langgraph) 에이전트와 상호작용하기 위한 Next.js 기반 웹 애플리케이션입니다. 단순한 채팅 인터페이스를 넘어 사용자 인증, 관리자 대시보드, 다중 Connection 관리 등 프로덕션 환경에 필요한 기능을 제공합니다.

### 왜 LangGraph Chat UI인가?

- **프로덕션 레디** — NextAuth 기반 인증, 사용자 관리, 관리자 대시보드 내장
- **유연한 설정** — 환경 변수부터 관리자 UI까지 다양한 수준의 설정 제어
- **다중 서버 지원** — 여러 LangGraph 서버를 하나의 UI에서 관리
- **보안 강화** — Server Action 인증, SSRF 방지, CORS 제한, 쿠키 보안
- **현대적인 스택** — Next.js 15, React 19, Tailwind CSS 4, TypeScript

---

## 주요 기능

<details>
<summary><b>채팅 인터페이스</b></summary>

| 기능 | 설명 |
|---|---|
| 실시간 스트리밍 | SSE 기반 실시간 응답 스트리밍 |
| 다중 Connection | 여러 LangGraph 서버 연결 관리 |
| 다중 그래프 | 하나의 서버에서 여러 그래프 선택 |
| Tool Calls 시각화 | 에이전트의 도구 호출 과정 표시 |
| 중간 노드 추적 | 서브그래프 실행 과정 실시간 표시 |
| 스레드 관리 | 대화 기록 저장, 이름 변경, 삭제 |
| 파일 업로드 | 이미지 및 파일 첨부 지원 |
| LaTeX 수식 | KaTeX 기반 수학 수식 렌더링 |
| LangSmith 추적 | LangSmith 추적과 실시간 연동 |
| 동적 폼 UI | input_schema 기반 자동 폼 생성 |

</details>

<details>
<summary><b>인증 및 사용자 관리</b></summary>

| 기능 | 설명 |
|---|---|
| NextAuth 통합 | Credentials, OAuth, Email 인증 |
| 회원가입 정책 | 자유 가입 / 관리자 승인 선택 |
| 사용자 상태 | 활성 / 대기 / 정지 상태 관리 |
| 역할 기반 접근 | 관리자(admin) / 일반 사용자(user) |
| Server Action 보호 | 모든 서버 액션에 인증 체크 적용 |

</details>

<details>
<summary><b>관리자 대시보드</b></summary>

| 기능 | 설명 |
|---|---|
| 사용자 관리 | 목록 조회, 역할 변경, 상태 변경, 삭제 |
| 가입 승인 | 대기 중인 가입 요청 승인/거부 |
| 전역 설정 | 기능 활성화, 기본 Connection 설정 |
| 기능 제어 | 개별 기능별 활성화/비활성화 |
| 감사 로그 | 사용자 관리 작업 이력 기록 |

</details>

<details>
<summary><b>커스터마이징</b></summary>

| 기능 | 설명 |
|---|---|
| 브랜딩 | 로고, 앱 이름, 설명 변경 |
| 테마 | 다크/라이트/자동 테마 (시스템 연동) |
| 대화 시작 질문 | 채팅 시작 예시 질문 커스터마이징 |
| 사용자 가이드 | 마크다운 기반 도움말 페이지 |

</details>

---

## 빠른 시작

### 요구사항

- **Node.js** 18.x 이상
- **pnpm** 8.x 이상
- **LangGraph 서버** 실행 중 (`langgraph dev`)

### 설치 및 실행

```bash
# 1. 저장소 복제
git clone https://github.com/teddynote-lab/langgraph-chat-ui.git
cd langgraph-chat-ui

# 2. 의존성 설치
pnpm install

# 3. 대화형 설정 및 실행
pnpm launch
```

`pnpm launch` 명령어를 실행하면 대화형 설정 마법사가 시작됩니다:

1. **실행 모드 선택** — Development / Production
2. **인증 모드 선택** — standalone, credentials, oauth, oauth-direct
3. **LangGraph 서버 URL** 입력
4. **LangSmith API 키** 입력 (선택)
5. **데이터베이스 마이그레이션** 자동 실행 (인증 모드에 따라)
6. **서버 자동 시작**

> 언어는 시스템 로케일에 따라 자동 감지됩니다 (한국어/English).

> 인증 모드별 상세 설정은 `examples/` 폴더의 예제를 참고하세요.

### 인증 모드

| 모드 | 설명 | NextAuth | DB 필요 |
|---|---|---|---|
| `standalone` | 인증 없이 바로 사용 (로컬 개발용) | - | - |
| `credentials` | 이메일/비밀번호 로그인 | O | O |
| `oauth` | Google, GitHub 등 OAuth 로그인 | O | O |
| `oauth-direct` | LangGraph 서버가 OAuth 처리 | - | - |

### 환경 변수 (수동 설정)

`pnpm launch`를 사용하지 않고 수동으로 설정하려면:

```bash
cp .env.example .env
```

```env
# 인증 모드 (standalone, credentials, oauth, oauth-direct)
AUTH_MODE=standalone

# LangGraph 서버 URL
NEXT_PUBLIC_API_URL=http://localhost:2024

# 기본 Graph ID (선택)
NEXT_PUBLIC_ASSISTANT_ID=agent

# NextAuth 시크릿 (credentials, oauth, email 모드에서 필요)
NEXTAUTH_SECRET=your-secret-key

# 데이터베이스 (credentials, oauth, email 모드에서 필요)
DATABASE_URL="file:./prisma/dev.db"

# LangSmith 추적 (선택)
LANGSMITH_API_KEY=lsv2_pt_xxxxx
```

```bash
# 데이터베이스 마이그레이션 (credentials, oauth, email 모드에서 필요)
pnpm prisma migrate dev

# 개발 서버 실행
pnpm dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

### 첫 번째 관리자 계정

인증 모드가 `credentials`, `oauth`, `email`인 경우, 최초 회원가입한 사용자는 자동으로 관리자 권한을 부여받습니다.

---

## 설정

### 앱 설정 파일

설정은 `src/configs/` 디렉토리에서 관리됩니다.

| 파일 | 설명 |
|---|---|
| `site.ts` | 앱 전체 설정 (브랜딩, 테마, UI 동작) |
| `chat-openers.ts` | 대화 시작 예시 질문 |

### 주요 설정 항목

```typescript
// src/configs/site.ts
export const siteConfig = {
  meta: {
    title: "My Chat",
    description: "AI 어시스턴트",
  },
  branding: {
    appName: "My Chat",
    logoPath: "/logo.png",
    description: "무엇이든 물어보세요.",
  },
  buttons: {
    enableFileUpload: true,
    chatInputPlaceholder: "메시지를 입력하세요.",
  },
  threads: {
    showHistory: true,
    enableDeletion: true,
    autoGenerateTitles: true,
  },
  theme: {
    colorScheme: "auto", // light, dark, auto
  },
};
```

### Connection 관리

앱 실행 후 설정에서 여러 LangGraph 서버를 관리할 수 있습니다.

| 필드 | 필수 | 설명 |
|---|---|---|
| API URL | O | LangGraph 서버 URL |
| Connection 이름 | - | 구분을 위한 이름 |
| Assistant ID | - | Graph ID (미입력시 목록 선택) |
| API 키 | - | LangSmith API 키 |

---

## 인증 시스템

### 아키텍처

Next.js에서 DB 기반 사용자 인증을 처리하고, LangGraph 서버는 JWT 검증만 수행합니다.

<img width="800" alt="image" src="https://github.com/user-attachments/assets/e8eab9cb-e0b5-4a14-95ad-a3ab2844f3ac" />

### 핵심 원칙

| 구성 요소 | 역할 | DB 접근 |
|---|---|---|
| **Next.js** | 사용자 인증, DB 관리, JWT 발급 | O |
| **LangGraph** | JWT 검증, 에이전트 실행 | - |

> **중요**: `AUTH_SECRET` (Next.js)과 `JWT_SECRET_KEY` (LangGraph)는 동일한 값이어야 합니다.

### 지원 데이터베이스

| DB | 지원 상태 | 용도 |
|---|---|---|
| **SQLite** | 지원 | 개발, 소규모 배포 |
| **PostgreSQL** | 추후 지원 예정 | 프로덕션 확장 |
| **MySQL** | 추후 지원 예정 | 프로덕션 확장 |

> Prisma ORM을 사용하므로 추후 다른 RDB로 쉽게 확장할 수 있습니다.

### 회원가입 정책

관리자 대시보드에서 설정 가능:

| 정책 | 동작 |
|---|---|
| `open` | 자유 가입 (기본값) |
| `approval` | 관리자 승인 후 활성화 |

### 사용자 상태

| 상태 | 설명 |
|---|---|
| `active` | 정상 사용 가능 |
| `pending` | 승인 대기 중 (로그인 불가) |
| `suspended` | 정지됨 (로그인 불가) |

### LangGraph 서버 인증 연동

LangGraph Platform에 JWT 기반 인증을 연동하는 방법은 [인증 가이드 개요](docs/00-OVERVIEW.md)를 참고하세요.

---

## 관리자 대시보드

`/admin` 경로에서 관리자 기능에 접근할 수 있습니다.

### 사용자 관리

- 전체 사용자 목록 조회
- 역할 변경 (관리자 / 일반 사용자)
- 상태 변경 (활성화 / 정지)
- 사용자 삭제

### 가입 승인

회원가입 정책이 `approval`일 때:

- 대기 중인 가입 요청 목록
- 승인 또는 거부 처리

### 전역 설정

| 설정 | 설명 |
|---|---|
| 회원가입 정책 | open / approval |
| 기능 활성화 | 각 기능별 on/off |
| 기본 Connection | 서버 전역 기본값 설정 |
| Connection 선택 | 사용자의 Connection 변경 허용 여부 |

---

## 보안

이 프로젝트는 다음과 같은 보안 조치를 적용하고 있습니다:

| 영역 | 조치 |
|---|---|
| **Server Actions** | 모든 서버 액션에 인증 체크 (`requireAuth`) |
| **API 프록시** | SSRF 방지 (프라이빗 IP 차단), CORS 출처 제한 |
| **쿠키 보안** | API 키 쿠키에 `httpOnly`, `secure` 플래그 적용 |
| **파일 업로드** | MIME 타입 기반 확장자 결정, SVG XSS 방지 |
| **JWT** | 공유 시크릿 기반 서버 간 인증, 안전한 토큰 생성 |
| **데이터 무결성** | Prisma 트랜잭션으로 원자적 사용자 상태 변경 |
| **입력 검증** | LangSmith API의 UUID 형식 검증 |

---

## 배포

### 배포 옵션

| 옵션 | LangSmith 필요 | 인프라 | 권장 용도 |
|---|---|---|---|
| LangGraph Platform | O (무료 가능) | Redis + PostgreSQL | 공식 지원, 빠른 설정 |
| FastAPI Standalone | - | 선택적 | 완전 독립, 커스텀 |

자세한 내용은 [LangGraph 서버 배포 가이드](docs/LANGGRAPH_DEPLOYMENT_GUIDE.md)를 참고하세요.

### Docker 배포 (예정)

```bash
# Docker 이미지 빌드
docker build -t langgraph-chat-ui .

# 실행
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e AUTH_SECRET="..." \
  langgraph-chat-ui
```

### Vercel 배포

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/teddynote-lab/langgraph-chat-ui)

1. Vercel에서 저장소 연결
2. 환경 변수 설정
3. PostgreSQL 데이터베이스 연결 (Vercel Postgres 권장)

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js 15 (App Router) |
| UI 라이브러리 | React 19, Radix UI, Framer Motion |
| 스타일링 | Tailwind CSS 4 |
| 언어 | TypeScript 5.7 |
| 인증 | NextAuth.js 5 (Auth.js) |
| 데이터베이스 | Prisma ORM (SQLite / PostgreSQL) |
| LangGraph | @langchain/langgraph-sdk |
| 마크다운 | react-markdown, KaTeX, remark-gfm |

---

## 문서

| 문서 | 설명 |
|---|---|
| [인증 가이드 개요](docs/00-OVERVIEW.md) | 인증 방식 비교 및 선택 가이드 |
| [LangGraph 서버 배포 가이드](docs/LANGGRAPH_DEPLOYMENT_GUIDE.md) | Platform vs FastAPI, Docker Compose 설정 |
| [예제 모음](examples/) | 인증 모드별 서버/프론트엔드 설정 예제 |

---

## 기여하기

기여는 언제나 환영합니다! 다음 단계를 따라주세요:

1. 이 저장소를 Fork 합니다
2. 새 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 Push 합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

### 개발 환경 설정

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev

# 프로덕션 빌드
pnpm build

# 린트 검사
pnpm lint
```

---

## 라이선스

이 프로젝트는 [MIT 라이선스](LICENSE) 하에 배포됩니다.

---

## 참고 자료

- [LangGraph 공식 문서](https://langchain-ai.github.io/langgraph/)
- [LangSmith 플랫폼](https://smith.langchain.com) — 에이전트 추적 및 모니터링
- [Next.js 문서](https://nextjs.org/docs)
- [NextAuth.js 문서](https://authjs.dev/)
- [테디노트 YouTube](https://youtube.com/c/teddynote)

---

<div align="center">

Made with ❤️ by [TeddyNote Lab](https://github.com/teddynote-lab)
<br/>
<sub>Based on <a href="https://github.com/langchain-ai/agent-chat-ui">langchain-ai/agent-chat-ui</a></sub>

</div>
