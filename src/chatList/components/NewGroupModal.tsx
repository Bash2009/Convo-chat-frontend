import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { NewGroupModalProps, Participant } from "../constants";
import { auth } from "../../firebase";

function useDebounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	return useCallback((...args: unknown[]) => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => fn(...args), delay);
	}, [fn, delay]) as unknown as T;
}

export const NewGroupModal = ({
	onClose,
	onStart,
	onSearch,
	searchStatus,
	foundUser,
}: NewGroupModalProps) => {
	const [groupName, setGroupName] = useState("");
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<Participant[]>([]);
	const debouncedSearch = useDebounce(onSearch, 300);

	const handleQueryChange = (value: string) => {
		setQuery(value);
		if (value.trim().length >= 1) debouncedSearch(value.trim());
	};

	const addParticipant = (p: Participant) => {
		if (!selected.find((s) => s.uid === p.uid)) {
			setSelected((prev) => [...prev, p]);
		}
		setQuery("");
	};

	const removeParticipant = (uid: string) =>
		setSelected((prev) => prev.filter((p) => p.uid !== uid));

	const canSubmit = groupName.trim() && selected.length >= 1;

	return createPortal(
		<div className="chatlist-modal-overlay" onClick={onClose}>
			<div className="chatlist-modal" onClick={(e) => e.stopPropagation()}>
				<p className="chatlist-modal-title">New group chat</p>

				<input
					type="text"
					className="chatlist-modal-input"
					placeholder="Group name…"
					value={groupName}
					autoFocus
					onChange={(e) => setGroupName(e.target.value)}
				/>

				<input
					type="text"
					className="chatlist-modal-input"
					placeholder="Add people by username…"
					value={query}
					onChange={(e) => handleQueryChange(e.target.value)}
				/>

				{searchStatus === "loading" && (
					<p className="ncm-status loading">Searching…</p>
				)}

				{(searchStatus === "not_found" ||
					(foundUser && foundUser.uid === auth.currentUser?.uid)) && (
					<p className="ncm-status not-found">
						No user found with that username.
					</p>
				)}

				{searchStatus === "found" &&
					foundUser &&
					foundUser.uid !== auth.currentUser?.uid &&
					!selected.find((s) => s.uid === foundUser.uid) && (
						<div
							className="ncm-user-preview ncm-user-preview--addable"
							onClick={() => addParticipant(foundUser)}
						>
							{foundUser.avatarUrl ? (
								<img
									src={foundUser.avatarUrl}
									alt={foundUser.firstName}
									width={36}
									height={36}
									loading="lazy"
									className="ncm-avatar"
								/>
							) : (
								<div className="ncm-avatar-placeholder">
									{foundUser.firstName[0]}
									{foundUser.lastName[0]}
								</div>
							)}
							<div>
								<p className="ncm-user-name">
									{foundUser.firstName} {foundUser.lastName}
								</p>
								<p className="ncm-user-username">@{foundUser.username}</p>
							</div>
							<svg
								className="ncm-add-icon"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
								strokeLinecap="round"
							>
								<line x1="12" y1="5" x2="12" y2="19" />
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
						</div>
					)}

				{selected.length > 0 && (
					<div className="group-modal-chips">
						{selected.map((p) => (
							<div key={p.uid} className="group-modal-chip">
								<span>
									{p.firstName} {p.lastName}
								</span>
								<button
									className="group-modal-chip-remove"
									onClick={() => removeParticipant(p.uid)}
								>
									<svg
										width="10"
										height="10"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2.5"
										strokeLinecap="round"
									>
										<line x1="18" y1="6" x2="6" y2="18" />
										<line x1="6" y1="6" x2="18" y2="18" />
									</svg>
								</button>
							</div>
						))}
					</div>
				)}

				<div className="chatlist-modal-actions">
					<button className="chatlist-modal-cancel" onClick={onClose}>
						Cancel
					</button>
					<button
						className="chatlist-modal-start"
						disabled={!canSubmit}
						onClick={() => onStart(groupName.trim(), selected)}
					>
						Create group
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
};
