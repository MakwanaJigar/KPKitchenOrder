import React from 'react';

import {
  Image,
  ImageBackground,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

const Welcome = ({
  navigation,
}) => {
  const {
    width,
    height,
  } = useWindowDimensions();

  const isTablet =
    width >= 768;

  const contentWidth =
    isTablet
      ? Math.min(
          width * 0.6,
          480,
        )
      : width - 28;

  /* =======================================================
   * Get Started
   * ======================================================= */

  const handleGetStarted =
    () => {
      navigation.navigate(
        'Register',
      );
    };

  /* =======================================================
   * Login
   * ======================================================= */

  const handleLogin =
    () => {
      navigation.navigate(
        'Login',
      );
    };

  /* =======================================================
   * Skip / Continue As Guest
   * ======================================================= */

  const handleSkip =
    () => {
      navigation.reset({
        index: 0,

        routes: [
          {
            name:
              'MainTabs',
          },
        ],
      });
    };

  return (
    <View
      style={
        styles.container
      }>

      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* ================================================= */}
      {/* Background */}
      {/* ================================================= */}

      <ImageBackground
        source={require('../assets/tiffin-1.png')}
        style={
          styles.backgroundImage
        }
        resizeMode="cover">

        {/* Dark Overlay */}

        <View
          style={
            styles.overlay
          }
        />

        <SafeAreaView
          style={
            styles.safeArea
          }>

          {/* ============================================= */}
          {/* Header */}
          {/* ============================================= */}

          <View
            style={
              styles.header
            }>

            {/* Logo */}

            <View
              style={
                styles.brandContainer
              }>

              <View
                style={
                  styles.logoBox
                }>

                <Image
                  source={require('../assets/logo.png')}
                  style={
                    styles.logoImage
                  }
                  resizeMode="contain"
                />

              </View>

              <Text
                style={
                  styles.brandName
                }>
                KP Cloud Kitchen
              </Text>

            </View>

            {/* Skip */}

            <Pressable
              hitSlop={10}
              onPress={
                handleSkip
              }
              style={({pressed}) => [
                styles.skipButton,

                pressed &&
                  styles.buttonPressed,
              ]}>

              <Text
                style={
                  styles.skipText
                }>
                Skip
              </Text>

            </Pressable>

          </View>

          {/* ============================================= */}
          {/* Bottom Content */}
          {/* ============================================= */}

          <View
            style={
              styles.bottomSection
            }>

            <View
              style={[
                styles.contentCard,

                {
                  width:
                    contentWidth,
                },
              ]}>

              {/* Slider Indicator */}

              {/* <View
                style={
                  styles.indicatorContainer
                }>

                <View
                  style={
                    styles.activeIndicator
                  }
                />

                <View
                  style={
                    styles.inactiveIndicator
                  }
                />

                <View
                  style={
                    styles.inactiveIndicator
                  }
                />

              </View> */}

              {/* Heading */}

              <Text
                style={
                  styles.title
                }>
                Fresh Daily Meals,{'\n'}
                Delivered to Your Door
              </Text>

              {/* Description */}

              <Text
                style={
                  styles.description
                }>
                Authentic home-cooked tiffins
                customized to your taste.
                Weekly billing, easy tracking,
                and local Melbourne delivery.
              </Text>

              {/* Get Started */}

              <TouchableOpacity
                activeOpacity={
                  0.85
                }
                style={
                  styles.getStartedButton
                }
                onPress={
                  handleGetStarted
                }>

                <Text
                  style={
                    styles.getStartedText
                  }>
                  Get Started
                </Text>

                <Text
                  style={
                    styles.arrow
                  }>
                  →
                </Text>

              </TouchableOpacity>

              {/* Existing Account */}

              <View
                style={
                  styles.loginRow
                }>

                <Text
                  style={
                    styles.accountText
                  }>
                  Already a member?{' '}
                </Text>

                <Pressable
                  onPress={
                    handleLogin
                  }
                  hitSlop={8}>

                  <Text
                    style={
                      styles.loginText
                    }>
                    Log in
                  </Text>

                </Pressable>

              </View>

            </View>

          </View>

        </SafeAreaView>

      </ImageBackground>

    </View>
  );
};

export default Welcome;

/* =========================================================
 * Styles
 * ========================================================= */

const styles =
  StyleSheet.create({
    container: {
      flex: 1,

      backgroundColor:
        '#000000',
    },

    backgroundImage: {
      flex: 1,

      width:
        '100%',

      height:
        '100%',
    },

    overlay: {
      ...StyleSheet.absoluteFillObject,

      backgroundColor:
        'rgba(20, 10, 5, 0.18)',
    },

    safeArea: {
      flex: 1,

      justifyContent:
        'space-between',
    },

    /* =====================================================
     * Header
     * ===================================================== */

    header: {
      width:
        '100%',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      paddingHorizontal:
        18,

      paddingTop:
        5,
    },

    brandContainer: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    logoBox: {
      width: 38,

      height: 38,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#A00B0F',

      borderRadius:
        10,

      overflow:
        'hidden',
    },

    logoImage: {
      width: 30,

      height: 30,
    },

    brandName: {
      color:
        '#FFFFFF',

      fontSize:
        15,

      fontWeight:
        '800',

      marginLeft:
        8,

      textShadowColor:
        'rgba(0,0,0,0.25)',

      textShadowOffset: {
        width:
          0,

        height:
          1,
      },

      textShadowRadius:
        3,
    },

    skipButton: {
      minWidth:
        48,

      height:
        30,

      paddingHorizontal:
        13,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(255,255,255,0.30)',

      borderWidth:
        1,

      borderColor:
        'rgba(255,255,255,0.30)',

      borderRadius:
        20,
    },

    skipText: {
      color:
        '#FFFFFF',

      fontSize:
        11,

      fontWeight:
        '700',
    },

    buttonPressed: {
      opacity:
        0.75,
    },

    /* =====================================================
     * Bottom
     * ===================================================== */

    bottomSection: {
      width:
        '100%',

      alignItems:
        'center',

      paddingHorizontal:
        14,

      paddingBottom:
        18,
    },

    contentCard: {
      alignItems:
        'center',

      backgroundColor:
        'rgba(255, 253, 250, 0.97)',

      borderRadius:
        30,

      paddingHorizontal:
        25,

      paddingTop:
        24,

      paddingBottom:
        22,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          8,
      },

      shadowOpacity:
        0.23,

      shadowRadius:
        18,

      elevation:
        12,
    },

    /* =====================================================
     * Indicators
     * ===================================================== */

    indicatorContainer: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginBottom:
        21,
    },

    activeIndicator: {
      width:
        29,

      height:
        5,

      backgroundColor:
        '#A00B0F',

      borderRadius:
        10,

      marginHorizontal:
        3,
    },

    inactiveIndicator: {
      width:
        6,

      height:
        6,

      backgroundColor:
        '#E8D8D0',

      borderRadius:
        3,

      marginHorizontal:
        3,
    },

    /* =====================================================
     * Content
     * ===================================================== */

    title: {
      color:
        '#242020',

      fontSize:
        22,

      lineHeight:
        29,

      fontWeight:
        '800',

      textAlign:
        'center',

      letterSpacing:
        -0.3,
    },

    description: {
      maxWidth:
        330,

      color:
        '#776963',

      fontSize:
        12,

      lineHeight:
        18,

      fontWeight:
        '500',

      textAlign:
        'center',

      marginTop:
        12,
    },

    /* =====================================================
     * Get Started
     * ===================================================== */

    getStartedButton: {
      width:
        '100%',

      minHeight:
        56,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#A00B0F',

      borderRadius:
        13,

      marginTop:
        25,

      shadowColor:
        '#A00B0F',

      shadowOffset: {
        width:
          0,

        height:
          6,
      },

      shadowOpacity:
        0.25,

      shadowRadius:
        9,

      elevation:
        5,
    },

    getStartedText: {
      color:
        '#FFFFFF',

      fontSize:
        14,

      fontWeight:
        '800',
    },

    arrow: {
      color:
        '#FFFFFF',

      fontSize:
        21,

      fontWeight:
        '700',

      marginLeft:
        10,

      marginTop:
        -1,
    },

    /* =====================================================
     * Login
     * ===================================================== */

    loginRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginTop:
        18,
    },

    accountText: {
      color:
        '#A0948E',

      fontSize:
        10,

      fontWeight:
        '500',
    },

    loginText: {
      color:
        '#A00B0F',

      fontSize:
        10,

      fontWeight:
        '800',
    },
  });