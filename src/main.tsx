import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "bootstrap/dist/css/bootstrap.css";
import App from "./App";

// ── Initialize theme before React renders (prevents FOUC) ───────────────────
(function initTheme() {
	try {
		const stored = localStorage.getItem("chat-theme");
		const theme =
			stored === "dark" || stored === "light"
				? stored
				: window.matchMedia("(prefers-color-scheme: dark)").matches
					? "dark"
					: "light";
		const html = document.documentElement;
		html.setAttribute("data-theme", theme);
		html.classList.add("no-transitions");
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				html.classList.remove("no-transitions");
			});
		});
	} catch {
		// localStorage unavailable — ignore
	}
})();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>
);
