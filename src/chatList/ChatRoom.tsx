import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../backend";
import { Avatar } from "./components/Avatar";
import { auth } from "../firebase";
import type { ChatStructure } from "./constants";
import { AddMemberModal } from "./components/AddMemberModal";

// ── Types ──────────────────────────────────────────────────────────────────

interface Message {
	id: string;
	senderId: string;
	text: string;
	sentAt: string;
	status: "sent" | "delivered" | "read";
}

interface Props {
	chat: ChatStructure;
	onBack: () => void;
	onPreviewUpdate?: (chatId: string, text: string, sentAt: string) => void;
	onChatDeleted?: (chatId: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const formatMsgTime = (iso: string) =>
	new Date(iso).toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	});

const isSameDay = (a: string, b: string) =>
	new Date(a).toDateString() === new Date(b).toDateString();

const formatDayLabel = (iso: string) => {
	const d = new Date(iso);
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);
	if (d.toDateString() === today.toDateString()) return "Today";
	if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
	return d.toLocaleDateString("en-US", {
		weekday: "long",
		month: "short",
		day: "numeric",
	});
};

// ── Tick icon ──────────────────────────────────────────────────────────────

const StatusTick = ({ status }: { status: Message["status"] }) => {
	const color   = status === "read" ? "#191970" : "currentColor";
	const opacity = status === "sent" ? 0.5 : 1;

	if (status === "sent") {
		return (
			<svg
				className="chatroom-tick"
				width="12" height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke={color}
				strokeOpacity={opacity}
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<polyline points="20 6 9 17 4 12" />
			</svg>
		);
	}

	return (
		<svg
			className="chatroom-tick"
			width="18" height="12"
			viewBox="0 0 36 24"
			fill="none"
			stroke={color}
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="36 6 17 17 12 12" />
			<polyline points="24 6 9 17 4 12" />
		</svg>
	);
};

// ── ChatRoom ───────────────────────────────────────────────────────────────
// This component does NOT own the socket connection — ChatList does.
// ChatRoom only emits joinChat / leaveChat and listens for room-scoped events.

const ChatRoom = ({ chat, onBack, onPreviewUpdate, onChatDeleted }: Props) => {
	const navigate   = useNavigate();
	const currentUid = auth.currentUser?.uid ?? "";

	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput]       = useState("");
	const [loading, setLoading]   = useState(true);
	const [showActions, setShowActions] = useState(false);
	const [showAddMember, setShowAddMember] = useState(false);
	const actionsRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const inputRef  = useRef<HTMLTextAreaElement>(null);

	const otherParticipant = !chat.isGroup
		? chat.participants.find((p) => p.user.uid !== currentUid)?.user
		: null;

	const headerName = chat.isGroup
		? chat.name
		: otherParticipant
		? `${otherParticipant.profile.firstName} ${otherParticipant.profile.lastName}`
		: "";

	const headerAvatar = chat.isGroup
		? chat.avatarUrl
		: otherParticipant?.profile.avatarUrl ?? "";

	// ── Socket events (room-scoped only) ──────────────────────────────────────

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- reset state on chat switch
		setLoading(true);
		setMessages([]);

		// Join the room — server responds with 'messages' (history)
		socket.emit("joinChat", { chatId: chat.id });

		socket.on("messages", (msgs: Message[]) => {
			setMessages(msgs);
			setLoading(false);
		});

		socket.on("newMessage", (msg: Message) => {
			setMessages((prev) => [...prev, msg]);
			onPreviewUpdate?.(chat.id, msg.text, msg.sentAt);
		});

		socket.on(
			"messageStatus",
			({ messageId, status }: { messageId: string; status: Message["status"] }) => {
				setMessages((prev) =>
					prev.map((m) => (m.id === messageId ? { ...m, status } : m)),
				);
			},
		);

		// Confirm deletion from server before closing the room
		socket.on("chatDeleted", ({ id }: { id: string }) => {
			if (id === chat.id) {
				onChatDeleted?.(id);
			}
		});

		// Mark existing messages as read when the room opens
		socket.emit("markRead", { chatId: chat.id, uid: currentUid });

		return () => {
			socket.emit("leaveChat", { chatId: chat.id });
			socket.off("messages");
			socket.off("newMessage");
			socket.off("messageStatus");
			socket.off("chatDeleted");
		};
	}, [chat.id, currentUid]);

	// Scroll to bottom on new messages
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// ── Close actions dropdown on outside click ─────────────────────────────

	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (actionsRef.current && !actionsRef.current.contains(e.target as Node))
				setShowActions(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	// ── Delete chat ───────────────────────────────────────────────────────────

	const handleDeleteChat = () => {
		if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
		socket.emit("deleteChat", { chatId: chat.id });
	};

	// ── Send ──────────────────────────────────────────────────────────────────

	const sendMessage = () => {
		const text = input.trim();
		if (!text) return;
		socket.emit("sendMessage", { chatId: chat.id, text, senderId: currentUid });
		setInput("");
		inputRef.current?.focus();
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	};

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<div className="chatroom-root">
			{/* Header */}
			<div className="chatroom-header">
				<button
					className="chatroom-back-btn"
					onClick={onBack}
					aria-label="Back"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
						<polyline points="15 18 9 12 15 6" />
					</svg>
				</button>

				<div
					className="chatroom-header-avatar"
					onClick={() => {
						if (!chat.isGroup && otherParticipant)
							navigate(`/profile/${otherParticipant.profile.username}`);
					}}
					style={{ cursor: chat.isGroup ? "default" : "pointer" }}
				>
					<Avatar
						name={headerName}
						avatarUrl={headerAvatar}
						online={false}
						size={36}
					/>
				</div>

				<div className="chatroom-header-info">
					<p className="chatroom-header-name">{headerName}</p>
					<p className="chatroom-header-sub">
						{chat.isGroup
							? `${chat.participants.length} members`
							: "Tap avatar to view profile"}
					</p>
				</div>

				{/* Actions dropdown */}
				<div className="chatroom-actions-wrap" ref={actionsRef}>
					<button
						className="chatroom-actions-btn"
						title="Chat options"
						onClick={() => setShowActions((v) => !v)}
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
							<circle cx="12" cy="5" r="1.5" fill="currentColor" />
							<circle cx="12" cy="12" r="1.5" fill="currentColor" />
							<circle cx="12" cy="19" r="1.5" fill="currentColor" />
						</svg>
					</button>

					{showActions && (
						<div className="chatroom-actions-menu">
							{chat.isGroup && (
								<button
									className="chatroom-actions-item"
									onClick={() => {
										setShowActions(false);
										setShowAddMember(true);
									}}
								>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
										<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
										<circle cx="9" cy="7" r="4" />
										<line x1="23" y1="7" x2="23" y2="13" />
										<line x1="20" y1="10" x2="26" y2="10" />
									</svg>
									Add members
								</button>
							)}
							<button
								className="chatroom-actions-item danger"
								onClick={() => {
									setShowActions(false);
									handleDeleteChat();
								}}
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<polyline points="3 6 5 6 21 6" />
									<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
								</svg>
								Delete chat
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Add member modal */}
			{showAddMember && (
				<AddMemberModal
					chatId={chat.id}
					onClose={() => setShowAddMember(false)}
				/>
			)}

			{/* Messages */}
			<div className="chatroom-messages">
				{loading && <p className="chatroom-loading">Loading…</p>}

				{!loading && messages.length === 0 && (
					<p className="chatroom-empty">No messages yet. Say hello 👋</p>
				)}

				{messages.map((msg, i) => {
					const isOwn   = msg.senderId === currentUid;
					const showDay = i === 0 || !isSameDay(messages[i - 1].sentAt, msg.sentAt);

					const senderParticipant =
						chat.isGroup && !isOwn
							? chat.participants.find((p) => p.user.uid === msg.senderId)?.user
							: null;

					return (
						<div key={msg.id}>
							{showDay && (
								<div className="chatroom-day-label">
									<span>{formatDayLabel(msg.sentAt)}</span>
								</div>
							)}

							<div className={`chatroom-msg-row ${isOwn ? "own" : "other"}`}>
								{!isOwn && chat.isGroup && senderParticipant && (
									<div
										className="chatroom-msg-avatar"
										onClick={() =>
											navigate(`/profile/${senderParticipant.profile.username}`)
										}
									>
										<Avatar
											name={`${senderParticipant.profile.firstName} ${senderParticipant.profile.lastName}`}
											avatarUrl={senderParticipant.profile.avatarUrl}
											online={false}
											size={26}
										/>
									</div>
								)}

								<div className={`chatroom-bubble ${isOwn ? "own" : "other"}`}>
									{!isOwn && chat.isGroup && senderParticipant && (
										<p className="chatroom-sender-name">
											{senderParticipant.profile.firstName}
										</p>
									)}

									<p className="chatroom-bubble-text">{msg.text}</p>

									<div className="chatroom-bubble-meta">
										<span className="chatroom-bubble-time">
											{formatMsgTime(msg.sentAt)}
										</span>
										{isOwn && <StatusTick status={msg.status} />}
									</div>
								</div>
							</div>
						</div>
					);
				})}

				<div ref={bottomRef} />
			</div>

			{/* Input */}
			<div className="chatroom-input-bar">
				<textarea
					ref={inputRef}
					className="chatroom-input"
					placeholder="Type a message…"
					rows={1}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
				/>
				<button
					className="chatroom-send-btn"
					onClick={sendMessage}
					disabled={!input.trim()}
					aria-label="Send"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
						<line x1="22" y1="2" x2="11" y2="13" />
						<polygon points="22 2 15 22 11 13 2 9 22 2" />
					</svg>
				</button>
			</div>
		</div>
	);
};

export default ChatRoom;
