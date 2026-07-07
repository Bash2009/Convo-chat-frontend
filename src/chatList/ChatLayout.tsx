import { useState } from "react";
import ChatList from "./ChatList";
import ChatRoom from "./ChatRoom";
import type { ChatStructure } from "./constants";

import "./ChatLayout.css";

// Architecture: ChatList owns the socket (connects on mount, disconnects on unmount).
// ChatRoom only emits joinChat / leaveChat — it never touches the connection.
// Switching chats = instant, no reconnect needed.

const ChatLayout = () => {
	const [activeChat, setActiveChat] = useState<ChatStructure | null>(null);

	const handleSelectChat = (id: string, allChats: ChatStructure[]) => {
		const found = allChats.find((c) => c.id === id) ?? null;
		setActiveChat(found);
	};

	return (
		<div className="chat-layout">
			{/* Sidebar — always mounted so the socket stays alive */}
			<div className={`chat-layout-sidebar ${activeChat ? "has-active" : ""}`}>
				<ChatList
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
