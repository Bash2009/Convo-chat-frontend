import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import "./App.css";
import "./index.css";

import { ErrorModalProvider } from "./ErrorModal";
import RequireAuth from "./auth/RequireAuth";
import ErrorBoundary from "./ErrorBoundary";

const Auth = lazy(() => import("./auth/auth"));
const VerifyEmail = lazy(() => import("./verification/VerifyEmail"));
const ProfileSetup = lazy(() => import("./profileSetup/ProfileSetup"));
const ProfileEdit = lazy(() => import("./profileEdit/ProfileEdit"));
const ChatLayout = lazy(() => import("./chatList/ChatLayout"));

const PageLoader = () => (
	<div style={{
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		minHeight: "100vh",
		fontFamily: "'DM Sans', sans-serif",
		color: "#191970",
	}}>
		Loading…
	</div>
);

const App = () => {
	return (
		<ErrorBoundary>
		<ErrorModalProvider>
		<BrowserRouter>
			<Suspense fallback={<PageLoader />}>
			<Routes>
				<Route path="/" element={<Auth />} />
				<Route path="/verify-email" element={<VerifyEmail />} />
				<Route
					path="/profile-setup"
					element={
						<RequireAuth>
							<ProfileSetup />
						</RequireAuth>
					}
				/>
				<Route
					path="/chats"
					element={
						<RequireAuth>
							<ChatLayout />
						</RequireAuth>
					}
				/>
				<Route
					path="/settings"
					element={
						<RequireAuth>
							<ProfileEdit />
						</RequireAuth>
					}
				/>
				<Route path="*" element={
					<div style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						minHeight: "100vh",
						fontFamily: "'DM Sans', sans-serif",
						flexDirection: "column",
						gap: "0.5rem",
					}}>
						<h2 style={{ color: "#191970" }}>404 — Page not found</h2>
						<a href="/" style={{ color: "#191970" }}>Go home</a>
					</div>
				} />
			</Routes>
			</Suspense>
		</BrowserRouter>
		</ErrorModalProvider>
		</ErrorBoundary>
	);
};

export default App;
