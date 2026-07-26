import { memo } from "react";
import { Avatar } from "./Avatar";
import type { ChatStructure } from "../constants";

const formatTime = (iso: string): string => {
	if (!iso) return "";
	const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
	if (mins  < 1)  return "now";
	if (mins  < 60) return `${mins}m`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h`;
	if (hours < 48) return "Yesterday";
	return new Date(iso).toLocaleDateString("en-US", { weekday: "short" });
};

const Chat = memo(({
	chat,
	activeChatId,
	onSelectChat,
	fullName,
	p,
	avatarUrl,
	isGroup,
}: {
	chat: ChatStructure;
	activeChatId: string;
	onSelectChat: (id: string) => void;
	fullName: string;
	p: { firstName: string; lastName: string; username: string; avatarUrl: string; online?: boolean } | undefined;
	avatarUrl?: string;
	isGroup: boolean;
}) => {
	return (
		<div
			className={`chatlist-item ${activeChatId === chat.id ? "active" : ""}`}
			onClick={() => onSelectChat(chat.id)}
		>
			<Avatar
				name={fullName}
				avatarUrl={avatarUrl}
				online={!isGroup && !!p?.online}
			/>
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
});

export default Chat;
