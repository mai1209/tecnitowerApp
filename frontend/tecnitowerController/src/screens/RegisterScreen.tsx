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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { registerUser } from '../services/api';

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
      const message = err instanceof Error ? err.message : 'No se pudo completar el registro.';
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
              />

              <Text style={styles.title}>TECNITOWER S.A</Text>
              <Text style={styles.subtitle}>Registrarme</Text>
              <View style={styles.containerInput}>
                <View>
                  <Text style={styles.label}>E-mail</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    placeholder="correo@correo.com"
                    placeholderTextColor="#9CA3AF"
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View>
                  <Text style={styles.label}>Usuario/Empresa</Text>
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    placeholder="Usuario/Empresa"
                    placeholderTextColor="#9CA3AF"
                    onChangeText={setFullName}
                  />
                </View>
                <View>
                  <Text style={styles.label}>Contraseña</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    placeholder="Contraseña"
                    placeholderTextColor="#9CA3AF"
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
                <View>
                  <Text style={styles.label}>Repetir contraseña</Text>
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    placeholder="Repetir contraseña"
                    placeholderTextColor="#9CA3AF"
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>
                {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleRegister}
                  activeOpacity={0.8}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.buttonText}>Registrarse</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.register}>
          ¿Ya tienes una cuenta? Inicia sesión
        </Text>
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
    borderRadius: 18,
    marginTop: 40,
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
  input: {
    marginBottom: 13,
    height: 45,
    borderWidth: 1,
    borderColor: '#001F7C',
    borderRadius: 15,
    paddingLeft: 10,
  },
  content: {
    flex: 1,
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
    marginTop: 4,
  },
});

export default RegisterScreen;
