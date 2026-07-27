# Features & Backend Notes

## User Search (`getUser`)

### Current behavior
- Client emits `getUser { username }` via socket
- Server responds with `userSearch { userExists, profile }`
- `profile` shape: `{ firstName, lastName, username, avatarUrl, user: { uid } }`

### No backend changes needed to fix add-member search
The bug was purely frontend: `AddMemberModal` read profile fields from the wrong path (`data.profile.user.profile.*` instead of `data.profile.*`).

### Suggested backend improvements (nice-to-have)
- **Partial / fuzzy username search** — currently the server likely requires an exact username match. Fuzzy matching (e.g. prefix, substring, or Levenshtein) would improve UX.
- **Exclude current group members** — an optional `excludeUids` parameter on `getUser` would prevent showing users already in the group.
- **Request correlation** — since both `ChatList` and `AddMemberModal` use the same `userSearch` event, a `requestId` token could let each requester discard stale responses.

## Mark-Read on Active Chat

### Current behavior
- `markRead` is emitted when a chat room opens and when a new incoming message arrives (sender !== current user).
- No frontend changes needed; behavior is correct.

### Suggested backend improvement
- Confirmation via ack callback works, but adding a sequenced `lastReadMessageId` parameter would let the server know exactly which messages were read, enabling per-message read receipts.

## Chat Search (sidebar)

### Current behavior
- Filters the local chat list client-side by name/username.
- No backend changes needed.

## Group Admin & Leave / Delete

### Current behavior (frontend)
- ChatRoom: if current user is `chat.admin` → "Delete group" (emits `deleteChat`); otherwise → "Leave group" (emits `leaveGroup`).
- GroupInfoPanel shows an "Admin" badge next to the admin's name.

### Backend requirements

#### 1. Include `admin` in ChatStructure responses
- When the server sends `chats`, `chatCreated`, or any other event that includes a `ChatStructure`, it **must** include:
  ```json
  {
    "...": "...",
    "admin": "<uid of the group creator / admin>"
  }
  ```
- Without this field, the frontend cannot distinguish admins from regular members, and the admin badge + delete-vs-leave logic won't work.

#### 2. `admin` field on the chat document
- The `admin` value is already sent by the client during `createChat` (`admin: auth.currentUser?.uid`). The server should persist it and echo it back in all ChatStructure responses.

#### 3. `leaveGroup` socket event
- **Client emits:** `leaveGroup { chatId }`
- **Server must:**
  - Remove the requesting user from the group's participant list.
  - If the leaving user is the admin, optionally reassign admin or delete the group.
  - Emit `chatDeleted { id }` back to the leaving user so their ChatList removes the group.
  - Emit a `memberRemoved` or participant-updated event to remaining members.

#### 4. `deleteChat` for groups (admin only)
- When the admin deletes a group, `deleteChat` is emitted (same as private chat delete).
- The server should delete the entire group document and emit `chatDeleted` to **all** participants so all members remove it from their lists.
