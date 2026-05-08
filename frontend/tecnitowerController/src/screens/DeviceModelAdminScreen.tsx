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
import { FilePlus2, PencilLine, Plus, Shapes } from "lucide-react-native";
import AppLayout from "../layouts/AppLayout";
import { fetchDeviceModels } from "../services/api";

const COLORS = {
  bg: "#F5F7FA",
  surface: "#FFFFFF",
  surfaceSoft: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  mutedSoft: "#94A3B8",
  border: "#E2E8F0",
  primary: "#0F3D91",
  primarySoft: "#E8F0FF",
  primaryBorder: "#C7D9FF",
  white: "#FFFFFF",
  danger: "#991B1B",
  dangerBg: "#FEF2F2",
};

export default function DeviceModelAdminScreen({
  navigation,
  session,
  onLogout,
}: any) {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        setError("");

        try {
          const response = await fetchDeviceModels();

          if (active) {
            setModels(response.models ?? []);
          }
        } catch (err: any) {
          if (active) {
            setError(err?.message || "No se pudieron cargar los modelos");
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      load();

      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <AppLayout navigation={navigation} onLogout={onLogout} session={session}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Panel técnico</Text>
            <Text style={styles.title}>Modelos de controladores</Text>
          </View>

          <View style={styles.countBox}>
            <Text style={styles.countNumber}>{models.length}</Text>
            <Text style={styles.countLabel}>modelos</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.createCard}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("DeviceModelForm")}
        >
          <View style={styles.createIcon}>
            <FilePlus2 color={COLORS.primary} size={24} strokeWidth={2.4} />
          </View>

          <View style={styles.createCopy}>
            <Text style={styles.createTitle}>Cargar nuevo modelo</Text>
            <Text style={styles.createMeta}>Agregar controlador y registros base</Text>
          </View>

          <View style={styles.createPlus}>
            <Plus color={COLORS.white} size={18} strokeWidth={2.6} />
          </View>
        </TouchableOpacity>

        {loading && (
          <View style={styles.stateCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.stateText}>Cargando modelos...</Text>
          </View>
        )}

        {!!error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>No se pudo cargar la información</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && models.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Shapes color={COLORS.primary} size={26} strokeWidth={2.4} />
            </View>

            <Text style={styles.emptyTitle}>No hay modelos cargados</Text>

            <TouchableOpacity
              style={styles.emptyButton}
              activeOpacity={0.9}
              onPress={() => navigation.navigate("DeviceModelForm")}
            >
              <Plus color={COLORS.white} size={17} strokeWidth={2.4} />
              <Text style={styles.emptyButtonText}>Crear modelo</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && models.length > 0 && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Inventario técnico</Text>
          </View>
        )}

        {models.map(model => (
          <View key={model._id} style={styles.modelCard}>
            <View style={styles.modelTop}>
              <View style={styles.modelIcon}>
                <Shapes color={COLORS.primary} size={20} strokeWidth={2.35} />
              </View>

              <View style={styles.modelContent}>
                <Text style={styles.modelName} numberOfLines={2}>
                  {model.brand} · {model.name}
                </Text>

                {!!model.description && (
                  <Text style={styles.modelDescription} numberOfLines={2}>
                    {model.description}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>UID</Text>
                <Text style={styles.metricValue}>{model.defaultUnitId ?? "-"}</Text>
              </View>

              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Baud</Text>
                <Text style={styles.metricValue}>{model.defaultBaudRate ?? "-"}</Text>
              </View>

              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Registros</Text>
                <Text style={styles.metricValue}>
                  {model.registerTemplates?.length ?? 0}
                </Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.registerButton}
                activeOpacity={0.9}
                onPress={() =>
                  navigation.navigate("DeviceModelForm", {
                    model,
                    focusRegisters: true,
                  })
                }
              >
                <Plus color={COLORS.primary} size={17} strokeWidth={2.5} />
                <Text style={styles.registerButtonText}>Nuevo registro</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.editButton}
                activeOpacity={0.9}
                onPress={() =>
                  navigation.navigate("DeviceModelForm", {
                    model,
                  })
                }
              >
                <PencilLine color={COLORS.white} size={17} strokeWidth={2.4} />
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingTop: 72,
    paddingBottom: 38,
    backgroundColor: COLORS.bg,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  kicker: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    marginBottom: 6,
  },

  title: {
    color: COLORS.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.9,
    maxWidth: 230,
  },

  countBox: {
    minWidth: 72,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    shadowColor: "#94A3B8",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },

  countNumber: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 25,
  },

  countLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },

  createCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    shadowColor: "#94A3B8",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },

  createIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  createCopy: {
    flex: 1,
  },

  createTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  createMeta: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },

  createPlus: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  stateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  stateText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "700",
  },

  errorCard: {
    backgroundColor: COLORS.dangerBg,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  errorTitle: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },

  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },

  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 26,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    shadowColor: "#94A3B8",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 21,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 16,
    letterSpacing: -0.3,
  },

  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 17,
    paddingVertical: 13,
  },

  emptyButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },

  sectionHeader: {
    marginBottom: 12,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  modelCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#94A3B8",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 3,
  },

  modelTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
  },

  modelIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  modelContent: {
    flex: 1,
  },

  modelName: {
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  modelDescription: {
    color: COLORS.muted,
    marginTop: 6,
    lineHeight: 18,
    fontSize: 13,
    fontWeight: "500",
  },

  metricsRow: {
    flexDirection: "row",
    gap: 9,
    marginTop: 16,
  },

  metricBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  metricLabel: {
    color: COLORS.mutedSoft,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },

  metricValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  registerButton: {
    flex: 1.3,
    minHeight: 48,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },

  registerButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
    textAlign: "center",
    fontSize: 13,
  },

  editButton: {
    flex: 0.8,
    minHeight: 48,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },

  editButtonText: {
    color: COLORS.white,
    fontWeight: "900",
    textAlign: "center",
    fontSize: 13,
  },
});