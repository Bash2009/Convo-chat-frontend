import { useEffect, useState } from "react";

interface Props {
	chatName: string;
	onUndo: () => void;
	onExpire: () => void;
	duration?: number; // ms, default 5000
}

export const UndoToast = ({ chatName, onUndo, onExpire, duration = 5000 }: Props) => {
	const [remaining, setRemaining] = useState(duration);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		if (dismissed) return;

		const expireTimer = setTimeout(() => {
			onExpire();
		}, duration);

		// Tick every 100ms for the progress bar
		const tickInterval = setInterval(() => {
			setRemaining((prev) => Math.max(0, prev - 100));
		}, 100);

		return () => {
			clearTimeout(expireTimer);
			clearInterval(tickInterval);
		};
	}, [dismissed, duration, onExpire]);

	const handleUndo = () => {
		setDismissed(true);
		onUndo();
	};

	const progress = (remaining / duration) * 100;

	return (
		<div className={`undo-toast ${dismissed ? "undo-toast--dismissed" : ""}`}>
			<div className="undo-toast-body">
				<span className="undo-toast-text">
					Conversation with <strong>{chatName}</strong> deleted
				</span>
				<button className="undo-toast-btn" onClick={handleUndo}>
					Undo
				</button>
			</div>
			<div className="undo-toast-progress" style={{ width: `${progress}%` }} />
		</div>
	);
};
