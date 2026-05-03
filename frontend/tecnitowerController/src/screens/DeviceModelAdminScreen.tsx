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
  bg: "#F3F6FB",
  surface: "#FFFFFF",
  surfaceSoft: "#F8FAFC",
  dark: "#0F172A",
  darkSoft: "#1E293B",
  primary: "#001F7C",
  primaryLight: "#DBEAFE",
  primaryText: "#1D4ED8",
  border: "#E2E8F0",
  muted: "#64748B",
  mutedDark: "#475569",
  text: "#111827",
  white: "#FFFFFF",
  danger: "#991B1B",
  dangerBg: "#FEE2E2",
  successSoft: "#ECFDF5",
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
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Shapes color={COLORS.white} size={22} strokeWidth={2.3} />
            </View>

            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>
                {models.length} modelos
              </Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>Carga de modelos y registros</Text>

          <Text style={styles.title}>Modelos cargados</Text>

          <Text style={styles.subtitle}>
            Acá ves todos los modelos cargados. Desde cada uno podés editar el
            modelo o cargar nuevos registros.
          </Text>

          <TouchableOpacity
            style={styles.primaryAction}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("DeviceModelForm")}
          >
            <FilePlus2 color={COLORS.white} size={17} strokeWidth={2.4} />
            <Text style={styles.primaryActionText}>Cargar nuevo modelo</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Cargando modelos...</Text>
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
            <View style={styles.emptyIconWrap}>
              <FilePlus2 color={COLORS.primary} size={24} strokeWidth={2.3} />
            </View>

            <Text style={styles.emptyTitle}>No hay modelos cargados</Text>

            <Text style={styles.emptyText}>
              Empezá creando el primero desde “Cargar nuevo modelo”.
            </Text>

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
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Listado de modelos</Text>
            <Text style={styles.listCounter}>{models.length}</Text>
          </View>
        )}

        {models.map(model => (
          <View key={model._id} style={styles.modelCard}>
            <View style={styles.modelHeader}>
              <View style={styles.iconWrap}>
                <Shapes color={COLORS.primary} size={21} strokeWidth={2.35} />
              </View>

              <View style={styles.modelCopy}>
                <Text style={styles.modelName} numberOfLines={2}>
                  {model.brand} · {model.name}
                </Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipLabel}>UID</Text>
                    <Text style={styles.metaChipText}>
                      {model.defaultUnitId ?? "-"}
                    </Text>
                  </View>

                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipLabel}>Baud</Text>
                    <Text style={styles.metaChipText}>
                      {model.defaultBaudRate ?? "-"}
                    </Text>
                  </View>

                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipLabel}>Reg.</Text>
                    <Text style={styles.metaChipText}>
                      {model.registerTemplates?.length ?? 0}
                    </Text>
                  </View>
                </View>

                {!!model.description && (
                  <Text style={styles.modelDescription} numberOfLines={3}>
                    {model.description}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.9}
                onPress={() =>
                  navigation.navigate("DeviceModelForm", {
                    model,
                    focusRegisters: true,
                  })
                }
              >
                <Plus color={COLORS.primary} size={17} strokeWidth={2.5} />
                <Text style={styles.secondaryButtonText}>
                  Cargar nuevo registro
                </Text>
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
    paddingTop: 70,
    paddingBottom: 38,
    backgroundColor: COLORS.bg,
  },

  hero: {
    backgroundColor: COLORS.dark,
    borderRadius: 30,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 8,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(147,197,253,0.14)",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.22)",
  },

  heroBadgeText: {
    color: "#BFDBFE",
    fontSize: 12,
    fontWeight: "900",
  },

  eyebrow: {
    color: "#93C5FD",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.25,
    textTransform: "uppercase",
  },

  title: {
    color: COLORS.white,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "900",
    marginTop: 8,
    letterSpacing: -0.8,
  },

  subtitle: {
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    marginTop: 9,
  },

  primaryAction: {
    marginTop: 18,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000B3D",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 5,
  },

  primaryActionText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.1,
  },

  loadingCard: {
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

  loadingText: {
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
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "flex-start",
    shadowColor: "#94A3B8",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },

  emptyIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
    letterSpacing: -0.3,
  },

  emptyText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    marginBottom: 16,
  },

  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },

  emptyButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },

  listHeader: {
    marginTop: 2,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  listTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  listCounter: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: COLORS.primaryLight,
    color: COLORS.primaryText,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 13,
    lineHeight: 32,
    fontWeight: "900",
  },

  modelCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 26,
    padding: 17,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#94A3B8",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },

  modelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
  },

  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    alignItems: "center",
    justifyContent: "center",
  },

  modelCopy: {
    flex: 1,
  },

  modelName: {
    color: COLORS.dark,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  metaChip: {
    minWidth: 72,
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  metaChipLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 2,
  },

  metaChipText: {
    color: COLORS.dark,
    fontSize: 13,
    fontWeight: "900",
  },

  modelDescription: {
    color: COLORS.muted,
    marginTop: 10,
    lineHeight: 19,
    fontSize: 13,
    fontWeight: "500",
  },

  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },

  secondaryButton: {
    flexGrow: 1,
    flexBasis: "52%",
    minHeight: 50,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },

  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
    textAlign: "center",
    fontSize: 13,
  },

  editButton: {
    flexGrow: 1,
    flexBasis: "34%",
    minHeight: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 13,
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