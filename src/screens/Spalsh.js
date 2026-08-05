import React from 'react';
import {
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const Splash = () => {
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFF8F4"
      />

      <Image
        source={require('../assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.appName}>KP Cloud Kitchen</Text>

      <Text style={styles.tagline}>
        Fresh meals, delivered with care.
      </Text>
    </View>
  );
};

export default Splash;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F4',
    paddingHorizontal: 24,
  },

  logo: {
    width: 180,
    height: 130,
  },

  appName: {
    color: '#172A46',
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 16,
  },

  tagline: {
    color: '#777777',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
});