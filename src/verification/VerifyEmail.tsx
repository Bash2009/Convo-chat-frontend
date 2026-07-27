import { useEffect, useState, useRef } from "react";
import { auth } from "../firebase";
import {
	sendEmailVerification,
	signOut,
	onAuthStateChanged,
} from "firebase/auth";
import { useNavigate } from "react-router";

const VerifyEmail = () => {
	const navigate = useNavigate();
	const [resent, setResent] = useState(false);
	const [loading, setLoading] = useState(false);
	const sentRef = useRef(false);

	// Listen for if the email has been verified
	useEffect(() => {
		const unsub = onAuthStateChanged(auth, (user) => {
			if (user && user.emailVerified) {
				navigate("/profile-setup"); // Navigate to profile setup when email is verified
			}
		});

		// Only send verification email once per mount (not on re-renders)
		if (!sentRef.current && auth.currentUser) {
			sentRef.current = true;
			sendEmailVerification(auth.currentUser).catch((error: unknown) => {
				const msg = error instanceof Error ? error.message : String(error);
				console.error("Send verification email failed:", msg);
			});
		}

		return unsub;
	}, [navigate]);

	const handleResend = async () => {
		if (!auth.currentUser) return;
		setResent(false);
		setLoading(true);
		try {
			await sendEmailVerification(auth.currentUser);
			setResent(true);
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : String(error);
			console.error("Resend verification email failed:", msg);
		} finally {
			setLoading(false);
		}
	};

	const handleSignOut = async () => {
		await signOut(auth);
		navigate("/");
	};

	return (
		<div className="verify-card">
			<div className="verify-icon-wrap">
				<svg
					className="verify-icon"
					viewBox="0 0 48 48"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<rect width="48" height="48" rx="12" fill="#eceff1" />
					<path
						d="M10 16C10 14.9 10.9 14 12 14H36C37.1 14 38 14.9 38 16V32C38 33.1 37.1 34 36 34H12C10.9 34 10 33.1 10 32V16Z"
						stroke="currentColor"
						strokeWidth="2"
						fill="none"
					/>
					<path
						d="M10 16L24 26L38 16"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
				</svg>
			</div>

			<h2 className="verify-title">Check your inbox</h2>
			<p className="verify-sub">
				We sent a verification link to{" "}
				<span className="verify-email">{auth.currentUser?.email}</span>.
				Click the link to activate your account.
			</p>

			<div className="verify-divider" />

			{resent ? (
				<p className="verify-resent">
					✓ Email resent — check your spam folder if you don't see it.
					<button
						className="verify-resend-btn"
						onClick={handleResend}
						disabled={loading}
					>
						{loading ? "Sending…" : "Resend email"}
					</button>
				</p>
			) : (
				<p className="verify-hint">
					Didn't get it?{" "}
					<button
						className="verify-resend-btn"
						onClick={handleResend}
						disabled={loading}
					>
						{loading ? "Sending…" : "Resend email"}
					</button>
				</p>
			)}

			<button className="btn-navy-outline" onClick={handleSignOut}>
				Back to sign in
			</button>
		</div>
	);
};

export default VerifyEmail;
