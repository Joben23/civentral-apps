import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useRouter } from 'expo-router';
import { getAccountAuthRoute } from '@/src/features/auth/account-routing';
import {
  ACCOUNT_CHECK_ERROR_MESSAGE,
  AuthService,
  normalizeAuthIdentifier,
} from '@/src/services/auth-service';

export type AuthMode = 'email' | 'phone';

export function AuthEntryScreen() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode>('email');
  const [inputValue, setInputValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEmail = authMode === 'email';

  // Toggle between Email and Phone mode
  const handleToggleMode = () => {
    setAuthMode((prev) => (prev === 'email' ? 'phone' : 'email'));
    setInputValue('');
    setErrorMessage(null);
  };

  const [isLoading, setIsLoading] = useState(false);

  // Input Validation & Account Check Action
  const handleContinue = async () => {
    setErrorMessage(null);
    const normalizedIdentifier = normalizeAuthIdentifier(inputValue);

    if (!normalizedIdentifier) {
      setErrorMessage(`Please enter your ${isEmail ? 'email address' : 'phone number'}.`);
      return;
    }

    if (isEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedIdentifier)) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }
    } else {
      const phoneRegex = /^(\+?63|0)9\d{9}$/;
      if (!phoneRegex.test(normalizedIdentifier)) {
        setErrorMessage('Please enter a valid PH mobile number.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const checkResult = await AuthService.checkAccount(normalizedIdentifier);
      const destination = getAccountAuthRoute(checkResult);

      if (!destination) {
        setErrorMessage(checkResult.message || ACCOUNT_CHECK_ERROR_MESSAGE);
        return;
      }

      router.push({
        pathname: destination as any,
        params: { identifier: normalizedIdentifier },
      });
    } catch {
      setErrorMessage(ACCOUNT_CHECK_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  };

  // Guest Mode Action
  const handleContinueAsGuest = () => {
    router.replace({
      pathname: '/(tabs)',
      params: { isGuest: 'true' },
    } as any);
  };

  const handleOpenTerms = () => {
    Alert.alert('Terms of Service', 'Civentral Municipal Portal Terms of Service.');
  };

  const handleOpenPrivacy = () => {
    Alert.alert('Privacy Policy', 'Data Privacy Policy for Civentral.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}>
        
        {/* Background Building Watermark */}
        <Image
          source={require('@/assets/images/building-bg.png')}
          style={styles.watermarkBg}
          resizeMode="contain"
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          
          {/* Centered Large Circular Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Header Title & Subtitle */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Welcome to Civentral</Text>
            <Text style={styles.headerSubtitle}>
              Enter your email or phone number to log-in to an existing account or instantly set up your new account.
            </Text>
          </View>

          {/* Form Area */}
          <View style={styles.formContainer}>
            {/* Input Label */}
            <Text style={styles.inputLabel}>
              {isEmail ? 'Email Address' : 'Phone Number'}
            </Text>

            {/* Input Field */}
            <TextInput
              style={[
                styles.textInput,
                errorMessage ? styles.inputErrorBorder : null,
              ]}
              placeholder={isEmail ? 'Enter your email address' : 'Enter your phone number'}
              placeholderTextColor="#94A3B8"
              value={inputValue}
              onChangeText={(text) => {
                setInputValue(text);
                if (errorMessage) setErrorMessage(null);
              }}
              keyboardType={isEmail ? 'email-address' : 'phone-pad'}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Error Message */}
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            {/* Toggle Link */}
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={handleToggleMode}
              activeOpacity={0.7}>
              <Text style={styles.toggleText}>
                {isEmail ? 'Use Phone Number Instead' : 'Use Email Address Instead'}
              </Text>
            </TouchableOpacity>

            {/* Primary Action Button (Continue) */}
            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.disabledButton]}
              onPress={handleContinue}
              disabled={isLoading}
              activeOpacity={0.85}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </TouchableOpacity>

            {/* Divider (OR) */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Secondary Action Button (Continue as Guest) */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleContinueAsGuest}
              activeOpacity={0.85}>
              <Text style={styles.secondaryButtonText}>Continue as Guest</Text>
            </TouchableOpacity>

            {/* Footer Disclaimer */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                By continuing, you agree to our{' '}
                <Text style={styles.footerLink} onPress={handleOpenTerms}>
                  Terms of Service
                </Text>{' '}
                and
              </Text>
              <Text style={styles.footerText}>
                Acknowledge our{' '}
                <Text style={styles.footerLink} onPress={handleOpenPrivacy}>
                  Privacy Policy
                </Text>
              </Text>
            </View>
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
  watermarkBg: {
    position: 'absolute',
    bottom: -10,
    left: 0,
    right: 0,
    height: 260,
    width: '100%',
    opacity: 0.35,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 220,
    height: 220,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  headerTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
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
  inputErrorBorder: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  toggleButton: {
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#165B7E',
  },
  primaryButton: {
    backgroundColor: '#165B7E',
    borderRadius: 24,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 24,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  footerContainer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: '#165B7E',
    fontWeight: '600',
  },
});
