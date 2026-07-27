import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import api from "../backend";
import { auth } from "../firebase";
import { useErrorModal, getFriendlyErrorMessage } from "../ErrorModal";
import "./ProfileEdit.css";

const DEFAULT_AVATARS = [
  "https://api.dicebear.com/8.x/shapes/svg?seed=alpha",
  "https://api.dicebear.com/8.x/shapes/svg?seed=beta",
  "https://api.dicebear.com/8.x/shapes/svg?seed=gamma",
  "https://api.dicebear.com/8.x/shapes/svg?seed=delta",
  "https://api.dicebear.com/8.x/shapes/svg?seed=epsilon",
  "https://api.dicebear.com/8.x/shapes/svg?seed=zeta",
];

const ProfileEdit = () => {
  const navigate = useNavigate();
  const { showError, showToast } = useErrorModal();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [username, setUsername]   = useState("");
  const [bio, setBio]             = useState("");
  const [location, setLocation]   = useState("");
  const [avatarFile, setAvatarFile]     = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  // Fetch current profile
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    api
      .get(`/profile/id/${uid}`)
      .then((res) => {
        const p = res.data;
        setFirstName(p.firstName || "");
        setLastName(p.lastName || "");
        setUsername(p.username || "");
        setBio(p.bio || "");
        setLocation(p.location || "");
        setAvatarPreview(p.avatarUrl || "");
      })
      .catch(() => {
        // No profile exists — redirect to setup
        navigate("/profile-setup", { replace: true });
      })
      .finally(() => setLoading(false));
  }, [navigate]);	const prevBlobUrl = useRef<string | null>(null);

	const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			// Revoke previous blob URL to avoid memory leaks
			if (prevBlobUrl.current) {
				URL.revokeObjectURL(prevBlobUrl.current);
			}
			const url = URL.createObjectURL(file);
			prevBlobUrl.current = url;
			setAvatarFile(file);
			setAvatarPreview(url);
		}
	};

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("firstName", firstName.trim());
      formData.append("lastName", lastName.trim());
      formData.append("userName", username);
      formData.append("bio", bio);
      formData.append("location", location);
      if (avatarFile) formData.append("avatar", avatarFile);
      else if (avatarPreview) formData.append("avatarUrl", avatarPreview);

      await api.patch(`/profile/update/`, formData);
      showToast("Profile updated!");
      navigate("/chats");
    } catch (err: unknown) {
      showError(`Could not update profile. ${getFriendlyErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="edit-profile-root">
        <p className="edit-profile-loading">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="edit-profile-root">
      <div className="edit-profile-card">
        {/* Header */}
        <div className="edit-profile-header">
          <button className="edit-profile-back" onClick={() => navigate("/chats")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
          <h1 className="edit-profile-title">Edit profile</h1>
        </div>

        {/* Avatar */}
        <div className="edit-avatar-section">
          <div className="edit-avatar-preview" onClick={() => fileRef.current?.click()} title="Change photo">
            {avatarPreview ? (
              <img src={avatarPreview} alt="avatar" />
            ) : (
              <svg viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="16" r="7" stroke="currentColor" strokeWidth="1.8" />
                <path d="M6 36c0-7.73 6.27-14 14-14s14 6.27 14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
            <div className="edit-avatar-overlay">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
          </div>

          <div>
            <p className="edit-avatar-label">Profile photo</p>
            <p className="edit-avatar-hint">Upload yours or pick a default</p>
            <div className="edit-avatar-defaults">
              {DEFAULT_AVATARS.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt="default avatar"
                  className={`edit-avatar-opt ${avatarPreview === url && !avatarFile ? "selected" : ""}`}
                  onClick={() => {
                    setAvatarFile(null);
                    setAvatarPreview(url);
                  }}
                />
              ))}
            </div>
          </div>

          <input ref={fileRef} type="file" accept="image/*" className="d-none" onChange={handleFileInput} />
        </div>

        {/* Form fields */}
        <div className="edit-profile-fields">
          <div className="edit-field-row">
            <div className="form-floating">
              <input
                type="text"
                id="ef_firstname"
                placeholder=""
                className="form-control"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <label htmlFor="ef_firstname">First name</label>
            </div>
            <div className="form-floating">
              <input
                type="text"
                id="ef_lastname"
                placeholder=""
                className="form-control"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <label htmlFor="ef_lastname">Last name</label>
            </div>
          </div>

          <div className="form-floating">
            <input
              type="text"
              id="ef_username"
              placeholder=""
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
            />
            <label htmlFor="ef_username">Username</label>
          </div>

          <div className="form-floating">
            <textarea
              id="ef_bio"
              placeholder=""
              className="form-control"
              style={{ height: "88px", resize: "none" }}
              maxLength={160}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <label htmlFor="ef_bio">Bio</label>
            <div className="form-text text-end">{bio.length} / 160</div>
          </div>

          <div className="form-floating">
            <input
              type="text"
              id="ef_location"
              placeholder=""
              className="form-control"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <label htmlFor="ef_location">Location</label>
          </div>
        </div>

        {/* Actions */}
        <div className="edit-profile-actions">
          <button className="edit-profile-cancel" onClick={() => navigate("/chats")}>
            Cancel
          </button>
          <button className="edit-profile-save" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileEdit;
