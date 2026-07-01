import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, ToastAndroid } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchDiagnostic, writeControllerRegister } from "../services/api";
import { STORAGE_KEYS } from "../constants/storageKeys";

type RegisterCardState = Record<string, number>;

function getDefinitionKey(definition: any) {
  return String(definition?.key ?? definition?.register ?? "");
}

function getDefinitionStep(definition: any) {
  if (definition?.dataType === "boolean") return 1;
  return Number(definition?.step ?? (Number(definition?.scale ?? 10) === 10 ? 0.1 : 1));
}

function getDefinitionDecimals(definition: any) {
  if (definition?.dataType === "integer" || definition?.dataType === "boolean") return 0;
  return getDefinitionStep(definition) < 1 ? 1 : 0;
}

function formatDefinitionValue(definition: any, value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) return "--";

  const numericValue = Number(value);
  if (definition?.dataType === "boolean") {
    return numericValue >= 1 ? "ON" : "OFF";
  }

  return numericValue.toFixed(getDefinitionDecimals(definition));
}

const RemoteControlScreen = (props: any) => {
  const {
    controllerId: controllerIdProp,
    token: tokenProp,
    session,
    route,
    configuredRegisters: configuredRegistersProp,
    online: onlineProp,
    profileCanWrite: profileCanWriteProp,
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
        } catch {}
      })
      .catch(() => {});
  }, [controllerIdProp, routeControllerId]);

  const controllerId = controllerIdProp ?? routeControllerId ?? fallbackController?.id ?? null;
  const token = tokenProp ?? session?.token ?? route?.params?.token ?? null;
  const userRole = session?.user?.role ?? "user";
  const canWriteByProfile =
    typeof profileCanWriteProp === "boolean"
      ? profileCanWriteProp
      : userRole === "admin" || session?.user?.canWrite === true;

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
    } catch {}
  }, [controllerId, token]);

  useEffect(() => {
    if (!controllerId || !token || hasExternalDiag) return;
    refreshDiagnostic();
  }, [controllerId, token, hasExternalDiag, refreshDiagnostic]);

  const configuredRegisters = useMemo(
    () => configuredRegistersProp ?? diag?.configuredRegisters ?? [],
    [configuredRegistersProp, diag?.configuredRegisters]
  );
  const online = onlineProp ?? diag?.online ?? true;

  useEffect(() => {
    const nextValues: RegisterCardState = {};

    for (const definition of configuredRegisters) {
      const key = getDefinitionKey(definition);
      if (!key || dirtyMap[key]) continue;
      if (Number.isFinite(Number(definition?.value))) {
        nextValues[key] = Number(definition.value);
      }
    }

    if (Object.keys(nextValues).length > 0) {
      setLocalValues((prev) => ({ ...prev, ...nextValues }));
    }
  }, [configuredRegisters, dirtyMap]);

  const canEditByConfig = Boolean(controllerId && token && canWriteByProfile);
  const canSubmit = Boolean(controllerId && token && online && canWriteByProfile);

  const applyDelta = (definition: any, delta: number) => {
    const key = getDefinitionKey(definition);
    const step = getDefinitionStep(definition);
    const current = Number(localValues[key] ?? definition?.value ?? 0);
    const next =
      definition?.dataType === "boolean"
        ? current >= 1
          ? 0
          : 1
        : parseFloat((current + delta * step).toFixed(getDefinitionDecimals(definition)));

    setDirtyMap((prev) => ({ ...prev, [key]: true }));
    setLocalValues((prev) => ({ ...prev, [key]: next }));
  };

  const handleSave = async (definition: any) => {
    if (!canSubmit) return;

    const key = getDefinitionKey(definition);
    const value = localValues[key] ?? definition?.value;

    if (!Number.isFinite(Number(value))) {
      Alert.alert("Valor inválido", "Ajustá el valor antes de aplicar el cambio.");
      return;
    }

    setLoadingMap((prev) => ({ ...prev, [key]: true }));

    try {
      await writeControllerRegister(
        controllerId,
        { key, register: definition.register, value: Number(value) },
        token
      );

      setDirtyMap((prev) => ({ ...prev, [key]: false }));
      const okMsg = `${definition.label} actualizado`;
      if (Platform.OS === "android") {
        ToastAndroid.show(okMsg, ToastAndroid.SHORT);
      } else {
        Alert.alert("OK", okMsg);
      }

      if (!hasExternalDiag) {
        await refreshDiagnostic();
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No se pudo actualizar el parámetro");
    } finally {
      setLoadingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const visibleRegisters = [...configuredRegisters]
    .filter((definition: any) => {
      if (definition?.visible === false) return false;
      return true;
    })
    .sort((a: any, b: any) => Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0));
  const editableRegisters = canEditByConfig
    ? visibleRegisters.filter((definition: any) => definition?.writable !== false)
    : [];
  const readOnlyRegisters = canEditByConfig
    ? visibleRegisters.filter((definition: any) => definition?.writable === false)
    : visibleRegisters;

  if (!visibleRegisters.length) {
    return null;
  }

  return (
    <View style={styles.cardContainer}>
      <Text style={styles.sectionTitle}>PARAMETROS DISPONIBLES</Text>
      {editableRegisters.map((definition: any) => {
        const key = getDefinitionKey(definition);
        const value = Number(localValues[key] ?? definition?.value);
        const hasValue = Number.isFinite(value);
        const isLoading = Boolean(loadingMap[key]);

        return (
          <View key={key} style={styles.controlBox}>
            <View style={styles.labelRow}>
              <Text style={styles.paramName}>{definition.label}</Text>
              <Text style={styles.regLabel}>REG {definition.register}</Text>
            </View>
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={[styles.stepBtn, (!canSubmit || isLoading) && styles.stepBtnDisabled]}
                onPress={() => applyDelta(definition, -1)}
                disabled={!canSubmit || isLoading}
              >
                <Text style={styles.stepBtnText}>
                  {definition?.dataType === "boolean" ? "TOGGLE" : "-"}
                </Text>
              </TouchableOpacity>
              <View style={styles.valueDisplay}>
                <Text style={styles.valueText}>
                  {hasValue ? formatDefinitionValue(definition, value) : "--"}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.stepBtn, (!canSubmit || isLoading) && styles.stepBtnDisabled]}
                onPress={() => applyDelta(definition, 1)}
                disabled={!canSubmit || isLoading}
              >
                <Text style={styles.stepBtnText}>
                  {definition?.dataType === "boolean" ? "TOGGLE" : "+"}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, isLoading && styles.stepBtnDisabled]}
              onPress={() => handleSave(definition)}
              disabled={!canSubmit || isLoading}
            >
              <Text style={styles.saveBtnText}>{isLoading ? "APLICANDO..." : "APLICAR"}</Text>
            </TouchableOpacity>
            <Text style={styles.helperText}>
              {!online
                ? "El parámetro es editable, pero este controlador está sin comunicación."
                : isLoading
                ? "Aplicando cambio. Puede demorar algunos segundos en reflejarse."
                : "El cambio puede tardar algunos segundos en confirmarse desde el equipo."}
            </Text>
          </View>
        );
      })}

      {readOnlyRegisters.map((definition: any) => {
        const key = getDefinitionKey(definition);
        const value = Number(localValues[key] ?? definition?.value);

        return (
          <View key={key} style={styles.readOnlyBox}>
            <View style={styles.labelRow}>
              <Text style={styles.paramName}>{definition.label}</Text>
              <Text style={styles.regLabel}>REG {definition.register}</Text>
            </View>
            <Text style={styles.readOnlyValue}>{formatDefinitionValue(definition, value)}</Text>
            <Text style={styles.helperText}>Visible para el usuario, sin edición habilitada.</Text>
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
  readOnlyBox: { backgroundColor: "#F9FAFB", borderRadius: 20, padding: 15, marginBottom: 15 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  paramName: { fontSize: 15, fontWeight: "700" },
  regLabel: { fontSize: 10, backgroundColor: "#E5E7EB", padding: 4 },
  stepperContainer: { flexDirection: "row", alignItems: "center" },
  stepBtn: { padding: 10 },
  stepBtnDisabled: { opacity: 0.5 },
  stepBtnText: { fontSize: 20 },
  valueDisplay: { flex: 1, alignItems: "center" },
  valueText: { fontSize: 24, fontWeight: "900" },
  readOnlyValue: { fontSize: 24, fontWeight: "900", textAlign: "center", color: "#0F172A" },
  saveBtn: { backgroundColor: "#111827", padding: 12, borderRadius: 12, marginTop: 10 },
  saveBtnText: { color: "#FFF", textAlign: "center", fontWeight: "800" },
  helperText: {
    fontSize: 11,
    lineHeight: 16,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
  },
});

export default RemoteControlScreen;
