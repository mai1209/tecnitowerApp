import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BellRing, Cpu, Eye, SlidersHorizontal } from "lucide-react-native";
import AppLayout from "../layouts/AppLayout";

const sections = [
  {
    key: "base",
    title: "Configuración base",
    description: "Nombre, Elfin ID, transporte, IP, Unit ID, baudrate, probes y ubicación.",
    icon: Cpu,
  },
  {
    key: "alerts",
    title: "Alertas",
    description: "Rangos de temperatura y tiempo máximo sin comunicación.",
    icon: BellRing,
  },
  {
    key: "parameter-new",
    title: "Alta de parámetro",
    description: "Crear un nuevo parámetro visible/editable para este controlador.",
    icon: SlidersHorizontal,
  },
  {
    key: "definitions",
    title: "Registros visibles/editables",
    description: "Editar permisos, visibilidad y detalle de los registros ya cargados.",
    icon: Eye,
  },
];

export default function AdminControllerConfigHubScreen({ navigation, route, session, onLogout }: any) {
  const controller = route?.params?.controller;
  const user = route?.params?.user;

  return (
    <AppLayout navigation={navigation} onLogout={onLogout} session={session}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Panel técnico del controlador</Text>
          <Text style={styles.title}>{controller?.name || "Controlador"}</Text>
          <Text style={styles.subtitle}>
            Usuario: {user?.fullName || user?.email || "-"}{"\n"}
            {controller?.elfinId || "-"} · {controller?.deviceModel || controller?.dixellModel || "Sin modelo"}
          </Text>
        </View>

        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <TouchableOpacity
              key={section.key}
              style={styles.sectionCard}
              onPress={() =>
                navigation.navigate("ControllerRegisterConfig", {
                  controller,
                  adminMode: true,
                  section: section.key,
                })
              }
            >
              <View style={styles.iconWrap}>
                <Icon color="#0F172A" size={20} strokeWidth={2.2} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionDescription}>{section.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
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
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
  copy: {
    flex: 1,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },
  sectionDescription: {
    color: "#64748B",
    lineHeight: 18,
  },
});
