import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { NewChatModalProps } from "../constants";
import { auth } from "../../firebase";

function useDebounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	return useCallback((...args: any[]) => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => fn(...args), delay);
	}, [fn, delay]) as unknown as T;
}

export const NewChatModal = ({
	onClose,
	onStart,
	onSearch,
	userStatus,
	foundUser,
}: NewChatModalProps) => {
	const [username, setUsername] = useState("");
	const debouncedSearch = useDebounce(onSearch, 300);

	const handleChange = (value: string) => {
		setUsername(value);
		if (value.trim()) debouncedSearch(value.trim());
	};

	return createPortal(
		<div className="chatlist-modal-overlay" onClick={onClose}>
			<div className="chatlist-modal" onClick={(e) => e.stopPropagation()}>
				<p className="chatlist-modal-title">New conversation</p>

				<input
					type="text"
					className="chatlist-modal-input"
					placeholder="Enter a username…"
					value={username}
					autoFocus
					onChange={(e) => handleChange(e.target.value)}
					onKeyDown={(e) =>
						e.key === "Enter" &&
						userStatus === "found" &&
						foundUser?.uid &&
						onStart(foundUser.uid)
					}
				/>

				{userStatus === "loading" && (
					<p className="modal-user-status loading">Searching…</p>
				)}

				{userStatus === "found" &&
					foundUser &&
					foundUser.uid !== auth.currentUser?.uid && (
						<div className="modal-user-found">
							{foundUser.avatarUrl ? (
								<img
									src={foundUser.avatarUrl}
									alt=""
									width={40}
									height={40}
									loading="lazy"
									className="modal-user-avatar"
								/>
							) : (
								<div className="modal-user-avatar-initials">
									{foundUser.firstName[0]}
									{foundUser.lastName[0]}
								</div>
							)}
							<div>
								<p className="modal-user-name">
									{foundUser.firstName} {foundUser.lastName}
								</p>
								<p className="modal-user-username">@{foundUser.username}</p>
							</div>
							<svg
								className="modal-user-check"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						</div>
					)}

				{(userStatus === "not_found" ||
					(foundUser && foundUser.uid === auth.currentUser?.uid)) && (
					<p className="modal-user-status not-found">
						No user found with that username.
					</p>
				)}

				<div className="chatlist-modal-actions">
					<button className="chatlist-modal-cancel" onClick={onClose}>
						Cancel
					</button>
					<button
						className="chatlist-modal-start"
						disabled={userStatus !== "found" || foundUser?.uid === auth.currentUser?.uid}
						onClick={() => {
							if (!foundUser?.uid) return;
							onStart(foundUser.uid);
						}}
					>
						Start chat
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
};
