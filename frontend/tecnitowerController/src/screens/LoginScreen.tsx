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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { loginUser } from '../services/api';
import { AuthSession } from '../types/auth';

type Props = {
  onLogin?: (session: AuthSession) => void;
  navigation: {
    navigate: (screen: string) => void;
  };
};

function LoginScreen({ onLogin, navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    if (isSubmitting) return;

    if (!email || !password) {
      setErrorMessage('Completa tu correo y contraseña.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await loginUser({ email, password });
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
        role: (rawUser.role === 'admin' || rawUser.role === 'technician' || rawUser.role === 'viewer')
          ? rawUser.role
          : 'technician',
      };

      onLogin?.({ token, user });
      Alert.alert('Bienvenido', `Hola ${user.fullName || 'Usuario'}`.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo iniciar sesión.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={['#F2F2F2', '#E6EAF4', '#001F7C']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logo}
                accessible
                accessibilityLabel="Logo Tecnitower"
              />
              <TouchableOpacity
                activeOpacity={1}
                onLongPress={() => navigation.navigate('Settings')}
                delayLongPress={700}
              >
                <Text style={styles.title}>TECNITOWER S.A</Text>
              </TouchableOpacity>
              <Text style={styles.subtitle}>Iniciar sesión</Text>

              <View style={styles.containerInput}>
                <View>
                  <Text style={styles.label}>E-mail</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="correo@correo.com"
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                </View>

                <View>
                  <Text style={styles.label}>Contraseña</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="contraseña"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
                <Text style={styles.forgotPass}>¿Olvidó su contraseña?</Text>
                {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

                <TouchableOpacity
                  style={styles.button}
                  onPress={handleLogin}
                  activeOpacity={0.8}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.buttonText}>Iniciar sesión</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.register}>¿Eres nuevo? Registrate</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 60,
    flex: 1,
  },
  keyboardAvoider: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  logo: {
    width: 82,
    height: 84,
    alignSelf: 'center',
    marginBottom: 5,
  },
  title: {
    textAlign: 'center',
    fontSize: 8,
    fontWeight: 600,
  },
  subtitle: {
    marginTop: 25,
    textAlign: 'center',
    fontSize: 25,
    fontWeight: 500,
    fontFamily: 'Anuphan',
  },
  button: {
    backgroundColor: '#001F7C',
    padding: 13,
    width: '100%',
    margin: 'auto',
    borderRadius: 18,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
  },
  containerInput: {
    padding: 12,
    width: 340,
    alignSelf: 'center',
    marginTop: 19,
  },
  content: {
    flex: 1,
  },
  input: {
    marginBottom: 13,
    height: 45,
    borderWidth: 1,
    borderColor: '#001F7C',
    borderRadius: 15,
    paddingLeft: 10,
  },
  label: {
    marginBottom: 5,
    marginLeft: 17,
  },
  forgotPass: {
    textAlign: 'right',
    marginBottom: 40,
  },
  register: {
    color: '#ffffff',
    margin: 'auto',
    marginBottom: 45,
  },
  errorText: {
    color: '#B00020',
    textAlign: 'center',
    marginBottom: 12,
  },
});

export default LoginScreen;
