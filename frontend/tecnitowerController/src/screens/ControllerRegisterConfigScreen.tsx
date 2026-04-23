import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  fetchAdminController,
  fetchController,
  updateAdminControllerAlertConfig,
  updateAdminControllerConnectionConfig,
  updateAdminControllerRegisterDefinitions,
  updateControllerAlertConfig,
  updateControllerRegisterDefinitions,
} from "../services/api";

function parseOptionalNumber(value: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function blankDefinition() {
  return {
    key: "",
    label: "",
    register: "",
    verifyRegister: "",
    scale: "10",
    min: "",
    max: "",
    writable: true,
    visible: true,
    accessLevel: "user" as "user" | "technician",
    functionCode: "auto" as "auto" | "0x06" | "0x10",
    description: "",
  };
}

function ControllerRegisterConfigScreen({ route, navigation, session }: any) {
  const { controller, adminMode = false, section = "all" } = route.params;
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [newDefinition, setNewDefinition] = useState(blankDefinition());
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [minTemperature, setMinTemperature] = useState("");
  const [maxTemperature, setMaxTemperature] = useState("");
  const [offlineAfterSeconds, setOfflineAfterSeconds] = useState("60");
  const [controllerName, setControllerName] = useState(controller?.name ?? "");
  const [controllerElfinId, setControllerElfinId] = useState(controller?.elfinId ?? "");
  const [gatewayMode, setGatewayMode] = useState(controller?.gatewayMode ?? "tcp-client");
  const [ipAddress, setIpAddress] = useState(controller?.ipAddress ?? "");
  const [modbusPort, setModbusPort] = useState(
    controller?.modbusPort == null ? "502" : String(controller.modbusPort)
  );
  const [unitId, setUnitId] = useState(controller?.unitId == null ? "1" : String(controller.unitId));
  const [baudRate, setBaudRate] = useState(
    controller?.baudRate == null ? "9600" : String(controller.baudRate)
  );
  const [probe1, setProbe1] = useState(controller?.probe1 == null ? "" : String(controller.probe1));
  const [probe2, setProbe2] = useState(controller?.probe2 == null ? "" : String(controller.probe2));
  const [location, setLocation] = useState(controller?.location ?? "");
  const [saving, setSaving] = useState(false);
  const activeSection = adminMode ? String(section ?? "all") : "all";
  const showBaseSection = activeSection === "all" || activeSection === "base";
  const showNewParameterSection = activeSection === "all" || activeSection === "parameter-new";
  const showAlertsSection = activeSection === "all" || activeSection === "alerts";
  const showDefinitionsSection = activeSection === "all" || activeSection === "definitions";

  useEffect(() => {
    async function loadController() {
      try {
        const response = adminMode
          ? await fetchAdminController(controller._id, session.token)
          : await fetchController(controller._id, session.token);
        const currentController = response.controller ?? {};
        setDefinitions(
          (currentController.registerDefinitions ?? []).map((definition: any) => ({
            key: definition.key ?? "",
            label: definition.label ?? "",
            register: definition.register == null ? "" : String(definition.register),
            verifyRegister:
              definition.verifyRegister == null ? "" : String(definition.verifyRegister),
            scale: definition.scale == null ? "10" : String(definition.scale),
            min: definition.min == null ? "" : String(definition.min),
            max: definition.max == null ? "" : String(definition.max),
            writable: definition.writable !== false,
            visible: definition.visible !== false,
            accessLevel: definition.accessLevel === "technician" ? "technician" : "user",
            functionCode:
              definition.functionCode === "0x06" || definition.functionCode === "0x10"
                ? definition.functionCode
                : "auto",
            description: definition.description ?? "",
          }))
        );
        setAlertsEnabled(currentController?.alertConfig?.enabled !== false);
        setMinTemperature(
          currentController?.alertConfig?.minTemperature == null
            ? ""
            : String(currentController.alertConfig.minTemperature)
        );
        setMaxTemperature(
          currentController?.alertConfig?.maxTemperature == null
            ? ""
            : String(currentController.alertConfig.maxTemperature)
        );
        setOfflineAfterSeconds(
          currentController?.alertConfig?.offlineAfterMs == null
            ? "60"
            : String(
                Math.max(
                  1,
                  Math.round(Number(currentController.alertConfig.offlineAfterMs) / 1000)
                )
              )
        );
        setControllerName(currentController?.name ?? "");
        setControllerElfinId(currentController?.elfinId ?? "");
        setGatewayMode(currentController?.gatewayMode ?? "tcp-client");
        setIpAddress(currentController?.ipAddress ?? "");
        setModbusPort(
          currentController?.modbusPort == null ? "502" : String(currentController.modbusPort)
        );
        setUnitId(currentController?.unitId == null ? "1" : String(currentController.unitId));
        setBaudRate(currentController?.baudRate == null ? "9600" : String(currentController.baudRate));
        setProbe1(currentController?.probe1 == null ? "" : String(currentController.probe1));
        setProbe2(currentController?.probe2 == null ? "" : String(currentController.probe2));
        setLocation(currentController?.location ?? "");
      } catch (_) {}
    }

    loadController();
  }, [adminMode, controller._id, session.token]);

  const updateDefinition = (index: number, patch: any) => {
    setDefinitions((current) =>
      current.map((definition, currentIndex) =>
        currentIndex === index ? { ...definition, ...patch } : definition
      )
    );
  };

  const handleAdd = () => {
    const numericRegister = parseOptionalNumber(newDefinition.register);
    if (!newDefinition.label.trim() || !newDefinition.key.trim() || numericRegister == null) {
      Alert.alert("Error", "Label, key y register son obligatorios");
      return;
    }

    const normalizedKey = newDefinition.key.trim().toUpperCase();
    if (definitions.some((definition) => definition.key === normalizedKey)) {
      Alert.alert("Error", "Ya existe un parámetro con esa key");
      return;
    }

    setDefinitions((prev) => [
      ...prev,
      {
        ...newDefinition,
        key: normalizedKey,
        label: newDefinition.label.trim(),
        register: String(numericRegister),
      },
    ]);
    setNewDefinition(blankDefinition());
  };

  const handleRemove = (index: number) => {
    setDefinitions((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const cycleAccess = (index: number) => {
    setDefinitions((current) =>
      current.map((definition, currentIndex) =>
        currentIndex === index
          ? {
              ...definition,
              accessLevel: definition.accessLevel === "user" ? "technician" : "user",
            }
          : definition
      )
    );
  };

  const cycleFunctionCode = (index: number) => {
    setDefinitions((current) =>
      current.map((definition, currentIndex) => {
        if (currentIndex !== index) return definition;
        const next =
          definition.functionCode === "auto"
            ? "0x06"
            : definition.functionCode === "0x06"
              ? "0x10"
              : "auto";
        return { ...definition, functionCode: next };
      })
    );
  };

  const handleSave = async () => {
    const parsedMinTemperature = parseOptionalNumber(minTemperature);
    const parsedMaxTemperature = parseOptionalNumber(maxTemperature);
    const parsedOfflineAfterSeconds = parseOptionalNumber(offlineAfterSeconds);

    if (minTemperature.trim() && parsedMinTemperature == null) {
      Alert.alert("Error", "La temperatura mínima de alerta es inválida");
      return;
    }

    if (maxTemperature.trim() && parsedMaxTemperature == null) {
      Alert.alert("Error", "La temperatura máxima de alerta es inválida");
      return;
    }

    if (
      parsedMinTemperature != null &&
      parsedMaxTemperature != null &&
      parsedMinTemperature > parsedMaxTemperature
    ) {
      Alert.alert("Error", "La temperatura mínima no puede ser mayor que la máxima");
      return;
    }

    if (
      parsedOfflineAfterSeconds != null &&
      (!Number.isFinite(parsedOfflineAfterSeconds) || parsedOfflineAfterSeconds < 1)
    ) {
      Alert.alert("Error", "El tiempo sin comunicación debe ser al menos 1 segundo");
      return;
    }

    const payloadDefinitions = definitions
      .map((definition, index) => {
        const register = parseOptionalNumber(definition.register);
        if (!definition.key.trim() || !definition.label.trim() || register == null) return null;
        return {
          key: definition.key.trim().toUpperCase(),
          label: definition.label.trim(),
          register,
          verifyRegister: parseOptionalNumber(definition.verifyRegister) ?? undefined,
          scale: parseOptionalNumber(definition.scale) ?? 10,
          min: parseOptionalNumber(definition.min) ?? undefined,
          max: parseOptionalNumber(definition.max) ?? undefined,
          step: (parseOptionalNumber(definition.scale) ?? 10) === 10 ? 0.1 : 1,
          dataType: "number",
          writable: definition.writable,
          visible: definition.visible,
          accessLevel: definition.accessLevel,
          functionCode: definition.functionCode,
          description: definition.description?.trim() || undefined,
          sortOrder: index,
        };
      })
      .filter(Boolean);

    const parsedUnitId = parseOptionalNumber(unitId);
    const parsedBaudRate = parseOptionalNumber(baudRate);
    const parsedProbe1 = parseOptionalNumber(probe1);
    const parsedProbe2 = parseOptionalNumber(probe2);
    const parsedModbusPort = parseOptionalNumber(modbusPort);

    if (adminMode) {
      if (!controllerName.trim() || !controllerElfinId.trim()) {
        Alert.alert("Error", "Nombre y Elfin ID son obligatorios");
        return;
      }
      if (parsedUnitId == null || parsedUnitId < 1 || parsedUnitId > 247) {
        Alert.alert("Error", "Unit ID inválido");
        return;
      }
      if (parsedBaudRate == null || parsedBaudRate < 1200) {
        Alert.alert("Error", "Baud rate inválido");
        return;
      }
      if (parsedModbusPort == null || parsedModbusPort < 1 || parsedModbusPort > 65535) {
        Alert.alert("Error", "Puerto Modbus inválido");
        return;
      }
    }

    setSaving(true);
    try {
      const saveRegisterDefinitions = adminMode
        ? updateAdminControllerRegisterDefinitions
        : updateControllerRegisterDefinitions;
      const saveAlertConfig = adminMode
        ? updateAdminControllerAlertConfig
        : updateControllerAlertConfig;

      const promises = [
        saveRegisterDefinitions(controller._id, payloadDefinitions as any[], session.token),
        saveAlertConfig(
          controller._id,
          {
            enabled: alertsEnabled,
            minTemperature: parsedMinTemperature,
            maxTemperature: parsedMaxTemperature,
            offlineAfterMs:
              parsedOfflineAfterSeconds == null ? null : parsedOfflineAfterSeconds * 1000,
          },
          session.token
        ),
      ];

      if (adminMode) {
        promises.push(
          updateAdminControllerConnectionConfig(
            controller._id,
            {
              name: controllerName.trim(),
              elfinId: controllerElfinId.trim().toUpperCase(),
              gatewayMode: gatewayMode as any,
              ipAddress: ipAddress.trim() || undefined,
              modbusPort: parsedModbusPort ?? undefined,
              unitId: parsedUnitId ?? undefined,
              baudRate: parsedBaudRate ?? undefined,
              probe1: parsedProbe1 ?? undefined,
              probe2: parsedProbe2 ?? undefined,
              location: location.trim() || undefined,
            },
            session.token
          )
        );
      }

      await Promise.all(promises);
      Alert.alert("OK", "Configuración guardada");
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No se pudieron guardar los parámetros");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        {adminMode ? "Admin: configuración completa del controlador" : "Parámetros dinámicos"}
      </Text>
      {adminMode && (
        <View style={styles.adminNotice}>
          <Text style={styles.adminNoticeTitle}>{controller?.name}</Text>
          <Text style={styles.adminNoticeText}>
            Desde acá definís conexión, alertas y qué registros verá o modificará el cliente.
          </Text>
        </View>
      )}

      {adminMode && showBaseSection && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Configuración base</Text>
          <FieldBlock label="Nombre" help="Identificación visible del controlador.">
            <TextInput
              style={styles.input}
              value={controllerName}
              onChangeText={setControllerName}
              placeholderTextColor="#94A3B8"
            />
          </FieldBlock>
          <FieldBlock label="Elfin ID" help="Debe coincidir con el equipo configurado en campo.">
            <TextInput
              style={styles.input}
              value={controllerElfinId}
              onChangeText={setControllerElfinId}
              autoCapitalize="characters"
              placeholderTextColor="#94A3B8"
            />
          </FieldBlock>
          <FieldBlock label="Gateway mode" help="Modo de transporte usado por este controlador.">
            <TouchableOpacity
              style={styles.selector}
              onPress={() =>
                setGatewayMode(
                  (
                    current:
                      | "direct"
                      | "agent-mqtt"
                      | "elfin-mqtt"
                      | "tcp-client"
                  ) =>
                  current === "tcp-client"
                    ? "agent-mqtt"
                    : current === "agent-mqtt"
                      ? "elfin-mqtt"
                      : current === "elfin-mqtt"
                        ? "direct"
                        : "tcp-client"
                )
              }
            >
              <Text style={styles.selectorValue}>{gatewayMode}</Text>
            </TouchableOpacity>
          </FieldBlock>
          <FieldBlock label="IP local" help="Solo aplica para modos locales.">
            <TextInput
              style={styles.input}
              value={ipAddress}
              onChangeText={setIpAddress}
              placeholderTextColor="#94A3B8"
            />
          </FieldBlock>
          <FieldBlock label="Puerto Modbus" help="Puerto TCP/RTU configurado en el Elfin o gateway.">
            <TextInput
              style={styles.input}
              value={modbusPort}
              onChangeText={setModbusPort}
              keyboardType="number-pad"
              placeholderTextColor="#94A3B8"
            />
          </FieldBlock>
          <FieldBlock label="Unit ID" help="Dirección Modbus del controlador.">
            <TextInput
              style={styles.input}
              value={unitId}
              onChangeText={setUnitId}
              keyboardType="number-pad"
              placeholderTextColor="#94A3B8"
            />
          </FieldBlock>
          <FieldBlock label="Baud rate" help="Baudrate RS485 del controlador.">
            <TextInput
              style={styles.input}
              value={baudRate}
              onChangeText={setBaudRate}
              keyboardType="number-pad"
              placeholderTextColor="#94A3B8"
            />
          </FieldBlock>
          <FieldBlock label="Probe 1" help="Registro principal de temperatura.">
            <TextInput
              style={styles.input}
              value={probe1}
              onChangeText={setProbe1}
              keyboardType="number-pad"
              placeholderTextColor="#94A3B8"
            />
          </FieldBlock>
          <FieldBlock label="Probe 2" help="Registro secundario.">
            <TextInput
              style={styles.input}
              value={probe2}
              onChangeText={setProbe2}
              keyboardType="number-pad"
              placeholderTextColor="#94A3B8"
            />
          </FieldBlock>
          <FieldBlock label="Ubicación" help="Texto interno para soporte.">
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholderTextColor="#94A3B8"
            />
          </FieldBlock>
        </View>
      )}

      {showNewParameterSection && (
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Alta de parámetro</Text>
        <Text style={styles.formHint}>
          Carga solo los registros que quieras mostrar en la app. También podés definir si son visibles, editables y para qué nivel de acceso.
        </Text>

        <FieldBlock label="Nombre visible" help="Texto que verá el usuario.">
          <TextInput
            style={styles.input}
            value={newDefinition.label}
            onChangeText={(value) => setNewDefinition((current) => ({ ...current, label: value }))}
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock label="Key interna" help="Clave corta y única.">
          <TextInput
            style={styles.input}
            value={newDefinition.key}
            onChangeText={(value) =>
              setNewDefinition((current) => ({ ...current, key: value.toUpperCase() }))
            }
            autoCapitalize="characters"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock label="Registro Modbus" help="Dirección real del parámetro.">
          <TextInput
            style={styles.input}
            value={newDefinition.register}
            onChangeText={(value) =>
              setNewDefinition((current) => ({ ...current, register: value }))
            }
            keyboardType="number-pad"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock label="Registro de verificación" help="Si queda vacío, se usa el mismo register.">
          <TextInput
            style={styles.input}
            value={newDefinition.verifyRegister}
            onChangeText={(value) =>
              setNewDefinition((current) => ({ ...current, verifyRegister: value }))
            }
            keyboardType="number-pad"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock label="Escala" help="10 para decimales, 1 para enteros.">
          <TextInput
            style={styles.input}
            value={newDefinition.scale}
            onChangeText={(value) => setNewDefinition((current) => ({ ...current, scale: value }))}
            keyboardType="number-pad"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock label="Mínimo" help="Límite inferior de escritura.">
          <TextInput
            style={styles.input}
            value={newDefinition.min}
            onChangeText={(value) => setNewDefinition((current) => ({ ...current, min: value }))}
            keyboardType="numbers-and-punctuation"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock label="Máximo" help="Límite superior de escritura.">
          <TextInput
            style={styles.input}
            value={newDefinition.max}
            onChangeText={(value) => setNewDefinition((current) => ({ ...current, max: value }))}
            keyboardType="numbers-and-punctuation"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock label="Descripción" help="Texto técnico opcional.">
          <TextInput
            style={styles.input}
            value={newDefinition.description}
            onChangeText={(value) =>
              setNewDefinition((current) => ({ ...current, description: value }))
            }
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <TouchableOpacity
          style={styles.selector}
          onPress={() =>
            setNewDefinition((current: ReturnType<typeof blankDefinition>) => ({
              ...current,
              accessLevel: current.accessLevel === "user" ? "technician" : "user",
            }))
          }
        >
          <Text style={styles.selectorLabel}>Access level</Text>
          <Text style={styles.selectorValue}>{newDefinition.accessLevel}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.selector}
          onPress={() =>
            setNewDefinition((current) => ({
              ...current,
              functionCode:
                current.functionCode === "auto"
                  ? "0x06"
                  : current.functionCode === "0x06"
                    ? "0x10"
                    : "auto",
            }))
          }
        >
          <Text style={styles.selectorLabel}>Function code</Text>
          <Text style={styles.selectorValue}>{newDefinition.functionCode}</Text>
        </TouchableOpacity>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Visible en app cliente</Text>
          <Switch
            value={newDefinition.visible}
            onValueChange={(value) =>
              setNewDefinition((current) => ({ ...current, visible: value }))
            }
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Editable en app cliente</Text>
          <Switch
            value={newDefinition.writable}
            onValueChange={(value) =>
              setNewDefinition((current) => ({ ...current, writable: value }))
            }
          />
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>Agregar parámetro</Text>
        </TouchableOpacity>
      </View>
      )}

      {showAlertsSection && (
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Alertas</Text>
        <Text style={styles.formHint}>
          Define si el backend debe marcar este controlador como fuera de rango o sin comunicación.
        </Text>

        <TouchableOpacity
          style={[styles.toggleCard, alertsEnabled && styles.toggleCardActive]}
          onPress={() => setAlertsEnabled((current) => !current)}
        >
          <View style={styles.toggleCopy}>
            <Text style={[styles.toggleTitle, alertsEnabled && styles.toggleTitleActive]}>
              {alertsEnabled ? "Alertas activas" : "Alertas desactivadas"}
            </Text>
            <Text style={styles.toggleDescription}>
              Si están activas, el backend evalúa temperatura alta, baja y controlador offline.
            </Text>
          </View>
          <View style={[styles.togglePill, alertsEnabled && styles.togglePillActive]}>
            <View style={[styles.toggleKnob, alertsEnabled && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>

        <FieldBlock
          label="Temperatura mínima alerta"
          help="Si la temperatura cae por debajo de este valor, se genera alerta."
        >
          <TextInput
            style={styles.input}
            value={minTemperature}
            onChangeText={setMinTemperature}
            keyboardType="numbers-and-punctuation"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock
          label="Temperatura máxima alerta"
          help="Si la temperatura supera este valor, se genera alerta."
        >
          <TextInput
            style={styles.input}
            value={maxTemperature}
            onChangeText={setMaxTemperature}
            keyboardType="numbers-and-punctuation"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock
          label="Segundos sin comunicación"
          help="Tiempo máximo antes de marcarlo offline."
        >
          <TextInput
            style={styles.input}
            value={offlineAfterSeconds}
            onChangeText={setOfflineAfterSeconds}
            keyboardType="number-pad"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>
      </View>
      )}

      {showDefinitionsSection && definitions.map((definition, index) => (
        <View key={`${definition.key}-${index}`} style={styles.definitionCard}>
          <LabeledInput
            label="Label"
            value={definition.label}
            onChangeText={(value) => updateDefinition(index, { label: value })}
          />
          <LabeledInput
            label="Key"
            value={definition.key}
            onChangeText={(value) => updateDefinition(index, { key: value.toUpperCase() })}
            autoCapitalize="characters"
          />
          <LabeledInput
            label="Register"
            value={definition.register}
            onChangeText={(value) => updateDefinition(index, { register: value })}
            keyboardType="number-pad"
          />
          <LabeledInput
            label="Verify register"
            value={definition.verifyRegister}
            onChangeText={(value) => updateDefinition(index, { verifyRegister: value })}
            keyboardType="number-pad"
          />
          <LabeledInput
            label="Scale"
            value={definition.scale}
            onChangeText={(value) => updateDefinition(index, { scale: value })}
            keyboardType="number-pad"
          />
          <LabeledInput
            label="Min"
            value={definition.min}
            onChangeText={(value) => updateDefinition(index, { min: value })}
            keyboardType="numbers-and-punctuation"
          />
          <LabeledInput
            label="Max"
            value={definition.max}
            onChangeText={(value) => updateDefinition(index, { max: value })}
            keyboardType="numbers-and-punctuation"
          />
          <LabeledInput
            label="Descripción"
            value={definition.description}
            onChangeText={(value) => updateDefinition(index, { description: value })}
          />

          <TouchableOpacity style={styles.selector} onPress={() => cycleAccess(index)}>
            <Text style={styles.selectorLabel}>Access level</Text>
            <Text style={styles.selectorValue}>{definition.accessLevel}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.selector} onPress={() => cycleFunctionCode(index)}>
            <Text style={styles.selectorLabel}>Function code</Text>
            <Text style={styles.selectorValue}>{definition.functionCode}</Text>
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Visible</Text>
            <Switch
              value={definition.visible}
              onValueChange={(value) => updateDefinition(index, { visible: value })}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Editable</Text>
            <Switch
              value={definition.writable}
              onValueChange={(value) => updateDefinition(index, { writable: value })}
            />
          </View>

          <TouchableOpacity onPress={() => handleRemove(index)}>
            <Text style={styles.removeText}>Quitar</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "Guardando..." : "Guardar configuración"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function FieldBlock({
  label,
  help,
  children,
}: {
  label: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldHelp}>{help}</Text>
      {children}
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor="#94A3B8"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#F3F4F6", paddingTop: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 20 },
  adminNotice: {
    backgroundColor: "#E0F2FE",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },
  adminNoticeTitle: {
    color: "#075985",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  adminNoticeText: {
    color: "#0369A1",
    lineHeight: 18,
  },
  formCard: { backgroundColor: "#FFF", borderRadius: 20, padding: 16, marginBottom: 20 },
  formTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 6 },
  formHint: { color: "#475569", lineHeight: 19, marginBottom: 16 },
  fieldBlock: { marginBottom: 12 },
  fieldLabel: { color: "#111827", fontWeight: "700", marginBottom: 4 },
  fieldHelp: { color: "#64748B", fontSize: 12, lineHeight: 17, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFF",
  },
  addButton: { backgroundColor: "#111827", borderRadius: 12, paddingVertical: 12 },
  addButtonText: { color: "#FFF", textAlign: "center", fontWeight: "700" },
  toggleCard: {
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleCardActive: {
    borderColor: "#001F7C",
    backgroundColor: "#EEF2FF",
  },
  toggleCopy: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  toggleTitleActive: {
    color: "#001F7C",
  },
  toggleDescription: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 17,
  },
  togglePill: {
    width: 52,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#CBD5E1",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  togglePillActive: {
    backgroundColor: "#001F7C",
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
  definitionCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  selector: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  selectorLabel: {
    color: "#64748B",
    fontSize: 12,
    marginBottom: 4,
  },
  selectorValue: {
    color: "#0F172A",
    fontWeight: "700",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  switchLabel: {
    color: "#111827",
    fontWeight: "700",
  },
  removeText: { color: "#B91C1C", fontWeight: "700" },
  saveButton: { marginTop: 10, backgroundColor: "#001F7C", borderRadius: 14, paddingVertical: 14 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#FFF", textAlign: "center", fontWeight: "800" },
});

export default ControllerRegisterConfigScreen;
