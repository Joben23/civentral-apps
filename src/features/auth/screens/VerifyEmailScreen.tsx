import React, { useRef, useState } from 'react';
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

export function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const displayEmail = normalizeAuthIdentifier(params.email || '');

  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleOtpChange = (text: string, index: number) => {
    if (errorMessage) setErrorMessage(null);
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    setErrorMessage(null);
    if (!displayEmail) {
      setErrorMessage('Your verification session is missing. Please sign in again.');
      return;
    }

    setIsLoading(true);
    const response = await AuthService.resendOtp(displayEmail);
    setIsLoading(false);

    if (response.status === 'success') {
      Alert.alert('Code Resent', response.message);
    } else {
      setErrorMessage(response.message);
    }
  };

  const handleVerifyAndComplete = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    if (!displayEmail) {
      setErrorMessage('Your verification session is missing. Please sign in again.');
      return;
    }

    setIsLoading(true);
    const response = await AuthService.verifyOtp(displayEmail, code);
    setIsLoading(false);

    if (response.status !== 'success') {
      setErrorMessage(response.message);
      return;
    }

    setIsRedirecting(true);
    setTimeout(() => {
      router.replace('/(tabs)' as any);
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}>
        
        {/* Top Back Nav Bar */}
        <View style={styles.topNav}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <IconSymbol name="chevron.right" size={24} color="#0F172A" style={styles.backIcon} />
          </TouchableOpacity>
        </View>

        {/* Step Progress Bar (Step 2 of 2) */}
        <View style={styles.progressContainer}>
          <View style={styles.progressInactive} />
          <View style={styles.progressActive} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          
          {/* Title & Subtitle */}
          <Text style={styles.screenTitle}>Verify Your Email</Text>
          <Text style={styles.screenSubtitle}>
            We sent a 6-digit code to <Text style={styles.boldText}>{displayEmail}</Text>.{'\n'}
            Enter the code below to verify your account.
          </Text>

          {/* 6 Square OTP Inputs */}
          <View style={styles.otpRow}>
            {otp.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={(ref) => {
                  inputRefs.current[idx] = ref;
                }}
                style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                maxLength={1}
                keyboardType="number-pad"
                value={digit}
                onChangeText={(text) => handleOtpChange(text, idx)}
                onKeyPress={(e) => handleKeyPress(e, idx)}
                textAlign="center"
                editable={!isLoading && !isRedirecting}
              />
            ))}
          </View>

          {/* Error Message */}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          {/* Resend Link */}
          <View style={styles.resendRow}>
            <Text style={styles.resendText}>
              Didn&apos;t receive the code?{' '}
              <Text style={styles.resendLink} onPress={handleResend}>
                Resend now
              </Text>
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Fixed Action Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[styles.verifyButton, (isLoading || isRedirecting) && styles.disabledButton]}
            onPress={handleVerifyAndComplete}
            disabled={isLoading || isRedirecting}
            activeOpacity={0.85}>
            {isLoading || isRedirecting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify and Complete Sign In</Text>
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
  topNav: {
    height: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
  },
  progressContainer: {
    flexDirection: 'row',
    height: 4,
    marginHorizontal: 24,
    marginTop: 4,
    marginBottom: 20,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressInactive: {
    flex: 1,
    backgroundColor: '#E2E8F0',
  },
  progressActive: {
    flex: 1,
    backgroundColor: '#165B7E',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  screenSubtitle: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 28,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  otpBox: {
    width: 46,
    height: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  otpBoxFilled: {
    borderColor: '#165B7E',
    backgroundColor: '#F0F9FF',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 12,
    fontWeight: '600',
  },
  resendRow: {
    marginTop: 8,
  },
  resendText: {
    fontSize: 13,
    color: '#475569',
  },
  resendLink: {
    color: '#165B7E',
    fontWeight: '700',
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
  },
  verifyButton: {
    backgroundColor: '#165B7E',
    borderRadius: 24,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  verifyButtonText: {
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
