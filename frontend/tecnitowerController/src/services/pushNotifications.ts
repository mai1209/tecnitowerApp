import { Alert, Platform } from "react-native";
import { getApps } from "@react-native-firebase/app";
import messaging, { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import { registerPushToken, unregisterPushToken } from "./api";

function hasFirebaseApp() {
  try {
    return getApps().length > 0;
  } catch (_) {
    return false;
  }
}

function isPermissionGranted(status: number) {
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}

function extractNotificationCopy(message: FirebaseMessagingTypes.RemoteMessage) {
  const title =
    String(message.notification?.title ?? "").trim() || "Nueva alerta Tecnitower";
  const body =
    String(message.notification?.body ?? "").trim() || "Revisá el estado del controlador.";
  return { title, body };
}

async function ensureRemoteMessagesRegistration() {
  if (!hasFirebaseApp()) return false;
  if (Platform.OS === "ios" && !messaging().isDeviceRegisteredForRemoteMessages) {
    await messaging().registerDeviceForRemoteMessages();
  }
  return true;
}

async function getFcmToken() {
  const ready = await ensureRemoteMessagesRegistration();
  if (!ready) return null;
  const permissionStatus = await messaging().requestPermission({
    alert: true,
    badge: true,
    sound: true,
  });

  if (!isPermissionGranted(permissionStatus)) {
    return null;
  }

  return messaging().getToken();
}

export async function syncPushTokenForSession(authToken: string) {
  try {
    const token = await getFcmToken();
    if (!token) return null;

    await registerPushToken(
      {
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
      },
      authToken
    );

    return token;
  } catch (error) {
    console.warn("[PUSH] No se pudo registrar el token:", error);
    return null;
  }
}

export async function unregisterCurrentPushToken(authToken: string) {
  try {
    if (!hasFirebaseApp()) return;
    const token = await messaging().getToken();
    if (!token) return;
    await unregisterPushToken(token, authToken);
  } catch (error) {
    console.warn("[PUSH] No se pudo desregistrar el token:", error);
  }
}

export function startPushNotificationListeners(authToken: string) {
  if (!hasFirebaseApp()) {
    return () => {};
  }

  const unsubscribeForeground = messaging().onMessage(async (message) => {
    const { title, body } = extractNotificationCopy(message);
    Alert.alert(title, body);
  });

  const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token) => {
    try {
      await registerPushToken(
        {
          token,
          platform: Platform.OS === "ios" ? "ios" : "android",
        },
        authToken
      );
    } catch (error) {
      console.warn("[PUSH] No se pudo actualizar el token:", error);
    }
  });

  return () => {
    unsubscribeForeground();
    unsubscribeTokenRefresh();
  };
}
