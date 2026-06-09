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
import { ArrowLeft, BellRing, Cpu, Hash, Info } from 'lucide-react-native';
import { createAdminController, createController, fetchDeviceModels } from '../services/api';
import { AuthSession } from '../types/auth';

type Props = {
  navigation: any;
  route: any;
  session: AuthSession;
};

function getRecommendedConnectionDefaults(model: any, fallback: { unitId: string; baudRate: string; probe1: string; probe2: string }) {
  const normalizedName = String(model?.name ?? '').trim().toUpperCase();

  if (normalizedName === 'TC900E LOG') {
    return {
      unitId: '1',
      baudRate: '9600',
      probe1: '101',
      probe2: '102',
    };
  }

  return {
    unitId: String(model?.defaultUnitId ?? fallback.unitId),
    baudRate: String(model?.defaultBaudRate ?? fallback.baudRate),
    probe1: String(model?.defaultProbe1 ?? fallback.probe1),
    probe2: String(model?.defaultProbe2 ?? fallback.probe2),
  };
}

function ControllerFormScreen({ navigation, route, session }: Props) {
  const adminOwnerId = route?.params?.ownerId ? String(route.params.ownerId) : '';
  const adminOwnerName = route?.params?.ownerName ? String(route.params.ownerName) : '';
  const adminMode = Boolean(adminOwnerId && session?.user?.role === 'admin');
  const [name, setName] = useState('');
  const gatewayMode = 'tcp-client' as const;
  const [deviceModel, setDeviceModel] = useState('');
  const [deviceBrand, setDeviceBrand] = useState('');
  const [elfinId, setElfinId] = useState('');
  const [ipAddress] = useState('');
  const [unitId, setUnitId] = useState('1');
  const [baudRate, setBaudRate] = useState('9600');
  const [probe1, setProbe1] = useState('');
  const [probe2, setProbe2] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [minTemperature, setMinTemperature] = useState('');
  const [maxTemperature, setMaxTemperature] = useState('');
  const [offlineAfterMinutes, setOfflineAfterMinutes] = useState('1');
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
    const recommended = getRecommendedConnectionDefaults(model, {
      unitId,
      baudRate,
      probe1: probe1 || '101',
      probe2: probe2 || '102',
    });

    setSelectedModelId(model._id);
    setDeviceModel(model.name);
    setDeviceBrand(model.brand ?? '');
    setUnitId(recommended.unitId);
    setBaudRate(recommended.baudRate);
    setProbe1(recommended.probe1);
    setProbe2(recommended.probe2);
    setModalVisible(false);
  };

  const parseOptionalNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedElfinId = elfinId.trim().toUpperCase();
    const trimmedDeviceModel = deviceModel.trim().toUpperCase();
    const trimmedDeviceBrand = deviceBrand.trim().toUpperCase();

    if (!trimmedName) {
      setError('Falta la identificación del controlador.');
      return;
    }
    if (!trimmedDeviceModel) {
      setError('Falta seleccionar el modelo de hardware.');
      return;
    }
    if (!trimmedElfinId) {
      setError('Falta el ID Elfin del controlador.');
      return;
    }

    const parsedUnitId = parseOptionalNumber(unitId);
    const parsedBaudRate = parseOptionalNumber(baudRate);
    const parsedProbe1 = parseOptionalNumber(probe1);
    const parsedProbe2 = parseOptionalNumber(probe2);
    const parsedMinTemperature = parseOptionalNumber(minTemperature);
    const parsedMaxTemperature = parseOptionalNumber(maxTemperature);
    const parsedOfflineAfterMinutes = parseOptionalNumber(offlineAfterMinutes);
    if (!parsedUnitId || parsedUnitId < 1 || parsedUnitId > 247) {
      setError('Unit ID debe estar entre 1 y 247.');
      return;
    }
    if (baudRate.trim() && !parsedBaudRate) {
      setError('Baud rate inválido.');
      return;
    }
    if (probe1.trim() && (parsedProbe1 == null || parsedProbe1 < 0)) {
      setError('Probe 1 inválida.');
      return;
    }
    if (probe2.trim() && (parsedProbe2 == null || parsedProbe2 < 0)) {
      setError('Probe 2 inválida.');
      return;
    }
    if (minTemperature.trim() && parsedMinTemperature == null) {
      setError('Temperatura mínima inválida.');
      return;
    }
    if (maxTemperature.trim() && parsedMaxTemperature == null) {
      setError('Temperatura máxima inválida.');
      return;
    }
    if (
      parsedMinTemperature != null &&
      parsedMaxTemperature != null &&
      parsedMinTemperature > parsedMaxTemperature
    ) {
      setError('La temperatura mínima no puede ser mayor que la máxima.');
      return;
    }
    if (
      offlineAfterMinutes.trim() &&
      (parsedOfflineAfterMinutes == null || parsedOfflineAfterMinutes < 1)
    ) {
      setError('El tiempo sin comunicación debe ser al menos 1 minuto.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const payload = {
        name: trimmedName,
        gatewayMode,
        deviceBrand: trimmedDeviceBrand || undefined,
        deviceModel: trimmedDeviceModel,
        deviceModelId: selectedModelId ?? undefined,
        dixellModel: trimmedDeviceModel,
        dixellModelId: selectedModelId ?? undefined,
        elfinId: trimmedElfinId,
        ipAddress: ipAddress.trim() || undefined,
        unitId: parsedUnitId,
        baudRate: parsedBaudRate,
        probe1: parsedProbe1,
        probe2: parsedProbe2,
        alertConfig: {
          enabled: alertsEnabled,
          minTemperature: parsedMinTemperature,
          maxTemperature: parsedMaxTemperature,
          offlineAfterMs:
            parsedOfflineAfterMinutes == null ? undefined : parsedOfflineAfterMinutes * 60000,
        },
      };

      if (adminMode) {
        await createAdminController(
          {
            ...payload,
            ownerId: adminOwnerId,
          },
          session.token
        );
      } else {
        await createController(payload, session.token);
      }

      Alert.alert('Éxito', adminMode ? 'Controlador asignado correctamente.' : 'Controlador registrado correctamente.');
      navigation.navigate(adminMode ? 'AdminDashboard' : 'Home');
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
                <Text style={styles.cardTitle}>
                  {adminMode ? `Alta para ${adminOwnerName || 'usuario'}` : 'Datos del Dispositivo'}
                </Text>
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
                <View style={[styles.modeCard, styles.modeCardActive]}>
                  <Text style={[styles.modeTitle, styles.modeTitleActive]}>
                    Elfin TCP Client
                  </Text>
                  <Text style={styles.modeDescription}>
                    Modo productivo validado. El Elfin se conecta directo al servidor Oracle en el puerto TCP 4001.
                  </Text>
                </View>
              </View>

              <InputField
                label="ID Elfin (Serial)"
                icon={<Hash size={16} color="#64748B" />}
                value={elfinId}
                onChangeText={setElfinId}
                placeholder="ELFIN:XXXXXXX"
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

              <View style={styles.sectionDivider} />

              <View style={styles.cardHeader}>
                <BellRing color="#001F7C" size={20} />
                <Text style={styles.cardTitle}>Alertas Básicas</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.toggleCard,
                  alertsEnabled ? styles.toggleCardActive : undefined,
                ]}
                onPress={() => setAlertsEnabled((current) => !current)}
              >
                <View style={styles.toggleCopy}>
                  <Text
                    style={[
                      styles.toggleTitle,
                      alertsEnabled ? styles.toggleTitleActive : undefined,
                    ]}
                  >
                    {alertsEnabled ? 'Alertas activas' : 'Alertas desactivadas'}
                  </Text>
                  <Text style={styles.toggleDescription}>
                    Controla temperatura fuera de rango y equipo sin comunicación.
                  </Text>
                </View>
                <View
                  style={[
                    styles.togglePill,
                    alertsEnabled ? styles.togglePillActive : undefined,
                  ]}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      alertsEnabled ? styles.toggleKnobActive : undefined,
                    ]}
                  />
                </View>
              </TouchableOpacity>

              <InputField
                label="Temperatura mínima alerta (opcional)"
                icon={<Info size={16} color="#64748B" />}
                value={minTemperature}
                onChangeText={setMinTemperature}
                placeholder="Ej: -5"
                keyboardType="numbers-and-punctuation"
              />

              <InputField
                label="Temperatura máxima alerta (opcional)"
                icon={<Info size={16} color="#64748B" />}
                value={maxTemperature}
                onChangeText={setMaxTemperature}
                placeholder="Ej: 8"
                keyboardType="numbers-and-punctuation"
              />

              <InputField
                label="Minutos sin comunicación"
                icon={<Hash size={16} color="#64748B" />}
                value={offlineAfterMinutes}
                onChangeText={setOfflineAfterMinutes}
                placeholder="1"
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
  sectionDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 18,
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
  toggleCard: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    padding: 14,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleCardActive: {
    borderColor: '#001F7C',
    backgroundColor: '#EEF2FF',
  },
  toggleCopy: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  toggleTitleActive: {
    color: '#001F7C',
  },
  toggleDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  togglePill: {
    width: 52,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  togglePillActive: {
    backgroundColor: '#001F7C',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
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
