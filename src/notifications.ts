import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface NotificationPayload {
	title: string;
	body: string;
	icon?: string;
	tag?: string;
}

export function useNotifications() {
	const [permission, setPermission] = useState<NotificationPermission>(
		() => ("Notification" in window ? Notification.permission : "denied"),
	);
	const isHiddenRef = useRef(document.hidden);
	const grantedRef = useRef(permission === "granted");

	// Keep the ref in sync
	useEffect(() => {
		grantedRef.current = permission === "granted";
	}, [permission]);

	// Track page visibility so we only notify when the tab is in the background
	useEffect(() => {
		const handler = () => {
			isHiddenRef.current = document.hidden;
		};
		document.addEventListener("visibilitychange", handler);
		return () => document.removeEventListener("visibilitychange", handler);
	}, []);

	// Request notification permission (must be called from a user gesture)
	const requestPermission = useCallback(async () => {
		if (!("Notification" in window)) return;
		const result = await Notification.requestPermission();
		setPermission(result);
	}, []);

	// Show a notification if the page is hidden and we have permission
	const showNotification = useCallback(
		(payload: NotificationPayload) => {
			if (!grantedRef.current) return;
			if (!isHiddenRef.current) return; // tab is visible — don't spam

			try {
				const n = new Notification(payload.title, {
					body: payload.body,
					icon: payload.icon || undefined,
					tag: payload.tag || "chat-message",
				});

				// Focus the tab when the notification is clicked
				n.onclick = () => {
					window.focus();
					n.close();
				};

				// Auto-close after 5 seconds
				setTimeout(() => n.close(), 5000);
			} catch {
				// Notification may be blocked by the browser — silently ignore
			}
		},
		[],
	);

	return { permission, requestPermission, showNotification } as const;
}
