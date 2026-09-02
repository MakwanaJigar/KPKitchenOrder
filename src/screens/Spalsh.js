import React, {
  useEffect,
  useRef,
} from 'react';

import {
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const Splash = ({
  onFinish,
}) => {
  const logoOpacity =
    useRef(
      new Animated.Value(0),
    ).current;

  const logoScale =
    useRef(
      new Animated.Value(0.82),
    ).current;

  const logoTranslateY =
    useRef(
      new Animated.Value(18),
    ).current;

  const titleOpacity =
    useRef(
      new Animated.Value(0),
    ).current;

  const titleTranslateY =
    useRef(
      new Animated.Value(12),
    ).current;

  const taglineOpacity =
    useRef(
      new Animated.Value(0),
    ).current;

  const dividerScale =
    useRef(
      new Animated.Value(0),
    ).current;

  const loaderOpacity =
    useRef(
      new Animated.Value(0.35),
    ).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(
          logoOpacity,
          {
            toValue: 1,
            duration: 700,
            easing:
              Easing.out(
                Easing.cubic,
              ),
            useNativeDriver:
              true,
          },
        ),

        Animated.timing(
          logoScale,
          {
            toValue: 1,
            duration: 850,
            easing:
              Easing.out(
                Easing.back(
                  1.1,
                ),
              ),
            useNativeDriver:
              true,
          },
        ),

        Animated.timing(
          logoTranslateY,
          {
            toValue: 0,
            duration: 850,
            easing:
              Easing.out(
                Easing.cubic,
              ),
            useNativeDriver:
              true,
          },
        ),
      ]),

      Animated.parallel([
        Animated.timing(
          titleOpacity,
          {
            toValue: 1,
            duration: 500,
            useNativeDriver:
              true,
          },
        ),

        Animated.timing(
          titleTranslateY,
          {
            toValue: 0,
            duration: 500,
            easing:
              Easing.out(
                Easing.cubic,
              ),
            useNativeDriver:
              true,
          },
        ),
      ]),

      Animated.timing(
        dividerScale,
        {
          toValue: 1,
          duration: 400,
          useNativeDriver:
            true,
        },
      ),

      Animated.timing(
        taglineOpacity,
        {
          toValue: 1,
          duration: 450,
          useNativeDriver:
            true,
        },
      ),
    ]).start();

    const loaderAnimation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            loaderOpacity,
            {
              toValue: 1,
              duration: 650,
              useNativeDriver:
                true,
            },
          ),

          Animated.timing(
            loaderOpacity,
            {
              toValue: 0.3,
              duration: 650,
              useNativeDriver:
                true,
            },
          ),
        ]),
      );

    loaderAnimation.start();

    const timer =
      setTimeout(() => {
        if (
          typeof onFinish ===
          'function'
        ) {
          onFinish();
        }
      }, 4000);

    return () => {
      clearTimeout(
        timer,
      );

      loaderAnimation.stop();
    };
  }, [
    onFinish,
    logoOpacity,
    logoScale,
    logoTranslateY,
    titleOpacity,
    titleTranslateY,
    taglineOpacity,
    dividerScale,
    loaderOpacity,
  ]);

  return (
    <View
      style={
        styles.container
      }
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#A9090D"
      />

      <View
        pointerEvents="none"
        style={
          styles.circleOne
        }
      />

      <View
        pointerEvents="none"
        style={
          styles.circleTwo
        }
      />

      <View
        pointerEvents="none"
        style={
          styles.circleThree
        }
      />

      <View
        style={
          styles.content
        }
      >
        <Animated.View
          style={{
            opacity:
              logoOpacity,

            transform: [
              {
                scale:
                  logoScale,
              },

              {
                translateY:
                  logoTranslateY,
              },
            ],
          }}
        >
          <View
            style={
              styles.logoCard
            }
          >
            <Image
              source={require('../assets/logo.png')}
              style={
                styles.logo
              }
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        <Animated.Text
          style={[
            styles.appName,

            {
              opacity:
                titleOpacity,

              transform: [
                {
                  translateY:
                    titleTranslateY,
                },
              ],
            },
          ]}
        >
          KP Cloud Kitchen
        </Animated.Text>

        <Animated.View
          style={[
            styles.divider,

            {
              transform: [
                {
                  scaleX:
                    dividerScale,
                },
              ],
            },
          ]}
        />

        <Animated.Text
          style={[
            styles.tagline,

            {
              opacity:
                taglineOpacity,
            },
          ]}
        >
          Fresh meals, delivered with care.
        </Animated.Text>
      </View>

      <View
        style={
          styles.bottomSection
        }
      >
        <View
          style={
            styles.loaderRow
          }
        >
          <Animated.View
            style={[
              styles.loaderDot,

              {
                opacity:
                  loaderOpacity,
              },
            ]}
          />

          <Animated.View
            style={[
              styles.loaderDot,
              styles.loaderDotMiddle,

              {
                opacity:
                  loaderOpacity,
              },
            ]}
          />

          <Animated.View
            style={[
              styles.loaderDot,

              {
                opacity:
                  loaderOpacity,
              },
            ]}
          />
        </View>

        <Text
          style={
            styles.bottomText
          }
        >
          KP'S KITCHEN
        </Text>
      </View>
    </View>
  );
};

export default Splash;

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#A9090D',
      overflow:
        'hidden',
    },

    circleOne: {
      position:
        'absolute',
      width: 330,
      height: 330,
      borderRadius: 165,
      borderWidth: 1,
      borderColor:
        'rgba(255,255,255,0.07)',
      top: -130,
      right: -120,
    },

    circleTwo: {
      position:
        'absolute',
      width: 230,
      height: 230,
      borderRadius: 115,
      backgroundColor:
        'rgba(255,255,255,0.025)',
      bottom: -90,
      left: -80,
    },

    circleThree: {
      position:
        'absolute',
      width: 150,
      height: 150,
      borderRadius: 75,
      borderWidth: 1,
      borderColor:
        'rgba(244,196,84,0.10)',
      bottom: 100,
      right: -65,
    },

    content: {
      width: '100%',
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 28,
    },

    logoCard: {
      width: 235,
      height: 170,
      backgroundColor:
        '#ffffff',
      borderRadius: 30,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 18,
      paddingVertical: 15,
      elevation: 10,
    },

    logo: {
      width: '100%',
      height: '100%',
    },

    appName: {
      color:
        '#ffffff',
      fontSize: 30,
      fontWeight:
        '900',
      textAlign:
        'center',
      marginTop: 28,
    },

    divider: {
      width: 58,
      height: 3,
      borderRadius: 3,
      backgroundColor:
        '#D4A12A',
      marginTop: 15,
      marginBottom: 13,
    },

    tagline: {
      color:
        'rgba(255,255,255,0.78)',
      fontSize: 14,
      textAlign:
        'center',
    },

    bottomSection: {
      position:
        'absolute',
      bottom: 42,
      alignItems:
        'center',
    },

    loaderRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    loaderDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor:
        '#D4A12A',
    },

    loaderDotMiddle: {
      marginHorizontal: 7,
    },

    bottomText: {
      color:
        'rgba(255,255,255,0.55)',
      fontSize: 8,
      fontWeight:
        '800',
      letterSpacing: 1.6,
      marginTop: 12,
    },
  });