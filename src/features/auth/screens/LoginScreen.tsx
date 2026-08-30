import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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

export function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ identifier?: string }>();

  const [email, setEmail] = useState(normalizeAuthIdentifier(params.identifier || ''));
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setErrorMessage(null);

    if (!password.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    const response = await AuthService.login(email.trim(), password.trim());
    setIsLoading(false);

    if (response.status === 'success') {
      setIsRedirecting(true);
      
      // Auto-redirect after smooth loading delay (1s)
      setTimeout(() => {
        router.replace('/(tabs)' as any);
      }, 1000);
    } else if (response.status === 'otp_required') {
      Alert.alert('Verification Required', response.message || 'Please verify your email to complete login.', [
        {
          text: 'Verify Email',
          onPress: () =>
            router.push({
              pathname: '/(auth)/verify' as any,
              params: { email: response.email || email },
            }),
        },
      ]);
    } else {
      setErrorMessage(response.message);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert('Reset Password', 'Please contact Caloocan City Hall Helpdesk or use email verification to reset.');
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
              onPress={() => router.replace('/(auth)' as any)}
              activeOpacity={0.75}>
              <IconSymbol name="chevron.right" size={20} color="#0F172A" style={styles.backIcon} />
            </TouchableOpacity>
          </View>

          {/* Header Title & Subtitle */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Welcome Back!</Text>
            <Text style={styles.headerSubtitle}>
              Please enter your password to sign-in to your CIVentral account.
            </Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            {/* Field 1: Email Address */}
            <Text style={styles.inputLabel}>Email Address / Phone Number</Text>
            <TextInput
              style={styles.textInputDisabled}
              placeholder="Enter your email address"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading && !isRedirecting}
            />

            {/* Field 2: Password */}
            <Text style={[styles.inputLabel, { marginTop: 18 }]}>Password</Text>
            <View style={[styles.passwordWrapper, errorMessage ? styles.inputErrorBorder : null]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                editable={!isLoading && !isRedirecting}
              />
              <TouchableOpacity
                style={styles.eyeIconBtn}
                onPress={() => setIsPasswordVisible((prev) => !prev)}
                activeOpacity={0.7}>
                <IconSymbol
                  name={isPasswordVisible ? 'eye.slash.fill' : 'eye.fill'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            {/* Error Text */}
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            {/* Remember Me & Forgot Password Row */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberMeContainer}
                onPress={() => setRememberMe((prev) => !prev)}
                activeOpacity={0.8}>
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <View style={styles.checkboxInner} />}
                </View>
                <Text style={styles.rememberMeText}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Fixed Sign In Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[styles.signInButton, (isLoading || isRedirecting) && styles.disabledButton]}
            onPress={handleSignIn}
            disabled={isLoading || isRedirecting}
            activeOpacity={0.85}>
            {isLoading || isRedirecting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* SIMPLE GOVERNMENT PORTAL LOADING SCREEN */}
        <Modal
          visible={isRedirecting}
          transparent={false}
          animationType="fade"
          hardwareAccelerated>
          <View style={styles.simpleGovContainer}>
            <View style={styles.simpleGovCenterStack}>
              {/* Municipality Logo Icon */}
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.simpleGovLogo}
                resizeMode="contain"
              />

              {/* Capitalized Title */}
              <Text style={styles.simpleGovTitle}>CIVENTRAL</Text>
              <Text style={styles.simpleGovSubtitle}>CITY OF CALOOCAN</Text>

              {/* Loading Spinner at the Bottom */}
              <View style={styles.simpleGovSpinnerBox}>
                <ActivityIndicator size="large" color="#165B7E" />
              </View>
            </View>
          </View>
        </Modal>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingBottom: 40,
  },
  topNavRow: {
    marginBottom: 20,
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
  headerContainer: {
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
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
    color: '#0F172A',
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
  inputErrorBorder: {
    borderColor: '#EF4444',
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
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    borderColor: '#165B7E',
    backgroundColor: '#165B7E',
  },
  checkboxInner: {
    width: 8,
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  rememberMeText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#165B7E',
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  signInButton: {
    backgroundColor: '#165B7E',
    borderRadius: 24,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* SIMPLE GOVERNMENT PORTAL LOADING SCREEN STYLES */
  simpleGovContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  simpleGovCenterStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleGovLogo: {
    width: 140,
    height: 140,
    marginBottom: 16,
  },
  simpleGovTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#165B7E',
    letterSpacing: 3,
    textAlign: 'center',
  },
  simpleGovSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 2,
    marginTop: 4,
    marginBottom: 32,
    textAlign: 'center',
  },
  simpleGovSpinnerBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
