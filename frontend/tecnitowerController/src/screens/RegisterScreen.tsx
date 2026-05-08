import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  Text,
  TextInput,
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

import { registerUser } from '../services/api';
import PasswordField from '../components/PasswordField';

type Props = {
  navigation: {
    navigate: (screen: string) => void;
  };
};

function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRegister = async () => {
    if (isSubmitting) return;

    if (!email || !fullName || !password || !confirmPassword) {
      setErrorMessage('Completa todos los campos para registrarte.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await registerUser({
        email,
        fullName,
        password,
      });

      Alert.alert(
        'Registro exitoso',
        'Tu cuenta fue creada. Ahora puedes iniciar sesión.',
        [{ text: 'Ir al login', onPress: () => navigation.navigate('Login') }]
      );

      setEmail('');
      setFullName('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo completar el registro.';
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
                    />
                  </View>

                  <Text style={styles.brand}>TECNITOWER S.A</Text>
                  <Text style={styles.welcomeTitle}>Crear cuenta</Text>
                  <Text style={styles.welcomeSubtitle}>
                    Registrá tu usuario para comenzar a operar y monitorear tus equipos.
                  </Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Registro</Text>
                  <Text style={styles.cardSubtitle}>
                    Completá los datos para dar de alta tu cuenta.
                  </Text>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Correo electrónico</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      placeholder="correo@correo.com"
                      placeholderTextColor="#94A3B8"
                      onChangeText={(value) => {
                        setEmail(value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Usuario / Empresa</Text>
                    <TextInput
                      style={styles.input}
                      value={fullName}
                      placeholder="Usuario o empresa"
                      placeholderTextColor="#94A3B8"
                      onChangeText={(value) => {
                        setFullName(value);
                        if (errorMessage) setErrorMessage('');
                      }}
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

                  <View style={styles.formGroup}>
                    <PasswordField
                      label="Repetir contraseña"
                      value={confirmPassword}
                      placeholder="Repite tu contraseña"
                      visible={confirmPasswordVisible}
                      onChangeText={(value) => {
                        setConfirmPassword(value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      onToggleVisibility={() =>
                        setConfirmPasswordVisible((current) => !current)
                      }
                    />
                  </View>

                  <Text style={styles.helperText}>
                    Usá una contraseña segura de al menos 8 caracteres.
                  </Text>

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
                    onPress={handleRegister}
                    activeOpacity={0.9}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Registrarme</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.bottomLinkWrap}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.bottomLinkText}>
                    ¿Ya tienes una cuenta?{' '}
                    <Text style={styles.bottomLinkStrong}>Inicia sesión</Text>
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
  welcomeSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
    maxWidth: 320,
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
  cardSubtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 21,
    marginBottom: 22,
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
  helperText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: -2,
    marginBottom: 16,
    marginLeft: 4,
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
    marginTop: 4,
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

export default RegisterScreen;
