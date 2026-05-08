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

import {
  requestPasswordRecovery,
  resetPasswordWithRecoveryCode,
  verifyPasswordRecoveryCode,
} from "../services/api";

type Props = {
  navigation: {
    navigate: (screen: string) => void;
  };
};

type Step = "email" | "code" | "password";

export default function PasswordRecoveryScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const normalizedEmail = email.trim().toLowerCase();

  const handleRequestCode = async () => {
    if (submitting) return;
    if (!normalizedEmail) {
      setMessage("Ingresá el correo de tu cuenta.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await requestPasswordRecovery({ email: normalizedEmail });
      setStep("code");
      Alert.alert("Código enviado", response.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar el código.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (submitting) return;
    const cleanCode = code.replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setMessage("Ingresá el código de 6 dígitos.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      await verifyPasswordRecoveryCode({ email: normalizedEmail, code: cleanCode });
      setCode(cleanCode);
      setStep("password");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo verificar el código.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (submitting) return;
    if (newPassword.length < 8) {
      setMessage("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await resetPasswordWithRecoveryCode({
        email: normalizedEmail,
        code,
        newPassword,
      });
      Alert.alert("Contraseña actualizada", response.message, [
        { text: "Ir al login", onPress: () => navigation.navigate("Login") },
      ]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la contraseña.");
    } finally {
      setSubmitting(false);
    }
  };

  const buttonText =
    step === "email"
      ? "Enviar código"
      : step === "code"
        ? "Verificar código"
        : "Guardar nueva contraseña";

  const handlePrimaryAction =
    step === "email"
      ? handleRequestCode
      : step === "code"
        ? handleVerifyCode
        : handleResetPassword;

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
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.content}>
              <Text style={styles.title}>Recuperar contraseña</Text>
              <Text style={styles.subtitle}>
                Te enviaremos un código de 6 dígitos para verificar tu cuenta y crear una nueva contraseña.
              </Text>

              <View style={styles.card}>
                <StepIndicator step={step} />

                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  style={[styles.input, step !== "email" && styles.inputDisabled]}
                  value={email}
                  placeholder="correo@correo.com"
                  placeholderTextColor="#9CA3AF"
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={step === "email" && !submitting}
                />

                {step !== "email" && (
                  <>
                    <Text style={styles.label}>Código de verificación</Text>
                    <TextInput
                      style={styles.input}
                      value={code}
                      placeholder="000000"
                      placeholderTextColor="#9CA3AF"
                      onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      editable={step === "code" && !submitting}
                    />
                  </>
                )}

                {step === "password" && (
                  <>
                    <Text style={styles.label}>Nueva contraseña</Text>
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      placeholder="Mínimo 8 caracteres"
                      placeholderTextColor="#9CA3AF"
                      onChangeText={setNewPassword}
                      secureTextEntry
                    />

                    <Text style={styles.label}>Confirmar contraseña</Text>
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      placeholder="Repetí la nueva contraseña"
                      placeholderTextColor="#9CA3AF"
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                    />
                  </>
                )}

                {!!message && <Text style={styles.errorText}>{message}</Text>}

                <TouchableOpacity
                  style={[styles.button, submitting && styles.buttonDisabled]}
                  onPress={handlePrimaryAction}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.buttonText}>{buttonText}</Text>
                  )}
                </TouchableOpacity>

                {step === "code" && (
                  <TouchableOpacity style={styles.linkButton} onPress={handleRequestCode} disabled={submitting}>
                    <Text style={styles.linkText}>Reenviar código</Text>
                  </TouchableOpacity>
                )}

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

function StepIndicator({ step }: { step: Step }) {
  const activeIndex = step === "email" ? 0 : step === "code" ? 1 : 2;
  return (
    <View style={styles.stepRow}>
      {["Email", "Código", "Clave"].map((label, index) => (
        <View key={label} style={[styles.stepPill, index <= activeIndex && styles.stepPillActive]}>
          <Text style={[styles.stepText, index <= activeIndex && styles.stepTextActive]}>{label}</Text>
        </View>
      ))}
    </View>
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
    paddingBottom: 48,
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
  stepRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  stepPill: {
    flex: 1,
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepPillActive: {
    backgroundColor: "#001F7C",
  },
  stepText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },
  stepTextActive: {
    color: "#FFFFFF",
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
    color: "#0F172A",
  },
  inputDisabled: {
    backgroundColor: "#F1F5F9",
    color: "#64748B",
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
    color: "#001F7C",
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    color: "#B00020",
    textAlign: "center",
    marginBottom: 10,
    fontWeight: "700",
  },
});
