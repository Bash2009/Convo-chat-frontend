import { io } from "socket.io-client";

const BASE_URL = import.meta.env.VITE_BACKEND_URL;

// ── In-memory token storage (never persisted to localStorage) ─────────────────
let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function setTokens(access: string) {
	accessToken = access;
}

export function clearTokens() {
	accessToken = null;
	refreshPromise = null;
}

export function getAccessToken(): string | null {
	return accessToken;
}

// ── Refresh mutex: only one refresh at a time ─────────────────────────────────
async function doRefresh(): Promise<boolean> {
	try {
		const res = await fetch(`${BASE_URL}/auth/refresh`, {
			method: "POST",
			credentials: "include",
		});
		if (res.ok) {
			const data = await res.json();
			setTokens(data.access_token);
			updateSocketAuth();
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

async function refreshWithMutex(): Promise<boolean> {
	if (refreshPromise) return refreshPromise;
	refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
	return refreshPromise;
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function request(method: string, path: string, body?: unknown, opts?: { headers?: Record<string, string> }): Promise<Response> {
	const headers: Record<string, string> = {
		...(opts?.headers ?? {}),
	};
	if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
	if (body && !(body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
	}

	const res = await fetch(`${BASE_URL}${path}`, {
		method,
		headers,
		credentials: "include",
		body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
	});

	// Token expired — try to refresh once
	if (res.status === 401) {
		const refreshed = await refreshWithMutex();
		if (refreshed) {
			headers["Authorization"] = `Bearer ${accessToken}`;
			const retryRes = await fetch(`${BASE_URL}${path}`, {
				method, headers, credentials: "include",
				body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
			});
			// If the retry also failed with a non-2xx, throw
			if (!retryRes.ok) {
				const errBody = await retryRes.json().catch(() => ({}));
				const err = new Error(errBody.message || `Request failed: ${retryRes.status}`);
				(err as any).status = retryRes.status;
				(err as any).body = errBody;
				throw err;
			}
			return retryRes;
		}
		await logout();
		throw new Error("Session expired. Please log in again.");
	}

	// Non-2xx (and not 401) — reject so calling code can catch
	if (!res.ok) {
		const errBody = await res.json().catch(() => ({}));
		const err = new Error(errBody.message || `Request failed: ${res.status}`);
		(err as any).status = res.status;
		(err as any).body = errBody;
		throw err;
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
	return { token: accessToken };
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
	try {
		await fetch(`${BASE_URL}/auth/logout`, {
			method: "POST",
			credentials: "include",
		});
	} catch {
		// Best-effort — clear locally regardless of server response
	} finally {
		clearTokens();
		socket.disconnect();
		await signOut(auth);
	}
};
