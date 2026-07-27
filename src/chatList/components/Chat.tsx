import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "./Avatar";
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
}) => {

	const navigate = useNavigate();
	const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
	const menuRef = useRef<HTMLDivElement>(null);

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

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		// Position the menu near the cursor, keeping it within the viewport
		const x = Math.min(e.clientX, window.innerWidth - 200);
		const y = Math.min(e.clientY, window.innerHeight - 100);
		setMenuPos({ x: Math.max(0, x), y: Math.max(0, y) });
	}, []);

	const handleAvatarClick = (e: React.MouseEvent) => {
		// For private chats, clicking the avatar navigates to the user's profile.
		// Stop propagation so it doesn't also trigger the row's onSelectChat.
		if (!isGroup && p?.username) {
			e.stopPropagation();
			navigate(`/profile/${p.username}`);
		}
		// For group chats, let the click fall through to open the chat as normal.
	};

	const handleMuteClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		onToggleMute?.(chat.id);
		setMenuPos(null);
	};

	return (
		<div
			className={`chatlist-item ${activeChatId === chat.id ? "active" : ""} ${isMuted ? "muted" : ""}`}
			style={{ animationDelay: `${i * 40}ms` }}
			onClick={() => onSelectChat(chat.id)}
			onContextMenu={handleContextMenu}
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
						{chat.lastMessage || "No messages yet"}
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
	);
};

export default Chat;
