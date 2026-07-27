# Convo — Real-time Chat Application

A full-featured, real-time messaging application built with **React 19**, **TypeScript**, and **Socket.IO**. Features end-to-end authentication via **Firebase Auth**, persistent chat history with live updates, dark mode, browser push notifications, and a responsive mobile-first UI.

> **Frontend:** React 19 + TypeScript + Vite  
> **Backend:** NestJS + Socket.IO + TypeORM + PostgreSQL  
> **Auth:** Firebase Authentication + JWT access/refresh tokens  
> **Deployment:** Vercel (frontend) + Railway / Render (backend)

---

## ✨ Features

### Messaging

- **Real-time chat** — Messages delivered instantly via Socket.IO with auto-scroll and day separators
- **Private & group chats** — Create one-on-one conversations or multi-member group chats with admin support
- **Message status** — Sent ✓, delivered ✓✓, and read ✓✓ indicators on every message
- **Infinite scroll** — Paginated message history with seamless scroll-to-top loading
- **Chat list polling** — Auto-refreshes every 10 seconds so you never miss a message
- **Unread badges** — Live unread counters next to each chat in the sidebar

### Chat Management

- **Swipe-to-delete** — Swipe left on mobile/desktop to delete a conversation with an **undo toast** (5-second grace period)
- **Mark all as read** — One-click button in the sidebar header to clear all unread badges
- **Search conversations** — Filter your chat list by name or username
- **Right-click context menu** — Mute/unmute notifications per chat

### User Experience

- **Dark mode** — System-aware theme with smooth CSS transitions, persisted to localStorage
- **Online status dots** — Live green indicators next to avatars throughout the UI
- **Profile pages** — Click any avatar to view a user's full profile at `/profile/:username`
- **Group info panel** — Click a group header to see all members with online status and clickable profiles
- **Browser notifications** — Native push notifications for background messages (permission-gated)
- **Responsive layout** — Sidebar collapses on mobile; works across screen sizes
- **Email verification** — Required before accessing the app

### Security

- **Firebase Auth** — Secure email/password and Google OAuth authentication
- **JWT token rotation** — Access + refresh token pattern with silent background refresh
- **Token hydration** — In-memory tokens with localStorage persistence survive page reloads
- **Refresh mutex** — Prevents race conditions when multiple 401s fire concurrently
- **Protected routes** — `RequireAuth` wrapper guards all authenticated pages

---

## 🏗 Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        React App                                 │
│                                                                  │
│  ┌──────────┐   ┌────────────┐   ┌───────────────────────────┐  │
│  │ Auth Flow │──▶│ ChatList   │──▶│ ChatRoom                   │  │
│  │ (Firebase)│   │ (owns      │   │ (room-scoped socket only) │  │
│  └──────────┘   │  socket)   │   └───────────────────────────┘  │
│                 └─────┬──────┘                                   │
│                       │ socket.emit / socket.on                  │
│                       ▼                                          │
│                 ┌──────────────┐   ┌────────────────────────┐   │
│                 │ NestJS       │──▶│ PostgreSQL              │   │
│                 │ (Socket.IO)  │   │ (TypeORM)               │   │
│                 └──────────────┘   └────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **ChatList owns the socket** | Single connection never drops when switching chats. ChatRoom only joins/leaves rooms. |
| **10-second chat list poll** | Ensures the sidebar stays in sync even when the server only emits `newMessage` to room-scoped listeners. |
| **Full list replacement** | The `chats` event replaces the entire array — no delta logic needed on the client. |
| **In-memory tokens + localStorage** | Reduces XSS exposure compared to localStorage-only; survives page refreshes. |
| **Refresh mutex (single-flight)** | Prevents concurrent /auth/refresh calls from invalidating each other's refresh tokens. |

---

## 🧩 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19 with TypeScript |
| **Bundler** | Vite 7 |
| **Routing** | React Router v7 |
| **Real-time** | Socket.IO (socket.io-client 4.x) |
| **HTTP Client** | Axios with interceptors for JWT refresh |
| **Auth** | Firebase Authentication (email/password + Google) |
| **UI** | Pure CSS with custom properties (no component library) |
| **Linting** | ESLint with typescript-eslint + react-hooks plugin |
| **CI** | GitHub Actions (lint → typecheck → build) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- A Firebase project with Authentication enabled
- A running instance of the [NestJS backend](https://github.com/your-org/chat-backend)

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_BACKEND_URL=http://localhost:3000

VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Install & Run

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Opens at `http://localhost:5173`.

### Available Scripts

```bash
npm run dev       # Start the Vite dev server with HMR
npm run build     # TypeScript check + production build
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint across the entire codebase
```

---

## 📁 Project Structure

```
src/
├── auth/                     # Authentication flow
│   ├── auth.tsx              #   On-mount session check
│   ├── forms.tsx             #   Login/signup form toggle
│   ├── login.tsx             #   Login form component
│   ├── signup.tsx            #   Signup form component
│   └── RequireAuth.tsx       #   Route guard wrapper
│
├── chatList/                 # Main chat interface
│   ├── ChatLayout.tsx        #   Sidebar + room split layout
│   ├── ChatList.tsx          #   Sidebar: owns socket, chat list, search
│   ├── ChatRoom.tsx          #   Message room with send/infinite scroll
│   ├── constants.ts          #   Types: ChatStructure, Participant, etc.
│   ├── components/
│   │   ├── Avatar.tsx        #   Avatar with online status dot
│   │   ├── Chat.tsx          #   Single chat row (swipe, context menu)
│   │   ├── AddMemberModal.tsx
│   │   ├── GroupInfoPanel.tsx#   Group member list overlay
│   │   ├── NewChatModal.tsx
│   │   ├── NewGroupModal.tsx
│   │   └── ChatTypeDropdown.tsx
│   └── ChatList.css          #   All sidebar + modal styles
│
├── components/               # Shared UI components
│   ├── StatusTick.tsx        #   Sent/delivered/read indicator
│   ├── ThemeToggle.tsx       #   Light/dark mode switch
│   └── UndoToast.tsx         #   Swipe-delete undo with progress bar
│
├── profileSetup/             # Onboarding wizard
├── profileEdit/              # Profile settings page
├── profileView/              # Public profile pages (/profile/:username)
├── verification/             # Email verification page
│
├── backend.ts                # Axios instance, socket singleton, JWT helpers
├── firebase.ts               # Firebase app initialization
├── notifications.ts          # Browser notification hook
├── ErrorModal.tsx            # Global error modal provider
│
├── App.tsx                   # Root router
├── main.tsx                  # Entry point with theme initialization
└── index.css                 # Theme variables (light + dark) and resets
```

---

## 🔌 API & Socket Events

The frontend communicates with the NestJS backend via:

### REST Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/auth/refresh` | Exchange a refresh token for a new access/refresh pair |
| `POST` | `/auth/logout` | Invalidate tokens server-side |
| `GET` | `/profile/name/:username` | Fetch a user's public profile |

### Socket.IO Events (Client → Server)

| Event | Payload | When |
|-------|---------|------|
| `getChats` | `{ username: string }` | On mount + every 10s poll |
| `createChat` | `{ members }` or `{ name, members, isGroup, admin }` | New private/group chat |
| `deleteChat` | `{ chatId }` | Delete a conversation |
| `markRead` | `{ chatId, uid }` | Open chat or mark all as read |
| `getUser` | `{ username }` | Search for a user |
| `joinChat` | `{ chatId }` | Enter a chat room |
| `leaveChat` | `{ chatId }` | Exit a chat room |
| `sendMessage` | `{ chatId, text, senderId }` | Send a message |
| `loadMoreMessages` | `{ chatId, before }` | Load older messages |

### Socket.IO Events (Server → Client)

| Event | Payload | Purpose |
|-------|---------|---------|
| `chats` | `ChatStructure[]` | Full chat list |
| `chatCreated` | `ChatStructure` | A new chat was created |
| `chatDeleted` | `{ id }` | A chat was deleted |
| `memberAdded` | `ChatStructure` | A member was added to a group |
| `newMessage` | `{ chatId, text, sentAt, senderId? }` | New message (global) |
| `unreadUpdated` | `{ chatId, unread }` | Unread count sync |
| `userSearch` | `{ userExists, profile }` | Result of a user search |
| `userOnline` | `{ uid }` | A user came online |
| `userOffline` | `{ uid }` | A user went offline |
| `messages` | `Message[]` | Full room history |
| `moreMessages` | `Message[]` | Paginated older messages |
| `messageStatus` | `{ messageId, status }` | Delivery status update |
| `error` | `{ event, message }` | Server-side error |

---

## 🖼 Screenshots

> *Add screenshots here — auth screen, chat list, chat room, dark mode, profile page, group info panel.*

---

## 🛡 CI/CD

The project uses **GitHub Actions** for continuous integration:

```yaml
# .github/workflows/ci.yml
- run: npm ci
- run: npm run lint          # ESLint — zero tolerance for errors/warnings
- run: npm run build         # tsc --noEmit + vite build
```

Every PR must pass all three checks before merging.

---

## 📄 License

MIT
