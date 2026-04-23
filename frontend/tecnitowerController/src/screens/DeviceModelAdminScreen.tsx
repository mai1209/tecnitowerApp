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

export default function DeviceModelAdminScreen({ navigation, session, onLogout }: any) {
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
          if (active) setModels(response.models ?? []);
        } catch (err: any) {
          if (active) setError(err?.message || "No se pudieron cargar los modelos");
        } finally {
          if (active) setLoading(false);
        }
      }

      load();
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <AppLayout navigation={navigation} onLogout={onLogout} session={session}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Parámetros generales</Text>
          <Text style={styles.title}>Modelos cargados</Text>
          <Text style={styles.subtitle}>
            Acá ves todos los modelos cargados. Desde cada uno podés editar el modelo o cargar nuevos registros.
          </Text>

          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => navigation.navigate("DeviceModelForm")}
          >
            <FilePlus2 color="#FFFFFF" size={16} />
            <Text style={styles.primaryActionText}>Cargar nuevo modelo</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator color="#0F172A" style={styles.loading} />}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {!loading && models.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No hay modelos cargados</Text>
            <Text style={styles.emptyText}>Empezá creando el primero desde “Cargar nuevo modelo”.</Text>
          </View>
        )}

        {models.map((model) => (
          <View key={model._id} style={styles.modelCard}>
            <View style={styles.modelHeader}>
              <View style={styles.iconWrap}>
                <Shapes color="#0F172A" size={20} strokeWidth={2.2} />
              </View>
              <View style={styles.modelCopy}>
                <Text style={styles.modelName}>{model.brand} · {model.name}</Text>
                <Text style={styles.modelMeta}>
                  UID {model.defaultUnitId ?? "-"} · Baud {model.defaultBaudRate ?? "-"} · Registros {model.registerTemplates?.length ?? 0}
                </Text>
                {!!model.description && <Text style={styles.modelDescription}>{model.description}</Text>}
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() =>
                  navigation.navigate("DeviceModelForm", {
                    model,
                    focusRegisters: true,
                  })
                }
              >
                <Plus color="#0F172A" size={16} />
                <Text style={styles.secondaryButtonText}>Cargar nuevo registro</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.editButton}
                onPress={() =>
                  navigation.navigate("DeviceModelForm", {
                    model,
                  })
                }
              >
                <PencilLine color="#FFFFFF" size={16} />
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
  primaryAction: {
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
  primaryActionText: {
    color: "#FFFFFF",
    fontWeight: "800",
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
  modelCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modelCopy: {
    flex: 1,
  },
  modelName: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "900",
  },
  modelMeta: {
    color: "#475569",
    marginTop: 4,
    fontSize: 12,
  },
  modelDescription: {
    color: "#64748B",
    marginTop: 6,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: "#0F172A",
    fontWeight: "800",
    textAlign: "center",
  },
  editButton: {
    flex: 1,
    backgroundColor: "#001F7C",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  editButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    textAlign: "center",
  },
});
