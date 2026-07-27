import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { socket } from "../backend";
import { Avatar } from "../chatList/components/Avatar";
import { useErrorModal, getFriendlyErrorMessage } from "../ErrorModal";
import "./ProfileView.css";

interface ProfileData {
	firstName: string;
	lastName: string;
	username: string;
	bio: string;
	location: string;
	avatarUrl: string;
}

const ProfileView = () => {
	const { username } = useParams<{ username: string }>();
	const navigate = useNavigate();
	const { showError } = useErrorModal();

	const [profile, setProfile] = useState<ProfileData | null>(null);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);
	const [isOnline, setIsOnline] = useState(false);
	const viewedUidRef = useRef<string | null>(null);

	// Fetch profile data
	useEffect(() => {
		let cancelled = false;

		if (!username) {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional immediate guard
			setNotFound(true);
			setLoading(false);
			return;
		}

		setLoading(true);
		setNotFound(false);
		setIsOnline(false);
		viewedUidRef.current = null;

		api
			.get(`/profile/name/${encodeURIComponent(username)}`)
			.then((res) => {
				if (cancelled) return;
				const data = res.data;
				let uid: string | undefined;
				let p: Partial<ProfileData>;

				if (data.userExists === false) {
					setNotFound(true);
					setProfile(null);
					return;
				} else if (data.userExists === true && data.profile) {
					uid = data.profile.user?.uid;
					p = data.profile.user?.profile ?? data.profile;
				} else {
					p = data;
				}

				viewedUidRef.current = uid ?? null;
				setProfile({
					firstName: p.firstName || "",
					lastName: p.lastName || "",
					username: p.username || username,
					bio: p.bio || "",
					location: p.location || "",
					avatarUrl: p.avatarUrl || "",
				});
			})
			.catch((err) => {
				if (cancelled) return;
				const status = err.response?.status;
				if (status === 404) {
					setNotFound(true);
				} else {
					showError(`Could not load profile. ${getFriendlyErrorMessage(err)}`);
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => { cancelled = true; };
	}, [username, showError]);

	// Track online status in real-time via socket events
	useEffect(() => {
		const handleOnline = ({ uid }: { uid: string }) => {
			if (uid === viewedUidRef.current) setIsOnline(true);
		};
		const handleOffline = ({ uid }: { uid: string }) => {
			if (uid === viewedUidRef.current) setIsOnline(false);
		};

		socket.on("userOnline", handleOnline);
		socket.on("userOffline", handleOffline);

		return () => {
			socket.off("userOnline", handleOnline);
			socket.off("userOffline", handleOffline);
		};
	}, []);

	const fullName = profile
		? `${profile.firstName} ${profile.lastName}`.trim()
		: "";

	return (
		<div className="profile-view-root">
			<div className="profile-view-card">
				{/* Header */}
				<div className="profile-view-header">
					<button
						className="profile-view-back"
						onClick={() => navigate("/chats")}
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<polyline points="15 18 9 12 15 6" />
						</svg>
						Back to chats
					</button>
				</div>

				{/* Loading */}
				{loading && (
					<div className="profile-view-body">
						<p className="profile-view-loading">Loading profile…</p>
					</div>
				)}

				{/* Not found */}
				{!loading && notFound && (
					<div className="profile-view-body">
						<div className="profile-view-not-found-icon">
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
								<circle cx="11" cy="11" r="8" />
								<line x1="21" y1="21" x2="16.65" y2="16.65" />
							</svg>
						</div>
						<p className="profile-view-not-found-text">
							User <strong>@{username}</strong> not found.
						</p>
					</div>
				)}

				{/* Profile */}
				{!loading && !notFound && profile && (
					<div className="profile-view-body">
						{/* Avatar section */}
						<div className="profile-view-avatar-section">
							<Avatar
								name={fullName}
								avatarUrl={profile.avatarUrl}
								online={isOnline}
								size={96}
							/>
						</div>

						{/* Name */}
						<h1 className="profile-view-name">
							{fullName || "Unknown User"}
						</h1>

						{/* Username */}
						<p className="profile-view-username">@{profile.username}</p>

						{/* Divider */}
						<div className="profile-view-divider" />

						{/* Bio */}
						{profile.bio && (
							<div className="profile-view-field">
								<label className="profile-view-field-label">Bio</label>
								<p className="profile-view-field-value">{profile.bio}</p>
							</div>
						)}

						{/* Location */}
						{profile.location && (
							<div className="profile-view-field">
								<label className="profile-view-field-label">Location</label>
								<p className="profile-view-field-value">
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
										<circle cx="12" cy="10" r="3" />
									</svg>
									{profile.location}
								</p>
							</div>
						)}

						{/* No bio or location */ }
						{!profile.bio && !profile.location && (
							<p className="profile-view-empty">No additional information.</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default ProfileView;
