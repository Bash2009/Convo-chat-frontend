import { io } from "socket.io-client";

const BASE_URL = import.meta.env.VITE_BACKEND_URL;

// ── Fetch wrapper (replaces axios) ────────────────────────────────────────────

async function request(method: string, path: string, body?: unknown, opts?: { headers?: Record<string, string> }): Promise<Response> {
	const token = localStorage.getItem("access_token");
	const headers: Record<string, string> = {
		...(opts?.headers ?? {}),
	};
	if (token) headers["Authorization"] = `Bearer ${token}`;
	if (body && !(body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
	}

	const res = await fetch(`${BASE_URL}${path}`, {
		method,
		headers,
		body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
	});

	if (res.status === 401) {
		const refreshToken = localStorage.getItem("refresh_token");
		if (refreshToken) {
			const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
				method: "POST",
				headers: { Authorization: `Bearer ${refreshToken}` },
			});
			if (refreshRes.ok) {
				const data = await refreshRes.json();
				localStorage.setItem("access_token", data.access_token);
				localStorage.setItem("refresh_token", data.refresh_token);
				updateSocketAuth();
				headers["Authorization"] = `Bearer ${data.access_token}`;
				const retryRes = await fetch(`${BASE_URL}${path}`, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
				return retryRes;
			} else {
				await logout();
			}
		} else {
			await logout();
		}
	}

	return res;
}

const api = {
	get: (path: string) => request("GET", path).then(r => r.json()),
	post: (path: string, body?: unknown, opts?: { headers?: Record<string, string> }) =>
		request("POST", path, body, opts).then(r => r.json()),
	patch: (path: string, body?: unknown) =>
		request("PATCH", path, body).then(r => r.json()),
};

export default api;

// ── Socket singleton ──────────────────────────────────────────────────────────

function getSocketAuth() {
	return { token: localStorage.getItem("access_token") };
}

function updateSocketAuth() {
	if (socket.connected) {
		socket.auth = getSocketAuth;
		socket.disconnect().connect();
	}
}

export const socket = io(BASE_URL, {
	withCredentials: true,
	autoConnect: false,
	auth: getSocketAuth,
	reconnection: true,
	reconnectionAttempts: 10,
	reconnectionDelay: 1000,
	reconnectionDelayMax: 5000,
});

// ── Shared logout ─────────────────────────────────────────────────────────────

import { signOut } from "firebase/auth";
import { auth } from "./firebase";

export const logout = async () => {
	const refreshToken = localStorage.getItem("refresh_token");
	try {
		if (refreshToken) {
			await fetch(`${BASE_URL}/auth/logout`, {
				method: "POST",
				headers: { Authorization: `Bearer ${refreshToken}` },
			});
		}
	} catch {
		// Best-effort — clear locally regardless of server response
	} finally {
		localStorage.removeItem("access_token");
		localStorage.removeItem("refresh_token");
		socket.disconnect();
		await signOut(auth);
	}
};
