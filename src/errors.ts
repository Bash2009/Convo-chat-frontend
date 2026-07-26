import { createContext, useContext } from "react";

/* ── Error Modal Context ─────────────────────────────────────────────────── */

interface ErrorModalContextValue {
	showError: (message: string) => void;
	hideError: () => void;
}

export const ErrorModalContext = createContext<ErrorModalContextValue | null>(null);

export const useErrorModal = (): ErrorModalContextValue => {
	const ctx = useContext(ErrorModalContext);
	if (!ctx)
		throw new Error("useErrorModal must be used within ErrorModalProvider");
	return ctx;
};

/* ── Firebase error map ──────────────────────────────────────────────────── */

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

		if (err.code && FIREBASE_ERROR_MAP[err.code]) {
			return FIREBASE_ERROR_MAP[err.code];
		}

		if (err.response?.data?.message) {
			return err.response.data.message;
		}

		const msg = err.message || String(error);

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
