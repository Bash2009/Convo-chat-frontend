import { useRef, type ChangeEvent } from "react";
import { type ProfileData, type ProfileErrors } from "./types";

const DEFAULT_AVATARS = [
  "https://api.dicebear.com/8.x/shapes/svg?seed=alpha",
  "https://api.dicebear.com/8.x/shapes/svg?seed=beta",
  "https://api.dicebear.com/8.x/shapes/svg?seed=gamma",
  "https://api.dicebear.com/8.x/shapes/svg?seed=delta",
  "https://api.dicebear.com/8.x/shapes/svg?seed=epsilon",
  "https://api.dicebear.com/8.x/shapes/svg?seed=zeta",
];

interface Props {
  data: ProfileData;
  errors: ProfileErrors;
  onChange: (field: keyof ProfileData, value: string) => void;
  onFileChange: (file: File) => void;
}

const StepAbout = ({ data, onChange, onFileChange }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileChange(file);
  };

  return (
    <div className="setup-step-body">

      <h2 className="setup-title">About you</h2>
      <p className="setup-desc">All optional — fill in what you'd like.</p>

      {/* Avatar picker */}
      <div className="avatar-row mb-3">

        {/* Clickable circle — opens file picker */}
        <div className="avatar-preview" onClick={() => fileRef.current?.click()} title="Upload photo">
          {data.avatarPreview
            ? <img src={data.avatarPreview} alt="avatar" />
            : <svg viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="16" r="7" stroke="#191970" strokeWidth="1.8" />
                <path d="M6 36c0-7.73 6.27-14 14-14s14 6.27 14 14" stroke="#191970" strokeWidth="1.8" strokeLinecap="round" />
              </svg>}
          <div className="avatar-overlay">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
        </div>

        {/* Default avatar options */}
        <div>
          <p className="avatar-label">Profile photo</p>
          <p className="avatar-hint">Upload yours or pick a default</p>
          <div className="avatar-defaults">
            {DEFAULT_AVATARS.map((url) => (
              <img
                key={url}
                src={url}
                alt="default avatar"
                className={`avatar-default-opt ${data.avatarPreview === url ? "selected" : ""}`}
                onClick={() => onChange("avatarPreview", url)}
              />
            ))}
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" className="d-none" onChange={handleFileInput} />
      </div>

      {/* Bio */}
      <div className="form-floating mb-3">
        <textarea
          id="p_bio"
          placeholder=""
          className="form-control"
          style={{ height: "88px", resize: "none" }}
          maxLength={160}
          value={data.bio}
          onChange={(e) => onChange("bio", e.target.value)}
        />
        <label htmlFor="p_bio">Bio</label>
        <div className="form-text ps-1 text-end">{data.bio.length} / 160</div>
      </div>

      {/* Location */}
      <div className="form-floating mb-3">
        <input
          type="text"
          id="p_location"
          placeholder=""
          className="form-control"
          value={data.location}
          onChange={(e) => onChange("location", e.target.value)}
        />
        <label htmlFor="p_location">Location</label>
      </div>

    </div>
  );
};

export default StepAbout;
