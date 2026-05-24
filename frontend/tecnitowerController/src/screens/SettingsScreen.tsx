import React, { useMemo } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import {
  ChevronRight,
  Headphones,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react-native";

export type SettingsSectionKey = "support" | "changePassword" | "privacy" | "deleteAccount";

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
};

export const SUPPORT_EMAIL = "contactotecnitower@gmail.com";

export const PRIVACY_POLICY_SECTIONS = [
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

function getRoleLabel(role?: string, canWrite?: boolean) {
  if (role === "admin") return "Administrador";
  return canWrite ? "Usuario con edición" : "Usuario solo lectura";
}

export default function SettingsScreen({ navigation, session }: Props) {
  const isAuthenticated = Boolean(session?.token);
  const sections = useMemo(
    () =>
      [
        {
          key: "support" as const,
          title: "Soporte",
          description: "Ayuda técnica y contacto con Tecnitower.",
          icon: Headphones,
        },
        isAuthenticated
          ? {
              key: "changePassword" as const,
              title: "Cambiar contraseña",
              description: "Actualizá la clave de acceso de la cuenta.",
              icon: LockKeyhole,
            }
          : null,
        {
          key: "passwordRecovery" as const,
          title: "Recuperar contraseña",
          description: "Restablecé tu clave con código de verificación.",
          icon: KeyRound,
        },
        {
          key: "privacy" as const,
          title: "Políticas de privacidad",
          description: "Datos, telemetría, seguridad y derechos del usuario.",
          icon: ShieldCheck,
        },
        isAuthenticated
          ? {
              key: "deleteAccount" as const,
              title: "Eliminar cuenta",
              description: "Borrado definitivo de cuenta y controladores.",
              icon: Trash2,
              danger: true,
            }
          : null,
      ].filter(Boolean) as Array<{
        key: SettingsSectionKey | "passwordRecovery";
        title: string;
        description: string;
        icon: any;
        danger?: boolean;
      }>,
    [isAuthenticated]
  );

  const openSection = (key: SettingsSectionKey | "passwordRecovery") => {
    if (key === "passwordRecovery") {
      navigation?.navigate?.("PasswordRecovery", { returnTo: "settings" });
      return;
    }
    navigation?.navigate?.("SettingsSection", { section: key });
  };

  return (
    <LinearGradient colors={["#F4F7FB", "#E8EEF8"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Ajustes</Text>
        <Text style={styles.title}>Cuenta y soporte</Text>

        {isAuthenticated && (
          <View style={styles.accountCard}>
            <View style={styles.accountIcon}>
              <UserRound color="#FFFFFF" size={22} strokeWidth={2.2} />
            </View>
            <View style={styles.accountCopy}>
              <Text style={styles.accountName}>{session?.user?.fullName || "Usuario"}</Text>
              <Text style={styles.accountEmail}>{session?.user?.email}</Text>
              <Text style={styles.accountRole}>{getRoleLabel(session?.user?.role, session?.user?.canWrite)}</Text>
            </View>
          </View>
        )}

        <View style={styles.sectionList}>
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <TouchableOpacity
                key={section.key}
                style={[styles.sectionItem, section.danger && styles.sectionItemDanger]}
                onPress={() => openSection(section.key)}
                activeOpacity={0.82}
              >
                <View style={[styles.sectionIcon, section.danger && styles.sectionIconDanger]}>
                  <Icon color={section.danger ? "#991B1B" : "#0F172A"} size={20} strokeWidth={2.2} />
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={[styles.sectionTitle, section.danger && styles.sectionTitleDanger]}>
                    {section.title}
                  </Text>
                  <Text style={styles.sectionDescription}>{section.description}</Text>
                </View>
                <ChevronRight color="#94A3B8" size={21} strokeWidth={2.3} />
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.mailButton}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
        >
          <Mail color="#0F172A" size={18} strokeWidth={2.2} />
          <Text style={styles.mailButtonText}>{SUPPORT_EMAIL}</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 42 },
  eyebrow: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  title: { color: "#0F172A", fontSize: 32, fontWeight: "900", marginTop: 8 , marginBottom: 20},
  accountCard: {
    backgroundColor: "#0F172A",
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  accountCopy: { flex: 1 },
  accountName: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  accountEmail: { color: "#CBD5E1", marginTop: 4 },
  accountRole: { color: "#93C5FD", marginTop: 5, fontSize: 12, fontWeight: "800" },
  sectionList: { gap: 12 },
  sectionItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDE7F3",
  },
  sectionItemDanger: { borderColor: "#FECACA", backgroundColor: "#FFF7F7" },
  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sectionIconDanger: { backgroundColor: "#FEE2E2" },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: "#0F172A", fontSize: 16, fontWeight: "900" },
  sectionTitleDanger: { color: "#991B1B" },
  sectionDescription: { color: "#64748B", lineHeight: 19, marginTop: 3 },
  mailButton: {
    marginTop: 18,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mailButtonText: { color: "#0F172A", fontWeight: "800" },
});
