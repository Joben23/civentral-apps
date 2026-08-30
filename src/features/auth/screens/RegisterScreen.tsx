import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AuthService, normalizeAuthIdentifier } from '@/src/services/auth-service';

export function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ identifier?: string }>();

  const [email, setEmail] = useState(normalizeAuthIdentifier(params.identifier || ''));
  const [isRegistrationAllowed] = useState(() => AuthService.isRegistrationAllowed(email));
  const [firstName, setFirstName] = useState('');
  const [suffix, setSuffix] = useState('Suffix');
  const [middleName, setMiddleName] = useState('');
  const [noMiddleName, setNoMiddleName] = useState(false);
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isRegistrationAllowed) {
      router.replace('/(auth)' as any);
    }
  }, [isRegistrationAllowed, router]);

  if (!isRegistrationAllowed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color="#165B7E" />
      </SafeAreaView>
    );
  }

  // REAL-TIME PASSWORD STRENGTH EVALUATION
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const getStrengthLevel = (): 'weak' | 'medium' | 'strong' | '' => {
    if (password.length === 0) return '';
    let score = 0;
    if (hasMinLength) score += 1;
    if (hasUpper && hasLower) score += 1;
    if (hasNumber) score += 1;
    if (hasSymbol) score += 1;

    if (score >= 4 && hasMinLength && hasUpper && hasLower && hasNumber && hasSymbol) {
      return 'strong';
    } else if (score >= 3 && hasMinLength) {
      return 'medium';
    } else {
      return 'weak';
    }
  };

  const strengthLevel = getStrengthLevel();

  const handleVerifyAccount = async () => {
    setErrorMessage(null);

    if (!firstName.trim()) {
      setErrorMessage('Please enter your first name.');
      return;
    }
    if (!lastName.trim()) {
      setErrorMessage('Please enter your last name.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter a password.');
      return;
    }

    // STRICT PASSWORD STRENGTH ENFORCEMENT
    if (strengthLevel !== 'strong') {
      setErrorMessage(
        'Password strength is ' + (strengthLevel ? strengthLevel.toUpperCase() : 'WEAK') + '. Registration requires a STRONG password (at least 8 characters with uppercase, lowercase, number, and special symbol).'
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    const res = await AuthService.register({
      email,
      firstName: firstName.trim(),
      middleName: middleName.trim(),
      hasNoMiddleName: noMiddleName,
      lastName: lastName.trim(),
      suffix: suffix === 'Suffix' || suffix === 'None' ? '' : suffix,
      password,
    });
    setIsLoading(false);

    if (res.status === 'otp_required' || res.status === 'success') {
      router.push({
        pathname: '/(auth)/verify' as any,
        params: {
          email: res.email || email,
        },
      });
    } else {
      setErrorMessage(res.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}>
        
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          
          {/* Circular Back Navigation Button */}
          <View style={styles.topNavRow}>
            <TouchableOpacity
              style={styles.backCircleBtn}
              onPress={() => router.back()}
              activeOpacity={0.75}>
              <IconSymbol name="chevron.right" size={20} color="#0F172A" style={styles.backIcon} />
            </TouchableOpacity>
          </View>

          {/* Step Progress Bar (Step 1 of 2) */}
          <View style={styles.progressContainer}>
            <View style={styles.progressActive} />
            <View style={styles.progressInactive} />
          </View>

          {/* Screen Title */}
          <Text style={styles.screenTitle}>Complete Your Profile</Text>

          <View style={styles.formContainer}>
            {/* Field 1: Email Address */}
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.textInputDisabled}
              placeholder="Enter your email address"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false}
            />

            {/* Field 2: First Name & Suffix Row */}
            <View style={styles.rowFields}>
              <View style={styles.firstNameContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="First Name"
                  placeholderTextColor="#94A3B8"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>

              <TouchableOpacity
                style={styles.suffixDropdown}
                activeOpacity={0.8}
                onPress={() => {
                  Alert.alert('Suffix Selection', 'Select suffix option', [
                    { text: 'None', onPress: () => setSuffix('None') },
                    { text: 'Jr.', onPress: () => setSuffix('Jr.') },
                    { text: 'Sr.', onPress: () => setSuffix('Sr.') },
                    { text: 'III', onPress: () => setSuffix('III') },
                  ]);
                }}>
                <Text style={styles.suffixText}>{suffix}</Text>
                <IconSymbol name="chevron.right" size={16} color="#64748B" style={{ transform: [{ rotate: '90deg' }] }} />
              </TouchableOpacity>
            </View>

            {/* Field 3: Middle Name */}
            <TextInput
              style={[styles.textInput, { marginTop: 14 }, noMiddleName && styles.disabledInput]}
              placeholder="Middle Name"
              placeholderTextColor="#94A3B8"
              value={noMiddleName ? '' : middleName}
              onChangeText={setMiddleName}
              editable={!noMiddleName}
            />

            {/* Checkbox: I have no middle name */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => {
                setNoMiddleName((prev) => !prev);
                if (!noMiddleName) setMiddleName('');
              }}
              activeOpacity={0.8}>
              <View style={[styles.checkbox, noMiddleName && styles.checkboxChecked]}>
                {noMiddleName && <View style={styles.checkboxInner} />}
              </View>
              <Text style={styles.checkboxLabel}>I have no middle name</Text>
            </TouchableOpacity>

            {/* Field 4: Last Name */}
            <TextInput
              style={[styles.textInput, { marginTop: 14 }]}
              placeholder="Last Name"
              placeholderTextColor="#94A3B8"
              value={lastName}
              onChangeText={setLastName}
            />

            {/* Field 5: Password */}
            <View style={[styles.passwordWrapper, { marginTop: 14 }]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeIconBtn}
                onPress={() => setIsPasswordVisible((prev) => !prev)}
                activeOpacity={0.7}>
                <IconSymbol name={isPasswordVisible ? 'eye.slash.fill' : 'eye.fill'} size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* PASSWORD STRENGTH INDICATOR METER */}
            {password.length > 0 && (
              <View style={styles.strengthMeterContainer}>
                {/* 3 Color Bars */}
                <View style={styles.strengthBarsRow}>
                  <View
                    style={[
                      styles.strengthBar,
                      strengthLevel === 'weak' && styles.barWeak,
                      strengthLevel === 'medium' && styles.barMedium,
                      strengthLevel === 'strong' && styles.barStrong,
                    ]}
                  />
                  <View
                    style={[
                      styles.strengthBar,
                      strengthLevel === 'medium' && styles.barMedium,
                      strengthLevel === 'strong' && styles.barStrong,
                    ]}
                  />
                  <View
                    style={[
                      styles.strengthBar,
                      strengthLevel === 'strong' && styles.barStrong,
                    ]}
                  />
                </View>

                {/* Strength Label & Status */}
                <View style={styles.strengthLabelRow}>
                  <Text style={styles.strengthPromptText}>Password Strength:</Text>
                  <Text
                    style={[
                      styles.strengthText,
                      strengthLevel === 'weak' && styles.textWeak,
                      strengthLevel === 'medium' && styles.textMedium,
                      strengthLevel === 'strong' && styles.textStrong,
                    ]}>
                    {strengthLevel.toUpperCase()}
                  </Text>
                </View>

                {/* Password Criteria Checklist */}
                <View style={styles.checklistContainer}>
                  <View style={styles.checkItem}>
                    <IconSymbol
                      name={hasMinLength ? 'checkmark.seal.fill' : 'chevron.right'}
                      size={14}
                      color={hasMinLength ? '#10B981' : '#94A3B8'}
                    />
                    <Text style={[styles.checkText, hasMinLength && styles.checkTextActive]}>
                      At least 8 characters
                    </Text>
                  </View>

                  <View style={styles.checkItem}>
                    <IconSymbol
                      name={hasUpper && hasLower ? 'checkmark.seal.fill' : 'chevron.right'}
                      size={14}
                      color={hasUpper && hasLower ? '#10B981' : '#94A3B8'}
                    />
                    <Text style={[styles.checkText, hasUpper && hasLower && styles.checkTextActive]}>
                      Uppercase & lowercase letters
                    </Text>
                  </View>

                  <View style={styles.checkItem}>
                    <IconSymbol
                      name={hasNumber ? 'checkmark.seal.fill' : 'chevron.right'}
                      size={14}
                      color={hasNumber ? '#10B981' : '#94A3B8'}
                    />
                    <Text style={[styles.checkText, hasNumber && styles.checkTextActive]}>
                      At least 1 number (0-9)
                    </Text>
                  </View>

                  <View style={styles.checkItem}>
                    <IconSymbol
                      name={hasSymbol ? 'checkmark.seal.fill' : 'chevron.right'}
                      size={14}
                      color={hasSymbol ? '#10B981' : '#94A3B8'}
                    />
                    <Text style={[styles.checkText, hasSymbol && styles.checkTextActive]}>
                      At least 1 special symbol (!@#$%^&*)
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Field 6: Confirm Password */}
            <View style={[styles.passwordWrapper, { marginTop: 14 }]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm your password"
                placeholderTextColor="#94A3B8"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                secureTextEntry={!isConfirmPasswordVisible}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeIconBtn}
                onPress={() => setIsConfirmPasswordVisible((prev) => !prev)}
                activeOpacity={0.7}>
                <IconSymbol name={isConfirmPasswordVisible ? 'eye.slash.fill' : 'eye.fill'} size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            {/* Primary Action Button (Verify Account) */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (isLoading || strengthLevel !== 'strong') && styles.disabledButton,
              ]}
              onPress={handleVerifyAccount}
              disabled={isLoading}
              activeOpacity={0.85}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify Account</Text>
              )}
            </TouchableOpacity>

            {/* Divider (OR) */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Already have an account label */}
            <Text style={styles.accountPromptText}>Already have an Civentral account?</Text>

            {/* Secondary Action Button (Back) */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.back()}
              activeOpacity={0.85}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardContainer: {
    flex: 1,
  },
  topNavRow: {
    marginBottom: 16,
    marginTop: 8,
  },
  backCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
  },
  progressContainer: {
    flexDirection: 'row',
    height: 4,
    marginBottom: 20,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressActive: {
    flex: 1,
    backgroundColor: '#165B7E',
  },
  progressInactive: {
    flex: 1,
    backgroundColor: '#E2E8F0',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingBottom: 40,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  formContainer: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  textInputDisabled: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: '#334155',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: '#0F172A',
  },
  disabledInput: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  rowFields: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 12,
  },
  firstNameContainer: {
    flex: 2,
  },
  suffixDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
  },
  suffixText: {
    fontSize: 14,
    color: '#475569',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    borderColor: '#165B7E',
    backgroundColor: '#165B7E',
  },
  checkboxInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#0F172A',
  },
  eyeIconBtn: {
    padding: 6,
  },

  /* PASSWORD STRENGTH INDICATOR METER STYLES */
  strengthMeterContainer: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  strengthBarsRow: {
    flexDirection: 'row',
    height: 6,
    gap: 6,
    marginBottom: 8,
  },
  strengthBar: {
    flex: 1,
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
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  strengthPromptText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
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
    fontSize: 12,
    color: '#94A3B8',
  },
  checkTextActive: {
    color: '#0F172A',
    fontWeight: '600',
  },

  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 10,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#165B7E',
    borderRadius: 24,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  accountPromptText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#475569',
    marginBottom: 14,
    fontWeight: '500',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 24,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
});
