export interface ProfileData {
  firstName: string;
  lastName: string;
  username: string;
  bio: string;
  location: string;
  avatarFile: File | null;
  avatarPreview: string;
}

export interface ProfileErrors {
  firstName?: string;
  lastName?: string;
  username?: string;
}
