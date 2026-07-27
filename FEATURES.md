# Frontend Features — Branch `fix/profile-setup-issue`

This document describes every feature added in this branch. Use it to update the **NestJS backend** (Socket.IO events, REST endpoints, database schemas) to match what the frontend now expects.

---

## 1. Dark Mode

**Files:** `src/components/ThemeToggle.tsx`, `src/index.css`

The frontend now supports light/dark themes via CSS custom properties on `:root` and `[data-theme="dark"]`. A toggle button in the sidebar header switches between them and persists the choice to `localStorage("chat-theme")`.

On initial load, the theme respects the OS `prefers-color-scheme` media query.

**Backend changes needed:** None — this is entirely client-side.

---

## 2. Online / Offline Status Dots

**Files:** `src/chatList/components/Avatar.tsx`, `src/chatList/ChatList.tsx`, `src/chatList/ChatLayout.tsx`, `src/chatList/ChatRoom.tsx`, `src/chatList/components/GroupInfoPanel.tsx`, `src/profileView/ProfileView.tsx`

A green dot appears next to a user's avatar when they are online.

### Socket events the frontend listens for:

| Event | Payload | Description |
|-------|---------|-------------|
| `userOnline` | `{ uid: string }` | Mark a user as online |
| `userOffline` | `{ uid: string }` | Mark a user as offline |

### Where status dots appear:

- Chat list sidebar (each private chat shows online/offline)
- Chat room header (other participant)
- Group info panel (each member)
- Profile view page (`/profile/:username`)

### Backend requirements:

- Server must emit `userOnline` / `userOffline` events when users connect/disconnect via Socket.IO
- The `uid` in the payload must match Firebase auth UIDs in the `users` collection

---

## 3. Profile View Page

**Files:** `src/profileView/ProfileView.tsx`, `src/profileView/ProfileView.css`

New route: `/profile/:username` — displays another user's profile information.

### REST endpoint the frontend calls:

```
GET /profile/name/:username
```

**Expected response shape:**

```json
{
  "userExists": true,
  "profile": {
    "user": {
      "uid": "firebase-uid-string"
    },
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "bio": "Some bio text",
    "location": "New York",
    "avatarUrl": "https://..."
  }
}
```

If the user does not exist, respond with:

```json
{ "userExists": false }
```

The frontend also listens for `userOnline`/`userOffline` socket events to update the online status dot in real-time while viewing a profile.

### Navigation triggers:

- Clicking a chat avatar in the sidebar → navigates to `/profile/:username`
- Clicking the chat room header (private chat) → navigates to `/profile/:username`
- Clicking a member in the group info panel → navigates to `/profile/:username`

---

## 4. Group Info Panel

**Files:** `src/chatList/components/GroupInfoPanel.tsx`, `src/chatList/ChatLayout.css`

Clicking the header of a **group chat** opens a modal overlay showing:

- Group name and avatar
- Member count
- A list of all members with avatars, names, usernames, online status dots, and a "You" badge for the current user
- Clicking any member navigates to `/profile/:username`

No new backend events — it uses the existing `ChatStructure` data and online/offline socket events.

---

## 5. Real-time Chat List Updates (Critical Backend Change)

**Files:** `src/chatList/ChatList.tsx`

### Polling mechanism:

The frontend now **polls `getChats` every 10 seconds** (in addition to the initial fetch on mount) to keep the chat list in sync.

### Socket events the frontend emits:

| Event | Payload | Description |
|-------|---------|-------------|
| `getChats` | `{ username: string }` | Fetch all chats for the user (note: key is `username` but value is the Firebase UID) |
| `createChat` | `{ members: string[] }` or `{ name, members, isGroup, admin }` | Create private or group chat |
| `deleteChat` | `{ chatId: string }` | Delete a conversation |
| `markRead` | `{ chatId: string, uid: string }` | Mark a chat as read (called when opening a chat AND from "Mark all as read") |
| `getUser` | `{ username: string }` | Search for a user by display username (to start a chat with them) |

### Socket events the frontend listens for:

| Event | Payload | Description |
|-------|---------|-------------|
| `chats` | `ChatStructure[]` | Full chat list (replaces entire array) |
| `chatCreated` | `ChatStructure` | New chat created by another user or self |
| `chatDeleted` | `{ id: string }` | Chat was deleted |
| `memberAdded` | `ChatStructure` | Updated chat (member was added) |
| `newMessage` | `{ chatId, text, sentAt, senderId? }` | New message in any chat |
| `unreadUpdated` | `{ chatId, unread }` | Server-pushed unread count sync |
| `userSearch` | `{ userExists, profile }` | Result of a user search (response to `getUser`) |
| `error` | `{ event, message }` | Server-side error |

### Important:

- The `chats` event now **fully replaces** the chat list — the server should send ALL of the user's chats every time, not just deltas
- The frontend sorts by `lastMessageAt` (newest first)
- The `newMessage` event globally updates the chat's `lastMessage`, `lastMessageAt`, and `unread` counter in the sidebar — **not just in the active chat room**

### ChatStructure type (what the frontend expects):

```typescript
interface ChatStructure {
  id: string;
  name: string;
  participants: {
    user: {
      uid: string;
      profile: {
        firstName: string;
        lastName: string;
        username: string;
        avatarUrl: string;
      };
    };
  }[];
  lastMessage: string;
  lastMessageAt: string;
  lastMessageSenderId?: string;      // NEW — who sent the last message
  lastMessageStatus?: "sent" | "delivered" | "read";  // NEW — status of last message
  unread: number;
  isGroup: boolean;
  avatarUrl: string;
}
```

**New fields the backend must now include:**

- `lastMessageSenderId` — the UID of the user who sent the last message
- `lastMessageStatus` — the delivery status of the last message (so the sidebar tick is accurate)

---

## 6. Message Status in Sidebar

**Files:** `src/components/StatusTick.tsx`, `src/chatList/components/Chat.tsx`

The chat list now shows a **sent/delivered/read tick** next to the last message text for **own messages in private chats only**:

- Single tick (grey) = sent
- Double tick (grey) = delivered
- Double tick (blue) = read

This data comes from the `lastMessageStatus` field in the `ChatStructure` response from `getChats`. The 10-second poll keeps it updated (the server's `messageStatus` event doesn't include a `chatId`, so it can't be mapped to the sidebar directly).

### Socket event frontend listens for in ChatRoom:

| Event | Payload | Description |
|-------|---------|-------------|
| `messageStatus` | `{ messageId: string, status: "sent" \| "delivered" \| "read" }` | Update a message's delivery status inside the chat room |

### Backend suggestion:

If possible, include `chatId` in the `messageStatus` event payload so the frontend can update the sidebar tick in real-time without waiting for the 10-second poll.

---

## 7. Unread Count Badges

**Files:** `src/chatList/ChatList.tsx`, `src/chatList/components/Chat.tsx`

Each chat in the sidebar shows an unread badge (a navy pill with the count). The counter:

- Increments when a `newMessage` event comes in for a chat the user **is not** currently viewing
- Resets to 0 locally when the user clicks the chat
- Syncs via server-side `unreadUpdated` events and the 10-second poll

### Unread sync events:

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `markRead` | Client → Server | `{ chatId, uid }` | Emitted when opening a chat, and from "Mark all as read" |
| `unreadUpdated` | Server → Client | `{ chatId, unread }` | Server pushes updated unread count (e.g. from another device) |

### "Mark All as Read" button:

An eye-with-checkmark icon in the sidebar header that:

- Iterates all chats with `unread > 0`
- Emits `socket.emit("markRead", { chatId, uid })` for each
- Resets all unread counts to 0 locally

The button only appears when there are unread chats.

---

## 8. Browser Push Notifications

**Files:** `src/notifications.ts`

A custom `useNotifications()` hook manages the Notification API lifecycle.

### Behavior:

- Only fires when the tab is in the **background** (`document.hidden`)
- Requires user permission (bell icon in sidebar requests it)
- Shows the message sender/group name as the notification title and the message text as the body
- Clicking the notification focuses the chat tab
- Notifications auto-close after 5 seconds
- Respects per-chat mute settings (no notification for muted chats)

### Backend changes needed:

None — purely client-side. The frontend's `newMessage` socket handler checks `document.hidden` and shows notifications.

---

## 9. Mute Notifications per Chat

**Files:** `src/chatList/components/Chat.tsx`, `src/chatList/ChatList.tsx`

### Interaction:

- Right-click any chat in the sidebar → context menu with "Mute notifications" / "Unmute notifications"
- Muted chats show a muted bell icon next to the name
- Muted chats have reduced opacity name text
- No browser notifications fire for muted chats

### Persistence:

Mute settings are persisted to **localStorage** (`"muted-chats"` key) — per-device only. No backend API is called.

### Backend changes needed:

None — purely client-side. If you want mute to sync across devices, add a `mutedChats` field to the database.

---

## 10. Swipe-to-Delete on Chat List

**Files:** `src/chatList/components/Chat.tsx`, `src/chatList/ChatList.css`

### Touch gesture:

- Swipe left on a chat item reveals a red delete background with a trash icon
- The swipe threshold is 80px
- A `touch-action: pan-y` CSS rule preserves vertical scrolling while allowing horizontal swipe
- After a swipe, the click event is suppressed to prevent navigating to a deleted chat
- Touch cancellation (`onTouchCancel`) resets the swipe state

### Socket event emitted:

| Event | Payload | Description |
|-------|---------|-------------|
| `deleteChat` | `{ chatId: string }` | Delete a conversation |

---

## 11. Undo Toast After Swipe Delete

**Files:** `src/components/UndoToast.tsx`, `src/chatList/ChatList.tsx`, `src/chatList/ChatList.css`

### Flow:

1. User swipes to delete → chat is **immediately removed** from the local list
2. An undo toast slides up at the bottom of the sidebar
3. Toast shows: "Conversation with **{name}** deleted" with an **Undo** button
4. A progress bar shrinks over 5 seconds
5. If user clicks **Undo** → chat is restored to the list (sorted by recency)
6. If 5 seconds expire → `socket.emit("deleteChat", { chatId })` fires

### Important:

The `deleteChat` event is **deferred** — it only fires after the 5-second undo window expires. The `ChatStructure` data is passed to the `requestDelete` handler so it can be restored if undone.

### Edge case:

If the user swipes another chat while an undo toast is showing, the pending deletion is immediately confirmed (`socket.emit("deleteChat")`) before starting the new one.

---

## 12. Chat Room Socket Events

**Files:** `src/chatList/ChatRoom.tsx`

The ChatRoom component emits and listens for room-scoped events only. It never calls `connect()` or `disconnect()`.

### Events emitted by ChatRoom:

| Event | Payload | Description |
|-------|---------|-------------|
| `joinChat` | `{ chatId: string }` | Emitted on mount — server should join the socket to the room and respond with `messages` (message history) |
| `leaveChat` | `{ chatId: string }` | Emitted on cleanup/unmount — server should leave the room |
| `sendMessage` | `{ chatId: string, text: string, senderId: string }` | Send a new message. Server should save and broadcast via `newMessage` |
| `loadMoreMessages` | `{ chatId: string, before: string }` | Paginate older messages. `before` is the ID of the oldest message currently loaded. Server responds with `moreMessages` |
| `markRead` | `{ chatId: string, uid: string }` | Mark chat as read (includes ack callback to confirm) |

### Events listened for by ChatRoom:

| Event | Payload | Description |
|-------|---------|-------------|
| `messages` | `Message[]` | Full message history for the room (response to `joinChat`) |
| `moreMessages` | `Message[]` | Older messages for pagination (response to `loadMoreMessages`). Empty array = no more history |
| `newMessage` | `Message` | A new message was sent in this room |
| `messageStatus` | `{ messageId, status }` | A message's delivery status was updated |
| `chatDeleted` | `{ id: string }` | If `id === chat.id`, close the room |

### Message type:

```typescript
interface Message {
  id: string;
  senderId: string;
  text: string;
  sentAt: string;
  status: "sent" | "delivered" | "read";
}
```

---

## 13. Socket Architecture

**Files:** `src/chatList/ChatList.tsx`, `src/chatList/ChatRoom.tsx`

### Important architectural change:

- **ChatList owns the single shared Socket.IO connection** (connects on mount, disconnects on unmount)
- **ChatRoom never calls `connect()` or `disconnect()`**
- ChatRoom only emits `joinChat` / `leaveChat` and listens for room-scoped events
- The socket is never closed when switching between chats — only on navigation away from `/chats`
- This means the server should expect the same socket connection to join/leave multiple rooms over its lifetime

### `getChats` payload note:

The frontend emits `socket.emit("getChats", { username: auth.currentUser?.uid })`. The key name is `username` but the value is the **Firebase auth UID**. The backend should either:

- Accept `username` as the user's UID, or
- Map the UID to a username internally

This naming mismatch exists in the frontend code and was not changed in this branch.

---

## 14. CI Pipeline

**Files:** `.github/workflows/ci.yml`

The GitHub Actions workflow runs:

1. `eslint .` — must pass with zero errors and zero warnings
2. `tsc --noEmit` — TypeScript compilation check
3. `vite build` — production build

All three must pass before merging.
