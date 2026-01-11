# LangGraph Chat UI

![TeddyNote Chat](assets/chat-interface.png)

LangGraph 에이전트를 위한 Next.js 기반 채팅 인터페이스입니다. 다중 Connection 관리 기능과 설정 커스터마이징을 제공합니다.

## 주요 기능

- 다중 Connection 및 다중 그래프 지원
- LangGraph thread 기반 대화 저장
- Tool Calls 시각화
- 실시간 스트리밍 응답
- 가이드 문서 커스터마이징
- 앱 설정 커스터마이징
- 테마 설정 (Dark/Light/Auto)
- [ ] OAuth 기반 인증 기능
- [ ] Middleware 로그 뷰어 기능
- [ ] Docker 이미지 지원

## 요구사항

- Node.js 18.x 이상
- pnpm 8.x 이상 (패키지 매니저)
- LangGraph 백엔드 서버 (`langgraph dev`)

## 사용법

### 1. 저장소 복제

```bash
git clone git@github.com:teddynote-lab/langgraph-chat-ui.git
cd langgraph-chat-ui
```

### 2. 의존성 설치

```bash
pnpm install
```

### 3. 환경 변수 설정

```bash
cd ../langgraph-chat-ui
cp .env.example .env
```

```env
# 필수: LangGraph API 엔드포인트 (로컬 개발용)
NEXT_PUBLIC_API_URL=http://localhost:2024

# 선택: Assistant/Graph ID
NEXT_PUBLIC_ASSISTANT_ID=agent

# 선택: 프로덕션 배포용
LANGGRAPH_API_URL=https://your-deployment.langgraph.app
LANGSMITH_API_KEY=lsv2_...
```

### 4. 빌드 및 실행

```bash
pnpm run build
pnpm run start
```

앱이 `http://localhost:3000`에서 실행됩니다.

## 설정

### 앱 설정 파일

설정은 `src/configs/` 디렉토리의 TypeScript 파일로 관리됩니다.

| 파일 | 설명 |
|------|------|
| `src/configs/site.ts` | 전체 설정 |
| `src/configs/chat-openers.ts` | 대화 시작 예시 질문 |

### 설정 항목

`src/configs/site.ts`:

```typescript
export const siteConfig = {
  // 메타 정보 (브라우저 탭)
  meta: {
    title: "My Chat",              // 페이지 타이틀
    description: "AI 어시스턴트",   // 메타 설명
    favicon: "",                   // 파비콘 경로 (빈값이면 logoPath 사용)
  },
  // 브랜딩
  branding: {
    appName: "My Chat",            // 앱 이름
    logoPath: "/logo.png",         // 로고 이미지 경로
    logoWidth: 28,                 // 로고 너비
    logoHeight: 28,                // 로고 높이
    description: "무엇이든 물어보세요.", // 랜딩 페이지 설명
    fullDescription: "/full-description.md", // 상세 설명 마크다운 경로
  },
  // 입력창
  buttons: {
    enableFileUpload: true,        // 파일 업로드 활성화
    chatInputPlaceholder: "메시지를 입력하세요.", // 입력창 placeholder
  },
  // 대화 기록
  threads: {
    showHistory: true,             // 대화 기록 사이드바 표시
    enableDeletion: true,          // 대화 삭제 허용
    enableTitleEdit: true,         // 대화 제목 편집 허용
    autoGenerateTitles: true,      // 대화 제목 자동 생성
    sidebarOpenByDefault: true,    // 사이드바 기본 열림
  },
  // 테마
  theme: {
    fontFamily: "sans",            // sans, serif, mono
    fontSize: "medium",            // small, medium, large
    colorScheme: "light",          // light, dark, auto
  },
  // UI 동작
  ui: {
    autoCollapseToolCalls: false,  // Tool Calls 자동 접기
    chatWidth: "default",          // default, wide
  },
};
```

`src/configs/chat-openers.ts`:

```typescript
export const chatOpeners = [
  "오늘의 날씨는 어때?",
  "Python 코딩 도움이 필요해",
  // ...
];
```

### Connection 관리

앱 실행 후 설정 Dialog에서 여러 서버 연결을 관리할 수 있습니다.

- 기본값: `.env`에 설정된 기본 Connection (서버 사이드 설정)
- 새 Connection 추가 및 URL 자동 검증 (클라이언트 사이드에 저장)
- Connection 간 빠른 전환 가능

### Connection 추가 시 필드

| 필드 | 필수 | 설명 |
|------|------|------|
| API URL | ✅ | LangGraph 서버 URL |
| Connection 이름 | ❌ | Connection 이름 |
| Assistant ID | ❌ | Graph 이름 (빈값이면 목록에서 선택 가능) |
| API 키 | ❌ | LangSmith API 키 |


## 사용자 가이드

전체 사용자 가이드는 `public/full-description.md`에 위치합니다. 이 마크다운 파일은 사용자가 랜딩 페이지에서 "자세한 설명 보기" 버튼을 클릭할 때 표시됩니다.

### 가이드 업데이트 방법

1. `public/full-description.md` 파일 편집
2. 표준 마크다운 문법 사용
3. 파일 저장시 자동으로 앱에 반영


## 고급 기능

### Artifact 렌더링

채팅 인터페이스는 사이드 패널에서 Artifact (코드, 문서, 시각화)를 렌더링할 수 있습니다. Artifact는 LangGraph 서버 응답 메타데이터를 통해 관리됩니다.

### 도구 호출 가시성

사용자는 채팅 입력창의 렌치 아이콘을 사용하여 도구 호출의 가시성을 전환할 수 있습니다. 숨김 상태에서는 최종 응답만 표시되어 깔끔한 인터페이스를 제공합니다.

### 자동 접기 동작

설정에서 `autoCollapseToolCalls`가 활성화되면 AI 응답이 완료된 후 도구 호출 세부사항이 자동으로 접혀 대화 기록을 깔끔하게 유지합니다.

### 대화 관리

- 대화는 생성된 제목과 함께 자동으로 저장됩니다
- 사용자는 대화 이름을 변경하거나 삭제할 수 있습니다
- 사이드바에서 대화 기록에 빠르게 접근할 수 있습니다
- 스레드 상태는 브라우저 세션 간에 유지됩니다

## 라이선스

MIT License

Copyright (c) 2025 TeddyNote

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 참고 자료

- YouTube 채널: [테디노트](https://youtube.com/c/teddynote)
- LangChain 문서: [LangChain Documentation](https://docs.langchain.com/)
- Next.js 문서: [nextjs.org/docs](https://nextjs.org/docs)

