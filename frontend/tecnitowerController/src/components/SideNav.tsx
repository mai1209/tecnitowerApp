import { useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { 
  BookOpenText, 
  ChevronLeft, 
  LogOut, 
  Menu, 
  Plus,
} from "lucide-react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = SCREEN_WIDTH * 0.85;

type SideNavProps = {
  navigation: any;
  onLogout?: () => void;
};

export default function SideNav({ navigation, onLogout }: SideNavProps) {
  const [open, setOpen] = useState(false);

  const items = useMemo(
    () => [
      {
        key: "controller-form",
        label: "Agregar controlador",
        hint: "Alta rápida de equipos",
        icon: Plus,
        action: () => navigation.navigate("ControllerForm"),
      },
      {
        key: "manual",
        label: "Manual técnico",
        hint: "Referencias y ayuda",
        icon: BookOpenText,
        action: () => navigation.navigate("Manual"),
      },
    ],
    [navigation]
  );

  return (
    <>
      {/* Lanzador Flotante */}
      <TouchableOpacity 
        style={styles.launcher} 
        onPress={() => setOpen(true)} 
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={["#1e293b", "#0f172a"]}
          style={styles.launcherGradient}
        >
          <Menu color="#FFFFFF" size={24} strokeWidth={2} />
        </LinearGradient>
      </TouchableOpacity>

      {open && (
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

          <View style={styles.drawer}>
            <SafeAreaView style={{ flex: 1 }}>
              
              {/* Header Profesional */}
              <View style={styles.header}>
                <View style={styles.headerTop}>
                  <View style={styles.logoContainer}>
                    <Image 
                      source={require("../../assets/logo.png")} 
                      style={styles.logo}
                      resizeMode="contain" 
                    />
                  </View>
                  <TouchableOpacity 
                    style={styles.closeButton} 
                    onPress={() => setOpen(false)}
                  >
                    <ChevronLeft color="#64748b" size={24} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.brandTitle}>TECNITOWER</Text>
                <Text style={styles.brandSubtitle}>Supervisión y control industrial</Text>
              </View>

              {/* Lista de Navegación */}
              <ScrollView 
                contentContainerStyle={styles.menuList} 
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.sectionLabel}>MENÚ DE SISTEMA</Text>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={styles.menuItem}
                      onPress={() => {
                        setOpen(false);
                        item.action();
                      }}
                    >
                      <View style={styles.iconWrapper}>
                        <Icon color="#0F172A" size={20} strokeWidth={2} />
                      </View>
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemLabel}>{item.label}</Text>
                        <Text style={styles.itemHint}>{item.hint}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Botón de Logout Estilo Original */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.logoutButton}
                  activeOpacity={0.92}
                  onPress={() => {
                    setOpen(false);
                    onLogout?.();
                  }}
                >
                  <LogOut color="#FFF7ED" size={18} strokeWidth={2.1} />
                  <Text style={styles.logoutText}>Cerrar sesión</Text>
                </TouchableOpacity>
                <Text style={styles.versionText}>Tecnitower S.A • v2.4.0</Text>
              </View>

            </SafeAreaView>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  launcher: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 40,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  launcherGradient: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    flexDirection: "row",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  drawer: {
    width: DRAWER_WIDTH,
    height: "100%",
    backgroundColor: "#FFFFFF",
   
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 25,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: "#F8FAFC",
    borderTopRightRadius: 32,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#FFF",
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  menuList: {
    paddingHorizontal: 20,
    paddingTop: 25,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1.2,
    marginBottom: 16,
    marginLeft: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 10,
    backgroundColor: "#F1F5F9",
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  itemCopy: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
  },
  itemHint: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  footer: {
    padding: 24,
    paddingBottom: 30,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#0F172A", 
    borderRadius: 20,
    paddingVertical: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  logoutText: {
    color: "#FFF7ED",
    fontSize: 15,
    fontWeight: "800",
  },
  versionText: {
    fontSize: 11,
    color: "#CBD5E1",
    marginTop: 18,
    textAlign: "center",
    fontWeight: "600",
  },
});
