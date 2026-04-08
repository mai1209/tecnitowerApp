import React from "react";
import { View, StyleSheet } from "react-native";
import SideNav from "../components/SideNav";

type Props = {
  navigation: any;
  children: React.ReactNode;
  onLogout?: () => void;
};

export default function AppLayout({ navigation, children, onLogout }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.content}>{children}</View>
      <SideNav navigation={navigation} onLogout={onLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#EEF3F9",
  },
  content: {
    flex: 1,
    paddingTop: 10,
  },
});
