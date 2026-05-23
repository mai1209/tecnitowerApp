import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { ChevronLeft, Headphones, LockKeyhole, ShieldCheck, Trash2 } from "lucide-react-native";
import {
  changeCurrentUserPassword,
  deleteCurrentUserAccount,
} from "../services/api";
import {
  PRIVACY_POLICY_SECTIONS,
  SettingsSectionKey,
  SUPPORT_EMAIL,
} from "./SettingsScreen";

type Props = {
  navigation?: any;
  route?: { params?: { section?: SettingsSectionKey } };
  session?: { token?: string } | null;
  onLogout?: () => void;
};

const SECTION_META = {
  support: {
    title: "Soporte",
    subtitle: "Contacto para asistencia técnica y revisión de instalaciones.",
    icon: Headphones,
  },
  changePassword: {
    title: "Cambiar contraseña",
    subtitle: "Actualizá tu clave de acceso de forma segura.",
    icon: LockKeyhole,
  },
  privacy: {
    title: "Políticas de privacidad",
    subtitle: "Datos procesados, seguridad, infraestructura y derechos.",
    icon: ShieldCheck,
  },
  deleteAccount: {
    title: "Eliminar cuenta",
    subtitle: "Borrado definitivo de cuenta y controladores asociados.",
    icon: Trash2,
    danger: true,
  },
};

export default function SettingsSectionScreen({ navigation, route, session, onLogout }: Props) {
  const section = route?.params?.section ?? "support";
  const meta = SECTION_META[section] ?? SECTION_META.support;
  const Icon = meta.icon;
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const supportMailTo = useMemo(
    () =>
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Soporte Tecnitower")}&body=${encodeURIComponent(
        "Hola, necesito ayuda con Tecnitower."
      )}`,
    []
  );

  const handleSupport = async () => {
    try {
      await Linking.openURL(supportMailTo);
    } catch {
      Alert.alert("Soporte", SUPPORT_EMAIL);
    }
  };

  const handleChangePassword = async () => {
    if (!session?.token) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Completá la contraseña actual, la nueva y la confirmación.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Error", "La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "La confirmación no coincide con la nueva contraseña.");
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await changeCurrentUserPassword({ currentPassword, newPassword }, session.token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("OK", response.message);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No se pudo cambiar la contraseña.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!session?.token) return;
    if (!deletePassword) {
      Alert.alert("Error", "Ingresá tu contraseña para eliminar la cuenta.");
      return;
    }

    Alert.alert(
      "Eliminar cuenta",
      "Se eliminará tu cuenta y también los controladores asociados. Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setDeleteSaving(true);
            try {
              const response = await deleteCurrentUserAccount(deletePassword, session.token!);
              setDeletePassword("");
              Alert.alert("Cuenta eliminada", response.message, [
                { text: "OK", onPress: () => onLogout?.() },
              ]);
            } catch (error: any) {
              Alert.alert("Error", error?.message || "No se pudo eliminar la cuenta.");
            } finally {
              setDeleteSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <LinearGradient colors={["#F4F7FB", "#E8EEF8"]} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack?.()}>
            <ChevronLeft color="#0F172A" size={20} strokeWidth={2.5} />
            <Text style={styles.backButtonText}>Ajustes</Text>
          </TouchableOpacity>

          <View style={[styles.hero, meta.danger && styles.heroDanger]}>
            <View style={[styles.heroIcon, meta.danger && styles.heroIconDanger]}>
              <Icon color={meta.danger ? "#991B1B" : "#FFFFFF"} size={24} strokeWidth={2.3} />
            </View>
            <Text style={[styles.title, meta.danger && styles.titleDanger]}>{meta.title}</Text>
            <Text style={styles.subtitle}>{meta.subtitle}</Text>
          </View>

          {section === "support" && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Contacto</Text>
              <Text style={styles.bodyText}>
                Si necesitás ayuda, soporte técnico o revisión de una instalación, escribinos a nuestro correo.
              </Text>
              <TouchableOpacity style={styles.primaryAction} onPress={handleSupport}>
                <Text style={styles.primaryActionText}>Escribir a {SUPPORT_EMAIL}</Text>
              </TouchableOpacity>
            </View>
          )}

          {section === "changePassword" && (
            <View style={styles.card}>
              <InputField label="Contraseña actual" secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} />
              <InputField label="Nueva contraseña" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
              <InputField label="Confirmar nueva contraseña" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
              <TouchableOpacity
                style={[styles.primaryAction, passwordSaving && styles.buttonDisabled]}
                onPress={handleChangePassword}
                disabled={passwordSaving}
              >
                <Text style={styles.primaryActionText}>{passwordSaving ? "Guardando..." : "Actualizar contraseña"}</Text>
              </TouchableOpacity>
            </View>
          )}

          {section === "privacy" && (
            <View style={styles.card}>
              {PRIVACY_POLICY_SECTIONS.map((item, index) => (
                <View key={item.title} style={[styles.privacyBlock, index === 0 && styles.privacyBlockFirst]}>
                  <Text style={styles.privacyTitle}>{item.title}</Text>
                  <Text style={styles.bodyText}>{item.body}</Text>
                </View>
              ))}
            </View>
          )}

          {section === "deleteAccount" && (
            <View style={[styles.card, styles.dangerCard]}>
              <Text style={styles.bodyText}>
                Esta acción elimina tu cuenta y también los controladores asociados. No se puede deshacer.
              </Text>
              <InputField
                label="Confirmá con tu contraseña"
                secureTextEntry
                value={deletePassword}
                onChangeText={setDeletePassword}
              />
              <TouchableOpacity
                style={[styles.dangerAction, deleteSaving && styles.buttonDisabled]}
                onPress={handleDeleteAccount}
                disabled={deleteSaving}
              >
                <Text style={styles.dangerActionText}>{deleteSaving ? "Eliminando..." : "Eliminar cuenta"}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
};

function InputField({ label, value, onChangeText, secureTextEntry }: InputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        placeholderTextColor="#94A3B8"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  keyboardAvoider: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: 48 },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  backButtonText: { color: "#0F172A", fontWeight: "900", marginLeft: 4 },
  hero: { backgroundColor: "#0F172A", borderRadius: 26, padding: 18, marginBottom: 16 },
  heroDanger: { backgroundColor: "#FFF7F7", borderWidth: 1, borderColor: "#FECACA" },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroIconDanger: { backgroundColor: "#FEE2E2" },
  title: { color: "#FFFFFF", fontSize: 27, fontWeight: "900" },
  titleDanger: { color: "#991B1B" },
  subtitle: { color: "#CBD5E1", lineHeight: 21, marginTop: 8 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#DDE7F3",
  },
  dangerCard: { borderColor: "#FECACA", backgroundColor: "#FFF7F7" },
  cardTitle: { color: "#0F172A", fontSize: 18, fontWeight: "900" },
  bodyText: { color: "#475569", lineHeight: 21, marginTop: 8 },
  field: { marginTop: 14 },
  inputLabel: { color: "#0F172A", fontSize: 13, fontWeight: "900", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  primaryAction: {
    marginTop: 16,
    backgroundColor: "#0F172A",
    borderRadius: 15,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryActionText: { color: "#FFFFFF", fontWeight: "900" },
  dangerAction: {
    marginTop: 16,
    backgroundColor: "#B91C1C",
    borderRadius: 15,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerActionText: { color: "#FFFFFF", fontWeight: "900" },
  buttonDisabled: { opacity: 0.65 },
  privacyBlock: { borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 14, marginTop: 14 },
  privacyBlockFirst: { borderTopWidth: 0, paddingTop: 0, marginTop: 0 },
  privacyTitle: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
});
