import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import "./index.css";
import "./verification/VerifyEmail.css";
import "./chatList/ChatList.css";

import { ErrorModalProvider } from "./ErrorModal";
import Auth from "./auth/auth";
import RequireAuth from "./auth/RequireAuth";
import VerifyEmail from "./verification/VerifyEmail";
import ProfileSetup from "./profileSetup/ProfileSetup";
import ProfileEdit from "./profileEdit/ProfileEdit";
import ChatLayout from "./chatList/ChatLayout";

const App = () => {
	return (
		<ErrorModalProvider>
		<BrowserRouter>
			<Routes>
				{/* Public */}
				<Route path="/" element={<Auth />} />
				<Route path="/verify-email" element={<VerifyEmail />} />

				{/* Protected — require Firebase session + access token */}
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
			</Routes>
		</BrowserRouter>
		</ErrorModalProvider>
	);
};

export default App;
