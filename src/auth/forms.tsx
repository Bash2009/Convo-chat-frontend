import { useState } from "react";
import Login from "./login";
import SignUp from "./signup";
import { ThemeToggle } from "../components/ThemeToggle";

const Forms = () => {
	const [isLogin, setLogin] = useState(true);

	const changeIsLogin = () => {
		setLogin(!isLogin);
	};
	return (
		<div className="auth-page">
			<ThemeToggle />
			<div className="auth-hero">
				<div className="auth-hero-brand">
					<h1 className="auth-hero-title">Convo</h1>
					<p className="auth-hero-tagline">Real-time conversations,<br />designed with care.</p>
				</div>
				<div className="auth-hero-decoration">
					<div className="auth-hero-circle auth-hero-circle--1" />
					<div className="auth-hero-circle auth-hero-circle--2" />
					<div className="auth-hero-circle auth-hero-circle--3" />
				</div>
			</div>
			<div className="auth-form-panel">
				{isLogin && <Login handleChange={changeIsLogin} />}
				{!isLogin && <SignUp handleChange={changeIsLogin} />}
			</div>
		</div>
	);
};

export default Forms;
