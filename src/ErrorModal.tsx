import {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect,
	type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./ErrorModal.css";

/* eslint-disable react-refresh/only-export-components */
/* ── Context ─────────────────────────────────────────────────────────────── */

interface ErrorModalContextValue {
	showError: (message: string) => void;
	hideError: () => void;
	showToast: (message: string) => void;
}

const ErrorModalContext = createContext<ErrorModalContextValue | null>(null);

export const useErrorModal = (): ErrorModalContextValue => {
	const ctx = useContext(ErrorModalContext);
	if (!ctx)
		throw new Error("useErrorModal must be used within ErrorModalProvider");
	return ctx;
};

/* ── Provider ────────────────────────────────────────────────────────────── */

export const ErrorModalProvider = ({ children }: { children: ReactNode }) => {
	const [message, setMessage] = useState<string | null>(null);
	const [toast, setToast] = useState<string | null>(null);

	const showError = useCallback((msg: string) => setMessage(msg), []);
	const hideError = useCallback(() => setMessage(null), []);
	const showToast = useCallback((msg: string) => setToast(msg), []);

	return (
		<ErrorModalContext.Provider value={{ showError, hideError, showToast }}>
			{children}
			{message && <ErrorModal message={message} onClose={hideError} />}
			{toast && <ToastNotification message={toast} onClose={() => setToast(null)} />}
		</ErrorModalContext.Provider>
	);
};

/* ── Toast notification ──────────────────────────────────────────────────── */

const ToastNotification = ({ message, onClose }: { message: string; onClose: () => void }) => {
	useEffect(() => {
		const timer = setTimeout(onClose, 4000);
		return () => clearTimeout(timer);
	}, [onClose]);

	return createPortal(
		<div className="toast-notification fade-in-up">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="12" />
				<line x1="12" y1="16" x2="12.01" y2="16" />
			</svg>
			<span>{message}</span>
		</div>,
		document.body,
	);
};

/* ── Modal component ─────────────────────────────────────────────────────── */

const ErrorModal = ({
	message,
	onClose,
}: {
	message: string;
	onClose: () => void;
}) =>
	createPortal(
		<div className="chatlist-modal-overlay" onClick={onClose}>
			<div
				className="error-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="error-modal-icon-wrap">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="#ef4444"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<circle cx="12" cy="12" r="10" />
						<line x1="12" y1="8" x2="12" y2="12" />
						<line x1="12" y1="16" x2="12.01" y2="16" />
					</svg>
				</div>
				<p className="error-modal-title">Something went wrong</p>
				<p className="error-modal-message">{message}</p>
				<div className="chatlist-modal-actions">
					<button className="chatlist-modal-start" onClick={onClose}>
						Got it
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);

/* ── Friendly error message mapping ──────────────────────────────────────── */

const FIREBASE_ERROR_MAP: Record<string, string> = {
	"auth/email-already-in-use":
		"This email is already registered. Try logging in instead.",
	"auth/user-not-found": "No account found with this email address.",
	"auth/wrong-password": "Incorrect password. Please try again.",
	"auth/invalid-credential":
		"Invalid email or password. Please check your credentials.",
	"auth/weak-password":
		"Password is too weak. Use at least 8 characters with uppercase, lowercase, and a number.",
	"auth/too-many-requests":
		"Too many attempts. Please wait a moment and try again.",
	"auth/invalid-email": "Please enter a valid email address.",
	"auth/network-request-failed":
		"Network error. Please check your internet connection.",
	"auth/user-disabled":
		"This account has been disabled. Contact support for help.",
	"auth/operation-not-allowed":
		"This sign-in method is not enabled. Contact support.",
};

export const getFriendlyErrorMessage = (error: unknown): string => {
	if (error instanceof Error) {
		const err = error as Error & {
			code?: string;
			response?: { data?: { message?: string } };
		};

		// Firebase error with code
		if (err.code && FIREBASE_ERROR_MAP[err.code]) {
			return FIREBASE_ERROR_MAP[err.code];
		}

		// API error with response message
		if (err.response?.data?.message) {
			return err.response.data.message;
		}

		const msg = err.message || String(error);

		// Network errors
		if (
			msg.includes("NetworkError") ||
			msg.includes("Failed to fetch") ||
			msg.includes("Network request failed")
		) {
			return "Network error. Please check your internet connection and try again.";
		}

		return msg;
	}
	return String(error);
};
