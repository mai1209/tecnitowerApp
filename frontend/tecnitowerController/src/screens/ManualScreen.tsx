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
    'Celular o PC conectado a la misma red para configurar.',
  ];

  const installModes = [
    {
      title: 'Gateway Local Tecnitower',
      accent: '#0f766e',
      background: '#ecfeff',
      border: '#99f6e4',
      bullets: [
        'Opción recomendada para primeras instalaciones.',
        'Usa una Raspberry, mini PC o equipo local Tecnitower conectado al mismo WiFi del Elfin.',
        'El Elfin se usa en modo local por TCP-SERVER, puerto 502.',
      ],
    },
    {
      title: 'Elfin MQTT Directo',
      accent: '#b45309',
      background: '#fffbeb',
      border: '#fde68a',
      bullets: [
        'Solo para gateways MQTT compatibles ya validados.',
        'Además de la configuración base del Elfin, se debe cargar la configuración MQTT en Socket Settings.',
        'Si el hardware no responde por MQTT bidireccional, volver al modo Gateway Local.',
      ],
    },
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
      title: 'Reiniciar y Validar',
      icon: <CheckCircle2 size={20} color="#10b981" />,
      content: [
        { type: 'text', value: 'Presioná Save/Reload y luego Restart.' },
        { type: 'text', value: 'Si la red "Elfin" desaparece, se vinculó con éxito.' },
        { type: 'image', value: require('../../assets/image4.webp') },
      ],
    },
  ];

  const localGatewayChecklist = [
    'En la app: elegir "Gateway Local".',
    'Cargar ID Elfin, IP local, Unit ID y baud rate.',
    'En el Elfin: dejar Socket en TCP-SERVER, puerto 502, Route uart.',
    'El equipo local Tecnitower debe quedar encendido y conectado al mismo WiFi del Elfin.',
    'Si el equipo local se apaga, la app no podrá leer ni escribir en forma remota.',
  ];

  const directGatewayChecklist = [
    'En la app: elegir "Elfin MQTT Directo".',
    'No cerrar el panel del Elfin después de la configuración base.',
    'Entrar en Communication Settings / Socket Settings y presionar Add.',
    'Cargar broker, usuario, password, topics, seguridad y Route uart.',
    'Mantener Unit ID y baud rate correctos del controlador.',
    'Si el hardware no responde por MQTT bidireccional, volver al modo Gateway Local.',
  ];

  const mqttDirectSteps = [
    {
      title: 'Entrar a Communication Settings',
      icon: <Settings size={20} color="#b45309" />,
      content: [
        { type: 'text', value: 'Si elegís la opción alternativa, no cierres el panel del Elfin después del paso 5.' },
        { type: 'text', value: 'Entrá a la sección Communication Settings.' },
        { type: 'placeholder', value: 'Espacio para imagen: acceso a Communication Settings / Socket Settings.' },
      ],
    },
    {
      title: 'Abrir Socket Settings y crear la conexión',
      icon: <Settings size={20} color="#b45309" />,
      content: [
        { type: 'text', value: 'Dentro de Communication Settings, entrá a Socket Settings.' },
        { type: 'text', value: 'Presioná Add para agregar una nueva conexión.' },
        { type: 'text', value: 'Elegí Protocol: MQTT.' },
        { type: 'placeholder', value: 'Espacio para imagen: botón Add dentro de Socket Settings.' },
      ],
    },
    {
      title: 'Completar los datos MQTT entregados por Tecnitower',
      icon: <CheckCircle2 size={20} color="#b45309" />,
      content: [
        { type: 'text', value: 'Completá Server, Port, Security, MQTT Client ID, MQTT User y MQTT Password.' },
        { type: 'text', value: 'Completá Subscribe Topic, Publish Topic, Route = uart y Connect Mode = Always.' },
        { type: 'text', value: 'Guardá la configuración y reiniciá el equipo si el instalador lo solicita.' },
        { type: 'placeholder', value: 'Espacio para imagen: valores MQTT que Tecnitower entrega para completar.' },
      ],
    },
  ];

  const finalChecks = [
    'El Elfin debe responder en la red local por puerto 502.',
    'El controlador debe responder Modbus antes de probar la app.',
    'El backend cloud debe estar online.',
    'El agente local debe quedar prendido si se usa el modo Gateway Local.',
    'La app debe mostrar lectura real antes de probar escritura de setpoint.',
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

        <View style={styles.summaryPanel}>
          <Text style={styles.summaryTitle}>Modos de instalación</Text>
          <Text style={styles.summaryText}>
            Primero se hace la configuración base del Elfin. Después se elige uno de los
            dos caminos: Gateway Local Tecnitower o Elfin MQTT Directo. Para instalaciones
            nuevas, la recomendación es Gateway Local.
          </Text>
        </View>

        {installModes.map((mode) => (
          <View
            key={mode.title}
            style={[
              styles.modeCard,
              { backgroundColor: mode.background, borderColor: mode.border },
            ]}
          >
            <Text style={[styles.modeCardTitle, { color: mode.accent }]}>{mode.title}</Text>
            {mode.bullets.map((bullet, index) => (
              <View key={`${mode.title}-${index}`} style={styles.preStepItem}>
                <View style={[styles.dot, { backgroundColor: mode.accent }]} />
                <Text style={[styles.modeBullet, { color: mode.accent }]}>{bullet}</Text>
              </View>
            ))}
          </View>
        ))}
        
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
          <Text style={styles.sectionTitle}>Configuración base del Elfin</Text>
          <Text style={styles.sectionDescription}>
            Estos pasos se hacen primero y aplican tanto para Gateway Local como para
            Elfin MQTT Directo.
          </Text>
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

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Después de la configuración base</Text>
          <Text style={styles.sectionDescription}>
            Después del paso 5, la configuración base del Elfin ya está terminada. Desde
            este punto tenés que elegir uno de los dos caminos de instalación. Si elegís la
            opción recomendada, reiniciás el equipo y seguís desde la app. Si elegís la
            opción alternativa, no desenchufes el Elfin y no cierres el panel: seguí directo
            con la configuración MQTT dentro del mismo panel.
          </Text>
        </View>

        <View style={styles.sectionCardWarning}>
          <Text style={styles.sectionTitleWarning}>Si elegís la opción alternativa</Text>
          <Text style={styles.sectionDescription}>
            No desenchufes el Elfin y no cierres el panel de configuración. Antes de salir
            del panel, seguí con Communication Settings y completá la configuración MQTT.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Opción recomendada: Gateway Local</Text>
          <Text style={styles.sectionDescription}>
            Si elegís esta opción, ahí sí desenchufá y volvé a enchufar el Elfin. Esperá a
            que la red WiFi del Elfin ya no se vea; eso indica que se conectó al WiFi del
            local. Después seguí con la configuración de la app y del gateway local
            Tecnitower.
          </Text>
          {localGatewayChecklist.map((item, index) => (
            <View key={`local-${index}`} style={styles.preStepItem}>
              <View style={[styles.dot, { backgroundColor: '#0f766e' }]} />
              <Text style={styles.sectionBullet}>{item}</Text>
            </View>
          ))}
        </View>

        {mqttDirectSteps.map((step, idx) => (
          <View key={`mqtt-step-${idx}`} style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={[styles.iconBadge, styles.iconBadgeWarning]}>{step.icon}</View>
              <Text style={styles.stepTitle}>{`Opción alternativa - Paso ${idx + 1}: ${step.title}`}</Text>
            </View>

            <View style={styles.stepBody}>
              {step.content.map((item, i) => (
                item.type === 'text' ? (
                  <Text key={i} style={styles.bodyText}>• {item.value}</Text>
                ) : item.type === 'placeholder' ? (
                  <View key={i} style={styles.placeholderContainer}>
                    <Text style={styles.placeholderText}>{item.value}</Text>
                  </View>
                ) : null
              ))}
            </View>
          </View>
        ))}

        <View style={styles.sectionCardWarning}>
          <Text style={styles.sectionTitleWarning}>Opción alternativa: Elfin MQTT Directo</Text>
          <Text style={styles.sectionDescription}>
            Esta opción solo se usa si la instalación se hace con un gateway compatible con
            MQTT directo y con los datos entregados por Tecnitower.
          </Text>
          {directGatewayChecklist.map((item, index) => (
            <View key={`direct-${index}`} style={styles.preStepItem}>
              <View style={[styles.dot, { backgroundColor: '#b45309' }]} />
              <Text style={styles.sectionBullet}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Checklist final antes de entregar</Text>
          {finalChecks.map((item, index) => (
            <View key={`final-${index}`} style={styles.preStepItem}>
              <View style={[styles.dot, { backgroundColor: '#0f172a' }]} />
              <Text style={styles.sectionBullet}>{item}</Text>
            </View>
          ))}
        </View>

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
