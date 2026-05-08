import React, { useEffect, useMemo, useRef, useState } from "react";
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

import {
  changeCurrentUserPassword,
  deleteCurrentUserAccount,
} from "../services/api";

type Props = {
  navigation?: any;
  session?: {
    token?: string;
    user?: {
      fullName?: string;
      email?: string;
      role?: "admin" | "user";
      canWrite?: boolean;
    };
  } | null;
  onLogout?: () => void;
};

const SUPPORT_EMAIL = "contactotecnitower@gmail.com";

const PRIVACY_POLICY_SECTIONS = [
  {
    title: "Responsable del tratamiento",
    body:
      "Tecnitower S.A. opera esta aplicación para monitoreo, configuración y soporte de controladores de refrigeración. Para consultas de privacidad o soporte podés escribir a contactotecnitower@gmail.com.",
  },
  {
    title: "Datos de cuenta",
    body:
      "Recolectamos nombre o empresa, correo electrónico, rol de usuario, permisos de edición y credenciales protegidas para crear la cuenta, iniciar sesión, administrar accesos y brindar soporte.",
  },
  {
    title: "Datos técnicos y operativos",
    body:
      "La app procesa datos de controladores, identificadores de Elfin, configuración Modbus, temperaturas, setpoints, alertas, estados de conexión, eventos técnicos y registros necesarios para operar el servicio.",
  },
  {
    title: "Notificaciones",
    body:
      "Si aceptás recibir notificaciones push, guardamos un identificador del dispositivo para enviarte alertas operativas, avisos de temperatura y estados relevantes de los equipos asociados a tu cuenta.",
  },
  {
    title: "Uso de la información",
    body:
      "Usamos la información para autenticar usuarios, mostrar controladores asignados, ejecutar comandos autorizados, detectar fallas, enviar alertas, mejorar estabilidad y responder solicitudes de soporte.",
  },
  {
    title: "Terceros e infraestructura",
    body:
      "Podemos usar servicios de infraestructura, base de datos, hosting y mensajería push necesarios para que la app funcione. No vendemos datos personales ni compartimos credenciales con terceros para publicidad.",
  },
  {
    title: "Seguridad y conservación",
    body:
      "Las contraseñas se almacenan con hash y los accesos se protegen con tokens. Conservamos datos de cuenta y operación mientras la cuenta esté activa o mientras sean necesarios para soporte, seguridad y obligaciones legales.",
  },
  {
    title: "Derechos del usuario",
    body:
      "Podés solicitar acceso, corrección o eliminación de tus datos desde Ajustes o escribiendo a soporte. Al eliminar la cuenta se remueven también los controladores asociados, salvo información que deba conservarse por motivos legales o de seguridad.",
  },
];

type SettingsSectionKey =
  | "support"
  | "changePassword"
  | "passwordRecovery"
  | "privacy"
  | "deleteAccount";

function getRoleLabel(role?: string, canWrite?: boolean) {
  if (role === "admin") return "Administrador";
  return canWrite ? "Usuario con edición" : "Usuario solo lectura";
}

export default function SettingsScreen({ navigation, session, onLogout }: Props) {
  const scrollViewRef = useRef<ScrollView | null>(null);
  const panelYRef = useRef(0);
  const shouldScrollToPanelRef = useRef(false);
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>("support");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const isAuthenticated = Boolean(session?.token);
  const sections = useMemo(
    () =>
      [
        {
          key: "support" as const,
          title: "Soporte",
          description: "Contacto para ayuda técnica o revisión de una instalación.",
        },
        isAuthenticated
          ? {
              key: "changePassword" as const,
              title: "Cambiar contraseña",
              description: "Actualizar la clave de acceso de la cuenta.",
            }
          : null,
        {
          key: "passwordRecovery" as const,
          title: "Recuperar contraseña",
          description: "Restablecer la clave con un código de verificación.",
        },
        {
          key: "privacy" as const,
          title: "Políticas de privacidad",
          description: "Datos de cuenta, telemetría, alertas y uso operativo.",
        },
        isAuthenticated
          ? {
              key: "deleteAccount" as const,
              title: "Eliminar cuenta",
              description: "Borrar la cuenta y sus controladores asociados.",
            }
          : null,
      ].filter(Boolean) as Array<{
        key: SettingsSectionKey;
        title: string;
        description: string;
      }>,
    [isAuthenticated]
  );

  useEffect(() => {
    if (!sections.some((section) => section.key === activeSection)) {
      setActiveSection(sections[0]?.key || "support");
    }
  }, [activeSection, sections]);

  useEffect(() => {
    if (!shouldScrollToPanelRef.current) return;

    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(panelYRef.current - 12, 0),
        animated: true,
      });
      shouldScrollToPanelRef.current = false;
    }, 80);

    return () => clearTimeout(timeout);
  }, [activeSection]);

  const supportMailTo = useMemo(
    () =>
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
        "Soporte Tecnitower"
      )}&body=${encodeURIComponent("Hola, necesito ayuda con Tecnitower.")}`,
    []
  );

  const handleSupport = async () => {
    try {
      await Linking.openURL(supportMailTo);
    } catch {
      Alert.alert("Soporte", SUPPORT_EMAIL);
    }
  };

  const handleSelectSection = (sectionKey: SettingsSectionKey) => {
    shouldScrollToPanelRef.current = true;
    setActiveSection(sectionKey);
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
      const response = await changeCurrentUserPassword(
        {
          currentPassword,
          newPassword,
        },
        session.token
      );
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
                {
                  text: "OK",
                  onPress: () => onLogout?.(),
                },
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
    <LinearGradient
      colors={["#F2F4F8", "#E7EDF7", "#CFD9F0"]}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.title}>Ajustes</Text>
        <Text style={styles.subtitle}>
          Cuenta, soporte, seguridad y documentación de la aplicación.
        </Text>

        {isAuthenticated && (
          <View style={styles.card}>
            <Text style={styles.label}>Cuenta actual</Text>
            <Text style={styles.value}>{session?.user?.fullName || "Usuario"}</Text>
            <Text style={styles.secondaryValue}>{session?.user?.email}</Text>
            <Text style={styles.hint}>Perfil: {getRoleLabel(session?.user?.role, session?.user?.canWrite)}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Secciones</Text>
          <View style={styles.sectionList}>
            {sections.map((section) => {
              const selected = activeSection === section.key;
              return (
                <TouchableOpacity
                  key={section.key}
                  style={[styles.sectionItem, selected && styles.sectionItemActive]}
                  onPress={() => handleSelectSection(section.key)}
                >
                  <View style={styles.sectionItemText}>
                    <Text style={[styles.sectionItemTitle, selected && styles.sectionItemTitleActive]}>
                      {section.title}
                    </Text>
                    <Text style={[styles.sectionItemDescription, selected && styles.sectionItemDescriptionActive]}>
                      {section.description}
                    </Text>
                  </View>
                  <Text style={[styles.sectionArrow, selected && styles.sectionArrowActive]}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View onLayout={(event) => { panelYRef.current = event.nativeEvent.layout.y; }}>
          {activeSection === "support" && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Soporte</Text>
              <Text style={styles.hint}>
                Si necesitás ayuda, soporte técnico o revisión de una instalación, escribinos a nuestro correo.
              </Text>
              <TouchableOpacity style={styles.primaryAction} onPress={handleSupport}>
                <Text style={styles.primaryActionText}>Escribir a {SUPPORT_EMAIL}</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeSection === "changePassword" && isAuthenticated && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Cambiar contraseña</Text>
              <InputField
                label="Contraseña actual"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <InputField
                label="Nueva contraseña"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <InputField
                label="Confirmar nueva contraseña"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity
                style={[styles.primaryAction, passwordSaving && styles.buttonDisabled]}
                onPress={handleChangePassword}
                disabled={passwordSaving}
              >
                <Text style={styles.primaryActionText}>
                  {passwordSaving ? "Guardando..." : "Actualizar contraseña"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {activeSection === "passwordRecovery" && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Recuperar contraseña</Text>
              <Text style={styles.hint}>
                Si olvidaste tu clave, podés recibir un código de verificación y crear una nueva contraseña.
              </Text>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => navigation?.navigate?.("PasswordRecovery")}
              >
                <Text style={styles.secondaryActionText}>Ir a recuperar contraseña</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeSection === "privacy" && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Políticas de privacidad</Text>
              {PRIVACY_POLICY_SECTIONS.map((section) => (
                <View key={section.title} style={styles.privacyBlock}>
                  <Text style={styles.privacyTitle}>{section.title}</Text>
                  <Text style={styles.hint}>{section.body}</Text>
                </View>
              ))}
            </View>
          )}

          {activeSection === "deleteAccount" && isAuthenticated && (
            <View style={[styles.card, styles.dangerCard]}>
              <Text style={styles.sectionTitle}>Eliminar cuenta</Text>
              <Text style={styles.hint}>
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
                <Text style={styles.dangerActionText}>
                  {deleteSaving ? "Eliminando..." : "Eliminar cuenta"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
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
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "url";
  placeholder?: string;
};

function InputField({
  label,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  keyboardType,
  placeholder,
}: InputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardAvoider: { flex: 1 },
  content: { padding: 20, paddingTop: 58, paddingBottom: 72 },
  title: { fontSize: 28, fontWeight: "900", color: "#111827" },
  subtitle: { color: "#475569", marginTop: 8, marginBottom: 18, lineHeight: 20 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dangerCard: {
    borderColor: "#FECACA",
    backgroundColor: "#FFF7F7",
  },
  adminNoteCard: {
    backgroundColor: "#0F172A",
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
  },
  adminNoteTitle: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  adminNoteText: { color: "#CBD5E1", marginTop: 8, lineHeight: 20 },
  label: { color: "#6B7280", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  value: { color: "#111827", fontSize: 16, fontWeight: "900", marginTop: 8 },
  secondaryValue: { color: "#475569", marginTop: 4 },
  hint: { color: "#475569", marginTop: 10, lineHeight: 19 },
  privacyBlock: { marginTop: 10 },
  privacyTitle: { color: "#111827", fontSize: 14, fontWeight: "900", marginTop: 6 },
  sectionTitle: { color: "#111827", fontSize: 18, fontWeight: "900" },
  sectionList: { marginTop: 12, gap: 10 },
  sectionItem: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionItemActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  sectionItemText: { flex: 1 },
  sectionItemTitle: { color: "#111827", fontSize: 15, fontWeight: "900" },
  sectionItemTitleActive: { color: "#FFFFFF" },
  sectionItemDescription: { color: "#64748B", marginTop: 4, lineHeight: 18 },
  sectionItemDescriptionActive: { color: "#CBD5E1" },
  sectionArrow: { color: "#64748B", fontSize: 24, fontWeight: "900" },
  sectionArrowActive: { color: "#FFFFFF" },
  loader: { marginTop: 10, alignSelf: "flex-start" },
  field: { marginTop: 14 },
  inputLabel: { color: "#111827", fontSize: 13, fontWeight: "800", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#111827",
    backgroundColor: "#F8FAFC",
  },
  primaryAction: {
    marginTop: 14,
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  primaryActionText: { color: "#FFFFFF", fontWeight: "900" },
  secondaryAction: {
    marginTop: 14,
    backgroundColor: "#E2E8F0",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  secondaryActionText: { color: "#0F172A", fontWeight: "900" },
  dangerAction: {
    marginTop: 14,
    backgroundColor: "#B91C1C",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  dangerActionText: { color: "#FFFFFF", fontWeight: "900" },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 2 },
  halfButton: { flex: 1 },
  buttonDisabled: { opacity: 0.65 },
  topSpacing: { marginTop: 16 },
});
