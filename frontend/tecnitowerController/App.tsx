import React from "react";
import { StatusBar, StyleSheet, View, Platform } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <SafeAreaProvider style={{ backgroundColor: "#0F172A" }}>
      <StatusBar 
        translucent 
        backgroundColor="transparent" 
        barStyle="light-content" 
      />

      {/* SafeAreaView superior con el color oscuro de tu marca */}
      <SafeAreaView edges={["top"]} style={styles.topSafeArea} />

      <View style={styles.app}>
        <AppNavigator />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  topSafeArea: { 
    backgroundColor: "#0F172A", // Este color debe ser oscuro para que resalte el texto blanco
    flex: 0 
  },
  app: { 
    flex: 1, 
    backgroundColor: "#0F172A" // Fondo base para evitar destellos blancos al navegar
  },
});