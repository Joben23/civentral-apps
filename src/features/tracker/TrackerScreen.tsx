import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Badge } from '@/src/components/ui/Badge';
import { CivicApiService } from '@/src/services/api';
import { DomainApplication } from '@/types/domain';

export function TrackerScreen() {
  const router = useRouter();

  // States
  const [applications, setApplications] = useState<DomainApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'All' | 'Under Review' | 'Approved' | 'Completed'>('All');

  // Modal State for Selected Application Timeline Details
  const [selectedApp, setSelectedApp] = useState<DomainApplication | null>(null);

  // Fetch Applications
  const fetchApplications = async () => {
    const data = await CivicApiService.getApplications();
    setApplications(data);
  };

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      await fetchApplications();
      setIsLoading(false);
    }
    loadData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchApplications();
    setIsRefreshing(false);
  };

  // Filtered Applications List
  const filteredApps = applications.filter((app) => {
    const matchesFilter = selectedFilter === 'All' || app.status === selectedFilter;
    const matchesQuery =
      searchQuery.trim() === '' ||
      app.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.serviceTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'info';
      case 'Completed':
        return 'success';
      case 'Under Review':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#176B87" />
        }>

        {/* Header Stack */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Application Tracker</Text>
          <Text style={styles.headerSubtitle}>
            Monitor live status, review milestones & processing timelines for your civic permits and requests.
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <IconSymbol name="magnifyingglass" size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Application ID or Service..."
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

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}>
          {(['All', 'Under Review', 'Approved', 'Completed'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterPill, selectedFilter === filter && styles.filterPillActive]}
              onPress={() => setSelectedFilter(filter)}
              activeOpacity={0.8}>
              <Text style={[styles.filterPillText, selectedFilter === filter && styles.filterPillTextActive]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isLoading && !isRefreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#176B87" />
            <Text style={styles.loadingText}>Fetching tracked applications...</Text>
          </View>
        ) : null}

        {/* Applications List */}
        {!isLoading && filteredApps.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <IconSymbol name="doc.text.fill" size={32} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No Tracked Applications</Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? `No applications matching "${searchQuery}" found.`
                : 'You currently have no active permit or document requests being tracked.'}
            </Text>
            <TouchableOpacity
              style={styles.applyCtaBtn}
              onPress={() => router.push('/(tabs)/services')}
              activeOpacity={0.85}>
              <Text style={styles.applyCtaText}>Apply for Civic Service</Text>
              <IconSymbol name="chevron.right" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.appsStack}>
            {filteredApps.map((app) => (
              <TouchableOpacity
                key={app.id}
                style={styles.appCard}
                onPress={() => setSelectedApp(app)}
                activeOpacity={0.88}>
                {/* Card Top Row */}
                <View style={styles.cardTopRow}>
                  <View style={styles.appIdBadge}>
                    <IconSymbol name="doc.text.fill" size={14} color="#176B87" />
                    <Text style={styles.appIdText}>{app.id}</Text>
                  </View>
                  <Badge label={app.status.toUpperCase()} variant={getStatusVariant(app.status)} />
                </View>

                {/* Service Title */}
                <Text style={styles.appTitleText}>{app.serviceTitle}</Text>

                {/* Timeline Progress Bar Summary */}
                <View style={styles.timelineSummaryBox}>
                  <View style={styles.timelineStepRow}>
                    <View style={[styles.timelineDot, styles.timelineDotDone]} />
                    <View
                      style={[
                        styles.timelineLine,
                        app.status !== 'Under Review' ? styles.timelineLineDone : null,
                      ]}
                    />
                    <View
                      style={[
                        styles.timelineDot,
                        app.status !== 'Under Review' ? styles.timelineDotDone : styles.timelineDotActive,
                      ]}
                    />
                    <View
                      style={[
                        styles.timelineLine,
                        app.status === 'Completed' ? styles.timelineLineDone : null,
                      ]}
                    />
                    <View
                      style={[
                        styles.timelineDot,
                        app.status === 'Completed' ? styles.timelineDotDone : styles.timelineDotPending,
                      ]}
                    />
                  </View>
                  <View style={styles.timelineLabelsRow}>
                    <Text style={styles.timelineLabelText}>Submitted</Text>

                    <Text
                      style={[
                        styles.timelineLabelText,
                        { textAlign: 'center' },
                        app.status === 'Under Review' && { color: '#176B87', fontWeight: '800' },
                      ]}>
                      In Review
                    </Text>

                    <Text
                      style={[
                        styles.timelineLabelText,
                        { textAlign: 'right' },
                        app.status === 'Completed' && { color: '#16A34A', fontWeight: '800' },
                      ]}>
                      {app.status === 'Completed' ? 'Completed' : 'Release'}
                    </Text>
                  </View>
                </View>

                {/* Card Footer */}
                <View style={styles.cardFooterRow}>
                  <Text style={styles.updatedDateText}>Updated: {app.updatedAt}</Text>
                  <View style={styles.viewTimelineBtn}>
                    <Text style={styles.viewTimelineText}>View Details</Text>
                    <IconSymbol name="chevron.right" size={14} color="#176B87" />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* APPLICATION TIMELINE DETAIL MODAL */}
      <Modal
        visible={selectedApp !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedApp(null)}>
        <View style={styles.modalOverlay}>
          {selectedApp ? (
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <View>
                  <Text style={styles.modalIdText}>{selectedApp.id}</Text>
                  <Text style={styles.modalTitleText}>{selectedApp.serviceTitle}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedApp(null)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalBadgeRow}>
                <Badge label={selectedApp.status.toUpperCase()} variant={getStatusVariant(selectedApp.status)} />
                <Text style={styles.modalSubmittedText}>Filed on {selectedApp.createdAt}</Text>
              </View>

              <View style={styles.modalDivider} />

              <Text style={styles.timelineHeaderTitle}>Processing Milestones</Text>

              {/* Step 1 */}
              <View style={styles.milestoneRow}>
                <View style={styles.milestoneIconDone}>
                  <IconSymbol name="checkmark.seal.fill" size={16} color="#FFFFFF" />
                </View>
                <View style={styles.milestoneContent}>
                  <Text style={styles.milestoneTitle}>1. Application Received & Encoded</Text>
                  <Text style={styles.milestoneSub}>Application data recorded on {selectedApp.createdAt}</Text>
                </View>
              </View>

              {/* Step 2 */}
              <View style={styles.milestoneRow}>
                <View
                  style={
                    selectedApp.status === 'Under Review'
                      ? styles.milestoneIconActive
                      : styles.milestoneIconDone
                  }>
                  <IconSymbol
                    name={selectedApp.status === 'Under Review' ? 'pencil' : 'checkmark.seal.fill'}
                    size={16}
                    color="#FFFFFF"
                  />
                </View>
                <View style={styles.milestoneContent}>
                  <Text style={styles.milestoneTitle}>2. Document Verification & Evaluation</Text>
                  <Text style={styles.milestoneSub}>
                    {selectedApp.status === 'Under Review'
                      ? 'Currently being evaluated by Department Officer'
                      : `Verified & Approved on ${selectedApp.updatedAt}`}
                  </Text>
                </View>
              </View>

              {/* Step 3 */}
              <View style={styles.milestoneRow}>
                <View
                  style={
                    selectedApp.status === 'Completed'
                      ? styles.milestoneIconDone
                      : selectedApp.status === 'Approved'
                      ? styles.milestoneIconActive
                      : styles.milestoneIconPending
                  }>
                  <IconSymbol
                    name={selectedApp.status === 'Completed' ? 'checkmark.seal.fill' : 'doc.text.fill'}
                    size={16}
                    color={selectedApp.status === 'Under Review' ? '#94A3B8' : '#FFFFFF'}
                  />
                </View>
                <View style={styles.milestoneContent}>
                  <Text style={styles.milestoneTitle}>3. Official E-Permit Release / Completion</Text>
                  <Text style={styles.milestoneSub}>
                    {selectedApp.status === 'Completed'
                      ? 'Digital Clearance Issued & Archived'
                      : selectedApp.status === 'Approved'
                      ? 'Approved. Final clearance ready for download'
                      : 'Pending completion of document review'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.doneModalBtn}
                onPress={() => setSelectedApp(null)}
                activeOpacity={0.85}>
                <Text style={styles.doneModalBtnText}>Close Tracker Details</Text>
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
    paddingTop: 16,
    paddingBottom: 110,
  },
  headerContainer: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
  filterScroll: {
    gap: 8,
    paddingBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#176B87',
    borderColor: '#0F4C61',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#176B87',
    fontWeight: '600',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  applyCtaBtn: {
    backgroundColor: '#176B87',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  applyCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  appsStack: {
    gap: 12,
  },
  appCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  appIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 6,
  },
  appIdText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#176B87',
  },
  appTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  timelineSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 12,
  },
  timelineStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineDotDone: {
    backgroundColor: '#16A34A',
  },
  timelineDotActive: {
    backgroundColor: '#176B87',
  },
  timelineDotPending: {
    backgroundColor: '#CBD5E1',
  },
  timelineLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
  },
  timelineLineDone: {
    backgroundColor: '#16A34A',
  },
  timelineLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timelineLabelText: {
    fontSize: 10,
    color: '#64748B',
    flex: 1,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 10,
  },
  updatedDateText: {
    fontSize: 11,
    color: '#64748B',
  },
  viewTimelineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewTimelineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#176B87',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalIdText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#176B87',
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '700',
  },
  modalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalSubmittedText: {
    fontSize: 11,
    color: '#64748B',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  timelineHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  milestoneIconDone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneIconActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#176B87',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneIconPending: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneContent: {
    marginLeft: 12,
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  milestoneSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  doneModalBtn: {
    backgroundColor: '#176B87',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  doneModalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
