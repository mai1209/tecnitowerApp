import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";

import { requestPasswordRecovery } from "../services/api";

type Props = {
  navigation: {
    navigate: (screen: string) => void;
  };
};

export default function PasswordRecoveryScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    if (submitting) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setMessage("Ingresá el correo de tu cuenta.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await requestPasswordRecovery({ email: normalizedEmail });
      Alert.alert("Solicitud enviada", response.message);
      navigation.navigate("Login");
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "No se pudo registrar la solicitud.";
      setMessage(nextMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={["#F2F2F2", "#E6EAF4", "#001F7C"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <Text style={styles.title}>Recuperar contraseña</Text>
              <Text style={styles.subtitle}>
                Ingresá tu correo. Si existe una cuenta asociada, registraremos el pedido de
                recuperación para soporte.
              </Text>

              <View style={styles.card}>
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

                {!!message && <Text style={styles.errorText}>{message}</Text>}

                <TouchableOpacity
                  style={[styles.button, submitting && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.buttonText}>Solicitar recuperación</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate("Login")}>
                  <Text style={styles.linkText}>Volver al login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoider: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#334155",
    textAlign: "center",
    marginBottom: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
  },
  label: {
    marginBottom: 6,
    marginLeft: 10,
    color: "#0F172A",
    fontWeight: "700",
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#001F7C",
    borderRadius: 15,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  button: {
    backgroundColor: "#001F7C",
    paddingVertical: 13,
    borderRadius: 18,
    marginTop: 4,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "800",
  },
  linkButton: {
    marginTop: 16,
    alignSelf: "center",
  },
  linkText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    color: "#B00020",
    textAlign: "center",
    marginBottom: 4,
  },
});
