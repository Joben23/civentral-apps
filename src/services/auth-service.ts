import { CitizenUser } from '@/types/citizen';
import { CITIZEN_API_BASE_URL } from '@/src/config/api';

export interface AuthApiResponse {
  status: 'success' | 'otp_required' | 'error';
  message: string;
  token?: string;
  user?: CitizenUser;
  citizen_user_id?: number;
  email?: string;
  data?: any;
}

// Kept as a public export for existing citizen services.
export const API_BASE_URL = CITIZEN_API_BASE_URL;

export class AuthService {
  private static currentUserEmail: string | null = null;
  private static currentUserId: number | null = null;
  private static currentUserData: any = null;

  static setCurrentUser(data: { email?: string; citizen_user_id?: number; user?: any }) {
    if (data.email) this.currentUserEmail = data.email;
    if (data.citizen_user_id) this.currentUserId = data.citizen_user_id;
    if (data.user) {
      this.currentUserData = data.user;
      if (data.user.email) this.currentUserEmail = data.user.email;
      if (data.user.citizen_user_id) this.currentUserId = data.user.citizen_user_id;
    }
  }

  static getCurrentUser() {
    return {
      email: this.currentUserEmail,
      citizen_user_id: this.currentUserId,
      user: this.currentUserData,
    };
  }

  static clearCurrentUser() {
    this.currentUserEmail = null;
    this.currentUserId = null;
    this.currentUserData = null;
  }

  /**
   * Check if account exists for email or phone number
   * Endpoint: https://civentral.tech/api/citizen/check-account.php
   */
  static async checkAccount(identifier: string): Promise<{
    exists: boolean;
    userStatus?: string;
    message?: string;
  }> {
    try {
      const payload = {
        email: identifier,
        identifier: identifier,
        mobile_number: identifier,
      };

      const response = await fetch(`${API_BASE_URL}/check-account.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        return { exists: false };
      }

      if (json.exists === true || json.status === 'exists') {
        return { exists: true, userStatus: json.user_status, message: json.message };
      }

      return { exists: false, message: json.message };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Citizen Login to PHP Backend API
   * Endpoint: https://civentral.tech/api/citizen/login.php
   */
  static async login(identifier: string, password: string): Promise<AuthApiResponse> {
    try {
      const payload = {
        email: identifier,
        mobile_number: identifier,
        identifier: identifier,
        password: password,
      };

      const response = await fetch(`${API_BASE_URL}/login.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        return {
          status: 'error',
          message: text || 'Server returned an invalid response format.',
        };
      }

      if (json.status === 'otp_required') {
        return {
          status: 'otp_required',
          message: json.message || 'Please verify your email to complete login.',
          email: json.email || identifier,
        };
      }

      if (json.status === 'success' || json.success === true) {
        const userObj = json.user || json.data?.user || json.data;
        const userEmail = json.email || userObj?.email || identifier;
        const userId = json.citizen_user_id || userObj?.citizen_user_id || userObj?.id;

        AuthService.setCurrentUser({
          email: userEmail,
          citizen_user_id: userId,
          user: userObj,
        });

        return {
          status: 'success',
          message: json.message || 'Login successful.',
          token: json.token || json.data?.token,
          user: userObj,
          citizen_user_id: userId,
          email: userEmail,
          data: json.data,
        };
      }

      return {
        status: 'error',
        message: json.message || 'Invalid Email / Mobile Number or Password.',
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error?.message || 'Network error connecting to Civentral servers.',
      };
    }
  }

  /**
   * Citizen Registration to PHP Backend API
   * Endpoint: https://civentral.tech/api/citizen/register.php
   */
  static async register(userData: {
    email: string;
    firstName: string;
    middleName?: string;
    hasNoMiddleName: boolean;
    lastName: string;
    suffix?: string;
    mobileNumber?: string;
    password: string;
  }): Promise<AuthApiResponse> {
    try {
      const payload = {
        first_name: userData.firstName,
        middle_name: userData.middleName || '',
        has_no_middle_name: userData.hasNoMiddleName ? 1 : 0,
        last_name: userData.lastName,
        suffix: userData.suffix || '',
        email: userData.email,
        mobile_number: userData.mobileNumber || '',
        password: userData.password,
      };

      const response = await fetch(`${API_BASE_URL}/register.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        return {
          status: 'error',
          message: text || 'Server returned an invalid response format.',
        };
      }

      if (json.status === 'otp_required' || json.status === 'success' || json.success === true) {
        const userId = json.citizen_user_id || json.data?.citizen_user_id;
        const userEmail = json.email || userData.email;

        AuthService.setCurrentUser({
          email: userEmail,
          citizen_user_id: userId,
        });

        return {
          status: json.status === 'otp_required' ? 'otp_required' : 'success',
          message: json.message || 'Account created! Verification code sent to your email.',
          citizen_user_id: userId,
          email: userEmail,
          data: json.data,
        };
      }

      return {
        status: 'error',
        message: json.message || 'Registration failed. Please try again.',
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error?.message || 'Network error connecting to Civentral servers.',
      };
    }
  }

  /**
   * OTP Verification to PHP Backend API
   * Endpoint: https://civentral.tech/api/citizen/verify.php
   */
  static async verifyOtp(email: string, otpCode: string): Promise<AuthApiResponse> {
    try {
      const payload = {
        email: email,
        otp_code: otpCode,
        otp: otpCode,
        code: otpCode,
      };

      const response = await fetch(`${API_BASE_URL}/verify.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        return {
          status: 'error',
          message: text || 'Server returned an invalid response format.',
        };
      }

      if (json.status === 'success' || json.success === true) {
        AuthService.setCurrentUser({
          email: email,
        });

        return {
          status: 'success',
          message: json.message || 'Verification successful.',
          data: json.data,
        };
      }

      return {
        status: 'error',
        message: json.message || 'Invalid or expired OTP code.',
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error?.message || 'Network error connecting to Civentral servers.',
      };
    }
  }

  /**
   * Change password via PHP backend API
   * Endpoint: https://civentral.tech/api/citizen/change-password.php
   */
  static async changePassword(params: {
    citizenUserId: number;
    email: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<AuthApiResponse> {
    try {
      const payload = {
        citizen_user_id: params.citizenUserId,
        email: params.email,
        current_password: params.currentPassword,
        new_password: params.newPassword,
      };

      const response = await fetch(`${API_BASE_URL}/change-password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        return {
          status: 'error',
          message: text || 'Server returned an invalid response format.',
        };
      }

      if (json.status === 'success' || json.success === true) {
        return {
          status: 'success',
          message: json.message || 'Password changed successfully.',
        };
      }

      return {
        status: 'error',
        message: json.message || 'Failed to change password.',
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error?.message || 'Network error connecting to Civentral servers.',
      };
    }
  }
}
