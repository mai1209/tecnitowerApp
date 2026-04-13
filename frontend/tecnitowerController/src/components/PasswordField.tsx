import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

type Props = {
  label: string;
  value: string;
  placeholder: string;
  visible: boolean;
  onChangeText: (value: string) => void;
  onToggleVisibility: () => void;
};

export default function PasswordField({
  label,
  value,
  placeholder,
  visible,
  onChangeText,
  onToggleVisibility,
}: Props) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          onPress={onToggleVisibility}
          style={styles.eyeButton}
        >
          {visible ? <EyeOff size={18} color="#334155" /> : <Eye size={18} color="#334155" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 5,
    marginLeft: 17,
  },
  inputWrapper: {
    position: "relative",
    justifyContent: "center",
    marginBottom: 13,
  },
  input: {
    height: 45,
    borderWidth: 1,
    borderColor: "#001F7C",
    borderRadius: 15,
    paddingLeft: 10,
    paddingRight: 44,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
});
