export interface ChatStructure {
	id: string;
	name: string;
	participants: {
		user: {
			uid: string;
			profile: {
				firstName: string;
				lastName: string;
				username: string;
				avatarUrl: string;
			};
		};
	}[];
	lastMessage: string;
	lastMessageAt: string;
	lastMessageSenderId?: string;
	lastMessageStatus?: "sent" | "delivered" | "read";
	unread: number;
	isGroup: boolean;
	avatarUrl: string;
	admin?: string;
}

export type Modal = "private" | "group" | null;
export type UserStatus = "idle" | "loading" | "found" | "not_found";

export interface Participant {
	uid: string;
	firstName: string;
	lastName: string;
	username: string;
	avatarUrl?: string;
}

export interface NewChatModalProps {
	onClose: () => void;
	onStart: (username: string) => void;
	onSearch: (username: string) => void;
	userStatus: UserStatus;
	foundUser?: Participant;
}

export interface NewGroupModalProps {
	onClose: () => void;
	onStart: (name: string, participants: Participant[]) => void;
	onSearch: (username: string) => void;
	searchStatus: UserStatus;
	foundUser?: Participant;
}
