import { useState, useRef, useEffect } from "react";
import ChatList from "./ChatList";
import type { ChatListHandle } from "./ChatList";
import ChatRoom from "./ChatRoom";
import type { ChatStructure } from "./constants";

import "./ChatLayout.css";

// Architecture: ChatList owns the socket (connects on mount, disconnects on unmount).
// ChatRoom only emits joinChat / leaveChat — it never touches the connection.
// Switching chats = instant, no reconnect needed.

const ChatLayout = () => {
	const [activeChat, setActiveChat] = useState<ChatStructure | null>(null);
	const chatListRef = useRef<ChatListHandle>(null);

	const handleSelectChat = (id: string, allChats: ChatStructure[]) => {
		const found = allChats.find((c) => c.id === id) ?? null;
		setActiveChat(found);
	};

	const handlePreviewUpdate = (chatId: string, text: string, sentAt: string) => {
		chatListRef.current?.updateChatPreview(chatId, text, sentAt);
	};

	const handleChatRead = (chatId: string) => {
		chatListRef.current?.resetUnread(chatId);
	};

	const handleChatDeleted = (chatId: string) => {
		if (activeChat?.id === chatId) {
			setActiveChat(null);
		}
	};

	const [onlineUids, setOnlineUids] = useState<Set<string>>(new Set());

	// Sync onlineUids from ChatList after each render via a ref-read effect
	useEffect(() => {
		const uids = chatListRef.current?.getOnlineUids() ?? new Set();
		// eslint-disable-next-line react-hooks/set-state-in-effect -- ref read, not stale closure
		setOnlineUids(uids);
	}, []);

	return (
		<div className="chat-layout">
			{/* Sidebar — always mounted so the socket stays alive */}
			<div className={`chat-layout-sidebar ${activeChat ? "has-active" : ""}`}>
				<ChatList
					ref={chatListRef}
					activeChatId={activeChat?.id}
					onSelectChat={(id, allChats) => handleSelectChat(id, allChats)}
				/>
			</div>

			{/* Room panel */}
			<div className={`chat-layout-room ${activeChat ? "visible" : ""}`}>
				{activeChat ? (
					<ChatRoom
						chat={activeChat}
						onBack={() => setActiveChat(null)}
						onPreviewUpdate={handlePreviewUpdate}
						onChatRead={handleChatRead}
						onChatDeleted={handleChatDeleted}
						onlineUids={onlineUids}
					/>
				) : (
					<div className="chat-layout-empty">
						<p className="chat-layout-empty-brand">C</p>
						<p className="chat-layout-empty-title">No conversation selected</p>
						<p className="chat-layout-empty-sub">Pick a conversation or start something new</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default ChatLayout;
