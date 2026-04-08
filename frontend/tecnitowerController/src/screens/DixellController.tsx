import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Props = {
  currentSetpoint?: number | null;
  readRegister?: number | null;
  writeRegister?: number | null;
};

const DixellController = ({
  currentSetpoint,
  readRegister,
  writeRegister,
}: Props) => {
  const hasValue = Number.isFinite(currentSetpoint);

  return (
    <View style={styles.cardContainer}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>PUNTO DE CONSIGNA (SEt)</Text>
        <View style={styles.headerUnderline} />
      </View>

      <View style={styles.controlBox}>
        <View style={styles.infoRow}>
          <View style={styles.infoCopy}>
            <Text style={styles.paramName}>Temperatura objetivo actual</Text>
            <Text style={styles.paramHint}>
              Lectura confirmada desde el controlador físico
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>SOLO LECTURA</Text>
          </View>
        </View>

        <View style={styles.valuePanel}>
          <Text style={styles.valueText}>
            {hasValue ? Number(currentSetpoint).toFixed(1) : "--.-"}
          </Text>
          <Text style={styles.unitText}>°C</Text>
        </View>

        <View style={styles.metaCard}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Registro de lectura</Text>
            <Text style={styles.metaValue}>REG {readRegister ?? "---"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Registro de escritura ??</Text>
            <Text style={styles.metaValue}>
              {writeRegister ? `REG ${writeRegister}` : "Pendiente de validar"}
            </Text>
          </View>
        </View>

        <Text style={styles.notice}>
          La escritura remota del setpoint queda en validación hasta confirmar
          el registro correcto del modelo. Por ahora esta tarjeta muestra el
          valor real leído del equipo.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    elevation: 4,
  },
  header: { alignItems: "center", marginBottom: 18 },
  sectionTitle: { fontSize: 12, fontWeight: "800", color: "#94A3B8" },
  headerUnderline: {
    width: 34,
    height: 3,
    backgroundColor: "#F59E0B",
    marginTop: 5,
    borderRadius: 999,
  },
  controlBox: {
    backgroundColor: "#FFF7ED",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  infoRow: {
    gap: 10,
  },
  infoCopy: {
    flexShrink: 1,
  },
  paramName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#9A3412",
  },
  paramHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#C2410C",
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FFEDD5",
    borderColor: "#FDBA74",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    color: "#9A3412",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  valuePanel: {
    marginTop: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "baseline",
  },
  valueText: {
    fontSize: 38,
    fontWeight: "900",
    color: "#111827",
  },
  unitText: {
    marginLeft: 5,
    fontSize: 16,
    color: "#94A3B8",
    fontWeight: "700",
  },
  metaCard: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  metaItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLabel: {
    color: "#9A3412",
    fontSize: 12,
    fontWeight: "700",
  },
  metaValue: {
    color: "#7C2D12",
    fontSize: 12,
    fontWeight: "900",
  },
  notice: {
    marginTop: 14,
    color: "#7C2D12",
    lineHeight: 19,
    fontSize: 12,
  },
});

export default DixellController;
