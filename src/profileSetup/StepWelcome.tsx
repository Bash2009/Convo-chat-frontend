// Step shown before the user starts filling anything in.
// Pure presentational — no props needed.

const StepWelcome = () => (
  <div className="setup-step-body centered">

    <svg className="setup-welcome-icon" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="32" fill="#eceff1" />
      <circle cx="32" cy="26" r="9" stroke="currentColor" strokeWidth="2.2" fill="none" />
      <path d="M14 50c0-9.94 8.06-18 18-18s18 8.06 18 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>

    <h2 className="setup-title">Set up your profile</h2>
    <p className="setup-desc">A few quick steps to personalise your account.</p>

    <div className="setup-steps-preview">
      {["Your identity", "About you", "Review"].map((label, i) => (
        <div key={i} className="setup-step-pill">
          <span className="pill-num">{i + 1}</span>
          <span>{label}</span>
        </div>
      ))}
    </div>

  </div>
);

export default StepWelcome;
