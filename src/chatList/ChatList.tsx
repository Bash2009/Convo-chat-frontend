import { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
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
	const uidRef = useRef<string | null>(null);

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

	useEffect(() => {
		const uid = auth.currentUser?.uid;
		if (!uid) return;
		uidRef.current = uid;

		socket.connect();
		socket.emit("getChats", { username: uid });

		const handleChats = (data: ChatStructure[]) => {
			setChats((prev) => {
				const updateMap = new Map(data.map((c) => [c.id, c]));
				const merged = prev.map((c) => updateMap.get(c.id) ?? c);
				for (const c of data) {
					if (!merged.some((m) => m.id === c.id)) {
						merged.push(c);
					}
				}
				return merged;
			});
			setLoading(false);
		};

		const handleConnectError = () => {
			setError("Couldn't load conversations.");
			setLoading(false);
		};

		const handleChatCreated = (newChat: ChatStructure) => {
			setChats((prev) => {
				if (prev.some((c) => c.id === newChat.id)) return prev;
				return [newChat, ...prev];
			});
		};

		const handleChatDeleted = ({ id }: { id: string }) => {
			setChats((prev) => prev.filter((c) => c.id !== id));
		};

		const handleMemberAdded = (updatedChat: ChatStructure) => {
			setChats((prev) =>
				prev.map((c) => (c.id === updatedChat.id ? updatedChat : c)),
			);
		};

		const handleUserSearch = (data: { userExists: boolean; profile?: { firstName: string; lastName: string; username: string; avatarUrl: string; user: { uid: string } } }) => {
			if (data.userExists && data.profile) {
				setFoundUser({
					uid: data.profile.user.uid,
					firstName: data.profile.firstName,
					lastName: data.profile.lastName,
					username: data.profile.username,
					avatarUrl: data.profile.avatarUrl,
				});
				setUserStatus("found");
			} else {
				setUserStatus("not_found");
			}
		};

		const handleNewMessage = (msg: { chatId: string; text: string; sentAt: string }) => {
			setChats((prev) =>
				prev.map((c) =>
					c.id === msg.chatId
						? { ...c, lastMessage: msg.text, lastMessageAt: msg.sentAt }
						: c,
				),
			);
		};

		const handleError = (err: { event: string; message: string }) => {
			showError(err.message || `Something went wrong while processing "${err.event}".`);
		};

		const handleReconnect = () => {
			socket.emit("getChats", { username: uidRef.current });
		};

		socket.on("chats", handleChats);
		socket.on("connect_error", handleConnectError);
		socket.on("chatCreated", handleChatCreated);
		socket.on("chatDeleted", handleChatDeleted);
		socket.on("memberAdded", handleMemberAdded);
		socket.on("userSearch", handleUserSearch);
		socket.on("newMessage", handleNewMessage);
		socket.on("error", handleError);
		socket.on("reconnect", handleReconnect);

		return () => {
			socket.off("chats", handleChats);
			socket.off("connect_error", handleConnectError);
			socket.off("chatCreated", handleChatCreated);
			socket.off("chatDeleted", handleChatDeleted);
			socket.off("memberAdded", handleMemberAdded);
			socket.off("userSearch", handleUserSearch);
			socket.off("newMessage", handleNewMessage);
			socket.off("error", handleError);
			socket.off("reconnect", handleReconnect);
			socket.disconnect();
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
				setDropdown(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(() => { setUserStatus("idle"); }, [modal]);

	// ── Handlers ──────────────────────────────────────────────────────────────

	const handlePrivateChat = useCallback((uid: string) => {
		socket.emit("createChat", { members: [auth.currentUser?.uid, uid] });
		setModal(null);
	}, []);

	const handleGroupChat = useCallback((name: string, participants: { uid: string }[]) => {
		socket.emit("createChat", {
			name,
			members: participants.map((p) => p.uid),
			isGroup: true,
			admin: auth.currentUser?.uid,
		});
		setModal(null);
	}, []);

	const handleSearch = useCallback((username: string) => {
		setUserStatus("loading");
		socket.emit("getUser", { username });
	}, []);

	const handleLogout = useCallback(async () => {
		await logout();
		navigate("/");
	}, [navigate]);

	const handleSelectChat = useCallback((id: string) => {
		onSelectChat(id, chats);
	}, [onSelectChat, chats]);

	const currentUid = auth.currentUser?.uid;

	const filtered = useMemo(() => chats.filter((c) => {
		const q = search.toLowerCase();
		if (c.isGroup) return c.name.toLowerCase().includes(q);
		const participant = c.participants.find((p) => p.user.uid !== currentUid);
		if (!participant) return false;
		const { firstName, lastName, username } = participant.user.profile;
		return `${firstName} ${lastName}`.toLowerCase().includes(q) || username.toLowerCase().includes(q);
	}), [chats, search, currentUid]);

	const chatItems = useMemo(() => filtered.map((chat) => {
		let fullName = "";
		let avatarUrl = "";
		let participant;

		if (chat.isGroup) {
			fullName = chat.name;
			avatarUrl = chat.avatarUrl;
		} else {
			participant = chat.participants.find(
				(p) => p.user.uid !== currentUid,
			);
			const profile = participant?.user.profile;
			fullName = `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim();
			avatarUrl = profile?.avatarUrl ?? "";
		}

		return (
			<Chat
				key={chat.id}
				chat={chat}
				activeChatId={activeChatId!}
				onSelectChat={handleSelectChat}
				fullName={fullName}
				p={chat.isGroup ? undefined : participant?.user.profile}
				avatarUrl={avatarUrl}
				isGroup={chat.isGroup}
			/>
		);
	}), [filtered, activeChatId, handleSelectChat, currentUid]);

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

					{chatItems}
				</div>
			</div>
		</>
	);
});

export type ChatListHandle = { updateChatPreview: (chatId: string, text: string, sentAt: string) => void };
export default ChatList;
