import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Badge } from '@/src/components/ui/Badge';
import { AuthService } from '@/src/services/auth-service';
import { CitizenProfileData, ProfileService } from '@/src/services/profile-service';

export function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ isGuest?: string }>();
  
  // Check active session or params
  const session = AuthService.getCurrentUser();
  const activeEmail = session.email || '';
  const activeUserId = session.citizen_user_id || undefined;
  
  // Is Guest if explicitly passed isGuest=true OR if no user email/id is found
  const isGuestMode = params.isGuest === 'true' || (!activeEmail && !activeUserId);

  // Active sub-tab state: 'overview' | 'settings'
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');

  // Loading & Refresh State
  const [isLoadingApi, setIsLoadingApi] = useState(!isGuestMode);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // User Profile Data state initialized with real dynamic state (No hardcoded mock data)
  const [userProfile, setUserProfile] = useState<CitizenProfileData>({
    citizen_user_id: activeUserId || 0,
    first_name: isGuestMode ? 'Guest' : '',
    middle_name: '',
    last_name: isGuestMode ? 'Resident' : '',
    suffix: '',
    fullName: isGuestMode ? 'Guest Resident' : '',
    initials: isGuestMode ? 'GR' : '',
    email: activeEmail || (isGuestMode ? 'guest@caloocan.gov.ph' : ''),
    phone: '',
    address: '',
    city: 'Caloocan City',
    barangay: '',
    birthDate: '',
    civilStatus: '',
    citizenId: activeUserId ? `CIV-2026-${String(activeUserId).padStart(5, '0')}` : isGuestMode ? 'CIV-GUEST-2026' : '',
    status: isGuestMode ? 'Guest' : '',
    isVerified: false,
    registryCompleted: false,
    biometricEnabled: false,
    memberSince: '',
    lastLogin: isGuestMode ? 'Current Session (Guest Mode)' : '',
  });

  // Settings State
  const [biometricsEnabled, setBiometricsEnabled] = useState(userProfile.biometricEnabled);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(true);
  const [sosAlertsEnabled, setSosAlertsEnabled] = useState(true);

  // Modals
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [isEditProfileModalVisible, setIsEditProfileModalVisible] = useState(false);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

  // Temporary Edit Form State
  const [editPhone, setEditPhone] = useState(userProfile.phone);
  const [editEmail, setEditEmail] = useState(userProfile.email);
  const [editAddress, setEditAddress] = useState(userProfile.address);
  const [isSaving, setIsSaving] = useState(false);

  // Change Password Form State
  const [isChangePasswordModalVisible, setIsChangePasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isCurrentPasswordVisible, setIsCurrentPasswordVisible] = useState(false);
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isConfirmNewPasswordVisible, setIsConfirmNewPasswordVisible] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changePasswordErrorMessage, setChangePasswordErrorMessage] = useState<string | null>(null);
  const [isSuccessToastVisible, setIsSuccessToastVisible] = useState(false);

  // New Password Strength Evaluation
  const newHasMinLength = newPassword.length >= 8;
  const newHasUpper = /[A-Z]/.test(newPassword);
  const newHasLower = /[a-z]/.test(newPassword);
  const newHasNumber = /[0-9]/.test(newPassword);
  const newHasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

  const getNewStrengthLevel = (): 'weak' | 'medium' | 'strong' | '' => {
    if (newPassword.length === 0) return '';
    let score = 0;
    if (newHasMinLength) score += 1;
    if (newHasUpper && newHasLower) score += 1;
    if (newHasNumber) score += 1;
    if (newHasSymbol) score += 1;

    if (score >= 4 && newHasMinLength && newHasUpper && newHasLower && newHasNumber && newHasSymbol) {
      return 'strong';
    } else if (score >= 3 && newHasMinLength) {
      return 'medium';
    } else {
      return 'weak';
    }
  };

  const newStrengthLevel = getNewStrengthLevel();

  const handleChangePassword = async () => {
    setChangePasswordErrorMessage(null);

    if (!currentPassword) {
      setChangePasswordErrorMessage('Please enter your current password.');
      return;
    }

    if (!newPassword) {
      setChangePasswordErrorMessage('Please enter a new password.');
      return;
    }

    if (newStrengthLevel !== 'strong') {
      setChangePasswordErrorMessage('New password must be STRONG to be saved.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setChangePasswordErrorMessage('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    const response = await AuthService.changePassword({
      currentPassword,
      newPassword,
    });
    setIsChangingPassword(false);

    if (response.status === 'success') {
      // Clear fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setIsChangePasswordModalVisible(false);

      setIsSuccessToastVisible(true);
      setTimeout(() => {
        setIsSuccessToastVisible(false);
      }, 2500);
    } else {
      setChangePasswordErrorMessage(response.message || 'Failed to update password.');
    }
  };

  // 1. Fetch Profile Data from PHP API (get-profile.php) - Skip if Guest Mode
  const fetchProfileFromApi = async () => {
    if (isGuestMode) return;

    const response = await ProfileService.getProfile();
    
    if (response.status === 'success' && response.data) {
      const data = response.data;
      setUserProfile((prev) => ({
        ...prev,
        ...data,
        status: data.status || 'Active',
        isVerified: true,
        registryCompleted: true,
      }));
      if (response.data.biometricEnabled !== undefined) {
        setBiometricsEnabled(response.data.biometricEnabled);
      }
    }
  };

  useEffect(() => {
    async function loadData() {
      if (isGuestMode) {
        setIsLoadingApi(false);
        return;
      }
      setIsLoadingApi(true);
      await fetchProfileFromApi();
      setIsLoadingApi(false);
    }
    loadData();
  }, [isGuestMode, activeEmail, activeUserId]);

  const handleRefresh = async () => {
    if (isGuestMode) return;
    setIsRefreshing(true);
    await fetchProfileFromApi();
    setIsRefreshing(false);
  };

  // 2. Update Profile to API & Local State
  const handleSaveProfile = async () => {
    const updatedPhone = editPhone.trim();
    const updatedEmail = editEmail.trim();
    const updatedAddress = editAddress.trim();

    setIsSaving(true);

    if (!isGuestMode) {
      const response = await ProfileService.updateProfile({
        email: updatedEmail,
        phone: updatedPhone,
        address: updatedAddress,
      });

      if (response.status !== 'success') {
        setIsSaving(false);
        Alert.alert('Profile Update Failed', response.message);
        return;
      }
    }

    setUserProfile((prev) => ({
      ...prev,
      phone: updatedPhone,
      email: updatedEmail,
      address: updatedAddress,
    }));

    setIsSaving(false);
    setIsEditProfileModalVisible(false);

    Alert.alert(
      'Profile Updated',
      'Your contact details have been successfully updated in your profile.'
    );
  };

  const handleSignOut = () => {
    if (isGuestMode) {
      AuthService.clearCurrentUser();
      router.replace('/(auth)');
      return;
    }
    setIsLogoutModalVisible(true);
  };

  const handleConfirmLogout = () => {
    setIsLogoutModalVisible(false);
    AuthService.clearCurrentUser();
    router.replace('/(auth)');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          !isGuestMode ? (
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#176B87" />
          ) : undefined
        }>
        
        {/* Top Citizen ID Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{userProfile.initials || (isGuestMode ? 'GR' : '...')}</Text>
              <View style={[styles.onlineBadgeDot, isGuestMode && styles.guestBadgeDot]} />
            </View>
            <View style={styles.headerInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.userNameText}>{userProfile.fullName || 'Loading Profile...'}</Text>
              </View>
              {userProfile.citizenId ? (
                <Text style={styles.citizenIdText}>ID: {userProfile.citizenId}</Text>
              ) : null}
              <Text style={styles.barangayText}>
                📍 {userProfile.barangay ? `${userProfile.barangay}, Caloocan City` : 'Caloocan City Resident'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.qrHeaderBtn}
              onPress={() => setIsQrModalVisible(true)}
              activeOpacity={0.8}>
              <IconSymbol name="qrcode" size={24} color="#176B87" />
              <Text style={styles.qrBtnLabel}>QR ID</Text>
            </TouchableOpacity>
          </View>

          {/* Status Badges */}
          <View style={styles.badgesRow}>
            <Badge
              label={isGuestMode ? 'GUEST USER' : `${(userProfile.status || 'Active').toUpperCase()} RESIDENT`}
              variant={isGuestMode ? 'neutral' : 'success'}
            />
            <View style={styles.badgeSpacer} />
            <Badge
              label={isGuestMode ? 'TEMPORARY SESSION' : userProfile.memberSince ? `MEMBER SINCE ${userProfile.memberSince.toUpperCase()}` : 'REGISTERED CITIZEN'}
              variant="neutral"
            />
          </View>
        </View>

        {/* Tab Navigation Controls (Overview and Settings only) */}
        <View style={styles.tabBarContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'overview' && styles.tabButtonActive]}
            onPress={() => setActiveTab('overview')}
            activeOpacity={0.7}>
            <Text style={[styles.tabButtonText, activeTab === 'overview' && styles.tabButtonTextActive]}>
              Overview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'settings' && styles.tabButtonActive]}
            onPress={() => setActiveTab('settings')}
            activeOpacity={0.7}>
            <Text style={[styles.tabButtonText, activeTab === 'settings' && styles.tabButtonTextActive]}>
              Settings
            </Text>
          </TouchableOpacity>
        </View>

        {isLoadingApi && !isRefreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#176B87" />
            <Text style={styles.loadingText}>Loading profile from get-profile.php...</Text>
          </View>
        ) : null}

        {/* TAB CONTENT: 1. OVERVIEW */}
        {activeTab === 'overview' && (
          <View style={styles.sectionStack}>
            {/* Personal Details Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <IconSymbol name="person.fill" size={20} color="#176B87" />
                  <Text style={styles.cardTitle}>Personal Information</Text>
                </View>
                {!isGuestMode && (
                  <TouchableOpacity
                    onPress={() => {
                      setEditPhone(userProfile.phone);
                      setEditEmail(userProfile.email);
                      setEditAddress(userProfile.address);
                      setIsEditProfileModalVisible(true);
                    }}
                    activeOpacity={0.7}>
                    <View style={styles.editIconBadge}>
                      <IconSymbol name="pencil" size={14} color="#176B87" />
                      <Text style={styles.editText}>Edit</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <IconSymbol name="envelope.fill" size={16} color="#64748B" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Email Address</Text>
                    <Text style={styles.infoValue}>{userProfile.email || 'Not set'}</Text>
                  </View>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.infoRow}>
                  <IconSymbol name="phone.fill" size={16} color="#64748B" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Mobile Number</Text>
                    <Text style={styles.infoValue}>{userProfile.phone || 'Not provided'}</Text>
                  </View>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.infoRow}>
                  <IconSymbol name="location.fill" size={16} color="#64748B" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Registered Address</Text>
                    <Text style={styles.infoValue}>
                      {userProfile.address ? userProfile.address : 'Not set (Complete in Citizen Services)'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.twoColumnRow}>
                  <View style={styles.columnHalf}>
                    <Text style={styles.infoLabel}>Last Active Login</Text>
                    <Text style={styles.infoValue}>{userProfile.lastLogin || 'N/A'}</Text>
                  </View>
                  <View style={styles.columnHalf}>
                    <Text style={styles.infoLabel}>Registry Status</Text>
                    <Text style={styles.infoValue}>
                      {isGuestMode ? 'Guest Session' : 'Active (Verified)'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Digital Citizen ID Card Preview (Located Bottom of Personal Info) */}
            <View style={styles.citizenIdCard}>
              <View style={styles.citizenIdHeader}>
                <View style={styles.idHeaderRow}>
                  <Text style={styles.idRepublicText}>REPUBLIC OF THE PHILIPPINES</Text>
                  <Text style={styles.idCityText}>CITY GOVERNMENT OF CALOOCAN</Text>
                </View>
                <Text style={styles.idCardTitle}>DIGITAL CITIZEN RESIDENT CARD</Text>
              </View>

              <View style={styles.idBodyRow}>
                <View style={styles.idPhotoBox}>
                  <Text style={styles.idPhotoText}>{userProfile.initials || (isGuestMode ? 'GR' : '...')}</Text>
                  <View style={styles.idCheckBadge}>
                    <IconSymbol name="checkmark.seal.fill" size={14} color="#16A34A" />
                  </View>
                </View>

                <View style={styles.idInfoCol}>
                  <Text style={styles.idLabel}>FULL NAME</Text>
                  <Text style={styles.idValueName}>{userProfile.fullName || 'Citizen Resident'}</Text>

                  <Text style={[styles.idLabel, { marginTop: 4 }]}>CITIZEN ID NO.</Text>
                  <Text style={styles.idValueHighlight}>{userProfile.citizenId || 'Pending Generation'}</Text>

                  <Text style={[styles.idLabel, { marginTop: 4 }]}>BARANGAY RESIDENCE</Text>
                  <Text style={styles.idValueSub}>
                    {userProfile.barangay ? `${userProfile.barangay}, Caloocan City` : 'Caloocan City Resident'}
                  </Text>
                </View>
              </View>

              {/* Complete ID Action CTA */}
              <View style={styles.idFooterBanner}>
                <View style={styles.idFooterTextStack}>
                  <Text style={styles.idFooterNoticeTitle}>Need Complete Citizen ID Verification?</Text>
                  <Text style={styles.idFooterNoticeSub}>
                    To finish full details, submit documents & get your official ID, visit Citizen Services.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.finishIdBtn}
                  onPress={() => router.push('/(tabs)/services' as any)}
                  activeOpacity={0.85}>
                  <Text style={styles.finishIdBtnText}>Complete Citizen ID in Services</Text>
                  <IconSymbol name="chevron.right" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* TAB CONTENT: 2. SETTINGS & SECURITY */}
        {activeTab === 'settings' && (
          <View style={styles.sectionStack}>
            {/* Account & Security */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Security & Biometrics</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingTextStack}>
                  <Text style={styles.settingLabel}>Biometric Sign-In</Text>
                  <Text style={styles.settingSub}>Use Fingerprint or Face ID for fast login</Text>
                </View>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={setBiometricsEnabled}
                  trackColor={{ false: '#CBD5E1', true: '#176B87' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.infoDivider} />

              <TouchableOpacity
                style={styles.settingActionRow}
                onPress={() => setIsChangePasswordModalVisible(true)}
                activeOpacity={0.7}>
                <View style={styles.settingLeftIcon}>
                  <IconSymbol name="lock.fill" size={18} color="#176B87" />
                  <Text style={styles.settingActionText}>Change Account Password</Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Notifications */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Notifications & Alerts</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingTextStack}>
                  <Text style={styles.settingLabel}>City In-App Notifications</Text>
                  <Text style={styles.settingSub}>
                    Preference for civic updates shown inside CIVENTRAL; phone push is not enabled
                  </Text>
                </View>
                <Switch
                  value={pushNotificationsEnabled}
                  onValueChange={setPushNotificationsEnabled}
                  trackColor={{ false: '#CBD5E1', true: '#176B87' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.settingRow}>
                <View style={styles.settingTextStack}>
                  <Text style={styles.settingLabel}>Emergency In-App Alerts</Text>
                  <Text style={styles.settingSub}>
                    Preference for emergency alerts shown inside CIVENTRAL; phone push is not enabled
                  </Text>
                </View>
                <Switch
                  value={sosAlertsEnabled}
                  onValueChange={setSosAlertsEnabled}
                  trackColor={{ false: '#CBD5E1', true: '#DC2626' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* App Info & Legal */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Support & About</Text>

              <TouchableOpacity
                style={styles.settingActionRow}
                onPress={() => Alert.alert('City Hall Support Hotline', 'Connecting to Caloocan City Citizen Desk: (02) 8888-CALOOCAN')}
                activeOpacity={0.7}>
                <View style={styles.settingLeftIcon}>
                  <IconSymbol name="help.circle.fill" size={18} color="#176B87" />
                  <Text style={styles.settingActionText}>City Hall Citizen Help Desk</Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color="#94A3B8" />
              </TouchableOpacity>

              <View style={styles.infoDivider} />

              <View style={styles.settingActionRow}>
                <View style={styles.settingLeftIcon}>
                  <IconSymbol name="shield.fill" size={18} color="#64748B" />
                  <Text style={styles.settingActionText}>Privacy & Data Protection Policy</Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color="#94A3B8" />
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.versionRow}>
                <Text style={styles.versionLabel}>Civentral Citizen App</Text>
                <Text style={styles.versionValue}>v2.4.1 (Build 2026)</Text>
              </View>
            </View>

            {/* Sign Out / Exit Guest Mode Button */}
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={handleSignOut}
              activeOpacity={0.85}>
              <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color="#EF4444" />
              <Text style={styles.signOutBtnText}>
                {isGuestMode ? 'Exit Guest Mode / Sign In' : 'Log Out of CIVentral'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* MODAL 1: QR CODE FULLSCREEN */}
      <Modal
        visible={isQrModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsQrModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContainer}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Civentral Resident Pass</Text>
              <TouchableOpacity
                onPress={() => setIsQrModalVisible(false)}
                activeOpacity={0.7}
                style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.qrCodeBox}>
              <IconSymbol name="qrcode" size={180} color="#0F172A" />
            </View>

            <Text style={styles.qrCitizenName}>{userProfile.fullName || 'Citizen Resident'}</Text>
            <Text style={styles.qrCitizenId}>{userProfile.citizenId || 'CITIZEN-PASS'}</Text>
            <Badge
              label={isGuestMode ? 'GUEST PASS • CALOOCAN CITY' : 'ACTIVE RESIDENT • CALOOCAN CITY'}
              variant={isGuestMode ? 'neutral' : 'success'}
            />

            <Text style={styles.qrInstruction}>
              Scan this QR code at City Hall entry points, Barangay Health Centers, or Civic Service counters.
            </Text>

            <TouchableOpacity
              style={styles.qrCloseActionBtn}
              onPress={() => setIsQrModalVisible(false)}
              activeOpacity={0.85}>
              <Text style={styles.qrCloseActionText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: LOGOUT CONFIRMATION */}
      <Modal
        visible={isLogoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLogoutModalVisible(false)}>
        <View style={styles.logoutOverlay}>
          <View style={styles.logoutCard}>

            {/* Warning Icon Ring */}
            <View style={styles.logoutIconRing}>
              <IconSymbol name="rectangle.portrait.and.arrow.right" size={32} color="#DC2626" />
            </View>

            {/* Header Text */}
            <Text style={styles.logoutTitle}>Sign Out of CIVentral?</Text>
            <Text style={styles.logoutSubtitle}>
              You are about to leave your secure citizen session. You will need to sign in again to access your government services.
            </Text>

            {/* Citizen Info Preview Strip */}
            <View style={styles.logoutCitizenStrip}>
              <View style={styles.logoutCitizenAvatar}>
                <Text style={styles.logoutCitizenAvatarText}>{userProfile.initials || 'CR'}</Text>
              </View>
              <View style={styles.logoutCitizenInfo}>
                <Text style={styles.logoutCitizenName}>{userProfile.fullName || 'Citizen Resident'}</Text>
                <Text style={styles.logoutCitizenId}>{userProfile.citizenId || 'CALOOCAN CITY RESIDENT'}</Text>
              </View>
              <View style={styles.logoutActiveBadge}>
                <View style={styles.logoutActiveDot} />
                <Text style={styles.logoutActiveLabel}>ACTIVE</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.logoutActionsCol}>
              <TouchableOpacity
                style={styles.logoutConfirmBtn}
                onPress={handleConfirmLogout}
                activeOpacity={0.88}>
                <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color="#FFFFFF" />
                <Text style={styles.logoutConfirmText}>Yes, Sign Me Out</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logoutCancelBtn}
                onPress={() => setIsLogoutModalVisible(false)}
                activeOpacity={0.7}>
                <Text style={styles.logoutCancelText}>Keep Me Signed In</Text>
              </TouchableOpacity>
            </View>

            {/* Footer Security Notice */}
            <View style={styles.logoutFooterNote}>
              <IconSymbol name="shield.fill" size={12} color="#94A3B8" />
              <Text style={styles.logoutFooterText}>  Secured by Caloocan City E-Governance Portal</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: EDIT PROFILE */}
      <Modal
        visible={isEditProfileModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditProfileModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContainer}>
            <Text style={styles.modalHeaderTitle}>Update Contact Details</Text>
            <Text style={styles.modalHeaderSub}>
              Ensure your email, mobile number, and address are up to date.
            </Text>

            <Text style={styles.inputLabel}>Mobile Number</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. +63 917 123 4567"
              placeholderTextColor="#94A3B8"
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
            />

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Email Address</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter email"
              placeholderTextColor="#94A3B8"
              value={editEmail}
              onChangeText={setEditEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Registered Address</Text>
            <TextInput
              style={[styles.modalInput, { height: 60 }]}
              placeholder="Enter complete residential address"
              placeholderTextColor="#94A3B8"
              value={editAddress}
              onChangeText={setEditAddress}
              multiline
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditProfileModalVisible(false)}
                activeOpacity={0.7}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveProfile}
                disabled={isSaving}
                activeOpacity={0.85}>
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: CHANGE PASSWORD */}
      <Modal
        visible={isChangePasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsChangePasswordModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidOverlay}>
          <View style={styles.modalOverlay}>
            <View style={styles.changePasswordModalContainer}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.changePasswordScrollContent}>
                
                <Text style={styles.modalHeaderTitle}>Change Account Password</Text>
                <Text style={styles.modalHeaderSub}>
                  Protect your citizen account by setting a new strong password.
                </Text>

                {/* Current Password Field */}
                <Text style={styles.inputLabel}>Current Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter current password"
                    placeholderTextColor="#94A3B8"
                    value={currentPassword}
                    onChangeText={(text) => {
                      setCurrentPassword(text);
                      if (changePasswordErrorMessage) setChangePasswordErrorMessage(null);
                    }}
                    secureTextEntry={!isCurrentPasswordVisible}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeIconBtn}
                    onPress={() => setIsCurrentPasswordVisible((prev) => !prev)}
                    activeOpacity={0.7}>
                    <IconSymbol
                      name={isCurrentPasswordVisible ? 'eye.slash.fill' : 'eye.fill'}
                      size={18}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                {/* New Password Field */}
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>New Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter new password"
                    placeholderTextColor="#94A3B8"
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      if (changePasswordErrorMessage) setChangePasswordErrorMessage(null);
                    }}
                    secureTextEntry={!isNewPasswordVisible}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeIconBtn}
                    onPress={() => setIsNewPasswordVisible((prev) => !prev)}
                    activeOpacity={0.7}>
                    <IconSymbol
                      name={isNewPasswordVisible ? 'eye.slash.fill' : 'eye.fill'}
                      size={18}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                {/* REAL-TIME PASSWORD STRENGTH METER */}
                {newPassword.length > 0 && (
                  <View style={styles.strengthMeterContainer}>
                    {/* 3 Color Bars */}
                    <View style={styles.strengthBarRow}>
                      <View
                        style={[
                          styles.strengthBar,
                          newStrengthLevel === 'weak' && styles.barWeak,
                          newStrengthLevel === 'medium' && styles.barMedium,
                          newStrengthLevel === 'strong' && styles.barStrong,
                        ]}
                      />
                      <View
                        style={[
                          styles.strengthBar,
                          newStrengthLevel === 'medium' && styles.barMedium,
                          newStrengthLevel === 'strong' && styles.barStrong,
                        ]}
                      />
                      <View
                        style={[
                          styles.strengthBar,
                          newStrengthLevel === 'strong' && styles.barStrong,
                        ]}
                      />
                    </View>

                    {/* Strength Label & Status */}
                    <View style={styles.strengthLabelRow}>
                      <Text style={styles.strengthPromptText}>Password Strength:</Text>
                      <Text
                        style={[
                          styles.strengthText,
                          newStrengthLevel === 'weak' && styles.textWeak,
                          newStrengthLevel === 'medium' && styles.textMedium,
                          newStrengthLevel === 'strong' && styles.textStrong,
                        ]}>
                        {newStrengthLevel.toUpperCase()}
                      </Text>
                    </View>

                    {/* Password Criteria Checklist */}
                    <View style={styles.checklistContainer}>
                      <View style={styles.checkItem}>
                        <IconSymbol
                          name={newHasMinLength ? 'checkmark.seal.fill' : 'chevron.right'}
                          size={14}
                          color={newHasMinLength ? '#10B981' : '#94A3B8'}
                        />
                        <Text style={[styles.checkText, newHasMinLength && styles.checkTextActive]}>
                          At least 8 characters
                        </Text>
                      </View>

                      <View style={styles.checkItem}>
                        <IconSymbol
                          name={newHasUpper && newHasLower ? 'checkmark.seal.fill' : 'chevron.right'}
                          size={14}
                          color={newHasUpper && newHasLower ? '#10B981' : '#94A3B8'}
                        />
                        <Text style={[styles.checkText, newHasUpper && newHasLower && styles.checkTextActive]}>
                          Uppercase & lowercase letters
                        </Text>
                      </View>

                      <View style={styles.checkItem}>
                        <IconSymbol
                          name={newHasNumber ? 'checkmark.seal.fill' : 'chevron.right'}
                          size={14}
                          color={newHasNumber ? '#10B981' : '#94A3B8'}
                        />
                        <Text style={[styles.checkText, newHasNumber && styles.checkTextActive]}>
                          At least 1 number (0-9)
                        </Text>
                      </View>

                      <View style={styles.checkItem}>
                        <IconSymbol
                          name={newHasSymbol ? 'checkmark.seal.fill' : 'chevron.right'}
                          size={14}
                          color={newHasSymbol ? '#10B981' : '#94A3B8'}
                        />
                        <Text style={[styles.checkText, newHasSymbol && styles.checkTextActive]}>
                          At least 1 special symbol (!@#$%^&*)
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Confirm New Password Field */}
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Confirm New Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Confirm new password"
                    placeholderTextColor="#94A3B8"
                    value={confirmNewPassword}
                    onChangeText={(text) => {
                      setConfirmNewPassword(text);
                      if (changePasswordErrorMessage) setChangePasswordErrorMessage(null);
                    }}
                    secureTextEntry={!isConfirmNewPasswordVisible}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeIconBtn}
                    onPress={() => setIsConfirmNewPasswordVisible((prev) => !prev)}
                    activeOpacity={0.7}>
                    <IconSymbol
                      name={isConfirmNewPasswordVisible ? 'eye.slash.fill' : 'eye.fill'}
                      size={18}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                {/* Error Message */}
                {changePasswordErrorMessage ? (
                  <Text style={styles.changePasswordErrorText}>{changePasswordErrorMessage}</Text>
                ) : null}

                {/* Modal Actions */}
                <View style={[styles.modalActionsRow, { marginTop: 16 }]}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => {
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmNewPassword('');
                      setChangePasswordErrorMessage(null);
                      setIsChangePasswordModalVisible(false);
                    }}
                    activeOpacity={0.7}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalSaveBtn,
                      (isChangingPassword || newStrengthLevel !== 'strong' || newPassword !== confirmNewPassword) && styles.modalSaveBtnDisabled,
                    ]}
                    onPress={handleChangePassword}
                    disabled={isChangingPassword || newStrengthLevel !== 'strong' || newPassword !== confirmNewPassword}
                    activeOpacity={0.85}>
                    {isChangingPassword ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.modalSaveText}>Update Password</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 4: SUCCESS TOAST POPUP */}
      <Modal
        visible={isSuccessToastVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSuccessToastVisible(false)}>
        <View style={styles.successToastOverlay}>
          <View style={styles.successToastCard}>
            <View style={styles.successToastCheckCircle}>
              <IconSymbol name="checkmark.seal.fill" size={38} color="#FFFFFF" />
            </View>
            <Text style={styles.successToastTitle}>Password Updated</Text>
            <Text style={styles.successToastSub}>
              Your account password has been changed successfully.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  loadingBox: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#176B87',
    fontWeight: '600',
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#176B87',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  onlineBadgeDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  guestBadgeDot: {
    backgroundColor: '#94A3B8',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  citizenIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#176B87',
    marginTop: 2,
  },
  barangayText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  qrHeaderBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  qrBtnLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#176B87',
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    marginTop: 14,
    alignItems: 'center',
  },
  badgeSpacer: {
    width: 8,
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 3,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#176B87',
    fontWeight: '800',
  },
  sectionStack: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 8,
  },
  editIconBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  editText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#176B87',
    marginLeft: 4,
  },
  infoGrid: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoContent: {
    marginLeft: 10,
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 1,
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  twoColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  columnHalf: {
    flex: 1,
  },

  /* Digital Citizen ID Preview Styles (Bottom of Personal Info) */
  citizenIdCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 4,
  },
  citizenIdHeader: {
    backgroundColor: '#0F4C61',
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  idHeaderRow: {
    alignItems: 'center',
  },
  idRepublicText: {
    fontSize: 9,
    color: '#CBD5E1',
    fontWeight: '700',
    letterSpacing: 1,
  },
  idCityText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  idCardTitle: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  idBodyRow: {
    flexDirection: 'row',
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  idPhotoBox: {
    width: 64,
    height: 74,
    backgroundColor: '#176B87',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  idPhotoText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  idCheckBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 2,
  },
  idInfoCol: {
    marginLeft: 14,
    flex: 1,
  },
  idLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '700',
  },
  idValueName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  idValueHighlight: {
    fontSize: 12,
    fontWeight: '800',
    color: '#176B87',
  },
  idValueSub: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  idFooterBanner: {
    backgroundColor: '#F0F9FF',
    borderTopWidth: 1,
    borderColor: '#BAE6FD',
    padding: 14,
    gap: 10,
  },
  idFooterTextStack: {
    flexDirection: 'column',
  },
  idFooterNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  idFooterNoticeSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
  },
  finishIdBtn: {
    backgroundColor: '#176B87',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  finishIdBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Settings Tab */
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingTextStack: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  settingSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  settingActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLeftIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginLeft: 10,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  versionLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  versionValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 8,
    gap: 8,
  },
  signOutBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  qrModalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '700',
  },
  qrCodeBox: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  qrCitizenName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  qrCitizenId: {
    fontSize: 13,
    fontWeight: '700',
    color: '#176B87',
    marginBottom: 8,
  },
  qrInstruction: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  qrCloseActionBtn: {
    backgroundColor: '#176B87',
    borderRadius: 14,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  qrCloseActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  editModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalHeaderSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: '#0F172A',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modalSaveBtn: {
    flex: 1.5,
    backgroundColor: '#176B87',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* ── LOGOUT MODAL STYLES ── */
  logoutOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 20, 40, 0.72)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  logoutCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoutIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoutTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  logoutSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  logoutCitizenStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    width: '100%',
    marginBottom: 24,
  },
  logoutCitizenAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#165B7E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoutCitizenAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  logoutCitizenInfo: {
    flex: 1,
  },
  logoutCitizenName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  logoutCitizenId: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  logoutActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  logoutActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 4,
  },
  logoutActiveLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  logoutActionsCol: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  logoutConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 15,
    gap: 8,
  },
  logoutConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 15,
  },
  logoutCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  logoutFooterNote: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutFooterText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },

  /* ── CHANGE PASSWORD MODAL STYLES ── */
  changePasswordModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxHeight: '90%',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 10,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#0F172A',
  },
  eyeIconBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.7,
  },
  changePasswordErrorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 6,
  },

  /* Strength Meter Styles */
  strengthMeterContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  strengthBarRow: {
    flexDirection: 'row',
    gap: 6,
    height: 6,
    marginBottom: 8,
  },
  strengthBar: {
    flex: 1,
    height: '100%',
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
  },
  barWeak: {
    backgroundColor: '#EF4444',
  },
  barMedium: {
    backgroundColor: '#F59E0B',
  },
  barStrong: {
    backgroundColor: '#10B981',
  },
  strengthLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  strengthPromptText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '800',
  },
  textWeak: {
    color: '#EF4444',
  },
  textMedium: {
    color: '#F59E0B',
  },
  textStrong: {
    color: '#10B981',
  },
  checklistContainer: {
    gap: 6,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  checkTextActive: {
    color: '#334155',
  },
  keyboardAvoidOverlay: {
    flex: 1,
    width: '100%',
  },
  changePasswordScrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  successToastOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  successToastCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    width: '85%',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 15,
  },
  successToastCheckCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  successToastTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  successToastSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
