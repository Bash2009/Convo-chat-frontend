import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Avatar } from "./Avatar";
import type { ChatStructure } from "../constants";
import { auth } from "../../firebase";

interface GroupInfoPanelProps {
	chat: ChatStructure;
	onClose: () => void;
	onlineUids?: Set<string>;
}

export const GroupInfoPanel = ({ chat, onClose, onlineUids }: GroupInfoPanelProps) => {
	const navigate = useNavigate();
	const currentUid = auth.currentUser?.uid ?? "";

	const currentMember = chat.participants.find(
		(p) => p.user.uid === currentUid,
	);
	const otherMembers = chat.participants.filter(
		(p) => p.user.uid !== currentUid,
	);
	const orderedMembers = currentMember
		? [currentMember, ...otherMembers]
		: chat.participants;

	const handleMemberClick = (uid: string) => {
		const member = chat.participants.find((p) => p.user.uid === uid);
		if (member && member.user.profile.username) {
			navigate(`/profile/${member.user.profile.username}`);
			onClose();
		}
	};

	return createPortal(
		<div className="chatlist-modal-overlay" onClick={onClose}>
			<div className="chatlist-modal chatlist-modal--wide" onClick={(e) => e.stopPropagation()}>
				<div className="group-info-header">
					<Avatar
						name={chat.name}
						avatarUrl={chat.avatarUrl}
						online={false}
						size={72}
					/>
					<h2 className="group-info-name">{chat.name}</h2>
					<p className="group-info-count">
						{chat.participants.length}{" "}
						{chat.participants.length === 1 ? "member" : "members"}
					</p>
				</div>

				<div className="group-info-divider" />

				<div className="group-info-members">
					<p className="group-info-members-title">Members</p>

					{orderedMembers.map((member) => {
						const isCurrentUser = member.user.uid === currentUid;
						const isAdmin = member.user.uid === chat.admin;
						const profile = member.user.profile;
						const fullName = `${profile.firstName} ${profile.lastName}`;

						return (
							<div
								key={member.user.uid}
								className="group-info-member"
								onClick={() => handleMemberClick(member.user.uid)}
							>
								<Avatar
									name={fullName}
									avatarUrl={profile.avatarUrl}
									online={onlineUids?.has(member.user.uid) ?? false}
									size={44}
								/>
								<div className="group-info-member-info">
									<p className="group-info-member-name">
										{fullName}
										{isAdmin && (
											<span className="group-info-member-admin">Admin</span>
										)}
									</p>
									<p className="group-info-member-username">
										@{profile.username}
										{isCurrentUser && (
											<span className="group-info-member-you">You</span>
										)}
									</p>
								</div>
								<svg
									className="group-info-member-chevron"
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<polyline points="9 18 15 12 9 6" />
								</svg>
							</div>
						);
					})}
				</div>

				<div className="chatlist-modal-actions">
					<button className="chatlist-modal-cancel" onClick={onClose}>
						Close
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
};
