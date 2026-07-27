import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../backend";
import { Avatar } from "./components/Avatar";
import { StatusTick } from "../components/StatusTick";
import { auth } from "../firebase";
import type { ChatStructure } from "./constants";
import { AddMemberModal } from "./components/AddMemberModal";
import { GroupInfoPanel } from "./components/GroupInfoPanel";
import { ConfirmModal } from "./components/ConfirmModal";

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
	onChatRead?: (chatId: string) => void;
	onChatDeleted?: (chatId: string) => void;
	onlineUids?: Set<string>;
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

// ── ChatRoom ───────────────────────────────────────────────────────────────
// This component does NOT own the socket connection — ChatList does.
// ChatRoom only emits joinChat / leaveChat and listens for room-scoped events.

const ChatRoom = ({ chat, onBack, onPreviewUpdate, onChatRead, onChatDeleted, onlineUids }: Props) => {
	const navigate   = useNavigate();
	const currentUid = auth.currentUser?.uid ?? "";

	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput]       = useState("");
	const [loading, setLoading]   = useState(true);
	const [hasMore, setHasMore]   = useState(true);
	const [showActions, setShowActions] = useState(false);
	const [showAddMember, setShowAddMember] = useState(false);
	const [showGroupInfo, setShowGroupInfo] = useState(false);
	const [showConfirmDelete, setShowConfirmDelete] = useState(false);
	const actionsRef = useRef<HTMLDivElement>(null);
	const messagesRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const inputRef  = useRef<HTMLTextAreaElement>(null);
	const isLoadingMore = useRef(false);

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

	const otherIsOnline = !chat.isGroup && otherParticipant
		? (onlineUids?.has(otherParticipant.uid) ?? false)
		: false;

	// ── Socket events (room-scoped only) ──────────────────────────────────────

	useEffect(() => {
		setLoading(true);
		setMessages([]);
		setHasMore(true);
		isLoadingMore.current = false;

		// Join the room — server responds with 'messages' (history)
		socket.emit("joinChat", { chatId: chat.id });

		socket.on("messages", (msgs: Message[]) => {
			setMessages(msgs);
			setLoading(false);
		});

		// Handle paginated load of older messages
		socket.on("moreMessages", (olderMessages: Message[]) => {
			if (olderMessages.length === 0) {
				setHasMore(false);
			} else {
				// Maintain scroll position after prepending older messages
				const container = messagesRef.current;
				const prevHeight = container?.scrollHeight ?? 0;

				setMessages((prev) => [...olderMessages, ...prev]);

				if (container) {
					requestAnimationFrame(() => {
						container.scrollTop = container.scrollHeight - prevHeight;
					});
				}
			}
			isLoadingMore.current = false;
		});

		socket.on("newMessage", (msg: Message) => {
			setMessages((prev) => [...prev, msg]);
			onPreviewUpdate?.(chat.id, msg.text, msg.sentAt);
			if (msg.senderId !== currentUid) {
				socket.emit("markRead", { chatId: chat.id, uid: currentUid }, () => {
					onChatRead?.(chat.id);
				});
			}
		});

		socket.on(
			"messageStatus",
			({ messageId, status }: { messageId: string; status: Message["status"] }) => {
				setMessages((prev) =>
					prev.map((m) => (m.id === messageId ? { ...m, status } : m)),
				);
			},
		);

		// Confirm deletion from server before closing the room.
		// Store the handler so cleanup removes only this callback — not the sidebar's.
		const onChatDeletedHandler = ({ id }: { id: string }) => {
			if (id === chat.id) {
				onChatDeleted?.(id);
			}
		};
		socket.on("chatDeleted", onChatDeletedHandler);

		const onMemberRemovedHandler = (updatedChat: { id: string; participants: { user: { uid: string } }[] }) => {
			if (updatedChat.id === chat.id && !updatedChat.participants.some((p) => p.user.uid === currentUid)) {
				onChatDeleted?.(chat.id);
			}
		};
		socket.on("memberRemoved", onMemberRemovedHandler);

		// Mark existing messages as read when the room opens.
		// The ack callback tells the server to persist the updated unread count.
		// If the server doesn't support acks, the frontend already reset unread
		// locally when the user clicked the chat, so this is a best-effort sync.
		socket.emit("markRead", { chatId: chat.id, uid: currentUid }, () => {
			onChatRead?.(chat.id);
		});

		return () => {
			socket.emit("leaveChat", { chatId: chat.id });
			socket.off("messages");
			socket.off("moreMessages");
			socket.off("newMessage");
			socket.off("messageStatus");
			socket.off("chatDeleted", onChatDeletedHandler);
			socket.off("memberRemoved", onMemberRemovedHandler);
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks are stable or handled via chat.id changes
	}, [chat.id, currentUid]);

	// ── Scroll-to-bottom on new messages ────────────────────────────────────

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// ── Infinite scroll: load older messages on scroll-to-top ───────────────

	const handleMessagesScroll = () => {
		const container = messagesRef.current;
		if (!container || isLoadingMore.current || !hasMore) return;

		// Trigger load when the user scrolls within 80px of the top
		if (container.scrollTop <= 80) {
			isLoadingMore.current = true;
			socket.emit("loadMoreMessages", {
				chatId: chat.id,
				before: messages[0]?.id,
			});
		}
	};

	// ── Close actions dropdown on outside click ─────────────────────────────

	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (actionsRef.current && !actionsRef.current.contains(e.target as Node))
				setShowActions(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	// ── Delete / Leave chat ───────────────────────────────────────────────────

	const isGroupAdmin = chat.isGroup && chat.admin === currentUid;

	const handleConfirmDelete = () => {
		if (chat.isGroup && !isGroupAdmin) {
			socket.emit("leaveGroup", { chatId: chat.id });
		} else {
			socket.emit("deleteChat", { chatId: chat.id });
		}
		setShowConfirmDelete(false);
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
						online={otherIsOnline}
						size={36}
					/>
				</div>

				<div
					className="chatroom-header-info"
					onClick={() => {
						if (chat.isGroup) {
							setShowGroupInfo(true);
						} else if (otherParticipant?.profile.username) {
							navigate(`/profile/${otherParticipant.profile.username}`);
						}
					}}
					style={{ cursor: "pointer" }}
				>
					<p className="chatroom-header-name">{headerName}</p>
					<p className="chatroom-header-sub">
						{chat.isGroup
							? `${chat.participants.length} ${chat.participants.length === 1 ? "member" : "members"}`
							: "Tap here to view profile"}
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
									setShowConfirmDelete(true);
								}}
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<polyline points="3 6 5 6 21 6" />
									<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
								</svg>
								{chat.isGroup
									? isGroupAdmin ? "Delete group" : "Leave group"
									: "Delete chat"}
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

			{/* Group info panel */}
			{showGroupInfo && chat.isGroup && (
				<GroupInfoPanel
					chat={chat}
					onClose={() => setShowGroupInfo(false)}
					onlineUids={onlineUids}
				/>
			)}

			{/* Confirm delete / leave modal */}
			{showConfirmDelete && (
				<ConfirmModal
					title={
						!chat.isGroup
							? "Delete conversation?"
							: isGroupAdmin
								? "Delete group?"
								: "Leave group?"
					}
					description={
						!chat.isGroup
							? "Are you sure you want to delete this conversation? This cannot be undone."
							: isGroupAdmin
								? `Are you sure you want to delete "${headerName}"? This will permanently remove the group for all members.`
								: `Are you sure you want to leave "${headerName}"? You won't be able to send or receive messages in this group.`
					}
					confirmLabel={
						!chat.isGroup
							? "Delete"
							: isGroupAdmin
								? "Delete group"
								: "Leave group"
					}
					confirmDanger
					onConfirm={handleConfirmDelete}
					onCancel={() => setShowConfirmDelete(false)}
				/>
			)}

			{/* Messages */}
			<div className="chatroom-messages" ref={messagesRef} onScroll={handleMessagesScroll}>
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
										{isOwn && <StatusTick status={msg.status} size="default" />}
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
