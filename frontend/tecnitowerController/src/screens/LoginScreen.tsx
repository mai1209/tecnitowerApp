import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  ScrollView,
  Platform,
  Keyboard,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { loginUser } from '../services/api';
import { AuthSession } from '../types/auth';
import PasswordField from '../components/PasswordField';

type Props = {
  onLogin?: (session: AuthSession) => void;
  navigation: {
    navigate: (screen: string) => void;
  };
};

function LoginScreen({ onLogin, navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    if (isSubmitting) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage('Completa tu correo y contraseña.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await loginUser({ email: normalizedEmail, password });
      const token = response?.token;
      const rawUser = response?.user;

      if (!token || !rawUser) {
        setErrorMessage('La respuesta del servidor no es válida.');
        return;
      }

      const user = {
        _id: String(rawUser._id ?? rawUser.id ?? ''),
        fullName: String(rawUser.fullName ?? ''),
        email: String(rawUser.email ?? ''),
        role: rawUser.role === 'admin' ? 'admin' : 'user',
        canWrite:
          rawUser.role === 'admin'
            ? true
            : typeof rawUser.canWrite === 'boolean'
              ? rawUser.canWrite
              : rawUser.role === 'viewer'
                ? false
                : true,
      };

      onLogin?.({ token, user });
      Alert.alert('Bienvenido', `Hola ${user.fullName || 'Usuario'}`.trim());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo iniciar sesión.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={['#F8FAFC', '#E8EEF9', '#C9D6F2']}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.screen}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets
            >
              <View style={styles.wrapper}>
                <View style={styles.topBrandBlock}>
                  <View style={styles.logoShell}>
                    <Image
                      source={require('../../assets/logo.png')}
                      style={styles.logo}
                      accessible
                      accessibilityLabel="Logo Tecnitower"
                    />
                  </View>

                  <TouchableOpacity
                    activeOpacity={1}
                    onLongPress={() => navigation.navigate('Settings')}
                    delayLongPress={700}
                  >
                    <Text style={styles.brand}>TECNITOWER S.A</Text>
                  </TouchableOpacity>

                  <Text style={styles.welcomeTitle}>Bienvenido</Text>
              
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Iniciar sesión</Text>
               

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Correo electrónico</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="correo@correo.com"
                      placeholderTextColor="#94A3B8"
                      value={email}
                      onChangeText={(value) => {
                        setEmail(value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <PasswordField
                      label="Contraseña"
                      value={password}
                      placeholder="Ingresa tu contraseña"
                      visible={passwordVisible}
                      onChangeText={(value) => {
                        setPassword(value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      onToggleVisibility={() =>
                        setPasswordVisible((current) => !current)
                      }
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.inlineAction}
                    onPress={() => navigation.navigate('PasswordRecovery')}
                  >
                    <Text style={styles.inlineActionText}>
                      ¿Olvidaste tu contraseña?
                    </Text>
                  </TouchableOpacity>

                  {!!errorMessage && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{errorMessage}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      isSubmitting && styles.primaryButtonDisabled,
                    ]}
                    onPress={handleLogin}
                    activeOpacity={0.9}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Ingresar</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.bottomLinkWrap}
                  onPress={() => navigation.navigate('Register')}
                >
                  <Text style={styles.bottomLinkText}>
                    ¿Eres nuevo? <Text style={styles.bottomLinkStrong}>Crear cuenta</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoider: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  wrapper: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  topBrandBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoShell: {
    width: 94,
    height: 94,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  logo: {
    width: 72,
    height: 72,
    resizeMode: 'contain',
  },
  brand: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
    color: '#0F172A',
    marginBottom: 10,
  },
  welcomeTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
 
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: 15,
  },
  inlineAction: {
    alignSelf: 'flex-end',
    marginTop: 2,
    marginBottom: 18,
  },
  inlineActionText: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#B91C1C',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  primaryButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#001F7C',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#001F7C',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.72,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  bottomLinkWrap: {
    alignItems: 'center',
    marginTop: 22,
  },
  bottomLinkText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomLinkStrong: {
    color: '#001F7C',
    fontWeight: '800',
  },
});

export default LoginScreen;
