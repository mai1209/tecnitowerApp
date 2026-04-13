import React, { useMemo, useState } from 'react';
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
  ExternalLink,
} from 'lucide-react-native';
import ImageViewing from 'react-native-image-viewing';

type NavigationProp = {
  goBack: () => void;
};

type ContentItem =
  | { type: 'text'; value: string }
  | { type: 'image'; value: any }
  | { type: 'placeholder'; value: string };

type StepItem = {
  title: string;
  tone?: 'primary' | 'success';
  icon: React.ReactNode;
  content: ContentItem[];
};

type KeyValueItem = {
  label: string;
  value: string;
};

function ManualScreen({ navigation }: { navigation: NavigationProp }) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  const handleOpenViewer = (img: any) => {
    const resolved = Image.resolveAssetSource(img);
    setViewerImage(resolved?.uri ?? null);
    setViewerVisible(true);
  };

  const preSteps = useMemo(
    () => [
      'El Elfin debe estar enchufado.',
      'Tener el nombre y la contraseña del WiFi local (2.4 GHz).',
      'Tener a mano el ID único del Elfin y los datos Modbus del controlador. EL ID único suele estar en una etiqueta en el equipo.',
    ],
    [],
  );

  const socketSettings = useMemo<KeyValueItem[]>(
    () => [
      { label: 'Name', value: 'nombre' },
      { label: 'Protocol', value: 'TCP-CLIENT' },
      { label: 'Server', value: '137.131.194.247' },
      { label: 'Server Port', value: '4001' },
      { label: 'Local Port', value: '0' },
      { label: 'Buffer Size', value: '512' },
      { label: 'Keep Alive', value: '60' },
      { label: 'Timeout', value: '0' },
      { label: 'Connect Mode', value: 'Always' },
      { label: 'Register Mode', value: 'Link' },
      { label: 'Register Code', value: 'ELFIN:<tu_id_unico>' },
      { label: 'Heart Beat', value: 'OFF' },
      { label: 'Security', value: 'Disable' },
      { label: 'Route', value: 'Uart' },
    ],
    [],
  );

  const configSteps = useMemo<StepItem[]>(
    () => [
      {
        title: 'Resetear el Elfin',
        tone: 'primary',
        icon: <RotateCcw size={20} color="#4f46e5" />,
        content: [
          {
            type: 'text',
            value: 'Presioná el botón RESET durante 10 segundos.',
          },
          { type: 'image', value: require('../../assets/ConexionWifi.webp') },
          {
            type: 'text',
            value: 'Soltá y esperá a que el LED de WiFi parpadee.',
          },
        ],
      },
      {
        title: 'Conectar al WiFi del Elfin',
        tone: 'primary',
        icon: <Wifi size={20} color="#4f46e5" />,
        content: [
          {
            type: 'text',
            value:
              'Buscá la red llamada "EW11" o "Elfin" en tu celular o computadora.',
          },
          {
            type: 'text',
            value: 'Conectate. Por defecto no suele pedir contraseña.',
          },
          { type: 'image', value: require('../../assets/ConexionWifi.webp') },
        ],
      },
      {
        title: 'Abrir el panel de control',
        tone: 'primary',
        icon: <Smartphone size={20} color="#4f46e5" />,
        content: [
          {
            type: 'text',
            value:
              'Abrí el navegador e ingresá a http://10.10.100.254/index.html',
          },
          { type: 'text', value: 'Usuario: admin / Contraseña: admin' },
          { type: 'image', value: require('../../assets/image1.webp') },
        ],
      },
      {
        title: 'Configurar WiFi del local',
        tone: 'primary',
        icon: <Settings size={20} color="#4f46e5" />,
        content: [
          { type: 'text', value: 'Entrá a System Setting → WiFi Setting.' },
          { type: 'text', value: 'Modo: STA.' },
          { type: 'text', value: 'SSID: nombre de tu red WiFi local.' },
          { type: 'text', value: 'Password: clave de tu red.' },
          { type: 'image', value: require('../../assets/image2.webp') },
          { type: 'image', value: require('../../assets/image3.webp') },
        ],
      },
      {
        title: 'Configurar socket TCP Client',
        tone: 'success',
        icon: <Settings size={20} color="#059669" />,
        content: [
          { type: 'text', value: 'Entrá a Communication Settings.' },
          {
            type: 'text',
            value:
              'Hace click en +Add arriba a la derecha del panel y completá los campos.',
          },
          {
            type: 'text',
            value:
              'Completá los valores exactamente como aparecen en la tarjeta de configuración.',
          },
          {
            type: 'text',
            value:
              'Luego de completar los campos, hacé click en Submit y luego en Reset para guardar la configuración del socket.',
          },
          { type: 'image', value: require('../../assets/menu.png') },
          { type: 'image', value: require('../../assets/socket.png') },
        ],
      },
      {
        title: 'Configurar Serial Port Setting',
        tone: 'success',
        icon: <CheckCircle2 size={20} color="#059669" />,
        content: [
          {
            type: 'text',
            value: `Baud Rate: 9600
Data: 8N1
Protocolo: Modbus
Nota: Realice este cambio solo si los datos Modbus de su controlador son incompatibles con la configuración actual. Generalmente, los valores por defecto del panel de control del Elfin ya coinciden con estos parámetros y pueden mantenerse sin cambios.`,
          },
          {
            type: 'text',
            value:
              'Verificá que en el controlador estén correctos el protocolo Modbus, la dirección y el baud rate.',
          },
          {
            type: 'text',
            value:
              'Guardá con Submit si aplicaste cambios si no, reiniciá el Elfin como indica el paso 7 .',
          },
        ],
      },
      {
        title: 'Reiniciar y validar conexión WiFi',
        tone: 'success',
        icon: <CheckCircle2 size={20} color="#059669" />,
        content: [
          {
            type: 'text',
            value:
              'Luego de configurar el panel del Elfin, desenchufá el equipo, esperá 5 segundos y volvé a conectarlo.',
          },
          {
            type: 'text',
            value:
              'Cuando lo desenchufes, volvé a conectarte a tu red WiFi local desde el celular o la computadora.',
          },
          {
            type: 'text',
            value:
              'Verificá que la red WiFi del Elfin haya desaparecido de la lista de redes disponibles.',
          },
          {
            type: 'text',
            value:
              'Si la red del Elfin ya no aparece, eso indica que el equipo se conectó correctamente a la red WiFi local configurada.',
          },
        ],
      },
    ],
    [],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={navigation.goBack}>
          <ArrowLeft color="#0f172a" size={22} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manual técnico</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.mainTitle}>Manual Técnico Tecnitower</Text>
        <Text style={styles.mainSubtitle}>
          Configuración guiada del Elfin para conexión WiFi local, comunicación
          TCP Client y lectura Modbus.
        </Text>

        <InfoCard
          icon={<Info size={20} color="#2563eb" />}
          title="Antes de empezar"
          tone="info"
        >
          {preSteps.map((step, index) => (
            <BulletItem key={`pre-${index}`} text={step} tone="info" />
          ))}
        </InfoCard>

        <SectionCard
          title="Configuración general del Elfin"
          description="Estos pasos dejan el equipo conectado al WiFi del local y enlazado con el servidor mediante TCP Client."
        />

        <SocketConfigCard
          title="Communication Settings"
          description="La configuración del socket del panel del Elfin debe quedar exactamente con estos valores."
          items={socketSettings}
        />

        {configSteps.map((step, idx) => (
          <StepCard
            key={`step-${idx}`}
            index={idx + 1}
            title={step.title}
            icon={step.icon}
            tone={step.tone ?? 'primary'}
          >
            {step.content.map((item, i) => {
              if (item.type === 'text') {
                return (
                  <BodyBullet key={`content-${idx}-${i}`} text={item.value} />
                );
              }

              if (item.type === 'placeholder') {
                return (
                  <View
                    key={`content-${idx}-${i}`}
                    style={styles.placeholderContainer}
                  >
                    <Text style={styles.placeholderText}>{item.value}</Text>
                  </View>
                );
              }

              return (
                <Pressable
                  key={`content-${idx}-${i}`}
                  style={styles.imageContainer}
                  onPress={() => handleOpenViewer(item.value)}
                >
                  <Image source={item.value} style={styles.stepImage} />
                  <View style={styles.zoomOverlay}>
                    <ExternalLink size={16} color="#fff" />
                  </View>
                </Pressable>
              );
            })}
          </StepCard>
        ))}

        <View style={{ height: 36 }} />
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

function BulletItem({
  text,
  tone = 'default',
}: {
  text: string;
  tone?: 'default' | 'info';
}) {
  const dotStyle = tone === 'info' ? styles.dotInfo : styles.dotDefault;
  const textStyle =
    tone === 'info' ? styles.bulletTextInfo : styles.bulletTextDefault;

  return (
    <View style={styles.bulletRow}>
      <View style={[styles.dotBase, dotStyle]} />
      <Text style={textStyle}>{text}</Text>
    </View>
  );
}

function BodyBullet({ text }: { text: string }) {
  return (
    <View style={styles.bodyBulletRow}>
      <Text style={styles.bodyBulletDot}>•</Text>
      <Text style={styles.bodyText}>{text}</Text>
    </View>
  );
}

function InfoCard({
  icon,
  title,
  children,
  tone = 'info',
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  tone?: 'info' | 'default';
}) {
  return (
    <View style={[styles.infoCard, tone === 'info' && styles.infoCardBlue]}>
      <View style={styles.infoCardHeader}>
        {icon}
        <Text style={styles.infoCardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function SectionCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDescription}>{description}</Text>
    </View>
  );
}

function SocketConfigCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: KeyValueItem[];
}) {
  return (
    <View style={styles.socketCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDescription}>{description}</Text>

      <View style={styles.socketPanel}>
        {items.map(item => (
          <View key={item.label} style={styles.socketRow}>
            <Text style={styles.socketLabel}>{item.label}</Text>
            <Text style={styles.socketValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.socketNote}>
        <Text style={styles.socketNoteText}>
          Revisá que no haya espacios extra ni diferencias en mayúsculas,
          especialmente en Protocol, Register Code y Route.
        </Text>
      </View>
    </View>
  );
}

function StepCard({
  index,
  title,
  icon,
  children,
  tone = 'primary',
}: {
  index: number;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: 'primary' | 'success';
}) {
  const badgeToneStyle =
    tone === 'success' ? styles.iconBadgeSuccess : styles.iconBadgePrimary;

  return (
    <View style={styles.stepCard}>
      <View style={styles.stepHeader}>
        <View style={[styles.iconBadge, badgeToneStyle]}>{icon}</View>
        <Text style={styles.stepTitle}>{`Paso ${index}: ${title}`}</Text>
      </View>
      <View style={styles.stepBody}>{children}</View>
    </View>
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
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginLeft: 14,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 10,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#020617',
    marginBottom: 8,
  },
  mainSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 22,
  },
  infoCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
  },
  infoCardBlue: {
    backgroundColor: '#eff6ff',
    borderColor: '#dbeafe',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1d4ed8',
    marginLeft: 10,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  socketCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#dbe4ea',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 14,
  },
  socketPanel: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 14,
    marginTop: 4,
  },
  socketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  socketLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  socketValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'right',
  },
  socketNote: {
    marginTop: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 12,
  },
  socketNoteText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#1e40af',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  dotBase: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginTop: 7,
    marginRight: 10,
  },
  dotInfo: {
    backgroundColor: '#3b82f6',
  },
  dotDefault: {
    backgroundColor: '#64748b',
  },
  bulletTextInfo: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#1e40af',
  },
  bulletTextDefault: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
  },
  stepCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconBadgePrimary: {
    backgroundColor: '#eef2ff',
  },
  iconBadgeSuccess: {
    backgroundColor: '#ecfdf5',
  },
  stepTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  stepBody: {
    paddingLeft: 2,
  },
  bodyBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bodyBulletDot: {
    width: 16,
    fontSize: 16,
    lineHeight: 24,
    color: '#334155',
  },
  bodyText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
  },
  placeholderContainer: {
    marginTop: 10,
    marginBottom: 14,
    minHeight: 170,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  placeholderText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#64748b',
    textAlign: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginTop: 10,
    marginBottom: 14,
  },
  stepImage: {
    width: '100%',
    height: 210,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    resizeMode: 'cover',
  },
  zoomOverlay: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(15,23,42,0.6)',
    padding: 8,
    borderRadius: 10,
  },
});

export default ManualScreen;
