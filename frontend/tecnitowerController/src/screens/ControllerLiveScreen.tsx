import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import AppLayout from '../layouts/AppLayout';
import { fetchDiagnostic, getControllerWebSocketUrl } from '../services/api';
import RemoteControlScreen from './RemoteControlScreen';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { Activity, Cpu, Settings2, Thermometer } from 'lucide-react-native';

const PRESENTATION_READINGS = [
  { key: 'SET', label: 'Setpoint normal' },
  { key: 'LS', label: 'Setpoint mínimo' },
  { key: 'US', label: 'Setpoint máximo' },
  { key: 'TMP1', label: 'Temperatura S1' },
];

function ControllerLiveScreen({ route, navigation, session, onLogout }: any) {
  const { controller } = route.params;
  const insets = useSafeAreaInsets();
  
 const [data, setData] = useState({
    temp: null,
    setpoint: null,
    setpointRegister: null,
    userParams768: null as any,
    status1280: null as any,
    online: false,
    connectionState: controller?.connectionState ?? null,
    alertState: controller?.alertState ?? null,
    paramSetpoint: null,
    paramSetpointRegister: null,
    configuredRegisters: (controller?.registerDefinitions as any[]) ?? [],
  });
  
  const [refreshing, setRefreshing] = useState(false);
  const isMountedRef = useRef(true);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getConfiguredRegister = useCallback((key: string) => {
    return data.configuredRegisters.find((definition: any) => {
      return String(definition?.key).toUpperCase() === key;
    });
  }, [data.configuredRegisters]);

  const getRegisterValue = useCallback((key: string) => {
    const definition = getConfiguredRegister(key);
    const value = Number(definition?.value);
    return Number.isFinite(value) ? value : null;
  }, [getConfiguredRegister]);

  const cameraTemp = data.temp ?? getRegisterValue('TMP1');
  const currentSetpoint = data.setpoint ?? getRegisterValue('SET');
  const currentSetpointRegister =
    data.setpointRegister ?? getConfiguredRegister('SET')?.register ?? null;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!controller?._id) return;
    AsyncStorage.setItem(
      STORAGE_KEYS.lastController,
      JSON.stringify({ id: controller._id, name: controller?.name }),
    ).catch(() => {});
  }, [controller?._id]);

  const fetchData = useCallback(async () => {
    try {
      const json = await fetchDiagnostic(controller._id, session.token);
      if (!isMountedRef.current) return;

      // Si no vienen valores dinámicos desde el diagnóstico, usamos las definiciones locales del controlador
      const baseDefinitions = Array.isArray(controller?.registerDefinitions)
        ? controller.registerDefinitions
        : [];
      const configuredRegisters =
        Array.isArray(json?.configuredRegisters) && json.configuredRegisters.length > 0
          ? json.configuredRegisters
          : baseDefinitions;

      setData({
        temp: json?.probe1Value ?? null,
        setpoint: json?.setpointValue ?? null,
        setpointRegister: json?.setpointRegister ?? null,
        userParams768: json?.userParams768 ?? null,
        status1280: json?.status1280 ?? null,
        online: Boolean(json?.online),
        connectionState: json?.connectionState ?? null,
        alertState: json?.alertState ?? null,
        paramSetpoint: json?.setpointParamValue ?? null,
        paramSetpointRegister: json?.setpointParamRegister ?? null,
        configuredRegisters,
      });
    } catch {
      if (isMountedRef.current) {
        // Si la lectura falla, mantenemos los registros locales y dejamos online=true para habilitar la UI
        setData(prev => ({
          ...prev,
          online: true,
          configuredRegisters:
            Array.isArray(prev.configuredRegisters) && prev.configuredRegisters.length > 0
              ? prev.configuredRegisters
              : Array.isArray(controller?.registerDefinitions)
                ? controller.registerDefinitions
                : [],
        }));
      }
    } finally {
      setRefreshing(false);
    }
  }, [controller._id, session.token]);

  const scheduleRealtimeRefresh = useCallback((delayMs = 150) => {
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }

    realtimeRefreshTimerRef.current = setTimeout(() => {
      fetchData();
    }, delayMs);
  }, [fetchData]);

  const currentAlert = data.alertState;
  const showAlertBanner = Boolean(currentAlert?.active);
  const alertBannerStyle = showAlertBanner
    ? currentAlert?.type === 'offline'
      ? {
          backgroundColor: '#FEF2F2',
          borderColor: '#FECACA',
          titleColor: '#991B1B',
          textColor: '#7F1D1D',
        }
      : {
          backgroundColor: '#FFFBEB',
          borderColor: '#FDE68A',
          titleColor: '#92400E',
          textColor: '#78350F',
        }
    : null;
  const statusMessage = showAlertBanner
    ? currentAlert?.message
    : data.online
      ? 'Comunicación estable con el controlador.'
      : 'Sin comunicación reciente con el controlador.';

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    let cancelled = false;

    async function connectRealtime() {
      try {
        const wsUrl = await getControllerWebSocketUrl(controller._id, session.token);
        if (cancelled) return;

        if (socketRef.current) {
          socketRef.current.close();
          socketRef.current = null;
        }

        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          scheduleRealtimeRefresh(100);
        };

        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(String(event?.data ?? '{}'));
            if (payload?.type === 'connected' || payload?.type === 'controller-refresh') {
              scheduleRealtimeRefresh(payload?.type === 'connected' ? 100 : 200);
            }
          } catch {
            scheduleRealtimeRefresh(200);
          }
        };

        socket.onerror = () => {};

        socket.onclose = () => {
          if (cancelled) return;
          reconnectTimerRef.current = setTimeout(() => {
            connectRealtime();
          }, 3000);
        };
      } catch {
        if (cancelled) return;
        reconnectTimerRef.current = setTimeout(() => {
          connectRealtime();
        }, 5000);
      }
    }

    connectRealtime();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [controller._id, scheduleRealtimeRefresh, session.token]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <AppLayout navigation={navigation} onLogout={onLogout} session={session}>
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(); }}
              tintColor="#2563eb"
              progressViewOffset={insets.top + 10} 
            />
          }
          contentContainerStyle={[styles.scrollContent, { paddingTop: 0 }]}
        >
          <View style={styles.header}>
            <View style={styles.statusContainer}>
              <LinearGradient
                colors={data.online ? ["#f0fdf4", "#dcfce7"] : ["#fef2f2", "#fee2e2"]}
                style={styles.statusPill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={[styles.dot, data.online ? styles.dotOn : styles.dotOff]} />
                <Text style={[styles.statusText, { color: data.online ? "#166534" : "#991b1b" }]}>
                  {data.online ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </LinearGradient>
              
              <View style={styles.activityBadge}>
                <Activity 
                  color={data.online ? "#10B981" : "#EF4444"} 
                  size={14} 
                  strokeWidth={3} 
                />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
          </View>

          {String(controller?.deviceModel).toUpperCase().includes('TC900E') && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Cpu color="#64748B" size={18} />
                <Text style={styles.cardLabel}>LECTURAS TC900E LOG</Text>
              </View>
              {PRESENTATION_READINGS.map((item) => {
                const def = getConfiguredRegister(item.key);
                const value = Number.isFinite(Number(def?.value)) ? Number(def?.value) : null;
                return (
                  <View key={item.key} style={styles.readRow}>
                    <View>
                      <Text style={styles.readLabel}>{def?.label ?? item.label}</Text>
                      <Text style={styles.readSub}>REG {def?.register ?? '---'}</Text>
                    </View>
                    <Text style={styles.readValue}>
                      {value !== null ? `${value.toFixed((def?.step ?? 0.1) < 1 ? 1 : 0)}°C` : '--'}
                    </Text>
                  </View>
                );
              })}
              {!data.online && (
                <Text style={styles.offlineHint}>
                  Sin lectura Modbus; se muestran datos locales. Verifica baud/ID del controlador.
                </Text>
              )}
            </View>
          )}

          <View style={styles.mainCard}>
            <View style={styles.cardHeader}>
              <Thermometer color="#64748B" size={18} />
              <Text style={styles.cardLabel}>TEMPERATURA DE CÁMARA</Text>
            </View>

            <View
              style={[
                styles.statusMessageBox,
                showAlertBanner && alertBannerStyle
                  ? {
                      backgroundColor: alertBannerStyle.backgroundColor,
                      borderColor: alertBannerStyle.borderColor,
                    }
                  : undefined,
              ]}
            >
              <Text
                style={[
                  styles.statusMessageTitle,
                  showAlertBanner && alertBannerStyle
                    ? { color: alertBannerStyle.titleColor }
                    : undefined,
                ]}
              >
                {showAlertBanner ? 'ALERTA DEL CONTROLADOR' : 'ESTADO DEL CONTROLADOR'}
              </Text>
              <Text
                style={[
                  styles.statusMessageText,
                  showAlertBanner && alertBannerStyle
                    ? { color: alertBannerStyle.textColor }
                    : undefined,
                ]}
              >
                {statusMessage}
              </Text>
            </View>
            
            <View style={styles.tempContainer}>
              <Text style={styles.tempValue}>
                {Number.isFinite(Number(cameraTemp)) ? Number(cameraTemp).toFixed(1) : '--.-'}
              </Text>
              <Text style={styles.tempUnit}>°C</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View>
                <Text style={styles.infoLabel}>SETPOINT ACTUAL</Text>
                <Text style={styles.infoValue}>
                  {Number.isFinite(Number(currentSetpoint)) ? Number(currentSetpoint).toFixed(1) : '--'}°C
                </Text>
              </View>
              <View style={styles.regBadge}>
                <Text style={styles.regBadgeText}>REG {currentSetpointRegister || '---'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            {session?.user?.role === 'admin' && (
              <TouchableOpacity
                style={styles.configButton}
                onPress={() =>
                  navigation.navigate('ControllerRegisterConfig', {
                    controller,
                    adminMode: true,
                  })
                }
              >
                <Settings2 color="#0F172A" size={18} strokeWidth={2.2} />
                <Text style={styles.configButtonText}>Configuración técnica</Text>
              </TouchableOpacity>
            )}
            <RemoteControlScreen
              controllerId={controller._id}
              token={session?.token}
              configuredRegisters={data.configuredRegisters}
              online={data.online}
            />
          </View>
        </ScrollView>
      </AppLayout>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  scrollContent: { 
    paddingBottom: 40, 
    paddingHorizontal: 20 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end', 
    marginBottom: 15,
    height: 54,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',

  },
  dot: { 
    width: 7, 
    height: 7, 
    borderRadius: 3.5, 
    marginRight: 8,
  },
  dotOn: { backgroundColor: '#10B981' },
  dotOff: { backgroundColor: '#EF4444' },
  statusText: { 
    fontSize: 10, 
    fontWeight: '900', 
    letterSpacing: 0.5 
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 25,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  cardLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
  statusMessageBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  statusMessageTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#334155',
    marginBottom: 4,
  },
  statusMessageText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
  },
  tempContainer: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginVertical: 10 },
  tempValue: { fontSize: 80, fontWeight: '900', color: '#0F172A', letterSpacing: -2 },
  tempUnit: { fontSize: 24, fontWeight: '700', color: '#CBD5E1', marginTop: 12, marginLeft: 4 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', marginBottom: 2 },
  infoValue: { fontSize: 20, fontWeight: '800', color: '#334155' },
  regBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  regBadgeText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
  section: { gap: 12, marginBottom: 20 },
  configButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  configButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8 },
  readRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E5E7EB' },
  readLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  readSub: { fontSize: 12, color: '#6B7280' },
  readValue: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  offlineHint: { fontSize: 12, color: '#9CA3AF', marginTop: 10, textAlign: 'center' },
});

export default ControllerLiveScreen;
