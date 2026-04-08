import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  type TextInputProps,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ArrowLeft, Cpu, Globe, Hash, Info } from 'lucide-react-native';
import { createController, fetchDeviceModels } from '../services/api';
import { AuthSession } from '../types/auth';

type Props = {
  navigation: any;
  session: AuthSession;
};

function ControllerFormScreen({ navigation, session }: Props) {
  const [name, setName] = useState('');
  const [gatewayMode, setGatewayMode] = useState<'agent-mqtt' | 'elfin-mqtt'>('agent-mqtt');
  const [deviceModel, setDeviceModel] = useState('');
  const [deviceBrand, setDeviceBrand] = useState('');
  const [elfinId, setElfinId] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [unitId, setUnitId] = useState('1');
  const [baudRate, setBaudRate] = useState('9600');
  const [models, setModels] = useState<any[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadModels() {
      setLoadingModels(true);
      try {
        const response = await fetchDeviceModels();
        setModels(response.models);
      } catch (err) {
        console.warn('Error cargando modelos:', err);
      } finally {
        setLoadingModels(false);
      }
    }
    loadModels();
  }, []);

  const handleSelectModel = (model: any) => {
    setSelectedModelId(model._id);
    setDeviceModel(model.name);
    setDeviceBrand(model.brand ?? '');
    setUnitId(String(model.defaultUnitId ?? unitId));
    setBaudRate(String(model.defaultBaudRate ?? baudRate));
    setModalVisible(false);
  };

  const parseOptionalNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const handleSubmit = async () => {
    const requiresLocalIp = gatewayMode !== 'elfin-mqtt';
    if (!name || !elfinId || (requiresLocalIp && !ipAddress)) {
      setError('Por favor, completa todos los campos obligatorios.');
      return;
    }
    const parsedUnitId = parseOptionalNumber(unitId);
    const parsedBaudRate = parseOptionalNumber(baudRate);
    if (!parsedUnitId || parsedUnitId < 1 || parsedUnitId > 247) {
      setError('Unit ID debe estar entre 1 y 247.');
      return;
    }
    if (baudRate.trim() && !parsedBaudRate) {
      setError('Baud rate inválido.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      await createController({
        name,
        gatewayMode,
        deviceBrand: deviceBrand.trim().toUpperCase() || undefined,
        deviceModel: deviceModel.trim().toUpperCase(),
        deviceModelId: selectedModelId ?? undefined,
        dixellModel: deviceModel.trim().toUpperCase(),
        dixellModelId: selectedModelId ?? undefined,
        elfinId: elfinId.trim().toUpperCase(),
        ipAddress: ipAddress.trim() || undefined,
        unitId: parsedUnitId,
        baudRate: parsedBaudRate,
      }, session.token);

      Alert.alert('Éxito', 'Controlador registrado correctamente.');
      navigation.navigate('Home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={['#F8FAFC', '#E2E8F0', '#001F7C']}
      style={styles.container}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.navigate('Home')}
            >
              <ArrowLeft color="#001F7C" size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Nuevo Controlador</Text>
            <View style={{ width: 40 }} /> 
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.formCard}>
              <View style={styles.cardHeader}>
                <Cpu color="#001F7C" size={20} />
                <Text style={styles.cardTitle}>Datos del Dispositivo</Text>
              </View>

              <InputField
                label="Identificación"
                icon={<Info size={16} color="#64748B" />}
                value={name}
                onChangeText={setName}
                placeholder="Ej: Heladera Principal"
              />

              <Text style={styles.label}>Modelo de Hardware</Text>
              <TouchableOpacity
                style={styles.selectInput}
                onPress={() => setModalVisible(true)}
              >
                <Text style={[styles.selectText, !deviceModel && { color: '#9CA3AF' }]}>
                  {deviceModel ? `${deviceBrand} ${deviceModel}` : 'Selecciona un modelo...'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>Modo de conexión</Text>
              <View style={styles.modeSelector}>
                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    gatewayMode === 'agent-mqtt' && styles.modeCardActive,
                  ]}
                  onPress={() => setGatewayMode('agent-mqtt')}
                >
                  <Text
                    style={[
                      styles.modeTitle,
                      gatewayMode === 'agent-mqtt' && styles.modeTitleActive,
                    ]}
                  >
                    Gateway Local
                  </Text>
                  <Text style={styles.modeDescription}>
                    Raspberry, mini PC o Mac conectada al mismo WiFi del Elfin.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    gatewayMode === 'elfin-mqtt' && styles.modeCardActive,
                  ]}
                  onPress={() => setGatewayMode('elfin-mqtt')}
                >
                  <Text
                    style={[
                      styles.modeTitle,
                      gatewayMode === 'elfin-mqtt' && styles.modeTitleActive,
                    ]}
                  >
                    Elfin MQTT Directo
                  </Text>
                  <Text style={styles.modeDescription}>
                    Solo para gateways compatibles. Requiere configurar MQTT en el panel del Elfin.
                  </Text>
                </TouchableOpacity>
              </View>

              <InputField
                label="ID Elfin (Serial)"
                icon={<Hash size={16} color="#64748B" />}
                value={elfinId}
                onChangeText={setElfinId}
                placeholder="ELF-XXXXXXX"
              />

              <InputField
                label={gatewayMode === 'elfin-mqtt' ? 'Dirección IP Local (opcional)' : 'Dirección IP'}
                icon={<Globe size={16} color="#64748B" />}
                value={ipAddress}
                onChangeText={setIpAddress}
                placeholder={gatewayMode === 'elfin-mqtt' ? 'Opcional si el gateway va directo por MQTT' : '192.168.1.XX'}
                keyboardType="numbers-and-punctuation"
              />

              <InputField
                label="Unit ID Modbus"
                icon={<Hash size={16} color="#64748B" />}
                value={unitId}
                onChangeText={setUnitId}
                placeholder="1"
                keyboardType="number-pad"
              />

              <InputField
                label="Baud rate RS485"
                icon={<Hash size={16} color="#64748B" />}
                value={baudRate}
                onChangeText={setBaudRate}
                placeholder="9600"
                keyboardType="number-pad"
              />

              {!!error && (
                <View style={styles.errorBadge}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Registrar ahora</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Modal de Selección */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Seleccionar Modelo</Text>
            {loadingModels ? (
              <ActivityIndicator color="#001F7C" style={{ margin: 20 }} />
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {models.map(model => (
                  <TouchableOpacity
                    key={model._id}
                    style={styles.modelOption}
                    onPress={() => handleSelectModel(model)}
                  >
                    <Text style={styles.modelName}>{model.name}</Text>
                    <Text style={styles.modelDesc}>{model.brand || 'Dixell Standard'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.closeModal} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeModalText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

function InputField({ label, icon, ...rest }: { label: string; icon: any } & TextInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <View style={styles.iconContainer}>{icon}</View>
        <TextInput style={styles.input} placeholderTextColor="#9CA3AF" {...rest} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#001F7C',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  iconContainer: {
    paddingLeft: 12,
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 12,
    color: '#1E293B',
    fontSize: 14,
  },
  selectInput: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  selectText: {
    fontSize: 14,
    color: '#1E293B',
  },
  modeSelector: {
    gap: 10,
    marginBottom: 15,
  },
  modeCard: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    padding: 14,
  },
  modeCardActive: {
    borderColor: '#001F7C',
    backgroundColor: '#EEF2FF',
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  modeTitleActive: {
    color: '#001F7C',
  },
  modeDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  errorBadge: {
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#000',
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#001F7C',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '85%',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 15,
  },
  modelOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modelName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#001F7C',
  },
  modelDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeModal: {
    marginTop: 20,
    alignSelf: 'center',
  },
  closeModalText: {
    color: '#64748B',
    fontWeight: '700',
  },
});

export default ControllerFormScreen;
