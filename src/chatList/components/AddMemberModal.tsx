import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { socket } from "../../backend";
import type { Participant } from "../constants";

interface AddMemberModalProps {
	chatId: string;
	onClose: () => void;
}

function useDebounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	return useCallback((...args: unknown[]) => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => fn(...args), delay);
	}, [fn, delay]) as unknown as T;
}

export const AddMemberModal = ({ chatId, onClose }: AddMemberModalProps) => {
	const [query, setQuery] = useState("");
	const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");
	const [foundUser, setFoundUser] = useState<Participant | null>(null);
	const [selected, setSelected] = useState<Participant[]>([]);
	const listenerRef = useRef<((data: { userExists: boolean; profile: { user: { uid: string; profile: { firstName: string; lastName: string; username: string; avatarUrl: string } } } }) => void) | null>(null);

	useEffect(() => {
		return () => {
			if (listenerRef.current) {
				socket.off("userSearch", listenerRef.current);
				listenerRef.current = null;
			}
		};
	}, []);

	const doSearch = useCallback((value: string) => {
		if (!value.trim()) return;

		if (listenerRef.current) {
			socket.off("userSearch", listenerRef.current);
		}

		setSearchStatus("loading");

		const handler = (data: { userExists: boolean; profile: { user: { uid: string; profile: { firstName: string; lastName: string; username: string; avatarUrl: string } } } }) => {
			if (data.userExists) {
				setFoundUser({
					uid: data.profile.user.uid,
					firstName: data.profile.user.profile.firstName,
					lastName: data.profile.user.profile.lastName,
					username: data.profile.user.profile.username,
					avatarUrl: data.profile.user.profile.avatarUrl,
				});
				setSearchStatus("found");
			} else {
				setFoundUser(null);
				setSearchStatus("not_found");
			}
		};

		listenerRef.current = handler;
		socket.on("userSearch", handler);
		socket.emit("getUser", { username: value.trim() });
	}, []);

	const debouncedSearch = useDebounce(doSearch, 300);

	const handleSearch = (value: string) => {
		setQuery(value);
		debouncedSearch(value);
	};

	const addParticipant = (p: Participant) => {
		if (!selected.find((s) => s.uid === p.uid)) {
			setSelected((prev) => [...prev, p]);
		}
		setQuery("");
		setSearchStatus("idle");
		setFoundUser(null);
	};

	const removeParticipant = (uid: string) =>
		setSelected((prev) => prev.filter((p) => p.uid !== uid));

	const handleAdd = () => {
		if (selected.length === 0) return;
		socket.emit("addMember", {
			chatId,
			members: selected.map((p) => p.uid),
		});
		onClose();
	};

	return createPortal(
		<div className="chatlist-modal-overlay" onClick={onClose}>
			<div className="chatlist-modal" onClick={(e) => e.stopPropagation()}>
				<p className="chatlist-modal-title">Add members</p>

				<input
					type="text"
					className="chatlist-modal-input"
					placeholder="Search by username…"
					value={query}
					onChange={(e) => handleSearch(e.target.value)}
					autoFocus
				/>

				{searchStatus === "loading" && (
					<p className="ncm-status loading">Searching…</p>
				)}

				{searchStatus === "not_found" && (
					<p className="ncm-status not-found">No user found with that username.</p>
				)}

					{searchStatus === "found" && foundUser && !selected.find((s) => s.uid === foundUser.uid) && (
					<div
						className="ncm-user-preview ncm-user-preview--addable"
						onClick={() => addParticipant(foundUser)}
					>
						{foundUser.avatarUrl ? (
							<img src={foundUser.avatarUrl} alt="" width={36} height={36} loading="lazy" className="ncm-avatar" />
						) : (
							<div className="ncm-avatar-placeholder">
								{foundUser.firstName[0]}{foundUser.lastName[0]}
							</div>
						)}
						<div>
							<p className="ncm-user-name">{foundUser.firstName} {foundUser.lastName}</p>
							<p className="ncm-user-username">@{foundUser.username}</p>
						</div>
						<svg className="ncm-add-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
							<line x1="12" y1="5" x2="12" y2="19" />
							<line x1="5" y1="12" x2="19" y2="12" />
						</svg>
					</div>
				)}

				{selected.length > 0 && (
					<div className="group-modal-chips">
						{selected.map((p) => (
							<div key={p.uid} className="group-modal-chip">
								<span>{p.firstName} {p.lastName}</span>
								<button className="group-modal-chip-remove" onClick={() => removeParticipant(p.uid)}>
									<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
						disabled={selected.length === 0}
						onClick={handleAdd}
					>
						Add {selected.length > 0 ? `(${selected.length})` : ""}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
};
