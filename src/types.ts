export type MembershipStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type UserRole = 'admin' | 'member';
export type FieldVisibility = 'members' | 'admins_only' | 'private';
export type BirthdayVisibility = 'day_month' | 'full_date' | 'admins_only' | 'private';

export interface PublicFellowshipInfo {
  fellowship_name: string;
  tagline: string;
  logo_url: string | null;
  description: string;
  meeting_schedule: string;
  meeting_location: string;
  official_domain?: string;
  needs_admin_setup: boolean;
  requires_bootstrap_passcode: boolean;
}

export interface ProfilePrivacy {
  phone_visibility: FieldVisibility;
  email_visibility: FieldVisibility;
  workplace_visibility: FieldVisibility;
  birthday_visibility: BirthdayVisibility;
  location_visibility: FieldVisibility;
}

export interface MemberProfile {
  id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  profile_image: string | null;
  date_of_birth: string | null;
  birth_month_day?: string | null;
  gender: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  lga?: string | null;
  street_address?: string | null;
  residential_location: string | null;
  occupation: string | null;
  workplace: string | null;
  professional_designation: string | null;
  skills: string | null;
  membership_category: string | null;
  date_of_joining: string | null;
  fellowship_responsibilities: string | null;
  biography: string | null;
  membership_status: MembershipStatus;
  role: UserRole;
  created_at: string;
  updated_at: string;
  privacy_summary?: {
    phone_visible: boolean;
    email_visible: boolean;
    workplace_visible: boolean;
    location_visible: boolean;
    birthday_mode: string;
  };
}

export interface AdminMemberRecord extends MemberProfile {
  phone_visibility: FieldVisibility;
  email_visibility: FieldVisibility;
  workplace_visibility: FieldVisibility;
  birthday_visibility: BirthdayVisibility;
  location_visibility: FieldVisibility;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  is_pinned: number;
  status: 'draft' | 'published';
  author_name: string;
  is_read?: number;
  created_at: string;
  updated_at?: string;
}

export interface UpcomingBirthday {
  id: string;
  full_name: string;
  profile_image: string | null;
  occupation: string | null;
  birth_month_day: string;
  date_of_birth: string | null;
  days_until: number;
  turning_age: number | null;
}

export interface FellowshipSettings {
  id: string;
  fellowship_name: string;
  tagline: string;
  logo_url: string | null;
  description: string;
  meeting_schedule: string;
  meeting_location: string;
  default_phone_visibility: FieldVisibility;
  default_email_visibility: FieldVisibility;
  default_workplace_visibility: FieldVisibility;
  default_birthday_visibility: BirthdayVisibility;
  default_location_visibility: FieldVisibility;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string | null;
  actor_name: string | null;
  created_at: string;
}

export type AppRoute =
  | 'landing'
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'reset-password'
  | 'admin-setup'
  | 'pending'
  | 'unauthorized'
  | 'dashboard'
  | 'directory'
  | 'member-profile'
  | 'my-profile'
  | 'birthdays'
  | 'announcements'
  | 'admin-dashboard'
  | 'admin-members'
  | 'admin-announcements'
  | 'admin-settings';
