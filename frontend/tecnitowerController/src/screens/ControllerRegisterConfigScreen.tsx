import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { fetchController, updateControllerRegisterDefinitions } from "../services/api";

function ControllerRegisterConfigScreen({ route, navigation, session }: any) {
  const { controller } = route.params;
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [label, setLabel] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [register, setRegister] = useState("");
  const [verifyRegister, setVerifyRegister] = useState("");
  const [scale, setScale] = useState("10");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadController() {
      try {
        const response = await fetchController(controller._id, session.token);
        setDefinitions(response.controller?.registerDefinitions ?? []);
      } catch (_) {}
    }

    loadController();
  }, [controller._id, session.token]);

  const handleAdd = () => {
    const numericRegister = Number(register);
    if (!label.trim() || !keyValue.trim() || !Number.isFinite(numericRegister)) {
      Alert.alert("Error", "Label, key y register son obligatorios");
      return;
    }

    const normalizedKey = keyValue.trim().toUpperCase();
    if (definitions.some((definition) => definition.key === normalizedKey)) {
      Alert.alert("Error", "Ya existe un parametro con esa key");
      return;
    }

    setDefinitions((prev) => [
      ...prev,
      {
        key: normalizedKey,
        label: label.trim(),
        register: numericRegister,
        verifyRegister: verifyRegister === "" ? undefined : Number(verifyRegister),
        scale: Number(scale) || 10,
        min: min === "" ? undefined : Number(min),
        max: max === "" ? undefined : Number(max),
        step: (Number(scale) || 10) === 10 ? 0.1 : 1,
        dataType: "number",
        writable: true,
        visible: true,
        accessLevel: "user",
        sortOrder: prev.length,
      },
    ]);

    setLabel("");
    setKeyValue("");
    setRegister("");
    setVerifyRegister("");
    setScale("10");
    setMin("");
    setMax("");
  };

  const handleRemove = (key: string) => {
    setDefinitions((prev) => prev.filter((definition) => definition.key !== key));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateControllerRegisterDefinitions(controller._id, definitions, session.token);
      Alert.alert("OK", "Parametros guardados");
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No se pudieron guardar los parametros");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Parametros dinamicos</Text>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Alta de parametro</Text>
        <Text style={styles.formHint}>
          Carga solo los registros que quieras mostrar en la app. La key debe
          ser unica y el register debe coincidir con la direccion Modbus del
          parametro.
        </Text>

        <FieldBlock
          label="Nombre visible"
          help="Es el texto que vera el usuario en la tarjeta del parametro."
        >
          <TextInput
            style={styles.input}
            placeholder="Ej: Diferencial HY"
            value={label}
            onChangeText={setLabel}
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock
          label="Key interna"
          help="Usa una clave corta, sin espacios. Debe ser unica dentro del controlador."
        >
          <TextInput
            style={styles.input}
            placeholder="Ej: HY"
            value={keyValue}
            onChangeText={setKeyValue}
            autoCapitalize="characters"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock
          label="Registro Modbus"
          help="Direccion exacta del parametro en el equipo."
        >
          <TextInput
            style={styles.input}
            placeholder="Ej: 769"
            value={register}
            onChangeText={setRegister}
            keyboardType="numeric"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock
          label="Registro de verificacion"
          help="Registro que se usa para leer y confirmar el valor real despues de escribir. Si no lo completas, usa el mismo register."
        >
          <TextInput
            style={styles.input}
            placeholder="Ej: 1536 para setpoint / vacio para usar el mismo"
            value={verifyRegister}
            onChangeText={setVerifyRegister}
            keyboardType="number-pad"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock
          label="Escala"
          help="Usa 10 si el equipo maneja decimales. Usa 1 si el valor es entero."
        >
          <TextInput
            style={styles.input}
            placeholder="Ej: 10 para 12.5 / 1 para 12"
            value={scale}
            onChangeText={setScale}
            keyboardType="numeric"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock
          label="Minimo permitido"
          help="Limite inferior que la app va a respetar al escribir."
        >
          <TextInput
            style={styles.input}
            placeholder="Ej: -50"
            value={min}
            onChangeText={setMin}
            keyboardType="numbers-and-punctuation"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <FieldBlock
          label="Maximo permitido"
          help="Limite superior que la app va a respetar al escribir."
        >
          <TextInput
            style={styles.input}
            placeholder="Ej: 25"
            value={max}
            onChangeText={setMax}
            keyboardType="numeric"
            placeholderTextColor="#94A3B8"
          />
        </FieldBlock>

        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>Agregar parametro</Text>
        </TouchableOpacity>
      </View>

      {definitions.map((definition) => (
        <View key={definition.key} style={styles.definitionCard}>
          <View>
            <Text style={styles.definitionTitle}>{definition.label}</Text>
            <Text style={styles.definitionMeta}>
              {definition.key} · REG {definition.register} · Verif {definition.verifyRegister ?? definition.register} · Scale {definition.scale ?? 10}
            </Text>
            <Text style={styles.definitionRange}>
              Min {definition.min ?? "-"} · Max {definition.max ?? "-"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleRemove(definition.key)}>
            <Text style={styles.removeText}>Quitar</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? "Guardando..." : "Guardar configuracion"}</Text>
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

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#F3F4F6", paddingTop: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 20 },
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
  definitionCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  definitionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  definitionMeta: { marginTop: 4, color: "#6B7280" },
  definitionRange: { marginTop: 4, color: "#94A3B8", fontSize: 12 },
  removeText: { color: "#B91C1C", fontWeight: "700" },
  saveButton: { marginTop: 10, backgroundColor: "#001F7C", borderRadius: 14, paddingVertical: 14 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#FFF", textAlign: "center", fontWeight: "800" },
});

export default ControllerRegisterConfigScreen;
