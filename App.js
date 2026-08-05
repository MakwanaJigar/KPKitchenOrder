import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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


const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />

        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Order" component={Order} />
        <Stack.Screen name="Profile" component={Profile} />

        <Stack.Screen name="CustomizeTiffin" component={CustomizeTiffin} />

        <Stack.Screen
          name="MainTabs"
          component={MainTabNavigator}
          options={{
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPassword}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Otp"
          component={Otp}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPassword}
          options={{
            headerShown: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => {
      clearTimeout(splashTimer);
    };
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  return <AppNavigator />;
};

export default App;
