/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getApps } from '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

if (getApps().length > 0) {
  messaging().setBackgroundMessageHandler(async () => {});
}

AppRegistry.registerComponent(appName, () => App);
