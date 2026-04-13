import React, { useCallback, useState } from 'react';
import {
  Alert,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppLayout from '../layouts/AppLayout';
import { deleteController, fetchControllers } from '../services/api';
import { AuthSession } from '../types/auth';
import { SkipForward, Trash2 } from 'lucide-react-native';

type Props = {
  navigation: any;
  session: AuthSession;
  onLogout: () => void;
};

function HomeScreen({ navigation, session, onLogout }: Props) {
  const [controllers, setControllers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadControllers() {
        if (!session?.token) {
          if (isMounted) {
            setError('Sesion invalida (token faltante). Cerra sesion e inicia de nuevo.');
            setLoading(false);
          }
          return;
        }
        setLoading(true);
        setError('');
        try {
          const response = await fetchControllers(session.token);
          if (isMounted) {
            setControllers(response.controllers);
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

      loadControllers();
      return () => {
        isMounted = false;
      };
    }, [session?.token]),
  );

  const handleDeleteController = useCallback((controller: any) => {
    if (!session?.token || deletingId) return;

    Alert.alert(
      'Eliminar controlador',
      `Se va a eliminar "${controller?.name ?? 'este controlador'}". Esta acción no se puede deshacer.`,
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
              setControllers((current) => current.filter((item) => item._id !== controller._id));
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
  }, [deletingId, session?.token]);

  return (
    <AppLayout navigation={navigation} onLogout={onLogout}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Presentación</Text>
          <Text style={styles.title}>Control remoto de setpoint</Text>

          <View style={styles.headerRow}>
            <View>
              <Text style={styles.subtitle}>Controladores</Text>
            </View>

            <TouchableOpacity
              style={styles.primaryCta}
              onPress={() => navigation.navigate('ControllerForm')}
            >
              <Text style={styles.primaryCtaText}>Agregar</Text>
            </TouchableOpacity>
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
            <Text style={styles.emptyTitle}>Todavía no registraste controladores</Text>
            <Text style={styles.emptyText}>
              Carga el primero desde “Agregar”.
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
                    ? [ctrl.deviceBrand, ctrl.deviceModel || ctrl.dixellModel].filter(Boolean).join(' · ')
                    : 'SIN MODELO'}
                </Text>
              </View>

              <View style={styles.arrowBadge}>
                <SkipForward color="#0F172A" strokeWidth={2} size={18} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteBadge, deletingId === ctrl._id && styles.deleteBadgeDisabled]}
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
        ))}
      </ScrollView>
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
    borderRadius: 28,
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
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 8,
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
    marginTop: 18,
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
  arrowBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
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
});

export default HomeScreen;
