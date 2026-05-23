import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import ControllerFormScreem from '../screens/ControllerFormScreem';
import ControllerLiveScreen from '../screens/ControllerLiveScreen';
import ControllerRegisterConfigScreen from '../screens/ControllerRegisterConfigScreen';
import RemoteControlScreen from '../screens/RemoteControlScreen';
import ManualScreen from '../screens/ManualScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminUserControllersScreen from '../screens/AdminUserControllersScreen';
import AdminControllerConfigHubScreen from '../screens/AdminControllerConfigHubScreen';
import DeviceModelAdminScreen from '../screens/DeviceModelAdminScreen';
import DeviceModelFormScreen from '../screens/DeviceModelFormScreen';
import SettingsSectionScreen from '../screens/SettingsSectionScreen';
import { AuthSession } from '../types/auth';
import { STORAGE_KEYS } from '../constants/storageKeys';
import {
  startPushNotificationListeners,
  syncPushTokenForSession,
  unregisterCurrentPushToken,
} from '../services/pushNotifications';

const Stack = createNativeStackNavigator();

function normalizeStoredUser(rawUser: any) {
  const role = rawUser?.role === "admin" ? "admin" : "user";
  const canWrite =
    role === "admin"
      ? true
      : typeof rawUser?.canWrite === "boolean"
        ? rawUser.canWrite
        : rawUser?.role === "viewer"
          ? false
          : true;

  return {
    _id: String(rawUser?._id ?? rawUser?.id ?? ""),
    fullName: String(rawUser?.fullName ?? ""),
    email: String(rawUser?.email ?? ""),
    role,
    canWrite,
  } as AuthSession["user"];
}

function loadStoredSession(): Promise<AuthSession | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.session).then((raw) => {
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as AuthSession;
      if (data?.token && data?.user?._id) {
        return {
          token: data.token,
          user: normalizeStoredUser(data.user),
        };
      }
    } catch {
      // ignore
    }
    return null;
  });
}

function saveSession(session: AuthSession | null): Promise<void> {
  if (!session) return AsyncStorage.removeItem(STORAGE_KEYS.session);
  return AsyncStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
}

export const AppNavigator = () => {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    loadStoredSession().then((stored) => {
      if (stored) setSessionState(stored);
      setInitializing(false);
    });
  }, []);

  const setSession = useCallback((newSession: AuthSession | null) => {
    setSessionState(newSession);
    saveSession(newSession).catch(() => {});
  }, []);

  const handleLogout = useCallback(() => {
    if (session?.token) {
      unregisterCurrentPushToken(session.token).catch(() => {});
    }
    setSession(null);
  }, [session?.token, setSession]);

  const handleLogin = useCallback((newSession: AuthSession) => {
    setSession(newSession);
  }, [setSession]);

  useEffect(() => {
    if (!session?.token) return;

    let active = true;
    let stopListeners = () => {};

    syncPushTokenForSession(session.token)
      .then(() => {
        if (!active) return;
        stopListeners = startPushNotificationListeners(session.token);
      })
      .catch(() => {});

    return () => {
      active = false;
      stopListeners();
    };
  }, [session?.token, session?.user?._id]);

  if (initializing) {
    return (
      <View style={styles.initializing}>
        <ActivityIndicator size="large" color="#001F7C" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        // Force remount when auth state changes. Without this, React Navigation can keep an
        // orphaned route in state and it looks like it "doesn't login/logout".
        key={session ? 'app' : 'auth'}
        initialRouteName={session ? 'Home' : 'Login'}
      >
        {session ? (
          // ======= STACK PRIVADO =======
          <>
            <Stack.Screen name="Home">
              {props => (
                <HomeScreen
                  {...props}
                  session={session}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="ControllerForm"
            >
              {props => (
                <ControllerFormScreem
                  {...props}
                  session={session}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="Manual"
              component={ManualScreen}
            />

            <Stack.Screen name="AdminDashboard">
              {props => (
                <AdminDashboardScreen
                  {...props}
                  session={session}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="AdminUserControllers">
              {props => (
                <AdminUserControllersScreen
                  {...props}
                  session={session}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="AdminControllerConfigHub">
              {props => (
                <AdminControllerConfigHubScreen
                  {...props}
                  session={session}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="DeviceModelAdmin">
              {props => (
                <DeviceModelAdminScreen
                  {...props}
                  session={session}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="DeviceModelForm">
              {props => (
                <DeviceModelFormScreen
                  {...props}
                  session={session}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Settings">
              {props => {
                const SettingsScreen = require('../screens/SettingsScreen').default;
                return (
                  <SettingsScreen
                    {...props}
                    session={session}
                    onLogout={handleLogout}
                  />
                );
              }}
            </Stack.Screen>
            <Stack.Screen name="SettingsSection">
              {props => (
                <SettingsSectionScreen
                  {...props}
                  session={session}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="PasswordRecovery">
              {props => {
                const PasswordRecoveryScreen = require('../screens/PasswordRecoveryScreen').default;
                return (
                  <PasswordRecoveryScreen
                    {...props}
                    onLogout={handleLogout}
                  />
                );
              }}
            </Stack.Screen>

            <Stack.Screen name="ControllerLive">
              {props => (
                <ControllerLiveScreen
                  {...props}
                  session={session}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="ControllerRegisterConfig">
              {props => (
                <ControllerRegisterConfigScreen
                  {...props}
                  session={session}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="RemoteControl">
              {props => (
                <RemoteControlScreen
                  {...props}
                  session={session}
                  token={session?.token}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>

          </>
        ) : (
          // ======= STACK PÚBLICO =======
          <>
            <Stack.Screen name="Login">
              {props => (
                <LoginScreen
                  {...props}
                  onLogin={handleLogin}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen
              name="Settings"
              getComponent={() => require('../screens/SettingsScreen').default}
            />
            <Stack.Screen
              name="SettingsSection"
              getComponent={() => require('../screens/SettingsSectionScreen').default}
            />
            <Stack.Screen
              name="PasswordRecovery"
              getComponent={() => require('../screens/PasswordRecoveryScreen').default}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  initializing: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
});
