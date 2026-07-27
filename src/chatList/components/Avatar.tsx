interface AvatarProps {
	name: string;
	avatarUrl?: string;
	online: boolean;
	size?: number;
	onClick?: (e: React.MouseEvent) => void;
}

export const Avatar = ({
	name,
	avatarUrl,
	online,
	size = 44,
	onClick,
}: AvatarProps) => {
	const initials = name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
	return (
		<div
			style={{
				position: "relative",
				flexShrink: 0,
				cursor: onClick ? "pointer" : "default",
			}}
			onClick={onClick}
			title={onClick ? `View ${name}'s profile` : undefined}
		>
			{avatarUrl ? (
				<img
					src={avatarUrl}
					alt={name}
					style={{
						width: size,
						height: size,
						borderRadius: "50%",
						objectFit: "cover",
						display: "block",
					}}
				/>
			) : (
				<div
					style={{
						width: size,
						height: size,
						borderRadius: "50%",
						background: `hsl(${hue}, 40%, 80%)`,
						color: `hsl(${hue}, 50%, 28%)`,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontWeight: 600,
						fontSize: size * 0.36,
						fontFamily: "'Inter', sans-serif",
					}}
				>
					{initials}
				</div>
			)}
			{online && (
				<div
					style={{
						position: "absolute",
						bottom: 1,
						right: 1,
						width: 10,
						height: 10,
						borderRadius: "50%",
						background: "var(--online, #3A8F5E)",
						border: "2px solid var(--card-bg, #fff)",
						boxShadow: "0 0 0 1px rgba(58, 143, 94, 0.15)",
					}}
				/>
			)}
		</div>
	);
};
