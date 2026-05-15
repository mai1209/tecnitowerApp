import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { PushDeviceModel } from "../models/PushDevice.js";

let firebaseReady = null;
let loggedDisabledReason = false;

function normalizePrivateKey(value = "") {
  return String(value ?? "").replace(/\\n/g, "\n").trim();
}

function readServiceAccount() {
  const inlineJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "").trim();
  if (inlineJson) {
    try {
      const parsed = JSON.parse(inlineJson);
      if (parsed?.projectId && parsed?.clientEmail && parsed?.privateKey) {
        return {
          projectId: parsed.projectId,
          clientEmail: parsed.clientEmail,
          privateKey: normalizePrivateKey(parsed.privateKey),
        };
      }
    } catch (error) {
      console.error("[PUSH] FIREBASE_SERVICE_ACCOUNT_JSON inválido:", error?.message || error);
    }
  }

  const projectId = String(process.env.FIREBASE_PROJECT_ID ?? "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL ?? "").trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY ?? "");

  if (!projectId || !clientEmail || !privateKey) return null;

  return { projectId, clientEmail, privateKey };
}

function getFirebaseMessagingClient() {
  if (firebaseReady === false) return null;

  try {
    if (!getApps().length) {
      const serviceAccount = readServiceAccount();
      if (!serviceAccount) {
        if (!loggedDisabledReason) {
          console.warn(
            "[PUSH] Firebase no configurado. Faltan FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY o FIREBASE_SERVICE_ACCOUNT_JSON."
          );
          loggedDisabledReason = true;
        }
        firebaseReady = false;
        return null;
      }

      initializeApp({
        credential: cert(serviceAccount),
      });
    }

    firebaseReady = true;
    return getMessaging();
  } catch (error) {
    firebaseReady = false;
    console.error("[PUSH] No se pudo inicializar Firebase Admin:", error?.message || error);
    return null;
  }
}

function buildTransition(previousAlertState, nextAlertState) {
  const previousActive = previousAlertState?.active === true;
  const nextActive = nextAlertState?.active === true;

  if (!previousActive && !nextActive) return null;
  if (!previousActive && nextActive) {
    return { kind: "activated", alertType: nextAlertState?.type ?? "unknown" };
  }
  if (previousActive && !nextActive) {
    return { kind: "resolved", alertType: previousAlertState?.type ?? "unknown" };
  }
  if (
    previousActive &&
    nextActive &&
    String(previousAlertState?.type ?? "") !== String(nextAlertState?.type ?? "")
  ) {
    return { kind: "changed", alertType: nextAlertState?.type ?? "unknown" };
  }
  return null;
}

function stringifyData(data = {}) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );
}

async function disableInvalidTokens(tokens = []) {
  const invalidTokens = [...new Set(tokens.map((item) => String(item ?? "").trim()).filter(Boolean))];
  if (!invalidTokens.length) return;
  await PushDeviceModel.deleteMany({ token: { $in: invalidTokens } });
}

export async function sendPushToUser({ userId, title, body, data = {} }) {
  const messaging = getFirebaseMessagingClient();
  if (!messaging) {
    return { sent: false, reason: "firebase-disabled", successCount: 0, failureCount: 0 };
  }

  const devices = await PushDeviceModel.find({ user: userId, enabled: true }).lean();
  const tokens = devices.map((device) => String(device.token ?? "").trim()).filter(Boolean);

  if (!tokens.length) {
    return { sent: false, reason: "no-devices", successCount: 0, failureCount: 0 };
  }

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: String(title ?? "").trim(),
      body: String(body ?? "").trim(),
    },
    data: stringifyData(data),
    android: {
      priority: "high",
      notification: {
        sound: "default",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
  });

  const invalidTokens = response.responses
    .map((item, index) => ({ item, token: tokens[index] }))
    .filter(({ item }) =>
      ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(
        String(item.error?.code ?? "")
      )
    )
    .map(({ token }) => token);

  if (invalidTokens.length) {
    await disableInvalidTokens(invalidTokens);
  }

  return {
    sent: response.successCount > 0,
    successCount: response.successCount,
    failureCount: response.failureCount,
  };
}

function buildNotificationCopy(controller, transition, previousAlertState, nextAlertState) {
  const controllerName = String(controller?.name ?? controller?.elfinId ?? "Controlador").trim();

  if (transition.kind === "resolved") {
    return {
      title: "Equipo recuperado",
      body: `${controllerName} volvió a estado normal.`,
    };
  }

  const currentAlert = nextAlertState?.active ? nextAlertState : previousAlertState;
  const connectionAlertTypes = new Set(["offline", "elfin_offline", "modbus_offline"]);
  const fallbackBody =
    connectionAlertTypes.has(transition.alertType)
      ? `${controllerName} perdió comunicación.`
      : `${controllerName} tiene una alerta activa.`;

  return {
    title: `Alerta en ${controllerName}`,
    body: String(currentAlert?.message ?? fallbackBody),
  };
}

export async function notifyControllerAlertTransition({
  controller,
  previousAlertState,
  nextAlertState,
}) {
  const transition = buildTransition(previousAlertState, nextAlertState);
  if (!transition) return { notified: false, reason: "no-transition" };

  const notification = buildNotificationCopy(
    controller,
    transition,
    previousAlertState,
    nextAlertState
  );

  const result = await sendPushToUser({
    userId: controller?.owner,
    title: notification.title,
    body: notification.body,
    data: {
      controllerId: controller?._id,
      controllerName: controller?.name,
      elfinId: controller?.elfinId,
      alertType: transition.alertType,
      alertTransition: transition.kind,
      screen: "ControllerLive",
    },
  });

  return {
    ...result,
    notified: result.sent === true,
    transition: transition.kind,
  };
}
