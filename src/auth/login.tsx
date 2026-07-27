import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useState } from "react";
import { auth } from "../firebase";
import api, { setTokens } from "../backend";
import { useNavigate } from "react-router-dom";
import { useErrorModal, getFriendlyErrorMessage } from "../ErrorModal";

interface LoginProps {
	handleChange: () => void;
}

const Login = ({ handleChange }: LoginProps) => {
	const navigate = useNavigate();
	const { showError, showToast } = useErrorModal();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [errors, setErrors] = useState<{ email?: string; password?: string }>(
		{}
	);
	const [touched, setTouched] = useState<{
		email?: boolean;
		password?: boolean;
	}>({});

	const validate = () => {
		const newErrors: { email?: string; password?: string } = {};
		if (!email) {
			newErrors.email = "Email is required.";
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			newErrors.email = "Enter a valid email.";
		}
		if (!password) {
			newErrors.password = "Password is required.";
		}
		return newErrors;
	};

	const handleBlur = (field: "email" | "password") => {
		setTouched((t) => ({ ...t, [field]: true }));
		setErrors(validate());
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const validationErrors = validate();
		setTouched({ email: true, password: true });
		setErrors(validationErrors);
		if (Object.keys(validationErrors).length > 0) return;

		setSubmitting(true);

		const userCredentials = await signInWithEmailAndPassword(
			auth,
			email,
			password
		).catch((error) => {
			showError(getFriendlyErrorMessage(error));
			setSubmitting(false);
		});

		const user = userCredentials?.user;
		if (user) {
			if (!user.emailVerified) {
				setSubmitting(false);
				navigate(`/verify-email`);
				return;
			}
			try {
				const { data } = await api.post("/auth/login", {
					uid: user.uid,
				});
				setTokens(data.access_token, data.refresh_token);
				showToast("Welcome back!");
				await checkProfile(user.uid);
			} catch {
				await signOut(auth);
				setSubmitting(false);
			}
		}
	};

	const checkProfile = async (uid: string) => {
		try {
			await api.get(`/profile/id/${uid}`);
			navigate("/chats");
		} catch {
			navigate("/profile-setup");
		}
	};

	return (
		<div className="auth-card">
			<p className="auth-title text-center">Welcome back</p>
			<form noValidate onSubmit={handleSubmit}>
				<div className="form-floating mb-3">
					<input
						type="email"
						className={`form-control ${
							touched.email
								? errors.email
									? "is-invalid"
									: "is-valid"
								: ""
						}`}
						id="log_email"
						placeholder=""
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						onBlur={() => handleBlur("email")}
						disabled={submitting}
					/>
					<label htmlFor="log_email">Email</label>
					{errors.email && (
						<div className="invalid-feedback">{errors.email}</div>
					)}
				</div>

				<div className="form-floating mb-4">
					<input
						type="password"
						className={`form-control ${
							touched.password
								? errors.password
									? "is-invalid"
									: "is-valid"
								: ""
						}`}
						id="log_pass"
						placeholder=""
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						onBlur={() => handleBlur("password")}
						disabled={submitting}
					/>
					<label htmlFor="log_pass">Password</label>
					{errors.password && (
						<div className="invalid-feedback">
							{errors.password}
						</div>
					)}
				</div>

					<button type="submit" className="btn btn-navy mb-3" disabled={submitting}>
					{submitting ? (
						<span className="btn-loading-text">
							<div className="spinner spinner--small" style={{ borderTopColor: "white", borderColor: "rgba(255,255,255,0.3)" }} />
							Signing in…
						</span>
					) : (
						"Log in"
					)}
				</button>

				<p className="switch-text text-center mb-0">
					Don't have an account?
					<span onClick={handleChange} className="switch-link">
						Create one
					</span>
				</p>
			</form>
		</div>
	);
};

export default Login;
