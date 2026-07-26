import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { getAccessToken } from "../backend";
import Forms from "./forms";

const Auth = () => {
	const navigate = useNavigate();
	const [checking, setChecking] = useState(true);

	useEffect(() => {
		const unsub = onAuthStateChanged(auth, async (user) => {
			if (user && getAccessToken()) {
				navigate("/chats", { replace: true });
			}
			setChecking(false);
		});
		return unsub;
	}, [navigate]);

	if (checking) return null;
	return <Forms />;
};

export default Auth;
