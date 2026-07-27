import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { auth } from "../firebase";
import api, { setTokens } from "../backend";
import { useNavigate } from "react-router-dom";
import { useErrorModal, getFriendlyErrorMessage } from "../errors";

interface LoginProps {
	handleChange: () => void;
}

const Login = ({ handleChange }: LoginProps) => {
	const navigate = useNavigate();
	const { showError } = useErrorModal();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
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

		const userCredentials = await signInWithEmailAndPassword(
			auth,
			email,
			password
		).catch((error) => {
			showError(getFriendlyErrorMessage(error));
		});

		const user = userCredentials?.user;
		if (user) {
			if (!user.emailVerified) {
				navigate(`/verify-email`);
				return;
			}
			try {
				const data = await api.post("/auth/login", {
					uid: user.uid,
					firebaseToken: await user.getIdToken(),
				});
				setTokens(data.access_token);
				checkProfile(user.uid);
			} catch {
				showError("Login failed. Please try again.");
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
					/>
					<label htmlFor="log_pass">Password</label>
					{errors.password && (
						<div className="invalid-feedback">
							{errors.password}
						</div>
					)}
				</div>

				<button type="submit" className="btn btn-navy mb-3">
					Log in
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
