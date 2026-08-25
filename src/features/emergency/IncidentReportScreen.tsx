import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { AuthService } from '@/src/services/auth-service';
import {
  DrrmCitizenIncidentError,
  getCitizenIncidentBarangays,
  submitCitizenIncident,
  validateCitizenIncidentForm,
} from '@/src/services/drrmIncidents';
import type {
  CitizenIncidentBarangay,
  CitizenIncidentErrorCode,
  CitizenIncidentFormErrors,
  CitizenIncidentFormValues,
  CitizenIncidentSubmissionResponse,
  CitizenIncidentType,
} from '@/src/types/drrmIncidents';
import {
  filterIncidentBarangays,
  getIncidentTypeLabel,
  INCIDENT_TYPE_OPTIONS,
} from './incidentPresentation';

const EMPTY_FORM: CitizenIncidentFormValues = {
  incidentType: '',
  title: '',
  description: '',
  barangayId: null,
  locationDescription: '',
};

type BarangayLoadState = 'loading' | 'ready' | 'error';

function submissionErrorTitle(code: CitizenIncidentErrorCode | null): string {
  if (code === 'AUTHENTICATION_REQUIRED') return 'Sign in required';
  if (code === 'RATE_LIMITED') return 'Please wait before retrying';
  if (code === 'DUPLICATE_SUBMISSION') return 'Possible duplicate report';
  if (code === 'INCIDENT_SERVICE_UNAVAILABLE') return 'Service temporarily unavailable';
  return 'Report not submitted';
}

export function IncidentReportScreen() {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [values, setValues] = useState<CitizenIncidentFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<CitizenIncidentFormErrors>({});
  const [isTypeListOpen, setIsTypeListOpen] = useState(false);
  const [barangays, setBarangays] = useState<CitizenIncidentBarangay[]>([]);
  const [barangayLoadState, setBarangayLoadState] = useState<BarangayLoadState>('loading');
  const [isBarangayModalOpen, setIsBarangayModalOpen] = useState(false);
  const [barangaySearch, setBarangaySearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionErrorCode, setSubmissionErrorCode] =
    useState<CitizenIncidentErrorCode | null>(null);
  const [submission, setSubmission] = useState<CitizenIncidentSubmissionResponse | null>(null);

  const loadBarangays = useCallback(async () => {
    setBarangayLoadState('loading');
    try {
      setBarangays(await getCitizenIncidentBarangays());
      setBarangayLoadState('ready');
    } catch {
      setBarangays([]);
      setBarangayLoadState('error');
    }
  }, []);

  useEffect(() => {
    void loadBarangays();
  }, [loadBarangays]);

  const selectedBarangay = useMemo(
    () => barangays.find((barangay) => barangay.barangay_id === values.barangayId) ?? null,
    [barangays, values.barangayId],
  );
  const filteredBarangays = useMemo(
    () => filterIncidentBarangays(barangays, barangaySearch),
    [barangays, barangaySearch],
  );

  const updateValue = <Key extends keyof CitizenIncidentFormValues>(
    key: Key,
    value: CitizenIncidentFormValues[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSubmissionError(null);
    setSubmissionErrorCode(null);
  };

  const selectIncidentType = (incidentType: CitizenIncidentType) => {
    updateValue('incidentType', incidentType);
    setIsTypeListOpen(false);
  };

  const openBarangaySelector = () => {
    if (barangayLoadState !== 'ready' || isSubmitting) return;
    setBarangaySearch('');
    setIsBarangayModalOpen(true);
  };

  const selectBarangay = (barangay: CitizenIncidentBarangay) => {
    updateValue('barangayId', barangay.barangay_id);
    setIsBarangayModalOpen(false);
    setBarangaySearch('');
  };

  const clearBarangay = () => {
    updateValue('barangayId', null);
    setBarangaySearch('');
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;

    const nextErrors = validateCitizenIncidentForm(values);
    setErrors(nextErrors);
    setSubmissionError(null);
    setSubmissionErrorCode(null);
    if (Object.keys(nextErrors).length > 0) return;

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await submitCitizenIncident(values);
      setSubmission(result);
    } catch (error) {
      const safeError =
        error instanceof DrrmCitizenIncidentError
          ? error
          : new DrrmCitizenIncidentError('INCIDENT_SUBMISSION_FAILED');
      setSubmissionError(safeError.message);
      setSubmissionErrorCode(safeError.code);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const startAnotherReport = () => {
    setValues(EMPTY_FORM);
    setErrors({});
    setSubmission(null);
    setSubmissionError(null);
    setSubmissionErrorCode(null);
    setIsTypeListOpen(false);
    setIsBarangayModalOpen(false);
    setBarangaySearch('');
  };

  const returnToSignIn = () => {
    AuthService.clearCurrentUser();
    router.replace('/(auth)/login' as never);
  };

  if (submission) {
    return (
      <ScrollView
        testID='incident-success-screen'
        style={styles.container}
        contentContainerStyle={styles.successContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.successIconCircle}>
          <IconSymbol name='checkmark.seal.fill' size={42} color='#15803D' />
        </View>
        <Text style={styles.successEyebrow}>CIVENTRAL DRRM</Text>
        <Text style={styles.successTitle}>Report Submitted</Text>
        <Text style={styles.successText}>
          Your report was received and is pending review by the DRRM team. It has not yet been
          verified.
        </Text>

        <View style={styles.receiptCard}>
          <Text style={styles.receiptLabel}>INCIDENT NUMBER</Text>
          <Text testID='incident-number' selectable style={styles.incidentNumber}>
            {submission.incident_number}
          </Text>
          <View style={styles.receiptDivider} />
          <View style={styles.statusRow}>
            <Text style={styles.receiptLabel}>STATUS</Text>
            <View testID='incident-status'>
              <Badge label={submission.status} variant='warning' />
            </View>
          </View>
        </View>

        <TouchableOpacity
          accessibilityRole='button'
          style={[styles.primaryButton, styles.successPrimaryButton]}
          onPress={() => router.replace('/emergency' as never)}>
          <Text style={styles.primaryButtonText}>Back to DRRM Hub</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole='button'
          style={styles.secondaryButton}
          onPress={startAnotherReport}>
          <Text style={styles.secondaryButtonText}>Submit Another Report</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <TouchableOpacity
            accessibilityRole='button'
            accessibilityLabel='Back to DRRM Hub'
            style={styles.backButton}
            onPress={() => router.back()}>
            <IconSymbol name='chevron.right' size={22} color='#0F172A' style={styles.backIcon} />
          </TouchableOpacity>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>CITIZEN INCIDENT REPORT</Text>
            <Text style={styles.title}>Report an Incident</Text>
          </View>
          <View style={styles.headingIcon}>
            <IconSymbol name='doc.text.fill' size={24} color='#B45309' />
          </View>
        </View>
        <Text style={styles.subtitle}>
          Share clear, factual details so Caloocan City DRRM can review the situation.
        </Text>
        <View style={styles.safetyNote}>
          <IconSymbol name='exclamationmark.triangle.fill' size={18} color='#B45309' />
          <Text style={styles.safetyNoteText}>
            If anyone is in immediate danger, contact emergency services first. Submitting this
            form does not mean the report is already verified or dispatched.
          </Text>
        </View>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionNumber}>
              <Text style={styles.sectionNumberText}>1</Text>
            </View>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.sectionTitle}>Incident Details</Text>
              <Text style={styles.sectionSubtitle}>Tell us what kind of incident you are reporting.</Text>
            </View>
          </View>
          <Text style={styles.fieldLabel}>Incident Type *</Text>
          <TouchableOpacity
            testID='incident-type-selector'
            accessibilityRole='button'
            accessibilityLabel='Select incident type'
            accessibilityState={{ expanded: isTypeListOpen }}
            style={[styles.selectButton, errors.incidentType && styles.inputErrorBorder]}
            onPress={() => setIsTypeListOpen((current) => !current)}
            disabled={isSubmitting}>
            <Text style={values.incidentType ? styles.selectValue : styles.placeholderText}>
              {getIncidentTypeLabel(values.incidentType) || 'Select an incident type'}
            </Text>
            <IconSymbol
              name='chevron.right'
              size={19}
              color='#64748B'
              style={isTypeListOpen ? styles.selectIconOpen : styles.selectIcon}
            />
          </TouchableOpacity>
          {errors.incidentType ? <Text style={styles.errorText}>{errors.incidentType}</Text> : null}
          {isTypeListOpen ? (
            <View testID='incident-type-options' style={styles.typeOptions}>
              {INCIDENT_TYPE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  testID={`incident-type-${option.value}`}
                  accessibilityRole='button'
                  accessibilityState={{ selected: values.incidentType === option.value }}
                  style={[
                    styles.typeOption,
                    values.incidentType === option.value && styles.typeOptionSelected,
                  ]}
                  onPress={() => selectIncidentType(option.value)}>
                  <Text
                    style={[
                      styles.typeOptionText,
                      values.incidentType === option.value && styles.typeOptionTextSelected,
                    ]}>
                    {option.label}
                  </Text>
                  {values.incidentType === option.value ? (
                    <IconSymbol name='checkmark.seal.fill' size={17} color='#176B87' />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>Title *</Text>
            <Text style={styles.characterCount}>{values.title.length}/180</Text>
          </View>
          <TextInput
            testID='incident-title-input'
            accessibilityLabel='Incident title'
            style={[styles.textInput, errors.title && styles.inputErrorBorder]}
            placeholder='Example: Floodwater rising near main road'
            placeholderTextColor='#94A3B8'
            value={values.title}
            onChangeText={(value) => updateValue('title', value)}
            maxLength={180}
            editable={!isSubmitting}
          />
          {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionNumber}>
              <Text style={styles.sectionNumberText}>2</Text>
            </View>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.sectionTitle}>Location</Text>
              <Text style={styles.sectionSubtitle}>Help responders understand where to look.</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Barangay</Text>
          <Text style={styles.helperText}>
            Select a barangay if known. You can still describe the exact location below.
          </Text>

          {barangayLoadState === 'loading' ? (
            <View testID='barangay-loading-state' style={styles.lookupState}>
              <ActivityIndicator size='small' color='#176B87' />
              <Text style={styles.lookupStateText}>Loading barangay choices...</Text>
            </View>
          ) : null}

          {barangayLoadState === 'error' ? (
            <View testID='barangay-error-state' style={styles.lookupError}>
              <View style={styles.lookupErrorCopy}>
                <Text style={styles.lookupErrorTitle}>Barangay choices are unavailable.</Text>
                <Text style={styles.lookupErrorText}>
                  You can continue by describing the exact location below.
                </Text>
              </View>
              <TouchableOpacity
                testID='barangay-retry-button'
                accessibilityRole='button'
                style={styles.retryButton}
                onPress={() => void loadBarangays()}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {barangayLoadState === 'ready' ? (
            <View style={styles.barangaySelectorRow}>
              <TouchableOpacity
                testID='barangay-selector'
                accessibilityRole='button'
                accessibilityLabel={
                  selectedBarangay
                    ? `Selected barangay: ${selectedBarangay.name}. Change selection`
                    : 'Select a barangay'
                }
                accessibilityState={{ expanded: isBarangayModalOpen }}
                style={[styles.selectButton, styles.barangaySelectButton]}
                onPress={openBarangaySelector}
                disabled={isSubmitting}>
                <IconSymbol name='location.fill' size={18} color='#176B87' />
                <Text
                  style={[
                    selectedBarangay ? styles.selectValue : styles.placeholderText,
                    styles.barangaySelectText,
                  ]}>
                  {selectedBarangay?.name ?? 'Select a barangay (optional)'}
                </Text>
                <IconSymbol name='chevron.right' size={19} color='#64748B' />
              </TouchableOpacity>
              {selectedBarangay ? (
                <TouchableOpacity
                  testID='barangay-clear-button'
                  accessibilityRole='button'
                  accessibilityLabel='Clear selected barangay'
                  style={styles.clearButton}
                  onPress={clearBarangay}
                  disabled={isSubmitting}>
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {errors.barangayId ? <Text style={styles.errorText}>{errors.barangayId}</Text> : null}

          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>Location / Landmark *</Text>
            <Text style={styles.characterCount}>{values.locationDescription.length}/500</Text>
          </View>
          <TextInput
            testID='incident-location-input'
            accessibilityLabel='Incident location description'
            style={[
              styles.textInput,
              styles.locationInput,
              errors.locationDescription && styles.inputErrorBorder,
            ]}
            placeholder='Street, landmark, subdivision, barangay area, or nearby establishment'
            placeholderTextColor='#94A3B8'
            value={values.locationDescription}
            onChangeText={(value) => updateValue('locationDescription', value)}
            maxLength={500}
            multiline
            textAlignVertical='top'
            editable={!isSubmitting}
          />
          <Text style={styles.fieldHelper}>
            Add enough detail to find the site even if you selected a barangay.
          </Text>
          {errors.locationDescription ? (
            <Text style={styles.errorText}>{errors.locationDescription}</Text>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionNumber}>
              <Text style={styles.sectionNumberText}>3</Text>
            </View>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.sectionTitle}>What Happened?</Text>
              <Text style={styles.sectionSubtitle}>Share factual details you can directly observe.</Text>
            </View>
          </View>
          <View style={[styles.labelRow, styles.firstLabelRow]}>
            <Text style={styles.fieldLabel}>Description *</Text>
            <Text style={styles.characterCount}>{values.description.length}/5000</Text>
          </View>
          <TextInput
            testID='incident-description-input'
            accessibilityLabel='Incident description'
            style={[
              styles.textInput,
              styles.multilineInput,
              errors.description && styles.inputErrorBorder,
            ]}
            placeholder='What happened, what is visible now, whether access is blocked, and whether people appear affected'
            placeholderTextColor='#94A3B8'
            value={values.description}
            onChangeText={(value) => updateValue('description', value)}
            maxLength={5000}
            multiline
            textAlignVertical='top'
            editable={!isSubmitting}
          />
          <Text style={styles.fieldHelper}>
            Describe observations only - you do not need to diagnose the hazard.
          </Text>
          {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
        </View>
        {submissionError ? (
          <View testID='incident-submission-error' style={styles.submissionErrorCard}>
            <IconSymbol name='exclamationmark.triangle.fill' size={20} color='#B91C1C' />
            <View style={styles.submissionErrorCopy}>
              <Text style={styles.submissionErrorTitle}>
                {submissionErrorTitle(submissionErrorCode)}
              </Text>
              <Text style={styles.submissionErrorText}>{submissionError}</Text>
              {submissionErrorCode === 'AUTHENTICATION_REQUIRED' ? (
                <TouchableOpacity
                  testID='incident-sign-in-button'
                  accessibilityRole='button'
                  style={styles.signInButton}
                  onPress={returnToSignIn}>
                  <Text style={styles.signInButtonText}>Sign In Again</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}
        <TouchableOpacity
          testID='incident-submit-button'
          accessibilityRole='button'
          accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
          activeOpacity={0.84}
          style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
          onPress={() => void handleSubmit()}
          disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <ActivityIndicator size='small' color='#FFFFFF' />
              <Text style={styles.loadingButtonText}>Submitting Report...</Text>
            </>
          ) : (
            <>
              <IconSymbol name='paperplane.fill' size={18} color='#FFFFFF' />
              <Text style={styles.submitButtonText}>Submit Incident Report</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.privacyText}>
          Your identity is verified through your secure citizen session and is not entered in this
          form.
        </Text>
      </ScrollView>

      <Modal
        testID='barangay-selector-modal'
        transparent
        visible={isBarangayModalOpen}
        onRequestClose={() => setIsBarangayModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            accessibilityRole='button'
            accessibilityLabel='Close barangay selector'
            activeOpacity={1}
            style={styles.modalBackdrop}
            onPress={() => setIsBarangayModalOpen(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalEyebrow}>LOCATION</Text>
                <Text style={styles.modalTitle}>Select Barangay</Text>
                <Text style={styles.modalSubtitle}>Search the validated Caloocan catalog.</Text>
              </View>
              <TouchableOpacity
                testID='barangay-modal-close-button'
                accessibilityRole='button'
                style={styles.modalCloseButton}
                onPress={() => setIsBarangayModalOpen(false)}>
                <Text style={styles.modalCloseButtonText}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <IconSymbol name='magnifyingglass' size={19} color='#64748B' />
              <TextInput
                testID='barangay-search-input'
                accessibilityLabel='Search barangays'
                style={styles.searchInput}
                placeholder='Search by barangay name or number'
                placeholderTextColor='#94A3B8'
                value={barangaySearch}
                onChangeText={setBarangaySearch}
                autoCapitalize='none'
                autoCorrect={false}
              />
              {barangaySearch ? (
                <TouchableOpacity
                  accessibilityRole='button'
                  accessibilityLabel='Clear barangay search'
                  style={styles.searchClearButton}
                  onPress={() => setBarangaySearch('')}>
                  <Text style={styles.searchClearText}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <Text testID='barangay-result-count' style={styles.resultCount}>
              {filteredBarangays.length}{' '}
              {filteredBarangays.length === 1 ? 'barangay' : 'barangays'}
            </Text>

            <FlatList
              testID='barangay-options-list'
              data={filteredBarangays}
              keyExtractor={(item) => item.barangay_id}
              keyboardShouldPersistTaps='handled'
              style={styles.barangayList}
              contentContainerStyle={
                filteredBarangays.length === 0
                  ? styles.emptyListContent
                  : styles.barangayListContent
              }
              renderItem={({ item, index }) => {
                const isSelected = item.barangay_id === values.barangayId;
                return (
                  <TouchableOpacity
                    testID={`barangay-option-${index}`}
                    accessibilityRole='button'
                    accessibilityLabel={item.name}
                    accessibilityState={{ selected: isSelected }}
                    style={[styles.barangayOption, isSelected && styles.barangayOptionSelected]}
                    onPress={() => selectBarangay(item)}>
                    <Text
                      style={[
                        styles.barangayOptionText,
                        isSelected && styles.barangayOptionTextSelected,
                      ]}>
                      {item.name}
                    </Text>
                    {isSelected ? (
                      <IconSymbol name='checkmark.seal.fill' size={18} color='#176B87' />
                    ) : (
                      <IconSymbol name='chevron.right' size={18} color='#94A3B8' />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View testID='barangay-empty-state' style={styles.emptyState}>
                  <IconSymbol name='magnifyingglass' size={26} color='#94A3B8' />
                  <Text style={styles.emptyStateTitle}>No barangay found</Text>
                  <Text style={styles.emptyStateText}>Try a different name or number.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 112 },
  headingRow: { flexDirection: 'row', alignItems: 'center' },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { transform: [{ rotate: '180deg' }] },
  headingCopy: { flex: 1, marginHorizontal: 12 },
  eyebrow: { fontSize: 9, fontWeight: '900', color: '#B45309', letterSpacing: 0.9 },
  title: { fontSize: 23, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  headingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: { fontSize: 13, color: '#475569', lineHeight: 19, marginTop: 12 },
  safetyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 13,
    marginTop: 14,
  },
  safetyNoteText: { flex: 1, fontSize: 11, color: '#7C2D12', lineHeight: 17, marginLeft: 8 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginTop: 12,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
  },
  sectionNumberText: { fontSize: 12, fontWeight: '900', color: '#176B87' },
  sectionHeadingCopy: { flex: 1, marginLeft: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
  sectionSubtitle: { fontSize: 10, color: '#64748B', lineHeight: 15, marginTop: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 7 },
  helperText: { fontSize: 10, color: '#64748B', lineHeight: 15, marginTop: -2, marginBottom: 10 },
  fieldHelper: { fontSize: 10, color: '#64748B', lineHeight: 15, marginTop: 6 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 17,
  },
  firstLabelRow: { marginTop: 0 },
  characterCount: { fontSize: 10, color: '#94A3B8', marginBottom: 7 },
  selectButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectValue: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '600' },
  placeholderText: { flex: 1, fontSize: 14, color: '#94A3B8' },
  selectIcon: { transform: [{ rotate: '90deg' }] },
  selectIconOpen: { transform: [{ rotate: '270deg' }] },
  typeOptions: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginTop: 7,
    overflow: 'hidden',
  },
  typeOption: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  typeOptionSelected: { backgroundColor: '#E0F2FE' },
  typeOptionText: { fontSize: 13, color: '#334155' },
  typeOptionTextSelected: { color: '#0F4C61', fontWeight: '800' },
  lookupState: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lookupStateText: { fontSize: 12, color: '#0F4C61', marginLeft: 9 },
  lookupError: {
    minHeight: 62,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lookupErrorCopy: { flex: 1, paddingRight: 8 },
  lookupErrorTitle: { fontSize: 11, fontWeight: '800', color: '#9A3412' },
  lookupErrorText: { fontSize: 10, color: '#9A3412', lineHeight: 14, marginTop: 2 },
  retryButton: {
    minWidth: 58,
    minHeight: 38,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  retryButtonText: { fontSize: 11, fontWeight: '800', color: '#9A3412' },
  barangaySelectorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barangaySelectButton: { flex: 1 },
  barangaySelectText: { marginLeft: 8 },
  clearButton: {
    minWidth: 58,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  clearButtonText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  textInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  multilineInput: { minHeight: 126 },
  locationInput: { minHeight: 84 },
  inputErrorBorder: { borderColor: '#DC2626', borderWidth: 1.5 },
  errorText: { fontSize: 11, color: '#B91C1C', lineHeight: 16, marginTop: 5 },
  submissionErrorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 14,
    marginTop: 14,
  },
  submissionErrorCopy: { flex: 1, marginLeft: 9 },
  submissionErrorTitle: { fontSize: 13, fontWeight: '800', color: '#991B1B' },
  submissionErrorText: { fontSize: 11, color: '#991B1B', lineHeight: 17, marginTop: 3 },
  signInButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#991B1B',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginTop: 10,
  },
  signInButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  primaryButton: {
    minHeight: 52,
    backgroundColor: '#176B87',
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 18,
  },
  disabledButton: { backgroundColor: '#7BA6B5' },
  submitButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginLeft: 8 },
  loadingButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginLeft: 9 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  privacyText: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '84%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    paddingTop: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
  },
  modalHeaderCopy: { flex: 1, paddingRight: 12 },
  modalEyebrow: { fontSize: 9, fontWeight: '900', color: '#176B87', letterSpacing: 0.8 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  modalSubtitle: { fontSize: 11, color: '#64748B', lineHeight: 16, marginTop: 3 },
  modalCloseButton: {
    minWidth: 56,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  modalCloseButtonText: { fontSize: 11, fontWeight: '900', color: '#176B87' },
  searchBox: {
    minHeight: 48,
    marginHorizontal: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 9,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  searchClearButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  searchClearText: { fontSize: 10, fontWeight: '800', color: '#176B87' },
  resultCount: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 7,
  },
  barangayList: { flexGrow: 0, maxHeight: 420 },
  barangayListContent: { paddingHorizontal: 12, paddingBottom: 16 },
  barangayOption: {
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  barangayOptionSelected: { backgroundColor: '#E0F2FE', borderRadius: 10 },
  barangayOptionText: { fontSize: 13, color: '#334155' },
  barangayOptionTextSelected: { color: '#0F4C61', fontWeight: '900' },
  emptyListContent: { minHeight: 190, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 26 },
  emptyStateTitle: { fontSize: 13, fontWeight: '800', color: '#334155', marginTop: 8 },
  emptyStateText: { fontSize: 11, color: '#64748B', marginTop: 3 },
  successContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
    paddingBottom: 112,
  },
  successIconCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 1,
    marginTop: 18,
  },
  successTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A', marginTop: 4 },
  successText: {
    maxWidth: 440,
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  receiptCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginTop: 22,
  },
  receiptLabel: { fontSize: 10, fontWeight: '900', color: '#64748B', letterSpacing: 0.8 },
  incidentNumber: { fontSize: 22, fontWeight: '900', color: '#176B87', marginTop: 6 },
  receiptDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  successPrimaryButton: { width: '100%', maxWidth: 440 },
  secondaryButton: {
    width: '100%',
    maxWidth: 440,
    minHeight: 50,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#176B87',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryButtonText: { color: '#176B87', fontSize: 14, fontWeight: '800' },
});
