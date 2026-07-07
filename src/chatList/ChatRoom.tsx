import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../backend";
import { Avatar } from "./components/Avatar";
import { auth } from "../firebase";
import type { ChatStructure } from "./constants";

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

const ChatRoom = ({ chat, onBack }: Props) => {
	const navigate   = useNavigate();
	const currentUid = auth.currentUser?.uid ?? "";

	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput]       = useState("");
	const [loading, setLoading]   = useState(true);
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
		});

		socket.on(
			"messageStatus",
			({ messageId, status }: { messageId: string; status: Message["status"] }) => {
				setMessages((prev) =>
					prev.map((m) => (m.id === messageId ? { ...m, status } : m)),
				);
			},
		);

		// Mark existing messages as read when the room opens
		socket.emit("markRead", { chatId: chat.id, uid: currentUid });

		return () => {
			socket.emit("leaveChat", { chatId: chat.id });
			socket.off("messages");
			socket.off("newMessage");
			socket.off("messageStatus");
		};
	}, [chat.id, currentUid]);

	// Scroll to bottom on new messages
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

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
			</div>

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
