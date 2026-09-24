import {AppRegistry} from 'react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import {name as appName} from './app.json';
import {displayRemoteMessage} from './src/notifications/NotificationService';

// App in background or killed. Messages with a "notification" block
// are shown by Android itself; data-only messages are shown here.
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('BACKGROUND NOTIFICATION:', remoteMessage);

  if (!remoteMessage?.notification) {
    await displayRemoteMessage(remoteMessage);
  }
});

// Required by Notifee; taps are handled via getInitialNotification in App.
notifee.onBackgroundEvent(async () => {});

AppRegistry.registerComponent(appName, () => App);
