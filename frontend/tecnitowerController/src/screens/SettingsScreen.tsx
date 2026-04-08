import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";

import { DEFAULT_API_BASE_URL, getApiBaseUrl, resetApiBaseUrl, setApiBaseUrl } from "../services/api";

export default function SettingsScreen() {
  const [inputValue, setInputValue] = useState("");
  const [currentUrl, setCurrentUrl] = useState(DEFAULT_API_BASE_URL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const url = await getApiBaseUrl();
        setCurrentUrl(url);
        setInputValue(url);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextUrl = await setApiBaseUrl(inputValue);
      setCurrentUrl(nextUrl);
      setInputValue(nextUrl);
      Alert.alert("Configuración guardada", "La app usará esta URL en las próximas consultas.");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No se pudo guardar la URL del backend.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const defaultUrl = await resetApiBaseUrl();
      setCurrentUrl(defaultUrl);
      setInputValue(defaultUrl);
      Alert.alert("URL restablecida", "Se volvió a la URL por defecto de esta compilación.");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No se pudo restablecer la URL.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <LinearGradient
      colors={["#F2F2F2", "#E6EAF4", "#001F7C"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Soporte técnico</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Backend actual</Text>
          {loading ? (
            <ActivityIndicator color="#001F7C" style={styles.loader} />
          ) : (
            <Text style={styles.value}>{currentUrl}</Text>
          )}

          <Text style={styles.hint}>
            Esta pantalla es solo para soporte o cambios técnicos del dominio del backend.
          </Text>

          <Text style={styles.inputLabel}>Nueva URL</Text>
          <TextInput
            style={styles.input}
            value={inputValue}
            onChangeText={setInputValue}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="Ej: http://192.168.1.20:3001"
            placeholderTextColor="#94A3B8"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>{saving ? "Guardando..." : "Guardar URL"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, saving && styles.buttonDisabled]}
              onPress={handleReset}
              disabled={saving}
            >
              <Text style={styles.secondaryButtonText}>Restablecer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>URL por defecto del build</Text>
          <Text style={styles.value}>{DEFAULT_API_BASE_URL}</Text>
          <Text style={styles.hint}>
            Si borrás la configuración guardada, la app vuelve a esta URL de producción o desarrollo.
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: "800", color: "#111827", marginBottom: 16 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  label: { color: "#6B7280", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  value: { color: "#111827", fontSize: 16, fontWeight: "800", marginTop: 8 },
  loader: { marginTop: 10, alignSelf: "flex-start" },
  hint: { color: "#374151", marginTop: 12, lineHeight: 19 },
  inputLabel: { color: "#111827", fontSize: 13, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#111827",
    backgroundColor: "#F8FAFC",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flex: 1,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#0F172A",
  },
  secondaryButton: {
    backgroundColor: "#E2E8F0",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  secondaryButtonText: {
    color: "#0F172A",
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
