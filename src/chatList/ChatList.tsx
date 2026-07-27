import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { socket } from "../backend";
import { logout } from "../backend";
import { NewChatModal } from "./components/NewChatModal";
import { NewGroupModal } from "./components/NewGroupModal";
import "./ChatList.css";
import ChatTypeDropdown from "./components/ChatTypeDropdown";
import Chat from "./components/Chat";
import { ThemeToggle } from "../components/ThemeToggle";
import { useNotifications } from "../notifications";
import type { ChatStructure, Modal, Participant, UserStatus } from "./constants";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useErrorModal } from "../ErrorModal";
import { UndoToast } from "../components/UndoToast";

// Sort chats so the most recently active one appears at the top.
// ChatStructures without a lastMessageAt are pushed to the bottom.
const sortChatsByRecent = (list: ChatStructure[]): ChatStructure[] =>
	[...list].sort((a, b) => {
		if (!a.lastMessageAt && !b.lastMessageAt) return 0;
		if (!a.lastMessageAt) return 1;
		if (!b.lastMessageAt) return -1;
		return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
	});

const ChatList = forwardRef(function ChatList(
	{
		activeChatId,
		onSelectChat,
	}: {
		activeChatId?: string;
		onSelectChat: (id: string, allChats: ChatStructure[]) => void;
	},
	ref,
) {
	const navigate = useNavigate();
	const { showError } = useErrorModal();
	const [chats, setChats]           = useState<ChatStructure[]>([]);
	const [search, setSearch]         = useState("");
	const [loading, setLoading]       = useState(true);
	const [error, setError]           = useState("");
	const [modal, setModal]           = useState<Modal>(null);
	const [dropdown, setDropdown]     = useState(false);
	const [userStatus, setUserStatus] = useState<UserStatus>("idle");
	const [foundUser, setFoundUser]   = useState<Participant>();
	const dropdownRef = useRef<HTMLDivElement>(null);

	// ── Undo delete toast ────────────────────────────────────────────────────
	const [undoChat, setUndoChat] = useState<{ chat: ChatStructure; chatName: string } | null>(null);

	const requestDelete = (chat: ChatStructure) => {
		// Immediately confirm any previous pending deletion before starting a new one
		if (undoChat) {
			socket.emit("deleteChat", { chatId: undoChat.chat.id });
		}

		const chatName = chat.isGroup
			? chat.name
			: chat.participants
					.find((p) => p.user.uid !== auth.currentUser?.uid)
					?.user.profile.firstName ?? "Unknown";

		// Immediately remove from the list
		setChats((prev) => prev.filter((c) => c.id !== chat.id));

		// Set up the undo toast
		setUndoChat({ chat, chatName });
	};

	const handleUndoDelete = () => {
		if (!undoChat) return;
		// Restore the chat to the list
		setChats((prev) => sortChatsByRecent([undoChat.chat, ...prev]));
		setUndoChat(null);
	};

	const handleExpireDelete = () => {
		if (!undoChat) return;
		// Actually emit the delete event now
		socket.emit("deleteChat", { chatId: undoChat.chat.id });
		setUndoChat(null);
	};

	// ── Muted chats (per-device, persisted to localStorage) ────────────────────
	const [mutedChats, setMutedChats] = useState<Set<string>>(() => {
		try {
			const stored = localStorage.getItem("muted-chats");
			return stored ? new Set(JSON.parse(stored)) : new Set();
		} catch {
			return new Set();
		}
	});

	const toggleMute = (chatId: string) => {
		setMutedChats((prev) => {
			const next = new Set(prev);
			if (next.has(chatId)) {
				next.delete(chatId);
			} else {
				next.add(chatId);
			}
			try {
				localStorage.setItem("muted-chats", JSON.stringify([...next]));
			} catch {
				// localStorage may be full or unavailable — silently ignore
			}
			return next;
		});
	};

	// ── Browser notifications ──────────────────────────────────────────────────
	const {
		permission: notifPermission,
		requestPermission,
		showNotification,
	} = useNotifications();

	// Expose updateChatPreview so ChatRoom can sync the list preview + reset unread when opened
	useImperativeHandle(ref, () => ({
		updateChatPreview(chatId: string, text: string, sentAt: string) {
			setChats((prev) =>
				sortChatsByRecent(
					prev.map((c) =>
						c.id === chatId
							? { ...c, lastMessage: text, lastMessageAt: sentAt }
							: c,
					),
				),
			);
		},
		resetUnread(chatId: string) {
			setChats((prev) =>
				prev.map((c) =>
					c.id === chatId ? { ...c, unread: 0 } : c,
				),
			);
		},
		getOnlineUids: () => onlineUids,
	}));

	// Keep refs in sync so the socket-effect closure (which only mounts once)
	// always reads the latest values.
	const activeChatIdRef = useRef(activeChatId);
	activeChatIdRef.current = activeChatId;
	const chatsRef = useRef<ChatStructure[]>(chats);
	chatsRef.current = chats;
	const mutedChatsRef = useRef<Set<string>>(mutedChats);
	mutedChatsRef.current = mutedChats;

	// ── Online status tracking ─────────────────────────────────────────────────
	// This ref holds a Set of currently-online user UIDs. It's updated via socket
	// events and exposed to parent components through the imperative handle so that
	// ChatRoom and GroupInfoPanel can show live status dots.

	const [onlineUids, setOnlineUids] = useState<Set<string>>(new Set());

	// ── Socket lifecycle ──────────────────────────────────────────────────────
	// ChatList owns the single shared socket. ChatRoom never calls connect/disconnect.

	useEffect(() => {
		socket.connect();

		// ── Refresh the chat list ─────────────────────────────────────────
		// Emit getChats immediately, then poll every 10 seconds so the list
		// stays in sync even if the server doesn't emit global events.
		const fetchChats = () => socket.emit("getChats", { username: auth.currentUser?.uid });
		fetchChats();
		const pollInterval = setInterval(fetchChats, 10_000);

		// Replace the entire list with fresh data from the server, sorted,
		// so existing chats get updated lastMessage / unread / etc.
		socket.on("chats", (data: ChatStructure[]) => {
			setChats(sortChatsByRecent(data));
			setLoading(false);
		});

		socket.on("connect_error", () => {
			setError("Couldn't load conversations.");
			setLoading(false);
		});

		socket.on("chatCreated", (newChat: ChatStructure) => {
			setChats((prev) => {
				// Don't add if it already exists (e.g. from a race condition)
				if (prev.some((c) => c.id === newChat.id)) return prev;
				return sortChatsByRecent([newChat, ...prev]);
			});
		});

		socket.on("chatDeleted", ({ id }: { id: string }) => {
			setChats((prev) => prev.filter((c) => c.id !== id));
		});

		socket.on("memberAdded", (updatedChat: ChatStructure) => {
			setChats((prev) =>
				sortChatsByRecent(
					prev.map((c) => (c.id === updatedChat.id ? updatedChat : c)),
				),
			);
		});

		socket.on("userSearch", (data) => {
			if (data.userExists) {
				setFoundUser({ ...data.profile, uid: data.profile.user.uid });
				setUserStatus("found");
			} else {
				setUserStatus("not_found");
			}
		});

		// Keep chat list preview fresh when any room receives a new message.
		// If the user isn't viewing that chat, also bump the unread counter.
		// If the tab is in the background, fire a browser notification.
		socket.on("newMessage", (msg: { chatId: string; text: string; sentAt: string; senderId?: string }) => {
			const currentUid = auth.currentUser?.uid;
			setChats((prev) =>
				sortChatsByRecent(
					prev.map((c) =>
						c.id === msg.chatId
							? {
									...c,
									lastMessage: msg.text,
									lastMessageAt: msg.sentAt,
									lastMessageSenderId: msg.senderId,
									// If the current user sent it, mark as sent (will update via status events)
									// Otherwise, no status needed (incoming message)
									lastMessageStatus:
										msg.senderId === currentUid
											? (c.lastMessageStatus ?? "sent")
											: undefined,
									// Only bump unread for chats the user isn't currently viewing
									unread:
										msg.chatId === activeChatIdRef.current
											? c.unread
											: c.unread + 1,
							  }
							: c,
					),
				),
			);

			// ── Browser notification for background messages ─────────────────
			// Only notify if the message is for a chat the user isn't currently
			// viewing AND the chat isn't muted. The notification title is the
			// sender/group name.
			if (msg.chatId !== activeChatIdRef.current && !mutedChatsRef.current.has(msg.chatId)) {
				const chat = chatsRef.current.find((c) => c.id === msg.chatId);
				if (chat) {
					let title = "";
					let icon = "";
					if (chat.isGroup) {
						title = chat.name;
						icon = chat.avatarUrl;
					} else {
						// Private chat — use the other participant's name
						const other = chat.participants.find(
							(p) => p.user.uid !== auth.currentUser?.uid,
						);
						title = other
							? `${other.user.profile.firstName} ${other.user.profile.lastName}`
							: "Someone";
						icon = other?.user.profile.avatarUrl ?? "";
					}
					showNotification({
						title,
						body: msg.text,
						icon: icon || undefined,
						tag: `chat-${msg.chatId}`,
					});
				}
			}
		});

		// Surface server-side socket errors to the user
		socket.on("error", (err: { event: string; message: string }) => {
			showError(err.message || `Something went wrong while processing "${err.event}".`);
		});

		// Sync unread counts pushed from the server (e.g., after markRead on
		// another device, or when the server resets unread for this user).
		socket.on("unreadUpdated", ({ chatId, unread }: { chatId: string; unread: number }) => {
			setChats((prev) =>
				prev.map((c) =>
					c.id === chatId ? { ...c, unread } : c,
				),
			);
		});

		// ── Message status updates ─────────────────────────────────────────
		// The server sends messageStatus events without a chatId, so we can't
		// map them back to the sidebar directly. The 10-second poll updates
		// lastMessageStatus from the server's ChatStructure response.

		// ── Online / offline tracking ────────────────────────────────────────
		socket.on("userOnline", ({ uid }: { uid: string }) => {
			setOnlineUids((prev) => new Set(prev).add(uid));
		});
		socket.on("userOffline", ({ uid }: { uid: string }) => {
			setOnlineUids((prev) => {
				const next = new Set(prev);
				next.delete(uid);
				return next;
			});
		});

		return () => {
			clearInterval(pollInterval);
			socket.off("chats");
			socket.off("connect_error");
			socket.off("chatCreated");
			socket.off("chatDeleted");
			socket.off("memberAdded");
			socket.off("userSearch");
			socket.off("newMessage");
			socket.off("error");
			socket.off("unreadUpdated");
			socket.off("userOnline");
			socket.off("userOffline");
			socket.disconnect();
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ── Dropdown close on outside click ──────────────────────────────────────

	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
				setDropdown(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	// Reset user search status when modal opens/closes
	useEffect(() => { setUserStatus("idle"); }, [modal]);

	// ── Handlers ──────────────────────────────────────────────────────────────

	const handleSelectChat = (id: string) => {
		// Reset unread locally when the user opens a chat
		setChats((prev) =>
			prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
		);
		onSelectChat(id, chats);
	};

	const handlePrivateChat = (uid: string) => {
		socket.emit("createChat", { members: [auth.currentUser?.uid, uid] });
		setModal(null);
	};

	const handleGroupChat = (name: string, participants: { uid: string }[]) => {
		socket.emit("createChat", {
			name,
			members: participants.map((p) => p.uid),
			isGroup: true,
			admin: auth.currentUser?.uid,
		});
		setModal(null);
	};

	const handleSearch = (username: string) => {
		setUserStatus("loading");
		socket.emit("getUser", { username });
	};

	const handleMarkAllRead = () => {
		const currentUid = auth.currentUser?.uid;
		if (!currentUid) return;

		// Reset all unread counts locally
		setChats((prev) =>
			prev.map((c) => {
				if (c.unread > 0) {
					// Tell the server to mark this chat as read
					socket.emit("markRead", { chatId: c.id, uid: currentUid });
					return { ...c, unread: 0 };
				}
				return c;
			}),
		);
	};

	const handleLogout = async () => {
		await logout();
		navigate("/");
	};

	// ── Filter ────────────────────────────────────────────────────────────────

	const filtered = chats.filter((c) => {
		const q = search.toLowerCase();
		if (c.isGroup) return c.name.toLowerCase().includes(q);
		const participant = c.participants.find((p) => p.user.uid !== auth.currentUser?.uid);
		if (!participant) return false;
		const { firstName, lastName, username } = participant.user.profile;
		return `${firstName} ${lastName}`.toLowerCase().includes(q) || username.includes(q);
	});

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<>
			{modal === "private" && (
				<NewChatModal
					onClose={() => setModal(null)}
					onStart={handlePrivateChat}
					onSearch={handleSearch}
					userStatus={userStatus}
					foundUser={foundUser}
				/>
			)}
			{modal === "group" && (
				<NewGroupModal
					onClose={() => setModal(null)}
					onStart={handleGroupChat}
					onSearch={handleSearch}
					searchStatus={userStatus}
					foundUser={foundUser}
				/>
			)}

			<div className="chatlist-root">
				<div className="chatlist-header">
					<div className="chatlist-brand">
						<h1 className="chatlist-title">Convo</h1>
						<p className="chatlist-subtitle">Messages</p>
					</div>
					<div className="chatlist-header-actions">
						<button
							className="chatlist-icon-btn"
							title="Edit profile"
							onClick={() => navigate("/settings")}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
								<circle cx="12" cy="7" r="4" />
							</svg>
						</button>

						<ThemeToggle />

						{/* Notification bell */}
						{notifPermission === "default" && (
							<button
								className="chatlist-icon-btn"
								title="Enable notifications"
								onClick={requestPermission}
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
									<path d="M13.73 21a2 2 0 0 1-3.46 0" />
								</svg>
							</button>
						)}
						{notifPermission === "granted" && (
							<button
								className="chatlist-icon-btn"
								title="Notifications enabled"
								style={{ color: "var(--accent)" }}
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
									<path d="M13.73 21a2 2 0 0 1-3.46 0" />
								</svg>
							</button>
						)}

						{/* Mark all as read — only show when there are unread chats */}
						{chats.some((c) => c.unread > 0) && (
							<button
								className="chatlist-icon-btn"
								title="Mark all as read"
								onClick={handleMarkAllRead}
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
									<circle cx="12" cy="12" r="3" />
									<polyline points="9 12 11 14 15 10" />
								</svg>
							</button>
						)}

						<button
							className="chatlist-icon-btn"
							title="Sign out"
							onClick={handleLogout}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
								<polyline points="16 17 21 12 16 7" />
								<line x1="21" y1="12" x2="9" y2="12" />
							</svg>
						</button>
					</div>
				</div>

				<div className="chatlist-search-wrap">
					<svg className="chatlist-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" />
					</svg>
					<input
						type="text"
						className="chatlist-search"
						placeholder="Search conversations…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>

				<div className="chatlist-items">
					{loading && (
						<div className="chatlist-status">
							<div className="spinner" />
						</div>
					)}
					{error && <p className="chatlist-status error">{error}</p>}
					{!loading && !error && filtered.length === 0 && (
						<p className="chatlist-status">No conversations found.</p>
					)}

					{filtered.map((chat, i) => {
						let fullName = "";
						let avatarUrl = "";
						let participant;

						if (chat.isGroup) {
							fullName  = chat.name;
							avatarUrl = chat.avatarUrl;
						} else {
							participant = chat.participants.find(
								(p) => p.user.uid !== auth.currentUser?.uid,
							);
							const profile = participant?.user.profile;
							fullName  = `${profile?.firstName} ${profile?.lastName}`;
							avatarUrl = profile?.avatarUrl ?? "";
						}

						const isOnline = !chat.isGroup && onlineUids.has(participant?.user.uid ?? "");

						return (
							<Chat
								key={chat.id}
								chat={chat}
								activeChatId={activeChatId!}
								onSelectChat={handleSelectChat}
								i={i}
								fullName={fullName}
								p={chat.isGroup ? undefined : participant?.user.profile}
								avatarUrl={avatarUrl}
								isGroup={chat.isGroup}
								isOnline={isOnline}
								isMuted={mutedChats.has(chat.id)}
								onToggleMute={toggleMute}
								onDeleteChat={requestDelete}
							/>
						);
					})}
				</div>

				{/* FAB — bottom-right, dropdown opens upward */}
				<div className="chatlist-fab-wrap" ref={dropdownRef}>
					{dropdown && (
						<ChatTypeDropdown setDropdown={setDropdown} setModal={setModal} />
					)}
					<button
						className="chatlist-fab"
						title="New chat"
						onClick={() => setDropdown((v) => !v)}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
							<line x1="12" y1="5" x2="12" y2="19" />
							<line x1="5" y1="12" x2="19" y2="12" />
						</svg>
					</button>
				</div>

				{/* Undo toast */}
				{undoChat && (
					<UndoToast
						chatName={undoChat.chatName}
						onUndo={handleUndoDelete}
						onExpire={handleExpireDelete}
					/>
				)}
			</div>
		</>
	);
});

export type ChatListHandle = {
	updateChatPreview: (chatId: string, text: string, sentAt: string) => void;
	resetUnread: (chatId: string) => void;
	getOnlineUids: () => Set<string>;
};
export default ChatList;
