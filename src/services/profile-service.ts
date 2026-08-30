import { API_BASE_URL } from './auth-service';

export interface CitizenProfileData {
  citizen_user_id?: number;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  suffix?: string | null;
  fullName: string;
  initials: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  barangay: string;
  birthDate: string;
  civilStatus: string;
  citizenId: string;
  status: string;
  isVerified: boolean;
  registryCompleted: boolean;
  biometricEnabled: boolean;
  memberSince: string;
  lastLogin: string;
}

export class ProfileService {
  /**
   * Fetch Citizen Profile details from PHP Backend API (get-profile.php)
   */
  static async getProfile(): Promise<{
    status: 'success' | 'error';
    data?: Partial<CitizenProfileData>;
    message?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/get-profile.php`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      const text = await response.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        return { status: 'error', message: 'Unable to parse API response' };
      }

      if (!response.ok) {
        return { status: 'error', message: json.message || 'Unable to load your profile.' };
      }

      if (json.status === 'success' && json.data) {
        const rawUser = json.data;
        const profile: Partial<CitizenProfileData> = {
          citizen_user_id: rawUser.citizen_user_id,
          first_name: rawUser.first_name,
          middle_name: rawUser.middle_name,
          last_name: rawUser.last_name,
          suffix: rawUser.suffix,
          fullName: rawUser.full_name || `${rawUser.first_name || ''} ${rawUser.last_name || ''}`.trim(),
          initials: rawUser.initials || (rawUser.first_name ? rawUser.first_name.charAt(0).toUpperCase() : ''),
          email: rawUser.email || '',
          phone: rawUser.mobile_number || rawUser.phone || '',
          address: rawUser.address || '',
          city: rawUser.city || 'Caloocan City',
          barangay: rawUser.barangay || '',
          birthDate: rawUser.birth_date || '',
          civilStatus: rawUser.civil_status || '',
          citizenId: rawUser.citizen_user_id ? `CIV-2026-${String(rawUser.citizen_user_id).padStart(5, '0')}` : '',
          status: rawUser.status || 'Active',
          isVerified: true,
          registryCompleted: true,
          biometricEnabled: Boolean(rawUser.biometric_enabled),
          memberSince: rawUser.member_since || '',
          lastLogin: rawUser.last_login || '',
        };
        return { status: 'success', data: profile };
      }

      return { status: 'error', message: json.message || 'Profile record not found.' };
    } catch (error: any) {
      return { status: 'error', message: error?.message || 'Network error connecting to get-profile.php' };
    }
  }

  /**
   * Update Citizen Profile details on PHP Backend API (update-profile.php)
   */
  static async updateProfile(payload: {
    email: string;
    phone: string;
    address: string;
  }): Promise<{ status: 'success' | 'error'; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/update-profile.php`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: payload.email,
          mobile_number: payload.phone,
          phone: payload.phone,
          address: payload.address,
        }),
      });

      const text = await response.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        return { status: 'error', message: 'Server returned an invalid response format.' };
      }

      if (response.ok && (json.status === 'success' || json.success === true)) {
        return { status: 'success', message: json.message || 'Profile updated successfully.' };
      }

      return { status: 'error', message: json.message || 'Unable to update your profile.' };
    } catch {
      return { status: 'error', message: 'Unable to update your profile. Please try again.' };
    }
  }
}
