import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import Home from '../screens/Home';
// import MenuScreen from '../screens/MenuScreen';
// import OrdersScreen from '../screens/OrdersScreen';
// import BillsScreen from '../screens/BillsScreen';
// import ProfileScreen from '../screens/ProfileScreen';
import GlassTabBar from './GlassTabBar';
import Profile from '../screens/Profile';

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={props => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: false,
        sceneStyle: {
          backgroundColor: '#FAF8FD',
        },
      }}>
      <Tab.Screen
        name="Home"
        component={Home}
      />

      {/* <Tab.Screen
        name="Menu"
        component={MenuScreen}
      />

      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
      />

      <Tab.Screen
        name="Bills"
        component={BillsScreen}
      />*/}

      <Tab.Screen
        name="Profile"
        component={Profile}
      /> 
    </Tab.Navigator>
  );
};

export default MainTabNavigator;