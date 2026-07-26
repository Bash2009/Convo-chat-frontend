import { useState, useRef, useCallback } from "react";
import ChatList from "./ChatList";
import type { ChatListHandle } from "./ChatList";
import ChatRoom from "./ChatRoom";
import type { ChatStructure } from "./constants";

import "./ChatLayout.css";

const ChatLayout = () => {
	const [activeChat, setActiveChat] = useState<ChatStructure | null>(null);
	const chatListRef = useRef<ChatListHandle>(null);

	const handleSelectChat = useCallback((id: string, allChats: ChatStructure[]) => {
		const found = allChats.find((c) => c.id === id) ?? null;
		setActiveChat(found);
	}, []);

	const handlePreviewUpdate = useCallback((chatId: string, text: string, sentAt: string) => {
		chatListRef.current?.updateChatPreview(chatId, text, sentAt);
	}, []);

	const handleChatDeleted = useCallback((chatId: string) => {
		if (activeChat?.id === chatId) {
			setActiveChat(null);
		}
	}, [activeChat?.id]);

	const handleBack = useCallback(() => setActiveChat(null), []);

	return (
		<div className="chat-layout">
			<div className={`chat-layout-sidebar ${activeChat ? "has-active" : ""}`}>
				<ChatList
					ref={chatListRef}
					activeChatId={activeChat?.id}
					onSelectChat={handleSelectChat}
				/>
			</div>

			<div className={`chat-layout-room ${activeChat ? "visible" : ""}`}>
				{activeChat ? (
					<ChatRoom
						key={activeChat.id}
						chat={activeChat}
						onBack={handleBack}
						onPreviewUpdate={handlePreviewUpdate}
						onChatDeleted={handleChatDeleted}
					/>
				) : (
					<div className="chat-layout-empty">
						<svg
							width="48"
							height="48"
							viewBox="0 0 24 24"
							fill="none"
							stroke="#d1d5db"
							strokeWidth="1.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
						</svg>
						<p>Select a conversation</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default ChatLayout;
