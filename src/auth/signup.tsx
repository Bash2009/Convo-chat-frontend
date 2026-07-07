import { useState } from "react";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import api from "../backend";
import { useNavigate } from "react-router-dom";
import { useErrorModal, getFriendlyErrorMessage } from "../ErrorModal";

interface SignUpProps {
	handleChange: () => void;
}

const SignUp = ({ handleChange }: SignUpProps) => {
	const navigate = useNavigate();
	const { showError } = useErrorModal();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [errors, setErrors] = useState<{
		email?: string;
		password?: string;
		confirm?: string;
	}>({});
	const [touched, setTouched] = useState<{
		email?: boolean;
		password?: boolean;
		confirm?: boolean;
	}>({});

	const validate = () => {
		const newErrors: {
			email?: string;
			password?: string;
			confirm?: string;
		} = {};
		if (!email) newErrors.email = "Email is required.";
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
			newErrors.email = "Enter a valid email.";
		if (!password) newErrors.password = "Password is required.";
		else if (password.length < 8)
			newErrors.password = "At least 8 characters.";
		else if (!/(?=.*\d)(?=.*[a-z])(?=.*[A-Z])/.test(password))
			newErrors.password =
				"Must include uppercase, lowercase, and a number.";
		if (!confirmPassword)
			newErrors.confirm = "Please confirm your password.";
		else if (confirmPassword !== password)
			newErrors.confirm = "Passwords do not match.";
		return newErrors;
	};

	const handleBlur = (field: "email" | "password" | "confirm") => {
		setTouched((t) => ({ ...t, [field]: true }));
		setErrors(validate());
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const validationErrors = validate();
		setTouched({ email: true, password: true, confirm: true });
		setErrors(validationErrors);
		if (Object.keys(validationErrors).length > 0) return;

		const userCredentials = await createUserWithEmailAndPassword(
			auth,
			email,
			password
		).catch((error) => {
			showError(getFriendlyErrorMessage(error));
		});

		const user = userCredentials?.user;
		if (user) {
			try {
				const { data } = await api.post("/auth/register", {
					email,
					uid: user.uid,
				});
				localStorage.setItem("access_token", data.access_token);
				localStorage.setItem("refresh_token", data.refresh_token);
				navigate("/verify-email");
			} catch (err) {
				showError(getFriendlyErrorMessage(err));
				await signOut(auth);
			}
		}
		// await sendEmailVerification(user!).catch((error) => {
		// 	console.log(`Error ${error.code}: ${error.message}`);
		// });
	};

	return (
		<div className="auth-card">
			<p className="auth-title text-center">Create account</p>
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
						id="sign_email"
						placeholder=""
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						onBlur={() => handleBlur("email")}
					/>
					<label htmlFor="sign_email">Email</label>
					{errors.email && (
						<div className="invalid-feedback">{errors.email}</div>
					)}
				</div>

				<div className="form-floating mb-3">
					<input
						type="password"
						className={`form-control ${
							touched.password
								? errors.password
									? "is-invalid"
									: "is-valid"
								: ""
						}`}
						id="sign_pass"
						placeholder=""
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						onBlur={() => handleBlur("password")}
					/>
					<label htmlFor="sign_pass">Password</label>
					{errors.password && (
						<div className="invalid-feedback">
							{errors.password}
						</div>
					)}
				</div>

				<div className="form-floating mb-4">
					<input
						type="password"
						className={`form-control ${
							touched.confirm
								? errors.confirm
									? "is-invalid"
									: "is-valid"
								: ""
						}`}
						id="con_pass"
						placeholder=""
						value={confirmPassword}
						onChange={(e) => setConfirmPassword(e.target.value)}
						onBlur={() => handleBlur("confirm")}
					/>
					<label htmlFor="con_pass">Confirm password</label>
					{errors.confirm && (
						<div className="invalid-feedback">{errors.confirm}</div>
					)}
				</div>

				<button type="submit" className="btn btn-navy mb-3">
					Create account
				</button>

				<p className="switch-text text-center mb-0">
					Already have an account?
					<span onClick={handleChange} className="switch-link">
						Log in
					</span>
				</p>
			</form>
		</div>
	);
};

export default SignUp;
