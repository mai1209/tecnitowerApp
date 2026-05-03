import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AlertTriangle, ChevronRight, Layers3, Trash2, UserRound } from "lucide-react-native";
import AppLayout from "../layouts/AppLayout";
import { deleteAdminUser, fetchAdminUsers } from "../services/api";
import { AuthSession } from "../types/auth";

type Props = {
  navigation: any;
  session: AuthSession;
  onLogout: () => void;
};

function buildUserPreview(user: any) {
  const controllers = Array.isArray(user?.controllers) ? user.controllers : [];
  const firstController = controllers[0];
  const onlineCount = controllers.filter((controller: any) => controller?.connectionState?.online).length;
  const alertCount = controllers.filter((controller: any) => controller?.alertState?.active).length;

  return {
    firstController,
    onlineCount,
    alertCount,
  };
}

function getUserModeLabel(user: any) {
  if (user?.role === "admin") return "Administrador";
  return user?.canWrite === false ? "Usuario solo lectura" : "Usuario con edición";
}

function buildActiveAlerts(users: any[]) {
  const alerts = [];

  for (const user of users ?? []) {
    for (const controller of user?.controllers ?? []) {
      if (!controller?.alertState?.active) continue;
      alerts.push({
        user,
        controller,
        type: controller.alertState.type ?? "none",
        message: controller.alertState.message ?? "Alerta activa",
        since: controller.alertState.since ?? null,
      });
    }
  }

  return alerts.sort((a, b) => {
    const aTime = a.since ? new Date(a.since).getTime() : 0;
    const bTime = b.since ? new Date(b.since).getTime() : 0;
    return bTime - aTime;
  });
}

export default function AdminDashboardScreen({ navigation, session, onLogout }: Props) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingUserId, setDeletingUserId] = useState("");
  const activeAlerts = buildActiveAlerts(users);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        setError("");
        try {
          const response = await fetchAdminUsers(session.token);
          if (active) setUsers(response.users ?? []);
        } catch (err: any) {
          if (active) setError(err?.message || "No se pudo cargar el panel admin");
        } finally {
          if (active) setLoading(false);
        }
      }

      load();
      return () => {
        active = false;
      };
    }, [session.token])
  );

  const handleDeleteUser = (user: any) => {
    Alert.alert(
      "Eliminar usuario",
      `Se eliminará ${user.fullName || user.email} y también todos sus controladores asociados.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setDeletingUserId(String(user._id));
            try {
              await deleteAdminUser(String(user._id), session.token);
              setUsers((current) => current.filter((item) => String(item._id) !== String(user._id)));
              Alert.alert("OK", "Usuario eliminado correctamente");
            } catch (err: any) {
              Alert.alert("Error", err?.message || "No se pudo eliminar el usuario");
            } finally {
              setDeletingUserId("");
            }
          },
        },
      ]
    );
  };

  return (
    <AppLayout navigation={navigation} onLogout={onLogout} session={session}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Panel: lista de usuarios</Text>
          <Text style={styles.title}>Lista de usuarios registrados</Text>
          <Text style={styles.subtitle}>
            Elegí un usuario para ver sus controladores y entrar al panel técnico de cada equipo.
          </Text>
          <TouchableOpacity
            style={styles.modelsButton}
            onPress={() => navigation.navigate("DeviceModelAdmin")}
          >
            <Layers3 color="#FFFFFF" size={16} />
            <Text style={styles.modelsButtonText}>Carga de modelos y registros</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator color="#0F172A" style={styles.loading} />}
        {!!error && (
          <View style={styles.errorCard}>
            <Text style={styles.error}>{error}</Text>
            {error.includes("Ruta no encontrada") && (
              <Text style={styles.errorHint}>
                El backend al que apunta esta app no tiene desplegadas las rutas admin. Hay que revisar la URL activa en Soporte técnico o hacer pull/restart en el servidor.
              </Text>
            )}
          </View>
        )}

        {!loading && !error && (
          <View style={styles.alertsCard}>
            <View style={styles.alertsHeader}>
              <AlertTriangle color={activeAlerts.length ? "#92400E" : "#64748B"} size={18} />
              <Text style={styles.alertsTitle}>Alertas activas</Text>
            </View>
            <Text style={styles.alertsSubtitle}>
              {activeAlerts.length
                ? `${activeAlerts.length} controlador(es) con alerta activa en este momento.`
                : "No hay alertas activas en usuarios finales."}
            </Text>

            {activeAlerts.slice(0, 6).map((item) => (
              <TouchableOpacity
                key={`${item.user._id}-${item.controller._id}`}
                style={styles.alertRow}
                activeOpacity={0.92}
                onPress={() =>
                  navigation.navigate("AdminUserControllers", {
                    userId: item.user._id,
                    user: item.user,
                  })
                }
              >
                <View style={styles.alertRowCopy}>
                  <Text style={styles.alertRowTitle}>{item.controller.name}</Text>
                  <Text style={styles.alertRowMeta}>
                    {item.user.fullName || item.user.email} · {item.type}
                  </Text>
                  <Text style={styles.alertRowText}>{item.message}</Text>
                </View>
                <ChevronRight color="#92400E" size={16} strokeWidth={2.2} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!loading && !error && users.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No hay usuarios cargados</Text>
          </View>
        )}

        {users.map((user) => {
          const preview = buildUserPreview(user);
          return (
            <View key={user._id} style={styles.userCard}>
              <View style={styles.userHeader}>
                <TouchableOpacity
                  style={styles.userHeaderMain}
                  activeOpacity={0.92}
                  onPress={() =>
                    navigation.navigate("AdminUserControllers", {
                      userId: user._id,
                      user,
                    })
                  }
                >
                  <View style={styles.userIcon}>
                    <UserRound color="#0F172A" size={20} strokeWidth={2.2} />
                  </View>
                  <View style={styles.userCopy}>
                    <Text style={styles.userLabel}>Usuario: {user.fullName || "Sin nombre"}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    <Text style={styles.userMeta}>
                      {getUserModeLabel(user)} · {user.controllersCount ?? 0} controladores · Online {preview.onlineCount}
                    </Text>
                  </View>
                  <ChevronRight color="#0F172A" size={18} strokeWidth={2.4} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deleteBadge,
                    deletingUserId === String(user._id) && styles.deleteBadgeDisabled,
                  ]}
                  onPress={() => handleDeleteUser(user)}
                  disabled={deletingUserId === String(user._id)}
                >
                  <Trash2 color="#B91C1C" size={16} strokeWidth={2.3} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.previewCard}
                activeOpacity={0.92}
                onPress={() =>
                  navigation.navigate("AdminUserControllers", {
                    userId: user._id,
                    user,
                  })
                }
              >
                <Text style={styles.previewTitle}>Vista previa</Text>
                <Text style={styles.previewText}>
                  {preview.firstController
                    ? `Modelo principal: ${preview.firstController.deviceModel || preview.firstController.dixellModel || "Sin modelo"}`
                    : "Todavía no tiene controladores asignados"}
                </Text>
                <Text style={styles.previewText}>
                  {preview.firstController
                    ? `Equipo ejemplo: ${preview.firstController.name} · ${preview.firstController.elfinId}`
                    : "Sin equipos para mostrar"}
                </Text>
                <Text style={styles.previewText}>
                  Alertas activas: {preview.alertCount}
                </Text>
                <Text style={styles.previewText}>
                  Dispositivos push: {user?.pushDevicesEnabledCount ?? 0}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingTop: 70,
    paddingBottom: 34,
    backgroundColor: "#F3F4F6",
  },
  hero: {
    backgroundColor: "#0F172A",
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
  },
  eyebrow: {
    color: "#93C5FD",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#F8FAFC",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 8,
  },
  subtitle: {
    color: "#CBD5E1",
    lineHeight: 20,
    marginTop: 8,
  },
  modelsButton: {
    marginTop: 16,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  modelsButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  loading: {
    marginVertical: 18,
  },
  errorCard: {
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  error: {
    color: "#991B1B",
    fontWeight: "800",
  },
  errorHint: {
    color: "#7F1D1D",
    marginTop: 6,
    lineHeight: 18,
  },
  alertsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  alertsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertsTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },
  alertsSubtitle: {
    color: "#64748B",
    lineHeight: 18,
    marginTop: 8,
  },
  alertRow: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  alertRowCopy: {
    flex: 1,
  },
  alertRowTitle: {
    color: "#111827",
    fontWeight: "900",
  },
  alertRowMeta: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  alertRowText: {
    color: "#78350F",
    lineHeight: 18,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
  },
  emptyTitle: {
    color: "#111827",
    fontWeight: "800",
  },
  userCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userHeaderMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  userIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  userCopy: {
    flex: 1,
  },
  userLabel: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "900",
  },
  userEmail: {
    color: "#475569",
    marginTop: 2,
  },
  userMeta: {
    color: "#94A3B8",
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  previewCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  previewTitle: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 6,
  },
  previewText: {
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 2,
  },
  deleteBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
    marginLeft: 10,
  },
  deleteBadgeDisabled: {
    opacity: 0.45,
  },
});
