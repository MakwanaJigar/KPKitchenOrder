import React, { useEffect, useState } from 'react';

import { NavigationContainer } from '@react-navigation/native';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Provider } from 'react-redux';

import { StripeProvider } from '@stripe/stripe-react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import axios from 'axios';

import store from './src/redux/Store';

import { AppAlertHost } from './src/components/AppAlert';

import SplashScreen from './src/screens/Spalsh';
import LoginScreen from './src/screens/Login';
import RegisterScreen from './src/screens/Register';
import CustomizeTiffin from './src/screens/CustomizeTiffin';
import Order from './src/screens/Order';
import Profile from './src/screens/Profile';
import MainTabNavigator from './src/navigation/MainTabNavigator';
import ForgotPassword from './src/screens/ForgotPassword';
import Otp from './src/screens/Otp';
import ResetPassword from './src/screens/ResetPassword';
import PreviousOrder from './src/screens/PreviousOrder';
import PaymentDetails from './src/screens/PaymentDetails';
import AddressList from './src/screens/AddressList';
import AddAddress from './src/screens/AddAddress';
import Welcome from './src/screens/Welcome';
import Notification from './src/screens/Notifications';
import WeeklyInvoice from './src/screens/WeeklyInvoice';
import InvoiceDetails from './src/screens/InvoiceDetails';

import {
  createNotificationChannel,
  flushPendingNotification,
  navigationRef,
  registerNotificationListeners,
  syncFcmToken,
} from './src/notifications/NotificationService';

/* =========================================================
 * STRIPE
 * =========================================================
 *
 * IMPORTANT:
 *
 * Put your PUBLISHABLE key here:
 *
 * pk_test_...
 *
 * DO NOT put:
 *
 * sk_test_...
 * sk_live_...
 *
 * Stripe secret key must remain on Laravel only.
 * ========================================================= */

const STRIPE_PUBLISHABLE_KEY =
  'pk_test_51U6SdyANg7fMOeypPugvZNrDN2FVjt1a6dMdKCvW0iw5se0u3CDdVqsX40eivgN7iBdGCHFFuIkg31uH7SaayEk000vpaKlvhL';

/* =========================================================
 * Stack
 * ========================================================= */

const Stack = createNativeStackNavigator();

/* =========================================================
 * Navigation
 * ========================================================= */

const AppNavigator = ({ initialRoute }) => {
  return (
    <NavigationContainer ref={navigationRef} onReady={flushPendingNotification}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        {/* ================================================= */}
        {/* Welcome */}
        {/* ================================================= */}

        <Stack.Screen
          name="Welcome"
          component={Welcome}
          options={{
            gestureEnabled: false,
          }}
        />

        {/* ================================================= */}
        {/* Main Tabs */}
        {/* ================================================= */}

        <Stack.Screen
          name="MainTabs"
          component={MainTabNavigator}
          options={{
            gestureEnabled: false,
          }}
        />

        {/* ================================================= */}
        {/* Authentication */}
        {/* ================================================= */}

        <Stack.Screen name="Login" component={LoginScreen} />

        <Stack.Screen name="Register" component={RegisterScreen} />

        <Stack.Screen name="ForgotPassword" component={ForgotPassword} />

        <Stack.Screen name="Otp" component={Otp} />

        <Stack.Screen name="ResetPassword" component={ResetPassword} />

        {/* ================================================= */}
        {/* Ordering */}
        {/* ================================================= */}

        <Stack.Screen name="CustomizeTiffin" component={CustomizeTiffin} />

        <Stack.Screen name="Order" component={Order} />

        {/* ================================================= */}
        {/* Profile / Account */}
        {/* ================================================= */}

        <Stack.Screen name="Profile" component={Profile} />

        <Stack.Screen name="PreviousOrder" component={PreviousOrder} />

        <Stack.Screen name="PaymentDetails" component={PaymentDetails} />

        <Stack.Screen name="AddressList" component={AddressList} />

        <Stack.Screen name="AddAddress" component={AddAddress} />

        <Stack.Screen name="Notification" component={Notification} />
        <Stack.Screen name="WeeklyInvoice" component={WeeklyInvoice} />
        <Stack.Screen name="InvoiceDetails" component={InvoiceDetails} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

/* =========================================================
 * App
 * ========================================================= */

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  const [initialRoute, setInitialRoute] = useState(null);

  /* =======================================================
   * Push Notifications
   * ======================================================= */

  useEffect(() => {
    createNotificationChannel().catch(() => {});

    const unsubscribe = registerNotificationListeners();

    return unsubscribe;
  }, []);

  /* =======================================================
   * App Initialization
   * ======================================================= */

  useEffect(() => {
    const initializeApp = async () => {
      try {
        /* =============================================
         * Splash
         * ============================================= */

        await new Promise(resolve => {
          setTimeout(resolve, 3000);
        });

        /* =============================================
         * Authentication
         * ============================================= */

        const token = await AsyncStorage.getItem('token');

        const isLoggedIn = await AsyncStorage.getItem('isLoggedIn');

        console.log('======================================');

        console.log('APP START AUTH CHECK');

        console.log('TOKEN:', token);

        console.log('IS LOGGED IN:', isLoggedIn);

        console.log('======================================');

        if (token && isLoggedIn === 'true') {
          axios.defaults.headers.common.Authorization = `Bearer ${token}`;

          syncFcmToken();

          console.log('USER LOGGED IN -> MAIN TABS');

          setInitialRoute('MainTabs');
        } else {
          /*
           * Guest browsing.
           */

          console.log('USER NOT LOGGED IN -> MAIN TABS');

          setInitialRoute('MainTabs');
        }
      } catch (error) {
        console.log('APP INITIALIZATION ERROR:', error);

        setInitialRoute('Welcome');
      } finally {
        setShowSplash(false);
      }
    };

    initializeApp();
  }, []);

  /* =======================================================
   * Splash
   * ======================================================= */

  if (showSplash || !initialRoute) {
    return (
      <Provider store={store}>
        <SplashScreen />

        <AppAlertHost />
      </Provider>
    );
  }

  /* =======================================================
   * Application
   * ======================================================= */

  return (
    <Provider store={store}>
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <AppNavigator initialRoute={initialRoute} />

        <AppAlertHost />
      </StripeProvider>
    </Provider>
  );
};

export default App;
