import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { getAccessToken } from "../backend";
import api from "../backend";
import Forms from "./forms";

const Auth = () => {
	const navigate = useNavigate();
	const [checking, setChecking] = useState(true);

	useEffect(() => {
		const unsub = onAuthStateChanged(auth, async (user) => {
			if (user && getAccessToken()) {
				// 1. Must verify email before anything else
				if (!user.emailVerified) {
					navigate("/verify-email", { replace: true });
					setChecking(false);
					return;
				}

				// 2. Check if profile exists — if not, send to setup
				try {
					await api.get(`/profile/id/${user.uid}`);
					navigate("/chats", { replace: true });
				} catch {
					navigate("/profile-setup", { replace: true });
				}
				setChecking(false);
				return;
			}
			setChecking(false);
		});
		return unsub;
	}, [navigate]);

	if (checking) return null;
	return <Forms />;
};

export default Auth;
