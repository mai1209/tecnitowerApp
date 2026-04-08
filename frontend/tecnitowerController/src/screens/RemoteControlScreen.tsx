import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchDiagnostic, writeControllerRegister } from "../services/api";
import { STORAGE_KEYS } from "../constants/storageKeys";

type RegisterCardState = Record<string, number>;

const RemoteControlScreen = (props: any) => {
  const {
    controllerId: controllerIdProp,
    token: tokenProp,
    session,
    route,
    configuredRegisters: configuredRegistersProp,
    online: onlineProp,
  } = props;

  const routeController = route?.params?.controller;
  const routeControllerId = route?.params?.controllerId ?? routeController?._id;
  const [fallbackController, setFallbackController] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (controllerIdProp || routeControllerId) return;
    AsyncStorage.getItem(STORAGE_KEYS.lastController)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.id) setFallbackController({ id: parsed.id });
        } catch (_) {}
      })
      .catch(() => {});
  }, [controllerIdProp, routeControllerId]);

  const controllerId = controllerIdProp ?? routeControllerId ?? fallbackController?.id ?? null;
  const token = tokenProp ?? session?.token ?? route?.params?.token ?? null;

  const [diag, setDiag] = useState<any>(null);
  const [localValues, setLocalValues] = useState<RegisterCardState>({});
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  const hasExternalDiag = useMemo(
    () => Array.isArray(configuredRegistersProp) || onlineProp !== undefined,
    [configuredRegistersProp, onlineProp]
  );

  const refreshDiagnostic = useCallback(async () => {
    if (!controllerId || !token) return;
    try {
      const json = await fetchDiagnostic(controllerId, token);
      setDiag(json ?? null);
    } catch (_) {}
  }, [controllerId, token]);

  useEffect(() => {
    if (!controllerId || !token || hasExternalDiag) return;
    refreshDiagnostic();
  }, [controllerId, token, hasExternalDiag, refreshDiagnostic]);

  const configuredRegisters = configuredRegistersProp ?? diag?.configuredRegisters ?? [];
  const online = onlineProp ?? diag?.online ?? true;

  useEffect(() => {
    const nextValues: RegisterCardState = {};

    for (const definition of configuredRegisters) {
      const key = String(definition?.key ?? definition?.register ?? "");
      if (!key || dirtyMap[key]) continue;
      if (Number.isFinite(Number(definition?.value))) {
        nextValues[key] = Number(definition.value);
      }
    }

    if (Object.keys(nextValues).length > 0) {
      setLocalValues((prev) => ({ ...prev, ...nextValues }));
    }
  }, [configuredRegisters, dirtyMap]);

  const canWrite = Boolean(controllerId && token && online);

  const applyDelta = (definition: any, delta: number) => {
    const key = String(definition.key);
    const step = Number(definition?.step ?? (Number(definition?.scale ?? 10) === 10 ? 0.1 : 1));
    const current = Number(localValues[key] ?? definition?.value ?? 0);
    const next = parseFloat((current + delta * step).toFixed(step < 1 ? 1 : 0));

    setDirtyMap((prev) => ({ ...prev, [key]: true }));
    setLocalValues((prev) => ({ ...prev, [key]: next }));
  };

  const handleSave = async (definition: any) => {
    if (!canWrite) return;

    const key = String(definition.key);
    const value = localValues[key];

    setLoadingMap((prev) => ({ ...prev, [key]: true }));

    try {
      await writeControllerRegister(
        controllerId,
        { key, register: definition.register, value },
        token
      );

      setDirtyMap((prev) => ({ ...prev, [key]: false }));
      Alert.alert("OK", `${definition.label} actualizado`);

      if (!hasExternalDiag) {
        await refreshDiagnostic();
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No se pudo actualizar el parámetro");
    } finally {
      setLoadingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const visibleRegisters = configuredRegisters.filter((definition: any) => {
    return definition?.visible !== false && String(definition?.key).toUpperCase() === "SET";
  });

  if (!visibleRegisters.length) {
    return null;
  }

  return (
    <View style={styles.cardContainer}>
      <Text style={styles.sectionTitle}>CONTROL REMOTO DE SETPOINT</Text>
      {visibleRegisters.map((definition: any) => {
        const key = String(definition.key);
        const step = Number(definition?.step ?? 0.1);
        const value = Number(localValues[key] ?? definition?.value);
        const hasValue = Number.isFinite(value);
        const decimals = step < 1 ? 1 : 0;
        const isLoading = Boolean(loadingMap[key]);

        return (
          <View key={key} style={styles.controlBox}>
            <View style={styles.labelRow}>
              <Text style={styles.paramName}>{definition.label}</Text>
              <Text style={styles.regLabel}>REG {definition.register}</Text>
            </View>
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={[styles.stepBtn, (!canWrite || isLoading) && styles.stepBtnDisabled]}
                onPress={() => applyDelta(definition, -1)}
                disabled={!canWrite || isLoading}
              >
                <Text style={styles.stepBtnText}>-</Text>
              </TouchableOpacity>
              <View style={styles.valueDisplay}>
                <Text style={styles.valueText}>{hasValue ? value.toFixed(decimals) : "--"}</Text>
              </View>
              <TouchableOpacity
                style={[styles.stepBtn, (!canWrite || isLoading) && styles.stepBtnDisabled]}
                onPress={() => applyDelta(definition, 1)}
                disabled={!canWrite || isLoading}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, isLoading && styles.stepBtnDisabled]}
              onPress={() => handleSave(definition)}
              disabled={!canWrite || isLoading}
            >
              <Text style={styles.saveBtnText}>{isLoading ? "APLICANDO..." : "APLICAR"}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: { backgroundColor: "#FFF", borderRadius: 24, padding: 20, marginBottom: 15, elevation: 4 },
  sectionTitle: { fontSize: 12, fontWeight: "800", color: "#9CA3AF", textAlign: "center", marginBottom: 20 },
  controlBox: { backgroundColor: "#F9FAFB", borderRadius: 20, padding: 15, marginBottom: 15 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  paramName: { fontSize: 15, fontWeight: "700" },
  regLabel: { fontSize: 10, backgroundColor: "#E5E7EB", padding: 4 },
  stepperContainer: { flexDirection: "row", alignItems: "center" },
  stepBtn: { padding: 10 },
  stepBtnDisabled: { opacity: 0.5 },
  stepBtnText: { fontSize: 20 },
  valueDisplay: { flex: 1, alignItems: "center" },
  valueText: { fontSize: 24, fontWeight: "900" },
  saveBtn: { backgroundColor: "#111827", padding: 12, borderRadius: 12, marginTop: 10 },
  saveBtnText: { color: "#FFF", textAlign: "center", fontWeight: "800" },
});

export default RemoteControlScreen;
