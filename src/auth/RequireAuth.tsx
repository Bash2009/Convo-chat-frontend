import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { getAccessToken } from "../backend";

/**
 * Wraps protected routes. Redirects to "/" if there is no Firebase session
 * or no in-memory access token (i.e. the user hasn't completed login).
 */
const RequireAuth = ({ children }: { children: React.ReactNode }) => {
	const navigate = useNavigate();
	const [checking, setChecking] = useState(true);

	useEffect(() => {
		const unsub = onAuthStateChanged(auth, (user) => {
			const hasToken = !!getAccessToken();
			if (!user || !hasToken) {
				navigate("/", { replace: true });
			}
			setChecking(false);
		});
		return unsub;
	}, [navigate]);

	if (checking) return null;
	return <>{children}</>;
};

export default RequireAuth;
