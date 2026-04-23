import React, { useEffect, useState } from "react";
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
import AppLayout from "../layouts/AppLayout";
import { createDeviceModel, updateDeviceModel } from "../services/api";

function blankRegisterDefinition() {
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

function blankModelForm() {
  return {
    brand: "DIXELL",
    name: "",
    protocol: "tcp-client",
    connectionType: "serial",
    defaultUnitId: "1",
    defaultModbusPort: "502",
    defaultBaudRate: "9600",
    defaultDataBits: "8",
    defaultParity: "none",
    defaultStopBits: "1",
    defaultProbe1: "",
    defaultProbe2: "",
    setpointRegister: "",
    setpointReadRegister: "",
    setpointVerifyRegister: "",
    setpointMin: "",
    setpointMax: "",
    setpointScale: "10",
    description: "",
    notes: "",
    registerTemplates: [] as any[],
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return undefined;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export default function DeviceModelFormScreen({ navigation, route, session, onLogout }: any) {
  const editingModel = route?.params?.model ?? null;
  const focusRegisters = Boolean(route?.params?.focusRegisters);
  const [form, setForm] = useState(blankModelForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showRegisters, setShowRegisters] = useState(focusRegisters);

  useEffect(() => {
    if (!editingModel) {
      setForm(blankModelForm());
      setShowRegisters(focusRegisters);
      return;
    }

    setForm({
      brand: editingModel.brand ?? "DIXELL",
      name: editingModel.name ?? "",
      protocol: editingModel.protocol ?? "tcp-client",
      connectionType: editingModel.connectionType ?? "serial",
      defaultUnitId:
        editingModel.defaultUnitId == null ? "" : String(editingModel.defaultUnitId),
      defaultModbusPort:
        editingModel.defaultModbusPort == null ? "" : String(editingModel.defaultModbusPort),
      defaultBaudRate:
        editingModel.defaultBaudRate == null ? "" : String(editingModel.defaultBaudRate),
      defaultDataBits:
        editingModel.defaultDataBits == null ? "" : String(editingModel.defaultDataBits),
      defaultParity: editingModel.defaultParity ?? "none",
      defaultStopBits:
        editingModel.defaultStopBits == null ? "" : String(editingModel.defaultStopBits),
      defaultProbe1:
        editingModel.defaultProbe1 == null ? "" : String(editingModel.defaultProbe1),
      defaultProbe2:
        editingModel.defaultProbe2 == null ? "" : String(editingModel.defaultProbe2),
      setpointRegister:
        editingModel.setpointRegister == null ? "" : String(editingModel.setpointRegister),
      setpointReadRegister:
        editingModel.setpointReadRegister == null ? "" : String(editingModel.setpointReadRegister),
      setpointVerifyRegister:
        editingModel.setpointVerifyRegister == null ? "" : String(editingModel.setpointVerifyRegister),
      setpointMin: editingModel.setpointMin == null ? "" : String(editingModel.setpointMin),
      setpointMax: editingModel.setpointMax == null ? "" : String(editingModel.setpointMax),
      setpointScale:
        editingModel.setpointScale == null ? "10" : String(editingModel.setpointScale),
      description: editingModel.description ?? "",
      notes: editingModel.notes ?? "",
      registerTemplates:
        editingModel.registerTemplates?.length > 0
          ? editingModel.registerTemplates.map((definition: any) => ({
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
          : [],
    });
    setShowRegisters(focusRegisters);
  }, [editingModel, focusRegisters]);

  const updateRegisterDefinition = (index: number, patch: any) => {
    setForm((current) => ({
      ...current,
      registerTemplates: current.registerTemplates.map((definition, currentIndex) =>
        currentIndex === index ? { ...definition, ...patch } : definition
      ),
    }));
  };

  const removeRegisterDefinition = (index: number) => {
    setForm((current) => ({
      ...current,
      registerTemplates: current.registerTemplates.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert("Error", "El nombre del modelo es obligatorio.");
      return;
    }

    const registerTemplates = form.registerTemplates
      .map((definition, index) => {
        const register = parseOptionalNumber(definition.register);
        if (!definition.key.trim() || !definition.label.trim() || register == null) return null;

        return {
          key: definition.key.trim().toUpperCase(),
          label: definition.label.trim(),
          register,
          verifyRegister: parseOptionalNumber(definition.verifyRegister),
          scale: parseOptionalNumber(definition.scale) ?? 10,
          min: parseOptionalNumber(definition.min),
          max: parseOptionalNumber(definition.max),
          step: (parseOptionalNumber(definition.scale) ?? 10) === 10 ? 0.1 : 1,
          writable: definition.writable,
          visible: definition.visible,
          accessLevel: definition.accessLevel,
          functionCode: definition.functionCode,
          description: definition.description.trim() || undefined,
          sortOrder: index,
        };
      })
      .filter(Boolean);

    setSaving(true);
    setError("");

    try {
      const payload = {
        brand: form.brand.trim().toUpperCase() || "DIXELL",
        name: form.name.trim().toUpperCase(),
        protocol: form.protocol,
        connectionType: form.connectionType,
        defaultUnitId: parseOptionalNumber(form.defaultUnitId),
        defaultModbusPort: parseOptionalNumber(form.defaultModbusPort),
        defaultBaudRate: parseOptionalNumber(form.defaultBaudRate),
        defaultDataBits: parseOptionalNumber(form.defaultDataBits),
        defaultParity: form.defaultParity.trim().toLowerCase() || undefined,
        defaultStopBits: parseOptionalNumber(form.defaultStopBits),
        defaultProbe1: parseOptionalNumber(form.defaultProbe1),
        defaultProbe2: parseOptionalNumber(form.defaultProbe2),
        setpointRegister: parseOptionalNumber(form.setpointRegister),
        setpointReadRegister: parseOptionalNumber(form.setpointReadRegister),
        setpointVerifyRegister: parseOptionalNumber(form.setpointVerifyRegister),
        setpointMin: parseOptionalNumber(form.setpointMin),
        setpointMax: parseOptionalNumber(form.setpointMax),
        setpointScale: parseOptionalNumber(form.setpointScale) ?? 10,
        description: form.description.trim() || undefined,
        notes: form.notes.trim() || undefined,
        registerTemplates,
      };

      if (editingModel?._id) {
        await updateDeviceModel(editingModel._id, payload, session.token);
      } else {
        await createDeviceModel(payload, session.token);
      }

      Alert.alert("OK", editingModel?._id ? "Modelo actualizado" : "Modelo creado");
      navigation.goBack();
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar el modelo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout navigation={navigation} onLogout={onLogout} session={session}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Parámetros generales</Text>
          <Text style={styles.title}>
            {editingModel?._id ? `Editar ${editingModel.name}` : "Cargar nuevo modelo"}
          </Text>
          <Text style={styles.subtitle}>
            Primero definí el modelo. Después cargá los registros que este modelo va a usar.
          </Text>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos del modelo</Text>
          <LabeledInput label="Marca" value={form.brand} onChangeText={(value) => setForm((current) => ({ ...current, brand: value }))} />
          <LabeledInput label="Nombre" value={form.name} onChangeText={(value) => setForm((current) => ({ ...current, name: value }))} />
          <LabeledInput label="Protocolo" value={form.protocol} onChangeText={(value) => setForm((current) => ({ ...current, protocol: value }))} />
          <LabeledInput label="Tipo de conexión" value={form.connectionType} onChangeText={(value) => setForm((current) => ({ ...current, connectionType: value }))} />
          <LabeledInput label="Unit ID default" value={form.defaultUnitId} keyboardType="number-pad" onChangeText={(value) => setForm((current) => ({ ...current, defaultUnitId: value }))} />
          <LabeledInput label="Puerto Modbus default" value={form.defaultModbusPort} keyboardType="number-pad" onChangeText={(value) => setForm((current) => ({ ...current, defaultModbusPort: value }))} />
          <LabeledInput label="Baud rate default" value={form.defaultBaudRate} keyboardType="number-pad" onChangeText={(value) => setForm((current) => ({ ...current, defaultBaudRate: value }))} />
          <LabeledInput label="Probe 1 default" value={form.defaultProbe1} keyboardType="number-pad" onChangeText={(value) => setForm((current) => ({ ...current, defaultProbe1: value }))} />
          <LabeledInput label="Probe 2 default" value={form.defaultProbe2} keyboardType="number-pad" onChangeText={(value) => setForm((current) => ({ ...current, defaultProbe2: value }))} />
          <LabeledInput label="Setpoint register" value={form.setpointRegister} keyboardType="number-pad" onChangeText={(value) => setForm((current) => ({ ...current, setpointRegister: value }))} />
          <LabeledInput label="Setpoint scale" value={form.setpointScale} keyboardType="number-pad" onChangeText={(value) => setForm((current) => ({ ...current, setpointScale: value }))} />
          <LabeledInput label="Descripción" value={form.description} onChangeText={(value) => setForm((current) => ({ ...current, description: value }))} />
          <LabeledInput label="Notas" value={form.notes} onChangeText={(value) => setForm((current) => ({ ...current, notes: value }))} />

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setShowRegisters((current) => !current)}
          >
            <Text style={styles.secondaryButtonText}>
              {showRegisters ? "Ocultar registros de este modelo" : "Cargar registros para este modelo"}
            </Text>
          </TouchableOpacity>
        </View>

        {showRegisters && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Registros del modelo</Text>
            {form.registerTemplates.length === 0 && (
              <View style={styles.emptyRegistersCard}>
                <Text style={styles.emptyRegistersText}>
                  Todavía no hay registros cargados para este modelo.
                </Text>
              </View>
            )}

            {form.registerTemplates.map((definition, index) => (
              <View key={`${definition.key}-${index}`} style={styles.registerCard}>
                <LabeledInput label="Key" value={definition.key} onChangeText={(value) => updateRegisterDefinition(index, { key: value.toUpperCase() })} />
                <LabeledInput label="Label" value={definition.label} onChangeText={(value) => updateRegisterDefinition(index, { label: value })} />
                <LabeledInput label="Register" value={definition.register} keyboardType="number-pad" onChangeText={(value) => updateRegisterDefinition(index, { register: value })} />
                <LabeledInput label="Verify register" value={definition.verifyRegister} keyboardType="number-pad" onChangeText={(value) => updateRegisterDefinition(index, { verifyRegister: value })} />
                <LabeledInput label="Scale" value={definition.scale} keyboardType="number-pad" onChangeText={(value) => updateRegisterDefinition(index, { scale: value })} />
                <LabeledInput label="Min" value={definition.min} keyboardType="numbers-and-punctuation" onChangeText={(value) => updateRegisterDefinition(index, { min: value })} />
                <LabeledInput label="Max" value={definition.max} keyboardType="numbers-and-punctuation" onChangeText={(value) => updateRegisterDefinition(index, { max: value })} />
                <LabeledInput label="Descripción" value={definition.description} onChangeText={(value) => updateRegisterDefinition(index, { description: value })} />

                <TouchableOpacity
                  style={styles.selector}
                  onPress={() =>
                    updateRegisterDefinition(index, {
                      accessLevel: definition.accessLevel === "user" ? "technician" : "user",
                    })
                  }
                >
                  <Text style={styles.selectorLabel}>Access level</Text>
                  <Text style={styles.selectorValue}>{definition.accessLevel}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => {
                    const current = definition.functionCode;
                    const next = current === "auto" ? "0x06" : current === "0x06" ? "0x10" : "auto";
                    updateRegisterDefinition(index, { functionCode: next });
                  }}
                >
                  <Text style={styles.selectorLabel}>Function code</Text>
                  <Text style={styles.selectorValue}>{definition.functionCode}</Text>
                </TouchableOpacity>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Visible</Text>
                  <Switch
                    value={definition.visible}
                    onValueChange={(value) => updateRegisterDefinition(index, { visible: value })}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Editable</Text>
                  <Switch
                    value={definition.writable}
                    onValueChange={(value) => updateRegisterDefinition(index, { writable: value })}
                  />
                </View>

                <TouchableOpacity style={styles.removeButton} onPress={() => removeRegisterDefinition(index)}>
                  <Text style={styles.removeButtonText}>Quitar registro</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() =>
                setForm((current) => ({
                  ...current,
                  registerTemplates: [...current.registerTemplates, blankRegisterDefinition()],
                }))
              }
            >
              <Text style={styles.secondaryButtonText}>Cargar nuevo registro</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          disabled={saving}
          onPress={handleSave}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Guardar cambios</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </AppLayout>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: any;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor="#94A3B8"
      />
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
  error: {
    color: "#991B1B",
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 14,
  },
  fieldBlock: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: "#111827",
    fontWeight: "700",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFF",
  },
  emptyRegistersCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  emptyRegistersText: {
    color: "#64748B",
  },
  registerCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#F8FAFC",
  },
  selector: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
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
    paddingHorizontal: 4,
  },
  switchLabel: {
    color: "#0F172A",
    fontWeight: "700",
  },
  removeButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    paddingVertical: 10,
  },
  removeButtonText: {
    color: "#991B1B",
    textAlign: "center",
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#0F172A",
    textAlign: "center",
    fontWeight: "800",
  },
  saveButton: {
    backgroundColor: "#001F7C",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#FFF",
    textAlign: "center",
    fontWeight: "800",
  },
});
