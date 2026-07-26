import { memo, useMemo, useState, useCallback } from "react";

interface AvatarProps {
	name: string;
	avatarUrl?: string;
	online: boolean;
	size?: number;
	onClick?: (e: React.MouseEvent) => void;
}

export const Avatar = memo(({
	name,
	avatarUrl,
	online,
	size = 44,
	onClick,
}: AvatarProps) => {
	const [imgError, setImgError] = useState(false);
	const initials = useMemo(() => name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.slice(0, 2)
		.toUpperCase(), [name]);
	const hue = useMemo(() => name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360, [name]);
	const handleError = useCallback(() => setImgError(true), []);

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
			{avatarUrl && !imgError ? (
				<img
					src={avatarUrl}
					alt={name}
					width={size}
					height={size}
					loading="lazy"
					onError={handleError}
					style={{
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
						fontFamily: "'DM Sans', sans-serif",
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
						background: "#22c55e",
						border: "2px solid #fff",
					}}
				/>
			)}
		</div>
	);
});
