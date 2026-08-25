import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
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

export interface AnnouncementItem {
  id: string;
  category: 'EMERGENCY ADVISORY' | 'COMMUNITY BROADCAST' | 'CIVIC NOTICE';
  badgeVariant: 'danger' | 'info' | 'success';
  title: string;
  date: string;
  summary: string;
  fullBody: string;
  department: string;
}

const INITIAL_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'ANC-101',
    category: 'EMERGENCY ADVISORY',
    badgeVariant: 'danger',
    title: 'Heavy Rainfall Advisory - DRRM Command Center',
    date: 'July 27, 2026',
    summary: 'Caloocan DRRM Command Center issued heavy rainfall alert for Barangay Central. Emergency response teams deployed.',
    fullBody: 'The Caloocan Disaster Risk Reduction and Management (DRRM) Office has raised Alert Level 2 due to heavy monsoon rains. Emergency evacuation shelters at Barangay Covered Courts are open. For emergency rescue, tap the SOS button or call hotline (02) 8888-CALOOCAN.',
    department: 'Caloocan DRRM Command Center',
  },
  {
    id: 'ANC-102',
    category: 'COMMUNITY BROADCAST',
    badgeVariant: 'info',
    title: 'Free Mobile Health & Vaccination Clinic in Barangay 171',
    date: 'July 26, 2026',
    summary: 'Free health checkups, dental services, and childhood vaccinations scheduled at Barangay 171 Covered Court this Friday.',
    fullBody: 'The City Health Department invites all residents of Barangay 171 to the free Mobile Health Caravan on Friday from 8:00 AM to 4:00 PM. Free services include general consultations, blood pressure checks, pediatric checkups, and flu vaccinations.',
    department: 'City Health Department',
  },
  {
    id: 'ANC-103',
    category: 'CIVIC NOTICE',
    badgeVariant: 'success',
    title: 'Online Business Permit Renewal Fast-Track Portal Open',
    date: 'July 25, 2026 • 2 days ago',
    summary: 'Caloocan City Treasury launches instant digital clearance processing for Q3 business permit renewals.',
    fullBody: 'Business owners can now apply for, renew, and pay Q3 business permits completely online via CIVentral. Approved e-permits with official QR verification will be issued within 24 hours of payment clearance.',
    department: 'Business Permits & Licensing Office (BPLO)',
  },
];

export function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ isGuest?: string; email?: string; citizenUserId?: string }>();

  // Active Session & Guest Status
  const session = AuthService.getCurrentUser();
  const activeEmail = params.email || session.email || '';
  const activeUserId = params.citizenUserId ? parseInt(params.citizenUserId, 10) : session.citizen_user_id || undefined;
  const isGuestMode = params.isGuest === 'true' || (!activeEmail && !activeUserId && !session.email);

  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(!isGuestMode);

  // User Profile State
  const [userProfile, setUserProfile] = useState<CitizenProfileData>({
    citizen_user_id: activeUserId || 0,
    first_name: isGuestMode ? 'Guest' : '',
    middle_name: '',
    last_name: isGuestMode ? 'Resident' : '',
    suffix: '',
    fullName: isGuestMode ? 'Guest Resident' : 'Active Citizen',
    initials: isGuestMode ? 'GR' : 'AC',
    email: activeEmail || (isGuestMode ? 'guest@caloocan.gov.ph' : ''),
    phone: '',
    address: '',
    city: 'Caloocan City',
    barangay: '',
    birthDate: '',
    civilStatus: 'Registered Resident',
    citizenId: activeUserId ? `CIV-2026-${String(activeUserId).padStart(5, '0')}` : isGuestMode ? 'CIV-GUEST-2026' : 'CIV-2026-00001',
    status: isGuestMode ? 'Guest' : 'Active',
    isVerified: true,
    registryCompleted: true,
    biometricEnabled: false,
    memberSince: '2026',
    lastLogin: isGuestMode ? 'Current Session (Guest Mode)' : 'Just Now',
  });

  // Modal States
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementItem | null>(null);
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);

  // Fetch Profile Data
  const loadProfile = async () => {
    if (isGuestMode) return;
    const emailToUse = activeEmail || userProfile.email;
    const res = await ProfileService.getProfile(emailToUse, activeUserId || userProfile.citizen_user_id);
    if (res.status === 'success' && res.data) {
      const data = res.data;
      setUserProfile((prev) => ({
        ...prev,
        ...data,
        status: data.status || 'Active',
      }));
    }
  };

  useEffect(() => {
    async function initData() {
      if (isGuestMode) {
        setIsLoadingProfile(false);
        return;
      }
      setIsLoadingProfile(true);
      await loadProfile();
      setIsLoadingProfile(false);
    }
    initData();
  }, [isGuestMode, activeEmail, activeUserId]);

  const handleRefresh = async () => {
    if (isGuestMode) return;
    setIsRefreshing(true);
    await loadProfile();
    setIsRefreshing(false);
  };

  // Filter announcements based on search
  const filteredAnnouncements = INITIAL_ANNOUNCEMENTS.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      item.summary.toLowerCase().includes(query) ||
      item.department.toLowerCase().includes(query)
    );
  });

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



        {/* SECTION 1: CITIZEN PROFILE CARD */}
        <View style={styles.profileCard}>
          <View style={styles.profileCardHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{userProfile.initials || (isGuestMode ? 'GR' : 'AC')}</Text>
              <View style={[styles.avatarStatusDot, isGuestMode && styles.guestStatusDot]} />
            </View>

            <View style={styles.profileInfoStack}>
              <View style={styles.nameRow}>
                <Text style={styles.profileNameText}>{userProfile.fullName || 'Citizen Resident'}</Text>
              </View>
              <Text style={styles.profileIdText}>ID: {userProfile.citizenId || 'Pending Generation'}</Text>
              <Text style={styles.profileLocationText}>
                📍 {userProfile.barangay ? `${userProfile.barangay}, Caloocan City` : 'Caloocan City Resident'}
              </Text>
            </View>

            {/* Mini QR Button */}
            <TouchableOpacity
              style={styles.miniQrBtn}
              onPress={() => setIsQrModalVisible(true)}
              activeOpacity={0.8}>
              <IconSymbol name="qrcode" size={24} color="#176B87" />
              <Text style={styles.miniQrText}>QR ID</Text>
            </TouchableOpacity>
          </View>

          {/* Card Footer Badges */}
          <View style={styles.profileCardFooter}>
            <Badge
              label={isGuestMode ? 'GUEST USER' : `${(userProfile.status || 'Active').toUpperCase()} RESIDENT`}
              variant={isGuestMode ? 'neutral' : 'success'}
            />
            <Badge
              label={isGuestMode ? 'TEMPORARY SESSION' : 'OFFICIAL DIGITAL PASS'}
              variant="info"
            />
          </View>
        </View>

        {/* SECTION 2: SEARCH BAR */}
        <View style={styles.searchSection}>
          <View style={styles.searchBarBox}>
            <IconSymbol name="magnifyingglass" size={20} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search services, permits, announcements..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* PUBLIC DRRM WARNINGS */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open active emergency warnings"
          style={styles.emergencyWarningsCard}
          onPress={() => router.push('/emergency/warnings' as any)}
          activeOpacity={0.84}>
          <View style={styles.emergencyWarningsIcon}>
            <IconSymbol name="exclamationmark.triangle.fill" size={22} color="#B91C1C" />
          </View>
          <View style={styles.emergencyWarningsCopy}>
            <Text style={styles.emergencyWarningsTitle}>Emergency Alerts</Text>
            <Text style={styles.emergencyWarningsSub}>
              View active CIVENTRAL DRRM warnings for Caloocan City
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={18} color="#B91C1C" />
        </TouchableOpacity>

        {/* SECTION 3: 6 QUICK SERVICES GRID (6TH IS SEE ALL SERVICES) */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>Quick Municipal Services</Text>
            <Text style={styles.sectionSubtitle}>Fast-track civic access & online processing</Text>
          </View>
        </View>

        <View style={styles.servicesGrid}>
          {/* Service 1: Barangay Clearance */}
          <TouchableOpacity
            style={styles.serviceGridCard}
            onPress={() => router.push('/(tabs)/services')}
            activeOpacity={0.8}>
            <View style={[styles.serviceIconCircle, { backgroundColor: '#E0F2FE' }]}>
              <IconSymbol name="person.text.rectangle.fill" size={22} color="#0284C7" />
            </View>
            <Text style={styles.serviceTitle} numberOfLines={2}>Barangay Clearance</Text>
            <Text style={styles.serviceSub} numberOfLines={1}>E-Clearance & ID</Text>
          </TouchableOpacity>

          {/* Service 2: Business Permit */}
          <TouchableOpacity
            style={styles.serviceGridCard}
            onPress={() => router.push('/(tabs)/services')}
            activeOpacity={0.8}>
            <View style={[styles.serviceIconCircle, { backgroundColor: '#E0E7FF' }]}>
              <IconSymbol name="briefcase.fill" size={22} color="#4338CA" />
            </View>
            <Text style={styles.serviceTitle} numberOfLines={2}>Business Permit</Text>
            <Text style={styles.serviceSub} numberOfLines={1}>New & Renewals</Text>
          </TouchableOpacity>

          {/* Service 3: Real Property Tax */}
          <TouchableOpacity
            style={styles.serviceGridCard}
            onPress={() => router.push('/(tabs)/services')}
            activeOpacity={0.8}>
            <View style={[styles.serviceIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <IconSymbol name="house.fill" size={22} color="#15803D" />
            </View>
            <Text style={styles.serviceTitle} numberOfLines={2}>Real Property Tax</Text>
            <Text style={styles.serviceSub} numberOfLines={1}>RPT Billing & Pay</Text>
          </TouchableOpacity>

          {/* Service 4: Health & Medical */}
          <TouchableOpacity
            style={styles.serviceGridCard}
            onPress={() => router.push('/(tabs)/services')}
            activeOpacity={0.8}>
            <View style={[styles.serviceIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <IconSymbol name="cross.case.fill" size={22} color="#B91C1C" />
            </View>
            <Text style={styles.serviceTitle} numberOfLines={2}>Health & Medical</Text>
            <Text style={styles.serviceSub} numberOfLines={1}>Barangay Clinics</Text>
          </TouchableOpacity>

          {/* Service 5: Education & Scholarship */}
          <TouchableOpacity
            style={styles.serviceGridCard}
            onPress={() => router.push('/education' as any)}
            activeOpacity={0.8}>
            <View style={[styles.serviceIconCircle, { backgroundColor: '#F3E8FF' }]}>
              <IconSymbol name="book.closed.fill" size={22} color="#7E22CE" />
            </View>
            <Text style={styles.serviceTitle} numberOfLines={2}>Education & Scholarship</Text>
            <Text style={styles.serviceSub} numberOfLines={1}>Grants & Allowance</Text>
          </TouchableOpacity>

          {/* SERVICE 6: SEE ALL SERVICES BUTTON (SPECIAL ACCENT CTA) */}
          <TouchableOpacity
            style={[styles.serviceGridCard, styles.seeAllCard]}
            onPress={() => router.push('/(tabs)/services')}
            activeOpacity={0.85}>
            <View style={styles.seeAllIconCircle}>
              <IconSymbol name="square.grid.2x2.fill" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.seeAllTitle}>See All Services</Text>
            <View style={styles.seeAllArrowRow}>
              <Text style={styles.seeAllSub}>Explore 50+ Services</Text>
              <IconSymbol name="chevron.right" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* SECTION 4: ANNOUNCEMENTS & NEWS */}
        <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>City Announcements & Advisories</Text>
            <Text style={styles.sectionSubtitle}>Official updates from Caloocan City Government</Text>
          </View>
        </View>

        <View style={styles.announcementsList}>
          {filteredAnnouncements.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.announcementCard}
              onPress={() => setSelectedAnnouncement(item)}
              activeOpacity={0.85}>
              <View style={styles.announcementTopRow}>
                <Badge label={item.category} variant={item.badgeVariant} />
                <Text style={styles.announcementDateText}>{item.date}</Text>
              </View>

              <Text style={styles.announcementTitleText}>{item.title}</Text>
              <Text style={styles.announcementSummaryText} numberOfLines={2}>
                {item.summary}
              </Text>

              <View style={styles.announcementFooterRow}>
                <Text style={styles.announcementDeptText}>{item.department}</Text>
                <View style={styles.readMoreRow}>
                  <Text style={styles.readMoreText}>Read Announcement</Text>
                  <IconSymbol name="chevron.right" size={14} color="#176B87" />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* MODAL 1: QR CODE RESIDENT PASS */}
      <Modal
        visible={isQrModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsQrModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContainer}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Civentral Resident Pass</Text>
              <TouchableOpacity onPress={() => setIsQrModalVisible(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
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

            <Text style={styles.qrInstructionText}>
              Scan this QR code at City Hall entry checkpoints, Barangay Health Centers, or Civic Service counters.
            </Text>

            <TouchableOpacity
              style={styles.primaryModalBtn}
              onPress={() => setIsQrModalVisible(false)}
              activeOpacity={0.85}>
              <Text style={styles.primaryModalBtnText}>Close Digital Pass</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: ANNOUNCEMENT DETAIL READER */}
      <Modal
        visible={selectedAnnouncement !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAnnouncement(null)}>
        <View style={styles.modalOverlay}>
          {selectedAnnouncement ? (
            <View style={styles.announcementModalContainer}>
              <View style={styles.qrModalHeader}>
                <Badge
                  label={selectedAnnouncement.category}
                  variant={selectedAnnouncement.badgeVariant}
                />
                <TouchableOpacity onPress={() => setSelectedAnnouncement(null)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 380, marginVertical: 12 }}>
                <Text style={styles.ancModalTitle}>{selectedAnnouncement.title}</Text>
                <Text style={styles.ancModalDate}>{selectedAnnouncement.date}</Text>
                <Text style={styles.ancModalDept}>Issued by: {selectedAnnouncement.department}</Text>
                
                <View style={styles.ancModalDivider} />
                
                <Text style={styles.ancModalBody}>{selectedAnnouncement.fullBody}</Text>
              </ScrollView>

              <TouchableOpacity
                style={styles.primaryModalBtn}
                onPress={() => setSelectedAnnouncement(null)}
                activeOpacity={0.85}>
                <Text style={styles.primaryModalBtnText}>Dismiss Announcement</Text>
              </TouchableOpacity>
            </View>
          ) : null}
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
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 110,
  },

  /* Brand Header */
  topBrandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brandLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogoImage: {
    width: 44,
    height: 44,
  },
  brandTitleStack: {
    marginLeft: 10,
  },
  brandRepublicText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
  },
  brandCityText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#176B87',
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  sosCircleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 19,
    gap: 4,
  },
  sosBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Citizen Profile Card */
  profileCard: {
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
  profileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#176B87',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  avatarStatusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  guestStatusDot: {
    backgroundColor: '#94A3B8',
  },
  profileInfoStack: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#176B87',
    marginTop: 1,
  },
  profileLocationText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  miniQrBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  miniQrText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#176B87',
    marginTop: 2,
  },
  profileCardFooter: {
    flexDirection: 'row',
    marginTop: 14,
    alignItems: 'center',
    gap: 8,
  },

  /* Search Section */
  searchSection: {
    marginBottom: 20,
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Public Emergency Warnings */
  emergencyWarningsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F7',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  emergencyWarningsIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyWarningsCopy: {
    flex: 1,
    marginHorizontal: 11,
  },
  emergencyWarningsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  emergencyWarningsSub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginTop: 2,
  },

  /* Section Titles */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  /* 6 Services Grid */
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  serviceGridCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  serviceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  serviceTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 15,
  },
  serviceSub: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },

  /* Service 6 Accent Button */
  seeAllCard: {
    backgroundColor: '#176B87',
    borderColor: '#0F4C61',
  },
  seeAllIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  seeAllTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  seeAllArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 2,
  },
  seeAllSub: {
    fontSize: 9,
    color: '#BAE6FD',
    fontWeight: '700',
  },

  /* Announcements Feed */
  announcementsList: {
    gap: 12,
  },
  announcementCard: {
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
  announcementTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  announcementDateText: {
    fontSize: 11,
    color: '#64748B',
  },
  announcementTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    lineHeight: 19,
  },
  announcementSummaryText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 12,
  },
  announcementFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 10,
  },
  announcementDeptText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
  },
  readMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  readMoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#176B87',
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  qrModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  announcementModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
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
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
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
  qrInstructionText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  primaryModalBtn: {
    backgroundColor: '#176B87',
    borderRadius: 14,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  primaryModalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  ancModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 22,
  },
  ancModalDate: {
    fontSize: 11,
    color: '#64748B',
  },
  ancModalDept: {
    fontSize: 11,
    fontWeight: '700',
    color: '#176B87',
    marginTop: 2,
  },
  ancModalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  ancModalBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
});
