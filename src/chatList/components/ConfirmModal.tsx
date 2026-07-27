import { createPortal } from "react-dom";

interface ConfirmModalProps {
	title: string;
	description: string;
	confirmLabel: string;
	confirmDanger?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

export const ConfirmModal = ({
	title,
	description,
	confirmLabel,
	confirmDanger,
	onConfirm,
	onCancel,
}: ConfirmModalProps) =>
	createPortal(
		<div className="chatlist-modal-overlay" onClick={(e) => { e.stopPropagation(); onCancel(); }}>
			<div className="chatlist-modal" onClick={(e) => e.stopPropagation()}>
				<p className="chatlist-modal-title">{title}</p>
				<p className="chatlist-modal-desc">{description}</p>
				<div className="chatlist-modal-actions">
					<button className="chatlist-modal-cancel" onClick={onCancel}>
						Cancel
					</button>
					<button
						className={`chatlist-modal-start${confirmDanger ? " chatlist-modal-danger" : ""}`}
						onClick={onConfirm}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
