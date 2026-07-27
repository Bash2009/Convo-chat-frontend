import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "./Avatar";
import { StatusTick } from "../../components/StatusTick";
import { auth } from "../../firebase";
import type { ChatStructure } from "../constants";

// Pure time-formatting helper — no component state, no Date.now() in render.
const formatTime = (iso: string): string => {
	if (!iso) return "";
	const now = Date.now();
	const diff  = now - new Date(iso).getTime();
	const mins  = Math.floor(diff / 60_000);
	const hours = Math.floor(diff / 3_600_000);
	if (mins  < 1)  return "now";
	if (mins  < 60) return `${mins}m`;
	if (hours < 24) return `${hours}h`;
	if (hours < 48) return "Yesterday";
	return new Date(iso).toLocaleDateString("en-US", { weekday: "short" });
};

const Chat = ({
	chat,
	activeChatId,
	onSelectChat,
	i,
	fullName,
	p,
	avatarUrl,
	isGroup,
	isOnline,
	isMuted,
	onToggleMute,
	onDeleteChat,
}: {
	chat: ChatStructure;
	activeChatId: string;
	onSelectChat: (id: string) => void;
	i: number;
	fullName: string;
	p: { firstName: string; lastName: string; username: string; avatarUrl: string; online?: boolean } | undefined;
	avatarUrl?: string;
	isGroup: boolean;
	isOnline?: boolean;
	isMuted?: boolean;
	onToggleMute?: (chatId: string) => void;
	onDeleteChat?: (chat: ChatStructure) => void;
}) => {

	const navigate = useNavigate();
	const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const itemRef = useRef<HTMLDivElement>(null);
	const [swipeOffset, setSwipeOffset] = useState(0);
	const [swiping, setSwiping] = useState(false);
	const touchStartX = useRef(0);
	const swipedRef = useRef(false);
	const SWIPE_THRESHOLD = 80;

	// ── Touch swipe handlers ───────────────────────────────────────────────
	const handleTouchStart = useCallback((e: React.TouchEvent) => {
		swipedRef.current = false;
		touchStartX.current = e.touches[0].clientX;
		setSwiping(true);
	}, []);

	const handleTouchMove = useCallback((e: React.TouchEvent) => {
		if (!swiping) return;
		const dx = e.touches[0].clientX - touchStartX.current;
		if (Math.abs(dx) > 10) swipedRef.current = true;
		// Only allow swiping left (negative dx) or slight right bounce
		const offset = Math.min(0, Math.max(-SWIPE_THRESHOLD - 20, dx));
		setSwipeOffset(offset);
	}, [swiping]);

	const handleTouchEnd = useCallback(() => {
		if (!swiping) return;
		setSwiping(false);
		if (Math.abs(swipeOffset) >= SWIPE_THRESHOLD) {
			// Swipe threshold reached — trigger delete with full chat data for undo
			onDeleteChat?.(chat);
		}
		setSwipeOffset(0);
	}, [swiping, swipeOffset, onDeleteChat, chat]);

	// Prevent onClick from firing after a swipe gesture
	const handleClick = useCallback(
		() => {
			if (swipedRef.current) {
				swipedRef.current = false;
				return;
			}
			onSelectChat(chat.id);
		},
		[onSelectChat, chat.id],
	);

	// Close the context menu on outside click
	useEffect(() => {
		if (!menuPos) return;
		const handler = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuPos(null);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [menuPos]);

	const handleContextMenu = (event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		const x = Math.min(event.clientX, window.innerWidth - 200);
		const y = Math.min(event.clientY, window.innerHeight - 100);
		setMenuPos({ x: Math.max(0, x), y: Math.max(0, y) });
	};

	const handleAvatarClick = (e: React.MouseEvent) => {
		// For private chats, clicking the avatar navigates to the user's profile.
		// Stop propagation so it doesn't also trigger the row's onSelectChat.
		if (!isGroup && p?.username) {
			e.stopPropagation();
			navigate(`/profile/${p.username}`);
		}
		// For group chats, let the click fall through to open the chat as normal.
	};

	const handleMuteClick = () => {
		onToggleMute?.(chat.id);
		setMenuPos(null);
	};

	return (
		<div className="chatlist-item-wrap">
			{/* Delete reveal behind the item */}
			<div className="chatlist-swipe-delete">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<polyline points="3 6 5 6 21 6" />
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
				</svg>
			</div>
			<div
				ref={itemRef}
				className={`chatlist-item ${activeChatId === chat.id ? "active" : ""} ${isMuted ? "muted" : ""}`}
				style={{
					animationDelay: `${i * 40}ms`,
					transform: `translateX(${swipeOffset}px)`,
					transition: swiping ? "none" : "transform 0.25s ease, background 0.12s",
				}}
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				onTouchCancel={handleTouchEnd}
			>
			<div className="chatlist-avatar-wrap" onClick={handleAvatarClick}>
				<Avatar
					name={fullName}
					avatarUrl={avatarUrl}
					online={!!isOnline}
				/>
			</div>
			<div className="chatlist-item-body">
				<div className="chatlist-item-row">
					<span className="chatlist-item-name">
						{fullName}
						{isMuted && (
							<span className="chatlist-muted-icon" title="Muted">
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
									<line x1="1" y1="1" x2="23" y2="23" />
								</svg>
							</span>
						)}
					</span>
					<span className="chatlist-item-time">
						{formatTime(chat.lastMessageAt)}
					</span>
				</div>
				<div className="chatlist-item-row">
					<span className="chatlist-item-msg">
						{/* Show status tick for the current user's own last message */}
						{chat.lastMessageSenderId === auth.currentUser?.uid && chat.lastMessageStatus && !isGroup && (
							<span className="chatlist-status-tick">
								<StatusTick status={chat.lastMessageStatus} size="small" />
							</span>
						)}
						<span className="chatlist-item-msg-text">
							{chat.lastMessage || "No messages yet"}
						</span>
					</span>
					{chat.unread > 0 && (
						<span className="chatlist-badge">{chat.unread}</span>
					)}
				</div>
			</div>

			{/* Right-click context menu */}
			{menuPos && (
				<div
					ref={menuRef}
					className="chatlist-context-menu"
					style={{ left: menuPos.x, top: menuPos.y }}
				>
					<button
						className="chatlist-context-item"
						onClick={handleMuteClick}
					>
						{isMuted ? (
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
							</svg>
						) : (
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
								<line x1="1" y1="1" x2="23" y2="23" />
							</svg>
						)}
						{isMuted ? "Unmute notifications" : "Mute notifications"}
					</button>
				</div>
			)}
		</div>
		</div>
	);
};

export default Chat;
