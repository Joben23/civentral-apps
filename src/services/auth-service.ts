import { CitizenUser } from '@/types/citizen';
import { CITIZEN_API_BASE_URL } from '@/src/config/api';
import { resetCitizenIncidentNotificationState } from '@/src/services/drrmIncidentNotifications';
import { resetCitizenWarningNotificationState } from '@/src/services/drrmWarningNotifications';

export interface AuthApiResponse {
  status: 'success' | 'otp_required' | 'error';
  message: string;
  token?: string;
  user?: CitizenUser;
  citizen_user_id?: number;
  email?: string;
  data?: any;
}

export type AccountCheckResult =
  | {
      status: 'exists';
      exists: true;
      userStatus?: string;
      message?: string;
    }
  | {
      status: 'not_found';
      exists: false;
      message?: string;
    }
  | {
      status: 'error';
      message: string;
    };

export const ACCOUNT_CHECK_ERROR_MESSAGE =
  'We could not verify your account right now. Please check your connection and try again.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function normalizeAuthIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed.replace(/\s+/g, '');
}

export function parseAccountCheckResponse(
  payload: unknown,
  httpStatus: number,
): AccountCheckResult {
  if (httpStatus < 200 || httpStatus >= 300 || !isRecord(payload)) {
    return { status: 'error', message: ACCOUNT_CHECK_ERROR_MESSAGE };
  }

  const backendStatus = optionalString(payload.status);
  const message = optionalString(payload.message);
  const userStatus = optionalString(payload.user_status);
  const explicitlyExists =
    (backendStatus === 'exists' && payload.exists !== false) ||
    (payload.exists === true &&
      (backendStatus === undefined || backendStatus === 'exists' || backendStatus === 'success'));

  if (explicitlyExists) {
    return { status: 'exists', exists: true, userStatus, message };
  }

  if (backendStatus === 'not_found' && payload.exists === false) {
    return { status: 'not_found', exists: false, message };
  }

  return { status: 'error', message: ACCOUNT_CHECK_ERROR_MESSAGE };
}

// Kept as a public export for existing citizen services.
export const API_BASE_URL = CITIZEN_API_BASE_URL;

export class AuthService {
  private static currentUserEmail: string | null = null;
  private static currentUserId: number | null = null;
  private static currentUserData: any = null;
  private static pendingRegistrationIdentifier: string | null = null;
  private static sessionRevision = 0;
  private static sessionEndReason: 'expired' | null = null;
  private static sessionListeners = new Set<() => void>();

  static subscribeCitizenSession(listener: () => void): () => void {
    AuthService.sessionListeners.add(listener);
    return () => AuthService.sessionListeners.delete(listener);
  }

  static getCitizenSessionRevisionSnapshot(): number {
    return AuthService.sessionRevision;
  }

  static getSessionEndReason(): 'expired' | null {
    return AuthService.sessionEndReason;
  }

  static isCitizenAuthenticated(): boolean {
    return AuthService.currentUserId !== null;
  }

  private static publishSessionChange(): void {
    AuthService.sessionRevision += 1;
    AuthService.sessionListeners.forEach((listener) => listener());
  }

  static setCurrentUser(data: { email?: string; citizen_user_id?: number; user?: any }) {
    const rawId = data.citizen_user_id ?? data.user?.citizen_user_id ?? data.user?.id;
    const parsedId = typeof rawId === 'number' ? rawId
      : typeof rawId === 'string' && /^\d+$/.test(rawId) ? Number(rawId) : null;
    this.currentUserId = parsedId !== null && Number.isSafeInteger(parsedId) && parsedId > 0
      ? parsedId : null;
    this.currentUserEmail = data.email ?? data.user?.email ?? null;
    this.currentUserData = data.user ?? null;
    this.sessionEndReason = null;
    resetCitizenIncidentNotificationState();
    resetCitizenWarningNotificationState();
    this.publishSessionChange();
  }

  static getCurrentUser() {
    return {
      email: this.currentUserEmail,
      citizen_user_id: this.currentUserId,
      user: this.currentUserData,
    };
  }

  // This clears app state only; the backend currently has no citizen logout endpoint.
  static clearCurrentUser(reason: 'signed-out' | 'expired' = 'signed-out') {
    this.currentUserEmail = null;
    this.currentUserId = null;
    this.currentUserData = null;
    this.pendingRegistrationIdentifier = null;
    this.sessionEndReason = reason === 'expired' ? 'expired' : null;
    resetCitizenIncidentNotificationState();
    resetCitizenWarningNotificationState();
    this.publishSessionChange();
  }

  static isRegistrationAllowed(identifier: string): boolean {
    return this.pendingRegistrationIdentifier === normalizeAuthIdentifier(identifier);
  }

  /**
   * Check if account exists for email or phone number
   * Endpoint: https://civentral.tech/api/citizen/check-account.php
   */
  static async checkAccount(identifier: string): Promise<AccountCheckResult> {
    this.pendingRegistrationIdentifier = null;
    try {
      const normalizedIdentifier = normalizeAuthIdentifier(identifier);
      const payload = {
        email: normalizedIdentifier,
        identifier: normalizedIdentifier,
        mobile_number: normalizedIdentifier,
      };

      const response = await fetch(`${API_BASE_URL}/check-account.php`, {
        method: 'POST',
        credentials: 'include',
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
        return { status: 'error', message: ACCOUNT_CHECK_ERROR_MESSAGE };
      }

      const result = parseAccountCheckResponse(json, response.status);
      if (result.status === 'not_found') {
        this.pendingRegistrationIdentifier = normalizedIdentifier;
      }
      return result;
    } catch {
      return { status: 'error', message: ACCOUNT_CHECK_ERROR_MESSAGE };
    }
  }

  /**
   * Citizen Login to PHP Backend API
   * Endpoint: https://civentral.tech/api/citizen/login.php
   */
  static async login(identifier: string, password: string): Promise<AuthApiResponse> {
    try {
      const normalizedIdentifier = normalizeAuthIdentifier(identifier);
      const payload = {
        email: normalizedIdentifier,
        mobile_number: normalizedIdentifier,
        identifier: normalizedIdentifier,
        password: password,
      };

      const response = await fetch(`${API_BASE_URL}/login.php`, {
        method: 'POST',
        credentials: 'include',
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
          message: 'Server returned an invalid response format.',
        };
      }

      if (!response.ok) {
        return {
          status: 'error',
          message: json.message || 'Unable to sign in. Please try again.',
        };
      }

      if (json.status === 'otp_required') {
        return {
          status: 'otp_required',
          message: json.message || 'Please verify your email to complete login.',
          email: json.email || normalizedIdentifier,
        };
      }

      if (json.status === 'success' || json.success === true) {
        const userObj = json.user || json.data?.user || json.data;
        const userEmail = json.email || userObj?.email || normalizedIdentifier;
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
      const normalizedEmail = normalizeAuthIdentifier(userData.email);
      if (!this.isRegistrationAllowed(normalizedEmail)) {
        return {
          status: 'error',
          message: 'Please verify that this account does not already exist before registering.',
        };
      }
      const normalizedMobileNumber = userData.mobileNumber
        ? normalizeAuthIdentifier(userData.mobileNumber)
        : '';
      const payload = {
        first_name: userData.firstName,
        middle_name: userData.middleName || '',
        has_no_middle_name: userData.hasNoMiddleName ? 1 : 0,
        last_name: userData.lastName,
        suffix: userData.suffix || '',
        email: normalizedEmail,
        mobile_number: normalizedMobileNumber,
        password: userData.password,
      };

      const response = await fetch(`${API_BASE_URL}/register.php`, {
        method: 'POST',
        credentials: 'include',
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
          message: 'Server returned an invalid response format.',
        };
      }

      if (!response.ok) {
        return {
          status: 'error',
          message: json.message || 'Registration failed. Please try again.',
        };
      }

      if (json.status === 'otp_required' || json.status === 'success' || json.success === true) {
        const userId = json.citizen_user_id || json.data?.citizen_user_id;
        const userEmail = json.email || normalizedEmail;
        this.pendingRegistrationIdentifier = null;

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
   * Endpoint: https://civentral.tech/api/citizen/verify-otp.php
   */
  static async verifyOtp(email: string, otpCode: string): Promise<AuthApiResponse> {
    try {
      const normalizedEmail = normalizeAuthIdentifier(email);
      const payload = {
        email: normalizedEmail,
        otp_code: otpCode,
        otp: otpCode,
        code: otpCode,
      };

      const response = await fetch(`${API_BASE_URL}/verify-otp.php`, {
        method: 'POST',
        credentials: 'include',
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
          message: 'Server returned an invalid response format.',
        };
      }

      if (!response.ok) {
        return {
          status: 'error',
          message: json.message || 'Invalid or expired OTP code.',
        };
      }

      if (json.status === 'success' || json.success === true) {
        const userObj = json.user || json.data?.user || json.data;
        const userEmail = json.email || userObj?.email || normalizedEmail;
        const userId = json.citizen_user_id || userObj?.citizen_user_id || userObj?.id;

        AuthService.setCurrentUser({
          email: userEmail,
          citizen_user_id: userId,
          user: userObj,
        });

        return {
          status: 'success',
          message: json.message || 'Verification successful.',
          token: json.token || json.data?.token,
          user: userObj,
          citizen_user_id: userId,
          email: userEmail,
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

  /** Resend a citizen OTP without changing local authentication state. */
  static async resendOtp(email: string): Promise<AuthApiResponse> {
    try {
      const normalizedEmail = normalizeAuthIdentifier(email);
      const response = await fetch(`${API_BASE_URL}/resend-otp.php`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail, identifier: normalizedEmail }),
      });

      const text = await response.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        return { status: 'error', message: 'Server returned an invalid response format.' };
      }

      if (!response.ok || (json.status !== 'success' && json.success !== true)) {
        return {
          status: 'error',
          message: json.message || 'Unable to resend the verification code. Please try again.',
        };
      }

      return {
        status: 'success',
        message: json.message || 'A new verification code was sent.',
        email: json.email || normalizedEmail,
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
    currentPassword: string;
    newPassword: string;
  }): Promise<AuthApiResponse> {
    try {
      const payload = {
        current_password: params.currentPassword,
        new_password: params.newPassword,
      };

      const response = await fetch(`${API_BASE_URL}/change-password.php`, {
        method: 'POST',
        credentials: 'include',
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
          message: 'Server returned an invalid response format.',
        };
      }

      if (!response.ok) {
        return {
          status: 'error',
          message: json.message || 'Failed to change password. Please try again.',
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
