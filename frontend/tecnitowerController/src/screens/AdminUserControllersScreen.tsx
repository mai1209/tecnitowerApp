import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AlertTriangle, BellRing, Settings2, UserRound } from "lucide-react-native";
import AppLayout from "../layouts/AppLayout";
import { fetchAdminUsers, sendAdminUserTestPush, updateAdminUser } from "../services/api";

function controllerStatus(controller: any) {
  if (controller?.alertState?.active) {
    const isConnectionAlert =
      controller.alertState.type === "offline" ||
      controller.alertState.type === "elfin_offline" ||
      controller.alertState.type === "modbus_offline";
    return {
      label:
        controller.alertState.type === "elfin_offline"
          ? "Elfin offline"
          : controller.alertState.type === "modbus_offline"
            ? "Lectura offline"
            : isConnectionAlert
              ? "Offline"
              : "Alerta",
      color: isConnectionAlert ? "#991B1B" : "#92400E",
      backgroundColor: isConnectionAlert ? "#FEE2E2" : "#FEF3C7",
    };
  }

  if (controller?.connectionState?.online) {
    return {
      label: "Online",
      color: "#166534",
      backgroundColor: "#DCFCE7",
    };
  }

  return {
    label: "Sin estado",
    color: "#475569",
    backgroundColor: "#E2E8F0",
  };
}

function formatTelemetryPreview(controller: any) {
  const telemetry = controller?.lastTelemetry ?? null;
  const probe1Value = Number(telemetry?.probe1Value);
  const probe2Value = Number(telemetry?.probe2Value);
  const pieces = [];

  if (Number.isFinite(probe1Value)) {
    pieces.push(`S1 ${probe1Value.toFixed(1)}°C`);
  }

  if (Number.isFinite(probe2Value)) {
    pieces.push(`S2 ${probe2Value.toFixed(1)}°C`);
  }

  return pieces.length > 0 ? pieces.join(" · ") : "Sin lectura reciente";
}

function getUserRoleLabel(role: "admin" | "user", canWrite: boolean) {
  if (role === "admin") return "Administrador";
  return canWrite ? "Usuario con edición" : "Usuario solo lectura";
}

function getUserRoleHelp(role: "admin" | "user", canWrite: boolean) {
  if (role === "admin") {
    return "Puede entrar al panel administrador y gestionar usuarios, controladores y modelos.";
  }
  return canWrite
    ? "Puede entrar a la app y editar los parámetros y controladores que el admin haya habilitado."
    : "Puede entrar a la app solo para consultar información; no puede editar ni dar de alta equipos.";
}

export default function AdminUserControllersScreen({ navigation, route, session, onLogout }: any) {
  const targetUserId = String(route?.params?.userId ?? "");
  const fallbackUser = route?.params?.user ?? null;
  const [user, setUser] = useState<any>(fallbackUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testingPush, setTestingPush] = useState(false);
  const activeAlerts = (user?.controllers ?? []).filter((controller: any) => controller?.alertState?.active);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        setError("");
        try {
          const response = await fetchAdminUsers(session.token);
          const found = (response.users ?? []).find((item: any) => String(item._id) === targetUserId);
          if (active) {
            setUser(found ?? null);
            if (!found) setError("Usuario no encontrado");
          }
        } catch (err: any) {
          if (active) setError(err?.message || "No se pudo cargar el usuario");
        } finally {
          if (active) setLoading(false);
        }
      }

      load();
      return () => {
        active = false;
      };
    }, [session.token, targetUserId])
  );

  return (
    <AppLayout navigation={navigation} onLogout={onLogout} session={session}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <View style={styles.userIcon}>
            <UserRound color="#FFFFFF" size={22} strokeWidth={2.2} />
          </View>
          <Text style={styles.eyebrow}>Panel de usuario</Text>
          <Text style={styles.title}>{user?.fullName || "Usuario"}</Text>
          <Text style={styles.subtitle}>
            {user?.email || "Sin correo"} · Rol{" "}
            {user?.role ? getUserRoleLabel(user.role, user?.canWrite !== false) : "-"} · {user?.controllersCount ?? 0} controladores
          </Text>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() =>
              navigation.navigate("ControllerForm", {
                ownerId: user?._id,
                ownerName: user?.fullName || user?.email,
              })
            }
          >
            <Text style={styles.addButtonText}>Cargar otro controlador para este usuario</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator color="#0F172A" style={styles.loading} />}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {!loading && user && (
          <AdminUserEditor
            user={user}
            token={session.token}
            onSaved={async () => {
              const response = await fetchAdminUsers(session.token);
              const found = (response.users ?? []).find((item: any) => String(item._id) === targetUserId);
              setUser(found ?? null);
            }}
          />
        )}

        {!loading && user && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <BellRing color="#0F172A" size={18} />
              <Text style={styles.summaryTitle}>Alertas y notificaciones</Text>
            </View>
            <Text style={styles.summaryText}>
              Alertas activas: {activeAlerts.length} · Dispositivos push registrados: {user?.pushDevicesEnabledCount ?? 0}
            </Text>
            <Text style={styles.summaryText}>
              Las push de este usuario se envían solo a los tokens asociados a su cuenta.
            </Text>
            <TouchableOpacity
              style={[styles.pushTestButton, testingPush && styles.pushTestButtonDisabled]}
              disabled={testingPush}
              onPress={async () => {
                setTestingPush(true);
                try {
                  const response = await sendAdminUserTestPush(user._id, session.token);
                  const result = response?.result ?? {};
                  Alert.alert(
                    "Push de prueba",
                    response?.message ||
                      `Enviadas: ${result.successCount ?? 0} · Fallidas: ${result.failureCount ?? 0}`
                  );
                } catch (err: any) {
                  Alert.alert("Error", err?.message || "No se pudo enviar la notificación de prueba");
                } finally {
                  setTestingPush(false);
                }
              }}
            >
              <Text style={styles.pushTestButtonText}>
                {testingPush ? "Enviando prueba..." : "Enviar notificación de prueba"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && activeAlerts.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Alertas activas de este usuario</Text>
            {activeAlerts.map((controller: any) => (
              <View key={controller._id} style={styles.activeAlertRow}>
                <Text style={styles.activeAlertTitle}>{controller.name}</Text>
                <Text style={styles.activeAlertText}>{controller?.alertState?.message || "Alerta activa"}</Text>
              </View>
            ))}
          </View>
        )}

        {!loading && !error && (user?.controllers ?? []).length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Este usuario no tiene controladores</Text>
            <Text style={styles.emptyText}>Podés dar de alta el primero desde el botón superior.</Text>
          </View>
        )}

        {(user?.controllers ?? []).map((controller: any) => {
          const status = controllerStatus(controller);
          return (
            <View key={controller._id} style={styles.controllerCard}>
              <View style={styles.controllerTop}>
                <View style={styles.controllerCopy}>
                  <Text style={styles.controllerName}>{controller.name}</Text>
                  <Text style={styles.controllerMeta}>
                    {controller.elfinId} · {controller.deviceModel || controller.dixellModel || "Sin modelo"}
                  </Text>
                  <Text style={styles.controllerMeta}>
                    UID {controller.unitId ?? "-"} · Baud {controller.baudRate ?? "-"} · Registros{" "}
                    {controller.registerDefinitionsCount ?? 0}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: status.backgroundColor }]}>
                  <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>

              <View style={styles.previewInfoBox}>
                <Text style={styles.previewInfoTitle}>Vista técnica</Text>
                <Text style={styles.previewInfoText}>
                  {formatTelemetryPreview(controller)}
                </Text>
                <Text style={styles.previewInfoText}>
                  Último error: {controller?.connectionState?.lastPollError || "Sin error registrado"}
                </Text>
                <Text style={styles.previewInfoText}>
                  Ubicación: {controller?.location || "Sin ubicación"}
                </Text>
              </View>

              {controller?.alertState?.active && (
                <View style={styles.alertBox}>
                  <AlertTriangle color="#92400E" size={16} />
                  <Text style={styles.alertText}>{controller.alertState.message}</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.configButton}
                onPress={() =>
                  navigation.navigate("AdminControllerConfigHub", {
                    controller,
                    user,
                  })
                }
              >
                <Settings2 color="#FFFFFF" size={17} strokeWidth={2.2} />
                <Text style={styles.configButtonText}>Entrar al panel del controlador</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </AppLayout>
  );
}

function AdminUserEditor({
  user,
  token,
  onSaved,
}: {
  user: any;
  token: string;
  onSaved: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [role, setRole] = useState<"admin" | "user">(user.role === "admin" ? "admin" : "user");
  const [canWrite, setCanWrite] = useState(user.role === "admin" ? true : user.canWrite !== false);
  const [isActive, setIsActive] = useState(user.isActive !== false);
  const [saving, setSaving] = useState(false);

  const cycleRole = () => {
    setRole((current) => (current === "admin" ? "user" : "admin"));
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert("Error", "El nombre del usuario es obligatorio");
      return;
    }

    setSaving(true);
    try {
      await updateAdminUser(
        user._id,
        {
          fullName: fullName.trim(),
          role,
          canWrite: role === "admin" ? true : canWrite,
          isActive,
        },
        token
      );
      await onSaved();
      Alert.alert("OK", "Usuario actualizado");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "No se pudo guardar el usuario");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.userEditor}>
      <Text style={styles.editorTitle}>Datos del usuario</Text>
      <Text style={styles.editorHint}>
        Desde acá editás los datos generales de este usuario. No modifica controladores ni registros.
      </Text>
      <Text style={styles.editorLabel}>Nombre</Text>
      <TextInput
        style={styles.editorInput}
        value={fullName}
        onChangeText={setFullName}
        placeholderTextColor="#94A3B8"
      />

      <TouchableOpacity style={styles.editorSelect} onPress={cycleRole}>
        <Text style={styles.editorSelectLabel}>Tipo de cuenta</Text>
        <Text style={styles.editorSelectValue}>
          {getUserRoleLabel(role, role === "admin" ? true : canWrite)}
        </Text>
        <Text style={styles.editorSelectHelp}>
          {getUserRoleHelp(role, role === "admin" ? true : canWrite)}
        </Text>
      </TouchableOpacity>

      {role !== "admin" && (
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>
            {canWrite ? "Usuario con lectura y escritura" : "Usuario solo lectura"}
          </Text>
          <Switch value={canWrite} onValueChange={setCanWrite} />
        </View>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>{isActive ? "Usuario activo" : "Usuario inactivo"}</Text>
        <Switch value={isActive} onValueChange={setIsActive} />
      </View>

      <TouchableOpacity
        style={[styles.saveUserButton, saving && styles.saveUserButtonDisabled]}
        disabled={saving}
        onPress={handleSave}
      >
        <Text style={styles.saveUserButtonText}>
          {saving ? "Guardando..." : "Guardar cambios del usuario"}
        </Text>
      </TouchableOpacity>
    </View>
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
  userIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
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
  addButton: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  addButtonText: {
    color: "#0F172A",
    textAlign: "center",
    fontWeight: "900",
  },
  loading: {
    marginVertical: 18,
  },
  error: {
    color: "#991B1B",
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  userEditor: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  editorTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },
  editorHint: {
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 12,
  },
  editorLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  editorInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFF",
    color: "#0F172A",
    marginBottom: 10,
  },
  editorSelect: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  editorSelectLabel: {
    color: "#64748B",
    fontSize: 12,
    marginBottom: 4,
  },
  editorSelectValue: {
    color: "#0F172A",
    fontWeight: "700",
  },
  editorSelectHelp: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  switchText: {
    color: "#0F172A",
    fontWeight: "700",
  },
  saveUserButton: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingVertical: 12,
  },
  saveUserButtonDisabled: {
    opacity: 0.6,
  },
  saveUserButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "800",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
  },
  emptyTitle: {
    color: "#111827",
    fontWeight: "800",
    marginBottom: 6,
  },
  emptyText: {
    color: "#64748B",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  summaryTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },
  summaryText: {
    color: "#64748B",
    lineHeight: 18,
    marginTop: 4,
  },
  pushTestButton: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
  },
  pushTestButtonDisabled: {
    opacity: 0.6,
  },
  pushTestButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "800",
  },
  activeAlertRow: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
    padding: 12,
  },
  activeAlertTitle: {
    color: "#111827",
    fontWeight: "900",
  },
  activeAlertText: {
    color: "#78350F",
    lineHeight: 18,
    marginTop: 4,
  },
  controllerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  controllerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  controllerCopy: {
    flex: 1,
  },
  controllerName: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
  controllerMeta: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 3,
  },
  previewInfoBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  previewInfoTitle: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 5,
  },
  previewInfoText: {
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 2,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "900",
  },
  alertBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  alertText: {
    flex: 1,
    color: "#92400E",
    fontSize: 12,
    lineHeight: 17,
  },
  configButton: {
    marginTop: 12,
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  configButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
});
