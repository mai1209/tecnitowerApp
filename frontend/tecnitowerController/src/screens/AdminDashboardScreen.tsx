import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { ChevronRight, Layers3, UserRound } from "lucide-react-native";
import AppLayout from "../layouts/AppLayout";
import { fetchAdminUsers } from "../services/api";
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

export default function AdminDashboardScreen({ navigation, session, onLogout }: Props) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <AppLayout navigation={navigation} onLogout={onLogout} session={session}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Panel administrador</Text>
          <Text style={styles.title}>Usuarios</Text>
          <Text style={styles.subtitle}>
            Elegí un usuario para ver sus controladores y entrar al panel técnico de cada equipo.
          </Text>
          <TouchableOpacity
            style={styles.modelsButton}
            onPress={() => navigation.navigate("DeviceModelAdmin")}
          >
            <Layers3 color="#FFFFFF" size={16} />
            <Text style={styles.modelsButtonText}>Modificar parámetros generales</Text>
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

        {!loading && !error && users.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No hay usuarios cargados</Text>
          </View>
        )}

        {users.map((user) => {
          const preview = buildUserPreview(user);
          return (
            <TouchableOpacity
              key={user._id}
              style={styles.userCard}
              onPress={() =>
                navigation.navigate("AdminUserControllers", {
                  userId: user._id,
                  user,
                })
              }
            >
              <View style={styles.userHeader}>
                <View style={styles.userIcon}>
                  <UserRound color="#0F172A" size={20} strokeWidth={2.2} />
                </View>
                <View style={styles.userCopy}>
                  <Text style={styles.userLabel}>Usuario: {user.fullName || "Sin nombre"}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  <Text style={styles.userMeta}>
                    Rol {user.role} · {user.controllersCount ?? 0} controladores · Online {preview.onlineCount}
                  </Text>
                </View>
                <ChevronRight color="#0F172A" size={18} strokeWidth={2.4} />
              </View>

              <View style={styles.previewCard}>
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
              </View>
            </TouchableOpacity>
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
    gap: 12,
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
});
