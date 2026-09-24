import React, { useState } from 'react';

import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

/* =========================================================
 * Tab Images
 * ========================================================= */

const tabImages = {
  Home: {
    active: require('../assets/login-icons/home.png'),
    inactive: require('../assets/login-icons/home-1.png'),
  },

  Profile: {
    active: require('../assets/login-icons/user-11.png'),
    inactive: require('../assets/login-icons/user.png'),
  },
  // RecentOrder: {
  //   active: require('../assets/login-icons/fast-delivery-dark.png'),
  //   inactive: require('../assets/login-icons/fast-delivery-light.png'),
  // },
};

/* =========================================================
 * Glass Tab Bar
 * ========================================================= */

const GlassTabBar = ({ state, descriptors, navigation }) => {
  /* =======================================================
   * Login Popup
   * ======================================================= */

  const [loginPopupVisible, setLoginPopupVisible] = useState(false);

  /* =======================================================
   * Selected Protected Route
   * ======================================================= */

  const [protectedRoute, setProtectedRoute] = useState(null);

  /* =======================================================
   * Close Popup
   * ======================================================= */

  const closeLoginPopup = () => {
    setLoginPopupVisible(false);

    setProtectedRoute(null);
  };

  /* =======================================================
   * Go To Login
   * ======================================================= */

  const handleLoginPress = () => {
    setLoginPopupVisible(false);

    /*
     * MainTabs is inside parent Stack.
     *
     * Therefore use getParent() to navigate
     * from Tab Navigator -> Stack Navigator.
     */

    const parentNavigation = navigation.getParent();

    if (parentNavigation) {
      parentNavigation.navigate('Login', {
        redirectTo: protectedRoute || 'Profile',
      });
    }

    setProtectedRoute(null);
  };

  /* =======================================================
   * Render
   * ======================================================= */

  return (
    <>
      {/* ================================================= */}
      {/* Tab Bar */}
      {/* ================================================= */}

      <View pointerEvents="box-none" style={styles.wrapper}>
        <View style={styles.glassContainer}>
          <View style={styles.glassHighlight} />

          {state.routes.map((route, index) => {
            const isFocused = state.index === index;

            const options = descriptors[route.key].options;

            const label =
              options.tabBarLabel !== undefined
                ? options.tabBarLabel
                : options.title !== undefined
                ? options.title
                : route.name;

            const imageData = tabImages[route.name];

            /* ===========================================
             * Tab Press
             * =========================================== */

            const onPress = async () => {
              /*
               * =======================================
               * PROFILE TAB
               * =======================================
               */

              if (route.name === 'Profile') {
                try {
                  const token = await AsyncStorage.getItem('token');

                  console.log('PROFILE TAB TOKEN:', token);

                  /*
                   * Guest
                   */

                  if (!token) {
                    setProtectedRoute('Profile');

                    setLoginPopupVisible(true);

                    return;
                  }
                } catch (error) {
                  console.log('PROFILE AUTH CHECK ERROR:', error);

                  setProtectedRoute('Profile');

                  setLoginPopupVisible(true);

                  return;
                }
              }

              /*
               * =======================================
               * Normal Tab Navigation
               * =======================================
               */

              const event = navigation.emit({
                type: 'tabPress',

                target: route.key,

                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            /* ===========================================
             * Long Press
             * =========================================== */

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',

                target: route.key,
              });
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={
                  isFocused
                    ? {
                        selected: true,
                      }
                    : {}
                }
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tabButton}
              >
                {/* Icon */}

                <View
                  style={[
                    styles.iconContainer,

                    isFocused && styles.activeIconContainer,
                  ]}
                >
                  {imageData ? (
                    <Image
                      source={isFocused ? imageData.active : imageData.inactive}
                      resizeMode="contain"
                      style={[
                        styles.tabImage,

                        isFocused && styles.activeTabImage,
                      ]}
                    />
                  ) : null}
                </View>

                {/* Label */}

                <Text
                  numberOfLines={1}
                  style={[styles.tabLabel, isFocused && styles.activeTabLabel]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ================================================= */}
      {/* Custom Login Required Popup */}
      {/* ================================================= */}

      <Modal
        visible={loginPopupVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeLoginPopup}
      >
        <Pressable style={styles.modalOverlay} onPress={closeLoginPopup}>
          {/* Prevent click inside popup from closing */}

          <Pressable style={styles.loginPopup} onPress={() => {}}>
            {/* Icon */}

            <View style={styles.popupIconContainer}>
              <Image
                source={require('../assets/login-icons/user.png')}
                style={styles.popupIcon}
                resizeMode="contain"
              />
            </View>

            {/* Heading */}

            <Text style={styles.popupTitle}>Login Required</Text>

            {/* Description */}

            <Text style={styles.popupDescription}>
              Please sign in to access your profile.
            </Text>

            {/* Buttons */}

            <View style={styles.popupButtonContainer}>
              {/* Cancel */}

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={closeLoginPopup}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              {/* Login */}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleLoginPress}
                style={styles.loginButton}
              >
                <Text style={styles.loginButtonText}>Sign In</Text>

                <Text style={styles.loginArrow}>→</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

export default GlassTabBar;

/* =========================================================
 * Styles
 * ========================================================= */

const styles = StyleSheet.create({
  /* =====================================================
   * Tab Wrapper
   * ===================================================== */

  wrapper: {
    position: 'absolute',

    right: 0,

    bottom: Platform.OS === 'ios' ? 18 : 12,

    left: 0,

    alignItems: 'center',

    paddingHorizontal: 14,
  },

  /* =====================================================
   * Glass Container
   * ===================================================== */

  glassContainer: {
    width: '100%',

    maxWidth: 600,

    height: 72,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-around',

    backgroundColor: 'rgba(255, 255, 255, 0.88)',

    borderWidth: 1,

    borderColor: 'rgba(255, 255, 255, 0.95)',

    borderRadius: 24,

    shadowColor: '#33243F',

    shadowOffset: {
      width: 0,

      height: 8,
    },

    shadowOpacity: 0.18,

    shadowRadius: 18,

    elevation: 12,

    overflow: 'hidden',
  },

  /* =====================================================
   * Glass Highlight
   * ===================================================== */

  glassHighlight: {
    position: 'absolute',

    top: 0,

    right: 12,

    left: 12,

    height: 1,

    backgroundColor: 'rgba(255,255,255,0.95)',
  },

  /* =====================================================
   * Tab Button
   * ===================================================== */

  tabButton: {
    flex: 1,

    height: '100%',

    alignItems: 'center',

    justifyContent: 'center',
  },

  /* =====================================================
   * Icon
   * ===================================================== */

  iconContainer: {
    width: 36,

    height: 32,

    alignItems: 'center',

    justifyContent: 'center',

    borderRadius: 11,
  },

  activeIconContainer: {
    backgroundColor: '#A00B0F',

    shadowColor: '#A00B0F',

    shadowOffset: {
      width: 0,

      height: 4,
    },

    shadowOpacity: 0.3,

    shadowRadius: 6,

    elevation: 4,

    borderRadius: 50,

    padding: 20,
  },

  tabImage: {
    width: 21,

    height: 21,
  },

  activeTabImage: {
    width: 20,

    height: 20,
  },

  /* =====================================================
   * Tab Label
   * ===================================================== */

  tabLabel: {
    color: '#A00B0F',

    fontSize: 9,

    fontWeight: '600',

    marginTop: 3,
  },

  activeTabLabel: {
    color: '#A00B0F',

    fontWeight: '800',
  },

  /* =====================================================
   * Modal Overlay
   * ===================================================== */

  modalOverlay: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: 'rgba(20, 13, 13, 0.55)',

    paddingHorizontal: 22,
  },

  /* =====================================================
   * Login Popup
   * ===================================================== */

  loginPopup: {
    width: '100%',

    maxWidth: 380,

    alignItems: 'center',

    backgroundColor: '#FFFFFF',

    borderRadius: 24,

    paddingHorizontal: 22,

    paddingTop: 28,

    paddingBottom: 22,

    shadowColor: '#000000',

    shadowOffset: {
      width: 0,

      height: 10,
    },

    shadowOpacity: 0.22,

    shadowRadius: 20,

    elevation: 15,
  },

  /* =====================================================
   * Popup Icon
   * ===================================================== */

  popupIconContainer: {
    width: 72,

    height: 72,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF1F1',

    borderRadius: 36,

    marginBottom: 16,
  },

  popupIcon: {
    width: 31,

    height: 31,

    tintColor: '#A00B0F',
  },

  /* =====================================================
   * Popup Text
   * ===================================================== */

  popupTitle: {
    color: '#211717',

    fontSize: 20,

    fontWeight: '900',

    textAlign: 'center',
  },

  popupDescription: {
    maxWidth: 300,

    color: '#7D6C68',

    fontSize: 12,

    lineHeight: 18,

    fontWeight: '500',

    textAlign: 'center',

    marginTop: 8,
  },

  /* =====================================================
   * Popup Buttons
   * ===================================================== */

  popupButtonContainer: {
    width: '100%',

    flexDirection: 'row',

    alignItems: 'center',

    marginTop: 24,

    gap: 10,
  },

  /* Cancel */

  cancelButton: {
    flex: 1,

    minHeight: 48,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF7F5',

    borderWidth: 1,

    borderColor: '#E7D7D2',

    borderRadius: 12,
  },

  cancelButtonText: {
    color: '#786561',

    fontSize: 12,

    fontWeight: '800',
  },

  /* Login */

  loginButton: {
    flex: 1,

    minHeight: 48,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#A00B0F',

    borderRadius: 12,

    shadowColor: '#A00B0F',

    shadowOffset: {
      width: 0,

      height: 4,
    },

    shadowOpacity: 0.22,

    shadowRadius: 7,

    elevation: 4,
  },

  loginButtonText: {
    color: '#FFFFFF',

    fontSize: 12,

    fontWeight: '800',
  },

  loginArrow: {
    color: '#FFFFFF',

    fontSize: 18,

    fontWeight: '700',

    marginLeft: 7,
  },
});
