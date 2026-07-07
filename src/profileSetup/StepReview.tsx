import { type ProfileData } from "./types";

const StepReview = ({ data }: { data: ProfileData }) => (
  <div className="setup-step-body centered">
    <div className="review-avatar">
      {data.avatarPreview
        ? <img src={data.avatarPreview} alt="avatar" />
        : <svg viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="32" fill="#eceff1" />
            <circle cx="32" cy="26" r="9" stroke="#191970" strokeWidth="2.2" fill="none" />
            <path d="M14 50c0-9.94 8.06-18 18-18s18 8.06 18 18" stroke="#191970" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          </svg>}
    </div>

    <h3 className="setup-title mt-3">
      {data.firstName || data.lastName ? `${data.firstName} ${data.lastName}`.trim() : "—"}
    </h3>
    <p className="review-username">@{data.username || "—"}</p>

    {data.bio && <p className="review-bio">"{data.bio}"</p>}

    <div className="review-meta">
      {data.location && (
        <span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {data.location}
        </span>
      )}

    </div>

    <p className="setup-desc mt-3">Looks good? Hit <strong>Finish setup</strong> to save.</p>
  </div>
);

export default StepReview;
