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
}) => {

	const navigate = useNavigate();

	const handleAvatarClick = (e: React.MouseEvent) => {
		// For private chats, clicking the avatar navigates to the user's profile.
		// Stop propagation so it doesn't also trigger the row's onSelectChat.
		if (!isGroup && p?.username) {
			e.stopPropagation();
			navigate(`/profile/${p.username}`);
		}
		// For group chats, let the click fall through to open the chat as normal.
	};

	return (
		<div
			className={`chatlist-item ${activeChatId === chat.id ? "active" : ""}`}
			style={{ animationDelay: `${i * 40}ms` }}
			onClick={() => onSelectChat(chat.id)}
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
					<span className="chatlist-item-name">{fullName}</span>
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
		</div>
	);
};

export default Chat;
