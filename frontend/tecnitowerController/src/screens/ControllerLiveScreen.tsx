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
import { BellRing, Cpu, Settings2, Thermometer } from 'lucide-react-native';

const PRESENTATION_READINGS = [
  { key: 'SET', label: 'Setpoint normal' },
  { key: 'LS', label: 'Setpoint mínimo' },
  { key: 'US', label: 'Setpoint máximo' },
  { key: 'TMP1', label: 'Temperatura S1' },
];
// Refresco periódico de respaldo: el WebSocket ya empuja actualizaciones en
// tiempo real, así que este intervalo solo cubre por si el WS se cae.
const LIVE_REFRESH_INTERVAL_MS = 15000;

function isConnectionAlertType(type?: string | null) {
  return type === 'offline' || type === 'elfin_offline' || type === 'modbus_offline';
}

function filterDefinitionsForRole(definitions: any[]) {
  return (definitions ?? []).filter((definition: any) => {
    if (definition?.visible === false) return false;
    return true;
  });
}

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
    userCanWrite: session?.user?.role === 'admin' || session?.user?.canWrite === true,
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
  }, [controller?._id, controller?.name]);

  const fetchData = useCallback(async () => {
    try {
      const json = await fetchDiagnostic(controller._id, session.token);
      if (!isMountedRef.current) return;

      // Si no vienen valores dinámicos desde el diagnóstico, usamos las definiciones locales del controlador
      const baseDefinitions = Array.isArray(controller?.registerDefinitions)
        ? filterDefinitionsForRole(controller.registerDefinitions)
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
        userCanWrite:
          typeof json?.userCanWrite === 'boolean'
            ? json.userCanWrite
            : session?.user?.role === 'admin' || session?.user?.canWrite === true,
        connectionState: json?.connectionState ?? null,
        alertState: json?.alertState ?? null,
        paramSetpoint: json?.setpointParamValue ?? null,
        paramSetpointRegister: json?.setpointParamRegister ?? null,
        configuredRegisters,
      });
    } catch {
      if (isMountedRef.current) {
        // Si la lectura falla no podemos verificar el equipo: reflejamos estado offline
        // (mantenemos los registros locales como referencia, pero sin mostrar "online" ni habilitar la escritura como si respondiera).
        setData(prev => ({
          ...prev,
          online: false,
          connectionState: null,
          userCanWrite:
            session?.user?.role === 'admin' || session?.user?.canWrite === true,
          configuredRegisters:
            Array.isArray(prev.configuredRegisters) && prev.configuredRegisters.length > 0
              ? prev.configuredRegisters
              : Array.isArray(controller?.registerDefinitions)
                ? filterDefinitionsForRole(controller.registerDefinitions)
                : [],
        }));
      }
    } finally {
      setRefreshing(false);
    }
  }, [controller._id, controller?.registerDefinitions, session.token, session?.user?.canWrite, session?.user?.role]);

  const scheduleRealtimeRefresh = useCallback((delayMs = 150) => {
    if (realtimeRefreshTimerRef.current) {
      clearTimeout(realtimeRefreshTimerRef.current);
    }

    realtimeRefreshTimerRef.current = setTimeout(() => {
      fetchData();
    }, delayMs);
  }, [fetchData]);

  const currentAlert = data.alertState;
  const elfinOnline = Boolean(data.connectionState?.elfinOnline ?? data.online);
  const modbusOnline = Boolean(data.connectionState?.modbusOnline ?? data.online);
  const gatewayOnline = elfinOnline;
  const connectionStatusMessage = !gatewayOnline
    ? 'Lectura Modbus no verificable porque el gateway/Elfin no está conectado al servidor. Revisá WiFi, internet, energía del Elfin o configuración TCP Client.'
    : !modbusOnline
      ? 'Gateway conectado, pero el controlador no entrega datos Modbus. Revisá cableado RS485, alimentación del controlador, Unit ID, baud rate y registros.'
      : 'Gateway conectado y lectura Modbus activa.';
  const showAlertBanner = Boolean(currentAlert?.active);
  const showConnectionAlert = showAlertBanner && isConnectionAlertType(currentAlert?.type);
  const alertBannerStyle = showAlertBanner
    ? showConnectionAlert
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
  const statusMessage = showConnectionAlert
    ? connectionStatusMessage
    : showAlertBanner && currentAlert?.message
      ? `${connectionStatusMessage} ${currentAlert.message}`
      : connectionStatusMessage;
  const statusMessageTitle = modbusOnline ? 'LECTURA MODBUS ONLINE' : 'LECTURA MODBUS OFFLINE';

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, LIVE_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    let reconnectAttempt = 0;

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
          reconnectAttempt = 0;
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
          // Backoff exponencial: 3s, 6s, 12s… hasta 60s, para no martillar el
          // servidor ni drenar batería cuando está caído.
          const delay = Math.min(3000 * 2 ** reconnectAttempt, 60000);
          reconnectAttempt += 1;
          reconnectTimerRef.current = setTimeout(connectRealtime, delay);
        };
      } catch {
        if (cancelled) return;
        const delay = Math.min(3000 * 2 ** reconnectAttempt, 60000);
        reconnectAttempt += 1;
        reconnectTimerRef.current = setTimeout(connectRealtime, delay);
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
          contentContainerStyle={[styles.scrollContent, styles.scrollContentTop]}
        >
          <View style={styles.header}>
            <View style={styles.statusContainer}>
              <LinearGradient
                colors={gatewayOnline ? ["#f0fdf4", "#dcfce7"] : ["#fef2f2", "#fee2e2"]}
                style={styles.statusPill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={[styles.dot, gatewayOnline ? styles.dotOn : styles.dotOff]} />
                <Text style={[styles.statusText, gatewayOnline ? styles.statusTextOn : styles.statusTextOff]}>
                  {gatewayOnline ? 'GATEWAY ONLINE' : 'GATEWAY OFFLINE'}
                </Text>
              </LinearGradient>
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
              {!modbusOnline && (
                <Text style={styles.offlineHint}>
                  Lectura Modbus offline; se muestran datos locales. Revisá cableado RS485, alimentación del controlador, Unit ID y baud rate.
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
                {statusMessageTitle}
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
            {data.userCanWrite && (
              <TouchableOpacity
                style={styles.configButton}
                onPress={() =>
                  navigation.navigate('ControllerRegisterConfig', {
                    controller,
                    adminMode: session?.user?.role === 'admin',
                    section: 'alerts',
                  })
                }
              >
                <BellRing color="#0F172A" size={18} strokeWidth={2.2} />
                <Text style={styles.configButtonText}>Configurar alertas</Text>
              </TouchableOpacity>
            )}
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
              online={modbusOnline}
              profileCanWrite={data.userCanWrite}
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
  scrollContentTop: {
    paddingTop: 0,
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
  statusTextOn: {
    color: '#166534',
  },
  statusTextOff: {
    color: '#991b1b',
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
