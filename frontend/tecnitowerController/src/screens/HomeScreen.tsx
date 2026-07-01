import React, { useCallback, useState } from 'react';
import {
  Alert,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppLayout from '../layouts/AppLayout';
import {
  deleteController,
  fetchControllers,
  updateControllerName,
} from '../services/api';
import { AuthSession } from '../types/auth';
import { PencilLine, SkipForward, Trash2 } from 'lucide-react-native';

const CONTROLLERS_REFRESH_INTERVAL_MS = 15000;

type Props = {
  navigation: any;
  session: AuthSession;
  onLogout: () => void;
};

function getControllerRuntimeStatus(controller: any) {
  const connectionState = controller?.connectionState ?? {};
  const gatewayOnline = Boolean(
    connectionState?.elfinOnline ?? connectionState?.online,
  );
  const modbusOnline = Boolean(
    connectionState?.modbusOnline ?? connectionState?.online,
  );
  const alert = controller?.alertState ?? null;

  if (!gatewayOnline) {
    return {
      label: 'Gateway offline',
      detail:
        'Lectura Modbus no verificable porque el gateway/Elfin no está conectado al servidor.',
      backgroundColor: '#FEE2E2',
      textColor: '#991B1B',
      dotColor: '#DC2626',
    };
  }

  if (!modbusOnline) {
    return {
      label: 'Gateway online · Modbus offline',
      detail:
        'Gateway conectado, pero el controlador no entrega datos Modbus. Revisá RS485, alimentación, Unit ID, baud rate y registros.',
      backgroundColor: '#FEF3C7',
      textColor: '#92400E',
      dotColor: '#D97706',
    };
  }

  if (alert?.active) {
    return {
      label: 'Gateway online · Modbus online',
      detail: alert.message || 'El controlador tiene una alerta pendiente.',
      backgroundColor: '#FEF3C7',
      textColor: '#92400E',
      dotColor: '#D97706',
    };
  }

  if (gatewayOnline && modbusOnline) {
    return {
      label: 'Gateway online · Modbus online',
      detail: 'Equipo comunicando correctamente.',
      backgroundColor: '#DCFCE7',
      textColor: '#166534',
      dotColor: '#16A34A',
    };
  }

  return {
    label: 'Sin estado',
    detail: 'Todavía no hay diagnóstico reciente.',
    backgroundColor: '#E2E8F0',
    textColor: '#475569',
    dotColor: '#94A3B8',
  };
}

function HomeScreen({ navigation, session, onLogout }: Props) {
  const [controllers, setControllers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingController, setEditingController] = useState<any | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState('');
  const canWrite =
    session?.user?.role === 'admin' || session?.user?.canWrite === true;

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      let refreshInterval: ReturnType<typeof setInterval> | null = null;

      async function loadControllers(showLoading = false) {
        if (!session?.token) {
          if (isMounted) {
            setError(
              'Sesion invalida (token faltante). Cerra sesion e inicia de nuevo.',
            );
            setLoading(false);
          }
          return;
        }
        if (showLoading) {
          setLoading(true);
        }
        setError('');
        try {
          const response = await fetchControllers(session.token);
          if (isMounted) {
            setControllers(Array.isArray(response?.controllers) ? response.controllers : []);
          }
        } catch (err) {
          if (isMounted) {
            setError(
              err instanceof Error
                ? err.message
                : 'No se pudieron cargar los controladores',
            );
          }
        } finally {
          if (isMounted) setLoading(false);
        }
      }

      loadControllers(true);
      refreshInterval = setInterval(() => {
        loadControllers(false);
      }, CONTROLLERS_REFRESH_INTERVAL_MS);

      return () => {
        isMounted = false;
        if (refreshInterval) {
          clearInterval(refreshInterval);
        }
      };
    }, [session?.token]),
  );

  const handleDeleteController = useCallback(
    (controller: any) => {
      if (!session?.token || deletingId) return;

      Alert.alert(
        'Eliminar controlador',
        `Se va a eliminar "${
          controller?.name ?? 'este controlador'
        }". Esta acción no se puede deshacer.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                setDeletingId(String(controller._id));
                setError('');
                await deleteController(String(controller._id), session.token);
                setControllers(current =>
                  current.filter(item => item._id !== controller._id),
                );
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : 'No se pudo eliminar el controlador',
                );
              } finally {
                setDeletingId(null);
              }
            },
          },
        ],
      );
    },
    [deletingId, session?.token],
  );

  const handleEditController = useCallback((controller: any) => {
    setEditingController(controller);
    setEditingName(String(controller?.name ?? ''));
  }, []);

  const handleCloseEditName = useCallback(() => {
    if (savingName) return;
    setEditingController(null);
    setEditingName('');
  }, [savingName]);

  const handleSaveControllerName = useCallback(async () => {
    if (!session?.token || !editingController?._id || savingName) return;

    const nextName = editingName.trim();
    if (!nextName) {
      Alert.alert('Nombre requerido', 'Ingresá un nombre para el controlador.');
      return;
    }

    if (nextName.length > 150) {
      Alert.alert(
        'Nombre muy largo',
        'El nombre puede tener hasta 150 caracteres.',
      );
      return;
    }

    setSavingName(true);
    setError('');
    try {
      await updateControllerName(String(editingController._id), nextName, session.token);
      setControllers(current =>
        current.map(controller =>
          controller._id === editingController._id
            ? { ...controller, name: nextName }
            : controller,
        ),
      );
      setEditingController(null);
      setEditingName('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cambiar el nombre',
      );
    } finally {
      setSavingName(false);
    }
  }, [editingController, editingName, savingName, session?.token]);

  return (
    <AppLayout navigation={navigation} onLogout={onLogout} session={session}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Presentación</Text>

          <View style={styles.headerRow}>
            <Text style={styles.subtitle}>Controladores</Text>

            <View style={styles.headerActions}>
              {session?.user?.role !== 'admin' && canWrite && (
                <TouchableOpacity
                  style={styles.primaryCta}
                  onPress={() => navigation.navigate('ControllerForm')}
                >
                  <Text style={styles.primaryCtaText}>Agregar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {loading && (
          <ActivityIndicator
            size="small"
            color="#001F7C"
            style={styles.loading}
          />
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && controllers.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {session?.user?.role === 'admin'
                ? 'Este usuario admin no tiene controladores propios'
                : 'Todavía no registraste controladores'}
            </Text>
            <Text style={styles.emptyText}>
              {session?.user?.role === 'admin'
                ? 'Entrá desde el menú al Panel administrador para gestionar usuarios, controladores y modelos.'
                : 'Cargá el primero desde “Agregar”.'}
            </Text>
          </View>
        )}

        {controllers.map(ctrl => (
          <View key={ctrl._id} style={styles.card}>
            <TouchableOpacity
              style={styles.cardMainAction}
              onPress={() =>
                navigation.navigate('ControllerLive', {
                  controller: ctrl,
                })
              }
            >
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{ctrl.name}</Text>
                <Text style={styles.cardBadge}>
                  {ctrl.deviceBrand || ctrl.deviceModel || ctrl.dixellModel
                    ? [ctrl.deviceBrand, ctrl.deviceModel || ctrl.dixellModel]
                        .filter(Boolean)
                        .join(' · ')
                    : 'SIN MODELO'}
                </Text>
                {(() => {
                  const runtimeStatus = getControllerRuntimeStatus(ctrl);
                  return (
                    <>
                      <View
                        style={[
                          styles.runtimeBadge,
                          { backgroundColor: runtimeStatus.backgroundColor },
                        ]}
                      >
                        <View
                          style={[
                            styles.runtimeDot,
                            { backgroundColor: runtimeStatus.dotColor },
                          ]}
                        />
                        <Text
                          style={[
                            styles.runtimeBadgeText,
                            { color: runtimeStatus.textColor },
                          ]}
                        >
                          {runtimeStatus.label}
                        </Text>
                      </View>
                      <Text style={styles.runtimeDetail}>
                        {runtimeStatus.detail}
                      </Text>
                    </>
                  );
                })()}
              </View>

              <View style={styles.arrowBadge}>
                <SkipForward color="#0F172A" strokeWidth={2} size={18} />
              </View>
            </TouchableOpacity>

            {canWrite && (
              <>
                <View style={styles.headerDeleteEdit}>
                  <TouchableOpacity
                    style={styles.editBadge}
                    onPress={() => handleEditController(ctrl)}
                  >
                    <PencilLine color="#1D4ED8" strokeWidth={2} size={18} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.deleteBadge,
                      deletingId === ctrl._id && styles.deleteBadgeDisabled,
                    ]}
                    onPress={() => handleDeleteController(ctrl)}
                    disabled={deletingId === ctrl._id}
                  >
                    {deletingId === ctrl._id ? (
                      <ActivityIndicator size="small" color="#991B1B" />
                    ) : (
                      <Trash2 color="#991B1B" strokeWidth={2} size={18} />
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(editingController)}
        onRequestClose={handleCloseEditName}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>Editar controlador</Text>
            <Text style={styles.modalTitle}>Nombre visible</Text>
            <TextInput
              style={styles.nameInput}
              value={editingName}
              onChangeText={setEditingName}
              placeholder="Nombre del controlador"
              placeholderTextColor="#94A3B8"
              autoCapitalize="sentences"
              maxLength={150}
              editable={!savingName}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleCloseEditName}
                disabled={savingName}
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveControllerName}
                disabled={savingName}
              >
                {savingName ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingTop: 70,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 22,
    marginBottom: 18,
  },
  eyebrow: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  subtitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerDeleteEdit: {
    position: 'absolute',
    top: 6,
    right: 16,
    flexDirection: 'row',
  },
  adminCta: {
    backgroundColor: '#E0F2FE',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  adminCtaText: {
    color: '#075985',
    fontWeight: '900',
    fontSize: 13,
  },
  primaryCta: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  primaryCtaText: {
    color: '#0F172A',
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D6E3F3',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardMainAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardCopy: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#E0ECFF',
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '800',
  },
  runtimeBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  runtimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  runtimeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  runtimeDetail: {
    marginTop: 8,
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
    paddingRight: 12,
  },
  arrowBadge: {
    width: 38,
    height: 38,

    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  deleteBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  deleteBadgeDisabled: {
    opacity: 0.7,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D6E3F3',
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: '#475569',
    lineHeight: 20,
  },
  loading: {
    marginBottom: 16,
    marginTop: 8,
  },
  errorText: {
    color: '#B00020',
    marginBottom: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#D6E3F3',
  },
  modalEyebrow: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: '#F8FAFC',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  secondaryButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: '#E2E8F0',
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontWeight: '800',
  },
  saveButton: {
    minWidth: 96,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});

export default HomeScreen;
