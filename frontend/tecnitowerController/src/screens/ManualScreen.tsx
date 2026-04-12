import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Pressable,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { 
  ArrowLeft, 
  Wifi, 
  Settings, 
  RotateCcw, 
  CheckCircle2, 
  Info, 
  Smartphone,
  ExternalLink 
} from 'lucide-react-native';
import ImageViewing from 'react-native-image-viewing';

function ManualScreen({ navigation }: { navigation: any }) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState<any>(null);

  const handleOpenViewer = (img: any) => {
    setViewerImage(Image.resolveAssetSource(img).uri);
    setViewerVisible(true);
  };

  const preSteps = [
    'El Elfin debe estar enchufado.',
    'Nombre y contraseña del WiFi local (2.4 GHz).',
    'Tener a mano el ID unico del Elfin y los datos Modbus del controlador.',
  ];

  const socketSettings = [
    'Name: netp',
    'Protocol: TCP-CLIENT',
    'Server: 137.131.194.247',
    'Server Port: 4001',
    'Local Port: 0',
    'Buffer Size: 512',
    'Keep Alive: 60',
    'Timeout: 0',
    'Connect Mode: Always',
    'Register Mode: Link',
    'Register Code: ELFIN:<tu_id_unico>',
    'Heart Beat: OFF',
    'Security: Disable',
    'Route: Uart',
  ];

  const configSteps = [
    {
      title: 'Resetear el Elfin',
      icon: <RotateCcw size={20} color="#6366f1" />,
      content: [
        { type: 'text', value: 'Presioná el botón RESET durante 10 segundos.' },
        { type: 'image', value: require('../../assets/ConexionWifi.webp') },
        { type: 'text', value: 'Soltá y esperá a que el LED de WiFi parpadee.' },
      ],
    },
    {
      title: 'Conectar al WiFi del Elfin',
      icon: <Wifi size={20} color="#6366f1" />,
      content: [
        { type: 'text', value: 'Buscá la red llamada "EW11" o "Elfin" en tu celular.' },
        { type: 'text', value: 'Conectate (no pide contraseña por defecto).' },
        { type: 'image', value: require('../../assets/ConexionWifi.webp') },
      ],
    },
    {
      title: 'Abrir el Panel de Control',
      icon: <Smartphone size={20} color="#6366f1" />,
      content: [
        { type: 'text', value: 'En tu navegador ve a: http://10.10.100.254' },
        { type: 'text', value: 'Usuario: admin / Contraseña: admin' },
        { type: 'image', value: require('../../assets/image1.webp') },
      ],
    },
    {
      title: 'Configurar WiFi del Local',
      icon: <Settings size={20} color="#6366f1" />,
      content: [
        { type: 'text', value: 'System Setting -> WiFi Setting.' },
        { type: 'text', value: 'Modo: STA. SSID: Nombre de tu WiFi.' },
        { type: 'text', value: 'Password: Tu clave de red.' },
        { type: 'image', value: require('../../assets/image2.webp') },
        { type: 'image', value: require('../../assets/image3.webp') },
      ],
    },
    {
      title: 'Configurar Socket TCP Client',
      icon: <Settings size={20} color="#10b981" />,
      content: [
        { type: 'text', value: 'Communication Settings -> Name: netp / Protocol: TCP-CLIENT.' },
        { type: 'text', value: 'Server: 137.131.194.247 / Server Port: 4001 / Local Port: 0.' },
        { type: 'text', value: 'Buffer Size: 512 / Keep Alive: 60 / Timeout: 0.' },
        { type: 'text', value: 'Connect Mode: Always / Register Mode: Link.' },
        { type: 'text', value: 'Register Code: ELFIN:<tu_id_unico> / Heart Beat: OFF.' },
        { type: 'text', value: 'Security: Disable / Route: Uart.' },
        { type: 'image', value: require('../../assets/image4.webp') },
      ],
    },
    {
      title: 'Configurar RS485 y reiniciar',
      icon: <CheckCircle2 size={20} color="#10b981" />,
      content: [
        { type: 'text', value: 'Serial Port Settings -> Baud 9600 / 8N1 / Protocol: Modbus.' },
        { type: 'text', value: 'En el controlador: protocolo Modbus, direccion correcta y baud correcto.' },
        { type: 'text', value: 'Guardá con Submit y reiniciá el Elfin.' },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header Fijo */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#1e293b" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manual técnico</Text>
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.mainTitle}>Manual Técnico Tecnitower</Text>

        {/* Card de Inicio */}
        <View style={styles.introCard}>
          <View style={styles.introHeader}>
            <Info size={20} color="#3b82f6" />
            <Text style={styles.introTitle}>Antes de empezar</Text>
          </View>
          {preSteps.map((step, i) => (
            <View key={i} style={styles.preStepItem}>
              <View style={styles.dot} />
              <Text style={styles.preStepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Configuracion del Elfin</Text>
          <Text style={styles.sectionDescription}>
            Estos pasos dejan el Elfin conectado al WiFi del local y al backend Oracle en
            modo TCP Client.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Communication Settings</Text>
          <Text style={styles.sectionDescription}>
            En el panel del Elfin, la configuracion del socket cloud debe quedar exactamente asi:
          </Text>
          {socketSettings.map((item, index) => (
            <View key={`socket-${index}`} style={styles.preStepItem}>
              <View style={[styles.dot, { backgroundColor: '#1d4ed8' }]} />
              <Text style={styles.sectionBullet}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Pasos de Configuración */}
        {configSteps.map((step, idx) => (
          <View key={idx} style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={styles.iconBadge}>{step.icon}</View>
              <Text style={styles.stepTitle}>{`Paso ${idx + 1}: ${step.title}`}</Text>
            </View>
            
            <View style={styles.stepBody}>
              {step.content.map((item, i) => (
                item.type === 'text' ? (
                  <Text key={i} style={styles.bodyText}>• {item.value}</Text>
                ) : item.type === 'placeholder' ? (
                  <View key={i} style={styles.placeholderContainer}>
                    <Text style={styles.placeholderText}>{item.value}</Text>
                  </View>
                ) : (
                  <Pressable 
                    key={i} 
                    style={styles.imageContainer}
                    onPress={() => handleOpenViewer(item.value)}
                  >
                    <Image style={styles.stepImage} source={item.value} />
                    <View style={styles.zoomOverlay}>
                      <ExternalLink size={16} color="#fff" />
                    </View>
                  </Pressable>
                )
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      <ImageViewing
        images={viewerImage ? [{ uri: viewerImage }] : []}
        imageIndex={0}
        visible={viewerVisible}
        backgroundColor="#000"
        onRequestClose={() => setViewerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 15,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 20,
  },
  introCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  summaryPanel: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
  },
  modeCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  modeCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  modeBullet: {
    fontSize: 14,
    lineHeight: 21,
    flex: 1,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#dbe4ea',
  },
  sectionCardWarning: {
    backgroundColor: '#fffaf0',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#f6d8a8',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  sectionTitleWarning: {
    fontSize: 16,
    fontWeight: '800',
    color: '#9a3412',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 12,
  },
  sectionBullet: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
    flex: 1,
  },
  introHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  introTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d4ed8',
    marginLeft: 10,
  },
  preStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3b82f6',
    marginRight: 10,
  },
  preStepText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#64748b',
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f5f3ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconBadgeWarning: {
    backgroundColor: '#fff7ed',
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  stepBody: {
    paddingLeft: 4,
  },
  bodyText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
    marginBottom: 8,
  },
  placeholderContainer: {
    marginTop: 10,
    marginBottom: 15,
    minHeight: 150,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  placeholderText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 22,
    textAlign: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginTop: 10,
    marginBottom: 15,
  },
  stepImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    resizeMode: 'cover',
  },
  zoomOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 10,
  },
});

export default ManualScreen;
