import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import api from "../backend";
import Forms from "./forms";

const Auth = () => {
	const navigate = useNavigate();
	const [checking, setChecking] = useState(true);

	useEffect(() => {
		const unsub = onAuthStateChanged(auth, async (user) => {
			if (user && localStorage.getItem("access_token")) {
				try {
					await api.get(`/profile/id/${user.uid}`);
					navigate("/chats", { replace: true });
				} catch {
					navigate("/profile-setup", { replace: true });
				}
				return;
			}
			setChecking(false);
		});
		return unsub;
	}, [navigate]);

	if (checking) {
		return (
			<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", width: "100vw" }}>
				<div className="spinner spinner--large" />
			</div>
		);
	}
	return <Forms />;
};

export default Auth;
