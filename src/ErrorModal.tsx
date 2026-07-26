import { useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./ErrorModal.css";
import { ErrorModalContext } from "./errors";

export const ErrorModalProvider = ({ children }: { children: ReactNode }) => {
	const [message, setMessage] = useState<string | null>(null);

	const showError = useCallback((msg: string) => setMessage(msg), []);
	const hideError = useCallback(() => setMessage(null), []);

	return (
		<ErrorModalContext.Provider value={{ showError, hideError }}>
			{children}
			{message && <ErrorModal message={message} onClose={hideError} />}
		</ErrorModalContext.Provider>
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


