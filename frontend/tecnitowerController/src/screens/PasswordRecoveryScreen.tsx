import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { ChevronLeft } from "lucide-react-native";
import LinearGradient from "react-native-linear-gradient";

import PasswordField from "../components/PasswordField";
import {
  requestPasswordRecovery,
  resetPasswordWithRecoveryCode,
  verifyPasswordRecoveryCode,
} from "../services/api";

type Props = {
  navigation: {
    canGoBack?: () => boolean;
    goBack?: () => void;
    navigate: (screen: string) => void;
  };
  route?: {
    params?: {
      returnTo?: "settings";
    };
  };
  onLogout?: () => void;
};

type Step = "email" | "code" | "password";

export default function PasswordRecoveryScreen({ navigation, route, onLogout }: Props) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const normalizedEmail = email.trim().toLowerCase();
  const openedFromSettings = route?.params?.returnTo === "settings";

  const goBackSafely = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack?.();
      return;
    }
    navigation.navigate("Login");
  };

  const goToPreviousEntry = () => {
    if (openedFromSettings) {
      goBackSafely();
      return;
    }
    if (onLogout && !openedFromSettings) {
      onLogout();
      return;
    }
    navigation.navigate("Login");
  };

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
        { text: openedFromSettings ? "Volver a ajustes" : "Ir al login", onPress: goToPreviousEntry },
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
      colors={["#F8FAFC", "#E8EEF9", "#C9D6F2"]}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.screen}
    >
      <SafeAreaView style={styles.safeArea}>
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
              <View style={styles.wrapper}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={goToPreviousEntry}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={openedFromSettings ? "Volver a ajustes" : "Volver al login"}
                >
                  <ChevronLeft color="#0F172A" size={22} strokeWidth={2.5} />
                </TouchableOpacity>

                <View style={styles.topBrandBlock}>
                  <View style={styles.logoShell}>
                    <Image
                      source={require("../../assets/logo.png")}
                      style={styles.logo}
                      accessible
                      accessibilityLabel="Logo Tecnitower"
                    />
                  </View>
                  <Text style={styles.brand}>TECNITOWER S.A</Text>
                  <Text style={styles.title}>Recuperar contraseña</Text>
                  <Text style={styles.subtitle}>
                    Usá tu correo para recibir el código y crear una nueva clave.
                  </Text>
                </View>

                <View style={styles.card}>
                  <StepIndicator step={step} />

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Correo electrónico</Text>
                    <TextInput
                      style={[styles.input, step !== "email" && styles.inputDisabled]}
                      value={email}
                      placeholder="correo@correo.com"
                      placeholderTextColor="#94A3B8"
                      onChangeText={(value) => {
                        setEmail(value);
                        if (message) setMessage("");
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={step === "email" && !submitting}
                    />
                  </View>

                  {step !== "email" && (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Código de verificación</Text>
                      <TextInput
                        style={[styles.input, styles.codeInput, step !== "code" && styles.inputDisabled]}
                        value={code}
                        placeholder="000000"
                        placeholderTextColor="#94A3B8"
                        onChangeText={(value) => {
                          setCode(value.replace(/\D/g, "").slice(0, 6));
                          if (message) setMessage("");
                        }}
                        keyboardType="number-pad"
                        maxLength={6}
                        editable={step === "code" && !submitting}
                      />
                    </View>
                  )}

                  {step === "password" && (
                    <>
                      <View style={styles.formGroup}>
                        <PasswordField
                          label="Nueva contraseña"
                          value={newPassword}
                          placeholder="Mínimo 8 caracteres"
                          visible={newPasswordVisible}
                          onChangeText={(value) => {
                            setNewPassword(value);
                            if (message) setMessage("");
                          }}
                          onToggleVisibility={() => setNewPasswordVisible((current) => !current)}
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <PasswordField
                          label="Confirmar contraseña"
                          value={confirmPassword}
                          placeholder="Repetí la nueva contraseña"
                          visible={confirmPasswordVisible}
                          onChangeText={(value) => {
                            setConfirmPassword(value);
                            if (message) setMessage("");
                          }}
                          onToggleVisibility={() => setConfirmPasswordVisible((current) => !current)}
                        />
                      </View>
                    </>
                  )}

                  {!!message && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{message}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
                    onPress={handlePrimaryAction}
                    activeOpacity={0.9}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>{buttonText}</Text>
                    )}
                  </TouchableOpacity>

                  {step === "code" && (
                    <TouchableOpacity style={styles.inlineAction} onPress={handleRequestCode} disabled={submitting}>
                      <Text style={styles.inlineActionText}>Reenviar código</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.bottomLinkWrap} onPress={goToPreviousEntry}>
                    <Text style={styles.bottomLinkText}>
                      Volver {openedFromSettings ? "a " : "al "}
                      <Text style={styles.bottomLinkStrong}>{openedFromSettings ? "ajustes" : "login"}</Text>
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.78)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  topBrandBlock: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoShell: {
    width: 94,
    height: 94,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.72)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  logo: {
    width: 72,
    height: 72,
    resizeMode: "contain",
  },
  brand: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.2,
    color: "#0F172A",
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    maxWidth: 320,
    fontSize: 14,
    lineHeight: 21,
    color: "#334155",
    textAlign: "center",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  stepRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  stepPill: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: "#E8EEF9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },
  stepPillActive: {
    backgroundColor: "#001F7C",
    borderColor: "#001F7C",
  },
  stepText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "800",
  },
  stepTextActive: {
    color: "#FFFFFF",
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
    marginLeft: 4,
  },
  formGroup: {
    marginBottom: 14,
  },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: "#F8FAFC",
    color: "#0F172A",
    fontSize: 15,
  },
  codeInput: {
    textAlign: "center",
    letterSpacing: 6,
    fontSize: 20,
    fontWeight: "800",
  },
  inputDisabled: {
    backgroundColor: "#EEF2F7",
    color: "#64748B",
  },
  primaryButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#001F7C",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#001F7C",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  primaryButtonDisabled: {
    opacity: 0.72,
  },
  inlineAction: {
    alignSelf: "center",
    marginTop: 16,
  },
  inlineActionText: {
    color: "#1D4ED8",
    fontWeight: "700",
    fontSize: 13,
  },
  bottomLinkWrap: {
    alignItems: "center",
    marginTop: 22,
  },
  bottomLinkText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "500",
  },
  bottomLinkStrong: {
    color: "#001F7C",
    fontWeight: "800",
  },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorText: {
    color: "#B91C1C",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
});
