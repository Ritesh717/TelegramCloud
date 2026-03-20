import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { telegramService } from '../../src/api/TelegramClient';
import { THEME } from '../../src/theme/theme';

function LoginScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'phone' | 'code' | 'password'>('phone');
  const [loading, setLoading] = useState(false);
  const [phoneCodeHash, setPhoneCodeHash] = useState('');

  const handleSendCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid phone number');
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

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      <Stack.Screen options={{ title: 'Log in', headerShown: false }} />
      
      <View style={styles.content}>
        <View style={styles.header}>
            <Text style={styles.title}>TelegramCloud</Text>
            <Text style={styles.subtitle}>
            {step === 'phone' && 'Enter your phone number to continue'}
            {step === 'code' && `Verify the code sent to your Telegram`}
            {step === 'password' && 'Enter your 2nd factor password'}
            </Text>
        </View>

        <View style={styles.form}>
            {step === 'phone' && (
            <TextInput
                style={styles.input}
                placeholder="+1 234 567 8900"
                placeholderTextColor={THEME.colors.textSecondary}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                autoFocus
            />
            )}

            {step === 'code' && (
            <TextInput
                style={styles.input}
                placeholder="Code"
                placeholderTextColor={THEME.colors.textSecondary}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
                autoFocus
                maxLength={6}
            />
            )}

            {step === 'password' && (
            <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={THEME.colors.textSecondary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoFocus
                onSubmitEditing={handlePasswordSubmit}
            />
            )}

            <TouchableOpacity 
            style={[styles.button, loading && { opacity: 0.7 }]} 
            onPress={
                step === 'phone' ? handleSendCode : 
                step === 'code' ? handleSignIn : handlePasswordSubmit
            }
            disabled={loading}
            >
            {loading ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <Text style={styles.buttonText}>
                {step === 'phone' ? 'Next' : 'Login'}
                </Text>
            )}
            </TouchableOpacity>

            {step !== 'phone' && (
            <TouchableOpacity onPress={resetFlow} style={styles.backButton}>
                <Text style={styles.backButtonText}>Back to phone number</Text>
            </TouchableOpacity>
            )}
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
  content: {
    flex: 1,
    padding: THEME.spacing.lg,
    justifyContent: 'center',
  },
  header: {
    marginBottom: THEME.spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: THEME.colors.text,
    marginBottom: THEME.spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: THEME.colors.textSecondary,
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  input: {
    height: 60,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: THEME.spacing.md,
    fontSize: 18,
    marginBottom: THEME.spacing.md,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  button: {
    height: 60,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  backButton: {
    marginTop: THEME.spacing.lg,
    alignItems: 'center',
  },
  backButtonText: {
    color: THEME.colors.accent,
    fontSize: 15,
    fontWeight: '500',
  },
});

export default LoginScreen;
