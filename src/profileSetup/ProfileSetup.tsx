import { useState } from "react";
import { type ProfileData, type ProfileErrors } from "./types";
import StepWelcome from "./StepWelcome";
import StepIdentity from "./StepIdentity";
import StepAbout from "./StepAbout";
import StepReview from "./StepReview";

import "./ProfileSetup.css";
import api from "../backend";
import { useNavigate } from "react-router-dom";
import { useErrorModal, getFriendlyErrorMessage } from "../ErrorModal";

const STEP_LABELS = [
	"Getting started",
	"Your identity",
	"About you",
	"All set!",
];
const TOTAL_STEPS = STEP_LABELS.length - 1;

const EMPTY_DATA: ProfileData = {
	firstName: "",
	lastName: "",
	username: "",
	bio: "",
	location: "",

	avatarFile: null,
	avatarPreview: "",
};

const validateIdentity = (data: ProfileData): ProfileErrors => {
	const e: ProfileErrors = {};
	if (!data.firstName.trim()) e.firstName = "First name is required.";
	if (!data.lastName.trim()) e.lastName = "Last name is required.";
	if (!data.username.trim()) e.username = "Username is required.";
	else if (!/^[a-zA-Z0-9_.]{3,20}$/.test(data.username))
		e.username = "3–20 chars. Letters, numbers, _ and . only.";
	return e;
};

const validateAbout = (_data: ProfileData): ProfileErrors => ({});

const ProfileSetup = () => {
	const navigate = useNavigate();
	const { showError } = useErrorModal();
	const [step, setStep] = useState(0);
	const [slideDir, setSlideDir] = useState<"forward" | "back">("forward");
	const [isAnimating, setAnim] = useState(false);
	const [isSubmitting, setSubmit] = useState(false);
	const [data, setData] = useState<ProfileData>(EMPTY_DATA);
	const [errors, setErrors] = useState<ProfileErrors>({});
	const [touched, setTouched] = useState<Record<string, boolean>>({});

	const handleChange = (field: keyof ProfileData, value: string) => {
		setData((prev) => ({ ...prev, [field]: value }));
	};

	const handleFileChange = (file: File) => {
		setData((prev) => {
			// Revoke previous blob URL to avoid memory leaks
			if (prev.avatarPreview && prev.avatarPreview.startsWith("blob:")) {
				URL.revokeObjectURL(prev.avatarPreview);
			}
			return {
				...prev,
				avatarFile: file,
				avatarPreview: URL.createObjectURL(file),
			};
		});
	};

	const handleBlur = (field: "firstName" | "lastName" | "username") => {
		setTouched((prev) => ({ ...prev, [field]: true }));
		setErrors(validateIdentity(data));
	};

	const animateTo = (dir: "forward" | "back") => {
		if (isAnimating) return;
		setSlideDir(dir);
		setAnim(true);
		setTimeout(() => {
			setStep((s) => (dir === "forward" ? s + 1 : s - 1));
			setAnim(false);
		}, 220);
	};

	const goNext = async () => {
		if (step === 1) {
			const errs = validateIdentity(data);
			setTouched({ firstName: true, lastName: true, username: true });
			setErrors(errs);
			if (Object.keys(errs).length > 0) return;

			const checkUsername = await api.get(
				`/profile/name/${data.username}`
			);

			if (checkUsername.data.userExists) {
				showError("A user with this username already exists. Please choose a different one.");
				return;
			}
		}
		if (step === 2) {
			const errs = validateAbout(data);
			setErrors(errs);
			if (Object.keys(errs).length > 0) return;
		}
		animateTo("forward");
	};

	const handleSubmit = async () => {
		setSubmit(true);
		try {
			const formData = new FormData();
			formData.append("firstName", data.firstName.trim());
			formData.append("lastName", data.lastName.trim());
			formData.append("userName", data.username);
			formData.append("bio", data.bio);
			formData.append("location", data.location);


			if (data.avatarFile) formData.append("avatar", data.avatarFile);
			else if (data.avatarPreview)
				formData.append("avatarUrl", data.avatarPreview);

			await api.post("/profile/create", formData, {});

			navigate("/chats");
		} catch (err: unknown) {
			showError(`Could not save your profile. ${getFriendlyErrorMessage(err)}`);
		} finally {
			setSubmit(false);
		}
	};

	const steps = [
		<StepWelcome />,
		<StepIdentity
			data={data}
			errors={errors}
			touched={touched}
			onChange={handleChange}
			onBlur={handleBlur}
		/>,
		<StepAbout
			data={data}
			errors={errors}
			onChange={handleChange}
			onFileChange={handleFileChange}
		/>,
		<StepReview data={data} />,
	];

	return (
		<div className="setup-card">
			<div className="setup-progress-track">
				<div
					className="setup-progress-fill"
					style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
				/>
			</div>

			<div className="setup-step-label">
				{STEP_LABELS[step]}
				<span className="setup-step-count">
					{step + 1} / {TOTAL_STEPS + 1}
				</span>
			</div>

			<div
				className={`setup-slide ${
					isAnimating
						? `slide-out-${slideDir}`
						: `slide-in-${slideDir}`
				}`}
			>
				{steps[step]}
			</div>

			<div className="setup-nav">
				{step > 0 && (
					<button
						className="setup-arrow-btn"
						onClick={() => animateTo("back")}
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<polyline points="15 18 9 12 15 6" />
						</svg>
						Back
					</button>
				)}
				<div style={{ flex: 1 }} />
				{step < TOTAL_STEPS ? (
					<button
						className="setup-arrow-btn primary"
						onClick={goNext}
					>
						{step === 0 ? "Let's go" : "Continue"}
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<polyline points="9 18 15 12 9 6" />
						</svg>
					</button>
				) : (
					<button
						className="btn-navy setup-submit"
						onClick={handleSubmit}
						disabled={isSubmitting}
					>
						{isSubmitting ? "Saving…" : "Finish setup"}
					</button>
				)}
			</div>
		</div>
	);
};

export default ProfileSetup;
