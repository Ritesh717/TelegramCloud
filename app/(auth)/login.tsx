import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { telegramService } from '../../src/api/TelegramClient';
import { useAppStore } from '../../src/store/useAppStore';
import { THEME } from '../../src/theme/theme';

function LoginScreen() {
  const router = useRouter();
  const setAuthenticated = useAppStore((state) => state.setAuthenticated);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'phone' | 'code' | 'password'>('phone');
  const [loading, setLoading] = useState(false);
  const [phoneCodeHash, setPhoneCodeHash] = useState('');

  const handleSendCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid number', 'Please enter a valid phone number.');
      return;
    }
    setLoading(true);
    try {
      const response = await telegramService.sendCode(phoneNumber);
      setPhoneCodeHash(response.phoneCodeHash);
      setStep('code');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!code || code.length < 5) return;
    setLoading(true);
    try {
      await telegramService.signIn(phoneNumber, phoneCodeHash, code);
      setAuthenticated(true);
      router.replace('/(tabs)');
    } catch (error: any) {
      if (error.message.includes('SESSION_PASSWORD_NEEDED') || error.error === 'SESSION_PASSWORD_NEEDED') {
        setStep('password');
      } else {
        Alert.alert('Error', error.message || 'Failed to sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password) return;
    setLoading(true);
    try {
      await telegramService.checkPassword(password);
      setAuthenticated(true);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep('phone');
    setCode('');
    setPassword('');
  };

  const actionLabel = step === 'phone' ? 'Continue' : step === 'code' ? 'Verify' : 'Unlock';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" />
      <Stack.Screen options={{ title: 'Log in', headerShown: false }} />

      <View style={styles.heroBand} />
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.logoRow}>
            <View style={[styles.dot, { backgroundColor: '#4285F4' }]} />
            <View style={[styles.dot, { backgroundColor: '#EA4335' }]} />
            <View style={[styles.dot, { backgroundColor: '#FBBC05' }]} />
            <View style={[styles.dot, { backgroundColor: '#34A853' }]} />
          </View>

          <Text style={styles.title}>Welcome to TelegramCloud</Text>
          <Text style={styles.subtitle}>
            Sign in to manage your backed up photos and videos in one place.
          </Text>

          <View style={styles.form}>
            {step === 'phone' ? (
              <TextInput
                style={styles.input}
                placeholder="+1 234 567 8900"
                placeholderTextColor={THEME.colors.textMuted}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                autoFocus
              />
            ) : null}

            {step === 'code' ? (
              <TextInput
                style={styles.input}
                placeholder="Verification code"
                placeholderTextColor={THEME.colors.textMuted}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                autoFocus
                maxLength={6}
              />
            ) : null}

            {step === 'password' ? (
              <TextInput
                style={styles.input}
                placeholder="2-step verification password"
                placeholderTextColor={THEME.colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoFocus
                onSubmitEditing={handlePasswordSubmit}
              />
            ) : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={step === 'phone' ? handleSendCode : step === 'code' ? handleSignIn : handlePasswordSubmit}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? <ActivityIndicator color={THEME.colors.white} /> : <Text style={styles.buttonText}>{actionLabel}</Text>}
            </TouchableOpacity>

            {step !== 'phone' ? (
              <TouchableOpacity onPress={resetFlow} style={styles.backButton} activeOpacity={0.85}>
                <Text style={styles.backButtonText}>Use a different phone number</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  heroBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: THEME.colors.backgroundAccent,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: THEME.spacing.lg,
  },
  card: {
    padding: THEME.spacing.xl,
    borderRadius: THEME.borderRadius.xl,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderSoft,
    ...THEME.shadow.soft,
  },
  logoRow: {
    flexDirection: 'row',
    marginBottom: THEME.spacing.lg,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: THEME.borderRadius.full,
    marginRight: 8,
  },
  title: {
    ...THEME.typography.display,
    color: THEME.colors.text,
  },
  subtitle: {
    ...THEME.typography.body,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.sm,
  },
  form: {
    marginTop: THEME.spacing.xl,
  },
  input: {
    height: 56,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surfaceSecondary,
    paddingHorizontal: THEME.spacing.md,
    color: THEME.colors.text,
    ...THEME.typography.body,
    marginBottom: THEME.spacing.md,
  },
  button: {
    height: 52,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.white,
  },
  backButton: {
    alignSelf: 'center',
    marginTop: THEME.spacing.lg,
  },
  backButtonText: {
    ...THEME.typography.bodyMedium,
    color: THEME.colors.primary,
  },
});

export default LoginScreen;
