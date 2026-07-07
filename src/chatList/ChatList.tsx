import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { socket } from "../backend";
import { logout } from "../backend";
import { NewChatModal } from "./components/NewChatModal";
import { NewGroupModal } from "./components/NewGroupModal";
import "./ChatList.css";
import ChatTypeDropdown from "./components/ChatTypeDropdown";
import Chat from "./components/Chat";
import type { ChatStructure, Modal, Participant, UserStatus } from "./constants";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useErrorModal } from "../ErrorModal";

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

	// Expose updateChatPreview so ChatRoom can update the list when new messages arrive
	useImperativeHandle(ref, () => ({
		updateChatPreview(chatId: string, text: string, sentAt: string) {
			setChats((prev) =>
				prev.map((c) =>
					c.id === chatId
						? { ...c, lastMessage: text, lastMessageAt: sentAt }
						: c,
				),
			);
		},
	}));

	// ── Socket lifecycle ──────────────────────────────────────────────────────
	// ChatList owns the single shared socket. ChatRoom never calls connect/disconnect.

	useEffect(() => {
		socket.connect();
		socket.emit("getChats", { username: auth.currentUser?.uid });

		// Deduplicate by id to guard against StrictMode double-fire in dev
		socket.on("chats", (data: ChatStructure[]) => {
			setChats((prev) => {
				const existingIds = new Set(prev.map((c) => c.id));
				const fresh = data.filter((c) => !existingIds.has(c.id));
				return [...prev, ...fresh];
			});
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
				return [newChat, ...prev];
			});
		});

		socket.on("chatDeleted", ({ id }: { id: string }) => {
			setChats((prev) => prev.filter((c) => c.id !== id));
		});

		socket.on("memberAdded", (updatedChat: ChatStructure) => {
			setChats((prev) =>
				prev.map((c) => (c.id === updatedChat.id ? updatedChat : c)),
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

		// Keep chat list preview fresh when any room receives a new message
		socket.on("newMessage", (msg: { chatId: string; text: string; sentAt: string }) => {
			setChats((prev) =>
				prev.map((c) =>
					c.id === msg.chatId
						? { ...c, lastMessage: msg.text, lastMessageAt: msg.sentAt }
						: c,
				),
			);
		});

		// Surface server-side socket errors to the user
		socket.on("error", (err: { event: string; message: string }) => {
			showError(err.message || `Something went wrong while processing "${err.event}".`);
		});

		return () => {
			socket.off("chats");
			socket.off("connect_error");
			socket.off("chatCreated");
			socket.off("chatDeleted");
			socket.off("memberAdded");
			socket.off("userSearch");
			socket.off("newMessage");
			socket.off("error");
			socket.disconnect();
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

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
	// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on modal change
	useEffect(() => { setUserStatus("idle"); }, [modal]);

	// ── Handlers ──────────────────────────────────────────────────────────────

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
					<h1 className="chatlist-title">Messages</h1>
					<div className="chatlist-header-actions">
						<div className="chatlist-dropdown-wrap" ref={dropdownRef}>
							<button
								className="chatlist-icon-btn"
								title="New chat"
								onClick={() => setDropdown((v) => !v)}
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
									<line x1="12" y1="5" x2="12" y2="19" />
									<line x1="5" y1="12" x2="19" y2="12" />
								</svg>
							</button>
							{dropdown && (
								<ChatTypeDropdown setDropdown={setDropdown} setModal={setModal} />
							)}
						</div>

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
					{loading && <p className="chatlist-status">Loading…</p>}
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

						return (
							<Chat
								key={chat.id}
								chat={chat}
								activeChatId={activeChatId!}
								onSelectChat={(id) => onSelectChat(id, chats)}
								i={i}
								fullName={fullName}
								p={chat.isGroup ? undefined : participant?.user.profile}
								avatarUrl={avatarUrl}
								isGroup={chat.isGroup}
							/>
						);
					})}
				</div>
			</div>
		</>
	);
});

export type ChatListHandle = { updateChatPreview: (chatId: string, text: string, sentAt: string) => void };
export default ChatList;
