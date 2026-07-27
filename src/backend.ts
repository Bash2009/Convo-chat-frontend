import axios from "axios";
import { io } from "socket.io-client";
import { auth } from "./firebase";
import { signOut } from "firebase/auth";

// ── In-memory token store ─────────────────────────────────────────────────────
// Tokens are held in memory to reduce XSS exposure. On page load, they're
// hydrated from localStorage so the session survives a refresh. On write, both
// memory and localStorage are updated so the next page load picks them up.
//
// Long-term: migrate the refresh token to an httpOnly, Secure, SameSite cookie
// issued by the server. That removes it from JS reach entirely. Until then, this
// in-memory pattern is the best client-side mitigation.

let _accessToken: string | null = localStorage.getItem("access_token");
let _refreshToken: string | null = localStorage.getItem("refresh_token");

const getAccessToken = () => _accessToken;
const getRefreshToken = () => _refreshToken;

const setTokens = (access: string, refresh: string) => {
	_accessToken = access;
	_refreshToken = refresh;
	localStorage.setItem("access_token", access);
	localStorage.setItem("refresh_token", refresh);
};

const clearTokens = () => {
	_accessToken = null;
	_refreshToken = null;
	localStorage.removeItem("access_token");
	localStorage.removeItem("refresh_token");
};

// ── Refresh mutex ─────────────────────────────────────────────────────────────
// Prevents concurrent /auth/refresh calls from racing each other. Without this,
// several 401s fired at the same time (common on page mount) each independently
// call /auth/refresh. The *second* concurrent call finds its refresh-token jti
// already blacklisted by the first and throws — logging the user out spuriously.

let refreshPromise: Promise<boolean> | null = null;

const doRefresh = async (): Promise<boolean> => {
	// Single-flight: if a refresh is already in-flight, join it
	if (refreshPromise) return refreshPromise;

	refreshPromise = (async () => {
		const token = _refreshToken;
		if (!token) return false;

		try {
			const { data } = await axios.post(
				`${import.meta.env.VITE_BACKEND_URL}/auth/refresh`,
				{ uid: auth.currentUser?.uid },
				{ headers: { Authorization: `Bearer ${token}` } },
			);
			setTokens(data.access_token, data.refresh_token);
			return true;
		} catch {
			clearTokens();
			return false;
		} finally {
			refreshPromise = null;
		}
	})();

	return refreshPromise;
};

// ── Axios instance ────────────────────────────────────────────────────────────

const api = axios.create({
	baseURL: import.meta.env.VITE_BACKEND_URL,
	withCredentials: true,
});

// Attach the access token from memory to every outgoing request
api.interceptors.request.use((config) => {
	const token = _accessToken;
	if (token) config.headers.Authorization = `Bearer ${token}`;
	return config;
});

// On 401, attempt a silent token refresh (single-flighted); if that fails, sign out
api.interceptors.response.use(
	(res) => res,
	async (error) => {
		const original = error.config;
		if (error.response?.status === 401 && !original._retry) {
			original._retry = true;
			const ok = await doRefresh();
			if (ok) {
				original.headers.Authorization = `Bearer ${_accessToken}`;
				return api(original);
			}
			await logout();
		}
		return Promise.reject(error);
	},
);

export default api;

// ── Socket singleton ──────────────────────────────────────────────────────────
// Token is read lazily at connect-time so it's always fresh after a login/refresh.

export const socket = io(import.meta.env.VITE_BACKEND_URL, {
	withCredentials: true,
	autoConnect: false,
	auth: (cb) => cb({ token: _accessToken }),
});

// ── Shared logout ─────────────────────────────────────────────────────────────
// Invalidates tokens on the backend, clears localStorage, disconnects the socket,
// and signs out of Firebase. Call this from any "Sign out" button.

export const logout = async () => {
	const accessToken = _accessToken;
	try {
		if (accessToken) {
			await axios.post(
				`${import.meta.env.VITE_BACKEND_URL}/auth/logout`,
				{ uid: auth.currentUser?.uid },
				{ headers: { Authorization: `Bearer ${accessToken}` } },
			);
		}
	} catch {
		// Best-effort — clear locally regardless of server response
	} finally {
		clearTokens();
		socket.disconnect();
		await signOut(auth);
	}
};

// ── Public token helpers (for login.tsx / signup.tsx) ─────────────────────────
// These avoid direct localStorage access in those components.

export { setTokens, clearTokens, getAccessToken, getRefreshToken };
