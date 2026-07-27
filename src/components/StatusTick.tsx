export type MessageStatus = "sent" | "delivered" | "read";

export const StatusTick = ({
	status,
	size = "default",
}: {
	status: MessageStatus;
	size?: "small" | "default";
}) => {
	const color   = status === "read" ? "#191970" : "currentColor";
	const opacity = status === "sent" ? 0.5 : 1;
	const w = size === "small" ? 10 : 12;
	const h = size === "small" ? 10 : 12;

	if (status === "sent") {
		return (
			<svg
				className="chatroom-tick"
				width={w} height={h}
				viewBox="0 0 24 24"
				fill="none"
				stroke={color}
				strokeOpacity={opacity}
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<polyline points="20 6 9 17 4 12" />
			</svg>
		);
	}

	const dw = size === "small" ? 14 : 18;

	return (
		<svg
			className="chatroom-tick"
			width={dw} height={h}
			viewBox="0 0 36 24"
			fill="none"
			stroke={color}
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="36 6 17 17 12 12" />
			<polyline points="24 6 9 17 4 12" />
		</svg>
	);
};
