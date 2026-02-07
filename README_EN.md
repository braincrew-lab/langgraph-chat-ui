<div align="center">

# LangGraph Chat UI

![LangGraph Chat UI](./assets/chat-interface.png)

**A production-ready chat interface for LangGraph agents**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

English | [한국어](./README.md)

[Demo](https://agentchat.vercel.app) · [Docs](docs/) · [Examples](examples/) · [Report Issue](https://github.com/teddynote-lab/langgraph-chat-ui/issues)

</div>

---

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Authentication](#authentication)
- [Admin Dashboard](#admin-dashboard)
- [Security](#security)
- [Deployment](#deployment)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

---

## Introduction

LangGraph Chat UI is a Next.js-based web application for interacting with [LangGraph](https://github.com/langchain-ai/langgraph) agents. Beyond a simple chat interface, it provides production-grade features including user authentication, an admin dashboard, and multi-connection management.

### Why LangGraph Chat UI?

- **Production Ready** — Built-in NextAuth authentication, user management, and admin dashboard
- **Flexible Configuration** — Control settings from environment variables to the admin UI
- **Multi-Server Support** — Manage multiple LangGraph servers from a single UI
- **Security Hardened** — Server Action auth, SSRF prevention, CORS restrictions, cookie security
- **Modern Stack** — Next.js 15, React 19, Tailwind CSS 4, TypeScript

---

## Features

<details>
<summary><b>Chat Interface</b></summary>

| Feature | Description |
|---|---|
| Real-time Streaming | SSE-based real-time response streaming |
| Multi-Connection | Manage multiple LangGraph server connections |
| Multi-Graph | Select from multiple graphs on a single server |
| Tool Call Visualization | Display agent tool call processes |
| Intermediate Node Tracking | Real-time display of subgraph execution |
| Thread Management | Save, rename, and delete conversation history |
| File Upload | Image and file attachment support |
| LaTeX Rendering | KaTeX-based mathematical formula rendering |
| LangSmith Tracing | Real-time integration with LangSmith tracing |
| Dynamic Form UI | Automatic form generation from input_schema |

</details>

<details>
<summary><b>Authentication & User Management</b></summary>

| Feature | Description |
|---|---|
| NextAuth Integration | Credentials, OAuth, and Email authentication |
| Signup Policy | Open signup or admin approval required |
| User Status | Active / pending / suspended state management |
| Role-Based Access | Admin and regular user roles |
| Server Action Protection | Auth checks on all server actions |

</details>

<details>
<summary><b>Admin Dashboard</b></summary>

| Feature | Description |
|---|---|
| User Management | List, role changes, status changes, deletion |
| Signup Approval | Approve or reject pending signup requests |
| Global Settings | Feature toggles, default connection settings |
| Feature Control | Per-feature enable/disable |
| Audit Logging | User management operation history |

</details>

<details>
<summary><b>Customization</b></summary>

| Feature | Description |
|---|---|
| Branding | Custom logo, app name, and description |
| Theming | Dark / light / auto theme (system-aware) |
| Chat Openers | Customizable conversation starter questions |
| User Guide | Markdown-based help page |

</details>

---

## Quick Start

### Prerequisites

- **Node.js** 18.x or later
- **pnpm** 8.x or later
- **LangGraph server** running (`langgraph dev`)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/teddynote-lab/langgraph-chat-ui.git
cd langgraph-chat-ui

# 2. Install dependencies
pnpm install

# 3. Interactive setup and launch
pnpm launch
```

Running `pnpm launch` starts an interactive setup wizard:

1. **Run mode** — Development / Production
2. **Auth mode** — standalone, credentials, oauth, oauth-direct
3. **LangGraph server URL** input
4. **LangSmith API key** input (optional)
5. **Database migration** (auto, depending on auth mode)
6. **Auto-start server**

> Language is auto-detected based on your system locale.

> See the `examples/` directory for detailed per-mode configuration examples.

### Auth Modes

| Mode | Description | NextAuth | DB Required |
|---|---|---|---|
| `standalone` | No auth, immediate use (local dev) | - | - |
| `credentials` | Email/password login | Yes | Yes |
| `oauth` | Google, GitHub, etc. OAuth login | Yes | Yes |
| `oauth-direct` | LangGraph server handles OAuth | - | - |

### Environment Variables (Manual Setup)

To configure manually instead of using `pnpm launch`:

```bash
cp .env.example .env
```

```env
# Auth mode (standalone, credentials, oauth, oauth-direct)
AUTH_MODE=standalone

# LangGraph server URL
NEXT_PUBLIC_API_URL=http://localhost:2024

# Default Graph ID (optional)
NEXT_PUBLIC_ASSISTANT_ID=agent

# NextAuth secret (required for credentials, oauth, email modes)
NEXTAUTH_SECRET=your-secret-key

# Database (required for credentials, oauth, email modes)
DATABASE_URL="file:./prisma/dev.db"

# LangSmith tracing (optional)
LANGSMITH_API_KEY=lsv2_pt_xxxxx
```

```bash
# Database migration (required for credentials, oauth, email modes)
pnpm prisma migrate dev

# Start dev server
pnpm dev
```

Open `http://localhost:3000` in your browser.

### First Admin Account

When using `credentials`, `oauth`, or `email` auth modes, the first user to sign up is automatically granted admin privileges.

---

## Configuration

### Config Files

Configuration is managed in the `src/configs/` directory.

| File | Description |
|---|---|
| `site.ts` | App-wide settings (branding, theme, UI behavior) |
| `chat-openers.ts` | Conversation starter questions |

### Key Settings

```typescript
// src/configs/site.ts
export const siteConfig = {
  meta: {
    title: "My Chat",
    description: "AI Assistant",
  },
  branding: {
    appName: "My Chat",
    logoPath: "/logo.png",
    description: "Ask me anything.",
  },
  buttons: {
    enableFileUpload: true,
    chatInputPlaceholder: "Type a message...",
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

### Connection Management

After launching the app, you can manage multiple LangGraph servers from the settings panel.

| Field | Required | Description |
|---|---|---|
| API URL | Yes | LangGraph server URL |
| Connection Name | No | Display name for identification |
| Assistant ID | No | Graph ID (shows list if empty) |
| API Key | No | LangSmith API key |

---

## Authentication

### Architecture

Next.js handles DB-based user authentication, while the LangGraph server only performs JWT verification.

<img width="800" alt="image" src="https://github.com/user-attachments/assets/e8eab9cb-e0b5-4a14-95ad-a3ab2844f3ac" />

### Core Principles

| Component | Role | DB Access |
|---|---|---|
| **Next.js** | User auth, DB management, JWT issuance | Yes |
| **LangGraph** | JWT verification, agent execution | No |

> **Important**: `AUTH_SECRET` (Next.js) and `JWT_SECRET_KEY` (LangGraph) must be the same value.

### Supported Databases

| DB | Status | Use Case |
|---|---|---|
| **SQLite** | Supported | Development, small deployments |
| **PostgreSQL** | Planned | Production scaling |
| **MySQL** | Planned | Production scaling |

> Uses Prisma ORM, making it easy to switch to other relational databases in the future.

### Signup Policy

Configurable from the admin dashboard:

| Policy | Behavior |
|---|---|
| `open` | Open signup (default) |
| `approval` | Admin approval required |

### User Status

| Status | Description |
|---|---|
| `active` | Normal access |
| `pending` | Awaiting approval (login disabled) |
| `suspended` | Suspended (login disabled) |

### LangGraph Server Auth Integration

For JWT-based authentication with LangGraph Platform, see the [LangGraph Auth Guide](docs/LANGGRAPH_AUTH_GUIDE.md).

---

## Admin Dashboard

Access admin features at the `/admin` route.

### User Management

- View all users
- Change roles (admin / regular user)
- Change status (activate / suspend)
- Delete users

### Signup Approval

When signup policy is set to `approval`:

- View pending signup requests
- Approve or reject

### Global Settings

| Setting | Description |
|---|---|
| Signup Policy | open / approval |
| Feature Toggles | Per-feature on/off |
| Default Connection | Server-wide default values |
| Connection Selection | Allow users to change connections |

---

## Security

This project implements the following security measures:

| Area | Measure |
|---|---|
| **Server Actions** | Auth checks on all server actions (`requireAuth`) |
| **API Proxy** | SSRF prevention (private IP blocking), CORS origin restrictions |
| **Cookie Security** | `httpOnly` and `secure` flags on API key cookies |
| **File Upload** | MIME-type-based extension detection, SVG XSS prevention |
| **JWT** | Shared-secret server-to-server auth, secure token generation |
| **Data Integrity** | Prisma transactions for atomic user state changes |
| **Input Validation** | UUID format validation on LangSmith API parameters |

---

## Deployment

### Deployment Options

| Option | LangSmith Required | Infrastructure | Recommended For |
|---|---|---|---|
| LangGraph Platform | Yes (free tier available) | Redis + PostgreSQL | Official support, fast setup |
| FastAPI Standalone | No | Optional | Full independence, custom |

For details, see the [LangGraph Deployment Guide](docs/LANGGRAPH_DEPLOYMENT_GUIDE.md).

### Docker Deployment (Planned)

```bash
# Build Docker image
docker build -t langgraph-chat-ui .

# Run
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e AUTH_SECRET="..." \
  langgraph-chat-ui
```

### Vercel Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/teddynote-lab/langgraph-chat-ui)

1. Connect your repository on Vercel
2. Configure environment variables
3. Connect a PostgreSQL database (Vercel Postgres recommended)

---

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI Library | React 19, Radix UI, Framer Motion |
| Styling | Tailwind CSS 4 |
| Language | TypeScript 5.7 |
| Authentication | NextAuth.js 5 (Auth.js) |
| Database | Prisma ORM (SQLite / PostgreSQL) |
| LangGraph | @langchain/langgraph-sdk |
| Markdown | react-markdown, KaTeX, remark-gfm |

---

## Documentation

| Document | Description |
|---|---|
| [Auth Guide Overview](docs/00-OVERVIEW.md) | Auth method comparison and selection guide |
| [LangGraph Auth Guide](docs/LANGGRAPH_AUTH_GUIDE.md) | JWT verification, Supabase integration, resource access control |
| [LangGraph Deployment Guide](docs/LANGGRAPH_DEPLOYMENT_GUIDE.md) | Platform vs FastAPI, Docker Compose setup |
| [Examples](examples/) | Per-auth-mode server/frontend configuration examples |

The user guide can be edited at `public/full-description.md`. Use markdown to customize the in-app help page.

---

## Contributing

Contributions are always welcome! Follow these steps:

1. Fork this repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

### Development Setup

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Production build
pnpm build

# Lint
pnpm lint
```

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## References

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [LangSmith Platform](https://smith.langchain.com) — Agent tracing and monitoring
- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Documentation](https://authjs.dev/)
- [TeddyNote YouTube](https://youtube.com/c/teddynote)

---

<div align="center">

Made with ❤️ by [TeddyNote Lab](https://github.com/teddynote-lab)
<br/>
<sub>Based on <a href="https://github.com/langchain-ai/agent-chat-ui">langchain-ai/agent-chat-ui</a></sub>

</div>
