import React, {
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import axios from 'axios';

import AsyncStorage from '@react-native-async-storage/async-storage';

/* =========================================================
 * Login API
 * ========================================================= */

const LOGIN_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/login';

/* =========================================================
 * Login Component
 * ========================================================= */

const Login = ({
  navigation,
  route,
}) => {
  const {width} =
    useWindowDimensions();

  const [
    formData,
    setFormData,
  ] = useState({
    email: '',
    password: '',
  });

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const containerWidth =
    width >= 768
      ? 500
      : width - 32;

  /* =======================================================
   * Update Field
   * ======================================================= */

  const updateField = (
    field,
    value,
  ) => {
    setFormData(
      previousData => ({
        ...previousData,

        [field]:
          value,
      }),
    );
  };

  /* =======================================================
   * Validate Email
   * ======================================================= */

  const validateEmail =
    email => {
      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      return emailPattern.test(
        email.trim(),
      );
    };

  /* =======================================================
   * API Error Message
   * ======================================================= */

  const getApiErrorMessage =
    error => {
      if (
        !error.response
      ) {
        if (
          error.code ===
          'ECONNABORTED'
        ) {
          return 'The request timed out. Please try again.';
        }

        return 'Unable to connect to the server. Please check your internet connection.';
      }

      const responseData =
        error.response
          ?.data;

      /* Laravel Validation */

      if (
        responseData
          ?.errors
      ) {
        const validationMessages =
          Object.values(
            responseData.errors,
          )
            .flat()
            .filter(
              Boolean,
            );

        if (
          validationMessages
            .length >
          0
        ) {
          return validationMessages.join(
            '\n',
          );
        }
      }

      /* Unauthorized */

      if (
        error.response
          .status ===
        401
      ) {
        return (
          responseData
            ?.message ||
          'The entered email address or password is incorrect.'
        );
      }

      /* Validation */

      if (
        error.response
          .status ===
        422
      ) {
        return (
          responseData
            ?.message ||
          'Please check your email address and password.'
        );
      }

      /* Server Error */

      if (
        error.response
          .status >=
        500
      ) {
        return (
          responseData
            ?.message ||
          'Server error. Please try again.'
        );
      }

      return (
        responseData
          ?.message ||
        responseData
          ?.error ||
        'Login failed. Please try again.'
      );
    };

  /* =======================================================
   * Successful Login Redirect
   * ======================================================= */

  const handleLoginRedirect =
    () => {
      const redirectTo =
        route?.params
          ?.redirectTo;

      const selectedTiffin =
        route?.params
          ?.tiffin;

      console.log(
        '======================================',
      );

      console.log(
        'LOGIN REDIRECT',
      );

      console.log(
        'Redirect To:',
        redirectTo,
      );

      console.log(
        'Selected Tiffin:',
        selectedTiffin,
      );

      console.log(
        '======================================',
      );

      /* ===============================================
       * Guest clicked ORDER NOW
       * =============================================== */

      if (
        redirectTo ===
          'CustomizeTiffin' &&
        selectedTiffin
      ) {
        navigation.replace(
          'CustomizeTiffin',
          {
            tiffin:
              selectedTiffin,
          },
        );

        return;
      }

      /* ===============================================
       * Guest clicked address
       * =============================================== */

      if (
        redirectTo ===
        'AddressList'
      ) {
        navigation.replace(
          'AddressList',
        );

        return;
      }

      /* ===============================================
       * Guest clicked Profile
       * =============================================== */

      if (
        redirectTo ===
        'Profile'
      ) {
        navigation.reset({
          index: 1,

          routes: [
            {
              name:
                'MainTabs',
            },

            {
              name:
                'Profile',
            },
          ],
        });

        return;
      }

      /* ===============================================
       * Normal Login
       * =============================================== */

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

  /* =======================================================
   * Login
   * ======================================================= */

  const handleLogin =
    async () => {
      const email =
        formData.email
          .trim()
          .toLowerCase();

      const password =
        formData.password;

      /* ===================================================
       * Email Required
       * =================================================== */

      if (!email) {
        Alert.alert(
          'Email Required',

          'Please enter your email address.',
        );

        return;
      }

      /* ===================================================
       * Validate Email
       * =================================================== */

      if (
        !validateEmail(
          email,
        )
      ) {
        Alert.alert(
          'Invalid Email',

          'Please enter a valid email address.',
        );

        return;
      }

      /* ===================================================
       * Password Required
       * =================================================== */

      if (
        !password.trim()
      ) {
        Alert.alert(
          'Password Required',

          'Please enter your password.',
        );

        return;
      }

      /* ===================================================
       * Payload
       * =================================================== */

      const payload = {
        email,

        password,

        device_name:
          Platform.OS ===
          'android'
            ? 'KP Kitchen Android App'
            : 'KP Kitchen iOS App',
      };

      try {
        setLoading(
          true,
        );

        console.log(
          '======================================',
        );

        console.log(
          'LOGIN API CALL',
        );

        console.log(
          'URL:',
          LOGIN_API_URL,
        );

        console.log(
          'EMAIL:',
          email,
        );

        console.log(
          'DEVICE:',
          payload.device_name,
        );

        console.log(
          '======================================',
        );

        /* ===============================================
         * Login API
         * =============================================== */

        const response =
          await axios.post(
            LOGIN_API_URL,

            payload,

            {
              headers: {
                Accept:
                  'application/json',

                'Content-Type':
                  'application/json',
              },

              timeout:
                20000,
            },
          );

        console.log(
          '======================================',
        );

        console.log(
          'LOGIN RESPONSE:',
        );

        console.log(
          JSON.stringify(
            response.data,
            null,
            2,
          ),
        );

        console.log(
          '======================================',
        );

        /* ===============================================
         * Some APIs return HTTP 200 with success false
         * =============================================== */

        if (
          response.data
            ?.status ===
            false ||
          response.data
            ?.success ===
            false
        ) {
          Alert.alert(
            'Login Failed',

            response.data
              ?.message ||
              'The entered email address or password is incorrect.',
          );

          return;
        }

        /* ===============================================
         * Extract Token
         * =============================================== */

        const token =
          response.data
            ?.token ||
          response.data
            ?.access_token ||
          response.data
            ?.data
            ?.token ||
          response.data
            ?.data
            ?.access_token;

        console.log(
          'TOKEN RECEIVED:',
          token,
        );

        /* ===============================================
         * Token Required
         * =============================================== */

        if (!token) {
          console.log(
            'LOGIN RESPONSE DOES NOT CONTAIN TOKEN',
          );

          Alert.alert(
            'Login Error',

            'Login was successful, but the authentication token was not returned by the server.',
          );

          return;
        }

        /* ===============================================
         * Save Token Permanently
         * =============================================== */

        await AsyncStorage.setItem(
          'token',

          String(
            token,
          ),
        );

        console.log(
          'TOKEN SAVED SUCCESSFULLY',
        );

        /* ===============================================
         * Save Logged-in State
         * =============================================== */

        await AsyncStorage.setItem(
          'isLoggedIn',

          'true',
        );

        /* ===============================================
         * Extract User Data
         * =============================================== */

        const userData =
          response.data
            ?.customer ||
          response.data
            ?.user ||
          response.data
            ?.data
            ?.customer ||
          response.data
            ?.data
            ?.user ||
          response.data
            ?.data ||
          null;

        /* ===============================================
         * Save User Data
         * =============================================== */

        if (
          userData
        ) {
          try {
            await AsyncStorage.setItem(
              'user',

              JSON.stringify(
                userData,
              ),
            );

            console.log(
              'USER DATA SAVED',
            );
          } catch (
            storageError
          ) {
            console.log(
              'USER DATA STORAGE ERROR:',
              storageError,
            );
          }
        }

        /* ===============================================
         * Axios Default Authorization
         * =============================================== */

        axios.defaults.headers.common.Authorization =
          `Bearer ${token}`;

        /* ===============================================
         * Verify Token
         * =============================================== */

        const savedToken =
          await AsyncStorage.getItem(
            'token',
          );

        const savedLoginState =
          await AsyncStorage.getItem(
            'isLoggedIn',
          );

        console.log(
          '======================================',
        );

        console.log(
          'LOGIN SUCCESSFUL',
        );

        console.log(
          'SAVED TOKEN:',
          savedToken,
        );

        console.log(
          'IS LOGGED IN:',
          savedLoginState,
        );

        console.log(
          '======================================',
        );

        /* ===============================================
         * Redirect
         * =============================================== */

        handleLoginRedirect();
      } catch (error) {
        console.log(
          '======================================',
        );

        console.log(
          'LOGIN ERROR',
        );

        console.log(
          'STATUS:',
          error.response
            ?.status,
        );

        console.log(
          'RESPONSE:',
          error.response
            ?.data,
        );

        console.log(
          'MESSAGE:',
          error.message,
        );

        console.log(
          '======================================',
        );

        const errorMessage =
          axios.isAxiosError(
            error,
          )
            ? getApiErrorMessage(
                error,
              )
            : 'An unexpected error occurred. Please try again.';

        Alert.alert(
          'Login Failed',

          errorMessage,
        );
      } finally {
        setLoading(
          false,
        );
      }
    };

  /* =======================================================
   * Forgot Password
   * ======================================================= */

  const handleForgotPassword =
    () => {
      if (
        navigation &&
        !loading
      ) {
        navigation.navigate(
          'ForgotPassword',
        );
      }
    };

  /* =======================================================
   * Register
   * ======================================================= */

  const handleCreateAccount =
    () => {
      if (
        !navigation ||
        loading
      ) {
        return;
      }

      /*
       * If user came from ORDER NOW,
       * preserve selected tiffin for registration too.
       */

      navigation.navigate(
        'Register',
        {
          redirectTo:
            route?.params
              ?.redirectTo,

          tiffin:
            route?.params
              ?.tiffin,
        },
      );
    };

  /* =======================================================
   * Continue As Guest
   * ======================================================= */

  const handleContinueAsGuest =
    () => {
      if (
        loading
      ) {
        return;
      }

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

  /* =======================================================
   * UI
   * ======================================================= */

  return (
    <SafeAreaView
      style={
        styles.screen
      }>

      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFF8F4"
      />

      <KeyboardAvoidingView
        style={
          styles.keyboardContainer
        }
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
        }>

        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled">

          <View
            style={[
              styles.loginCard,

              {
                width:
                  containerWidth,
              },
            ]}>

            {/* ========================================= */}
            {/* Logo */}
            {/* ========================================= */}

            <Image
              source={require('../assets/logo.png')}
              style={
                styles.logo
              }
              resizeMode="contain"
            />

            {/* ========================================= */}
            {/* Heading */}
            {/* ========================================= */}

            <Text
              style={
                styles.title
              }>
              Welcome Back
            </Text>

            <Text
              style={
                styles.subtitle
              }>

              {route?.params
                ?.redirectTo ===
              'CustomizeTiffin'
                ? 'Sign in to continue with your tiffin order.'
                : 'Please enter your details to sign in.'}

            </Text>

            {/* ========================================= */}
            {/* Email */}
            {/* ========================================= */}

            <View
              style={
                styles.fieldGroup
              }>

              <Text
                style={
                  styles.label
                }>
                Email Address
              </Text>

              <View
                style={
                  styles.inputContainer
                }>

                <Image
                  source={require('../assets/login-icons/mail.png')}
                  style={
                    styles.inputIconImage
                  }
                  resizeMode="contain"
                />

                <TextInput
                  value={
                    formData.email
                  }
                  onChangeText={
                    value =>
                      updateField(
                        'email',
                        value,
                      )
                  }
                  placeholder="name@example.com"
                  placeholderTextColor="#9B9B9B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={
                    false
                  }
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  editable={
                    !loading
                  }
                  style={
                    styles.input
                  }
                />

              </View>

            </View>

            {/* ========================================= */}
            {/* Password */}
            {/* ========================================= */}

            <View
              style={
                styles.fieldGroup
              }>

              <View
                style={
                  styles.passwordLabelRow
                }>

                <Text
                  style={
                    styles.label
                  }>
                  Password
                </Text>

                <Pressable
                  hitSlop={
                    10
                  }
                  disabled={
                    loading
                  }
                  onPress={
                    handleForgotPassword
                  }>

                  <Text
                    style={
                      styles.forgotPasswordText
                    }>
                    Forgot Password?
                  </Text>

                </Pressable>

              </View>

              <View
                style={
                  styles.inputContainer
                }>

                <Image
                  source={require('../assets/login-icons/unlock.png')}
                  style={
                    styles.inputIconImage
                  }
                  resizeMode="contain"
                />

                <TextInput
                  value={
                    formData.password
                  }
                  onChangeText={
                    value =>
                      updateField(
                        'password',
                        value,
                      )
                  }
                  placeholder="Enter your password"
                  placeholderTextColor="#9B9B9B"
                  secureTextEntry={
                    !showPassword
                  }
                  autoCapitalize="none"
                  autoCorrect={
                    false
                  }
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={
                    handleLogin
                  }
                  editable={
                    !loading
                  }
                  style={
                    styles.input
                  }
                />

                <Pressable
                  hitSlop={
                    10
                  }
                  disabled={
                    loading
                  }
                  onPress={() =>
                    setShowPassword(
                      previousValue =>
                        !previousValue,
                    )
                  }>

                  <Image
                    source={
                      showPassword
                        ? require('../assets/login-icons/eye.png')
                        : require('../assets/login-icons/close-eye.png')
                    }
                    style={
                      styles.passwordEyeImage
                    }
                    resizeMode="contain"
                  />

                </Pressable>

              </View>

            </View>

            {/* ========================================= */}
            {/* Login Button */}
            {/* ========================================= */}

            <TouchableOpacity
              activeOpacity={
                0.85
              }
              disabled={
                loading
              }
              style={[
                styles.loginButton,

                loading &&
                  styles.loginButtonDisabled,
              ]}
              onPress={
                handleLogin
              }>

              {loading ? (
                <View
                  style={
                    styles.loadingContainer
                  }>

                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.loadingText
                    }>
                    Signing In...
                  </Text>

                </View>
              ) : (
                <>

                  <Text
                    style={
                      styles.loginButtonText
                    }>
                    Sign In
                  </Text>

                  <Text
                    style={
                      styles.loginArrow
                    }>
                    →
                  </Text>

                </>
              )}

            </TouchableOpacity>

            {/* ========================================= */}
            {/* Create Account */}
            {/* ========================================= */}

            <View
              style={
                styles.createAccountContainer
              }>

              <Text
                style={
                  styles.accountText
                }>
                Don&apos;t have an account?{' '}
              </Text>

              <Pressable
                disabled={
                  loading
                }
                onPress={
                  handleCreateAccount
                }>

                <Text
                  style={
                    styles.createAccountText
                  }>
                  Create Account
                </Text>

              </Pressable>

            </View>

            {/* ========================================= */}
            {/* Continue as Guest */}
            {/* ========================================= */}

            <Pressable
              disabled={
                loading
              }
              onPress={
                handleContinueAsGuest
              }
              style={
                styles.guestButton
              }>

              <Text
                style={
                  styles.guestButtonText
                }>
                Continue as Guest
              </Text>

            </Pressable>

            {/* ========================================= */}
            {/* Footer */}
            {/* ========================================= */}

            <View
              style={
                styles.footerContainer
              }>

              <Pressable
                disabled={
                  loading
                }>

                <Text
                  style={
                    styles.footerText
                  }>
                  Privacy Policy
                </Text>

              </Pressable>

              <View
                style={
                  styles.footerSeparator
                }
              />

              <Pressable
                disabled={
                  loading
                }>

                <Text
                  style={
                    styles.footerText
                  }>
                  Terms of Service
                </Text>

              </Pressable>

            </View>

          </View>

        </ScrollView>

      </KeyboardAvoidingView>

    </SafeAreaView>
  );
};

export default Login;

/* =========================================================
 * Styles
 * ========================================================= */

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,

      backgroundColor:
        '#FFF8F4',
    },

    keyboardContainer: {
      flex: 1,
    },

    scrollContent: {
      flexGrow: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        16,

      paddingTop:
        24,

      paddingBottom:
        24,
    },

    loginCard: {
      maxWidth:
        500,

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        24,

      paddingHorizontal:
        22,

      paddingTop:
        26,

      paddingBottom:
        20,

      shadowColor:
        '#7D6B63',

      shadowOffset: {
        width: 0,

        height: 6,
      },

      shadowOpacity:
        0.14,

      shadowRadius:
        16,

      elevation:
        6,
    },

    logo: {
      width:
        150,

      height:
        150,

      alignSelf:
        'center',

      marginBottom:
        15,
    },

    title: {
      color:
        '#111111',

      fontSize:
        27,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    subtitle: {
      color:
        '#777777',

      fontSize:
        13,

      lineHeight:
        19,

      marginTop:
        6,

      marginBottom:
        27,

      textAlign:
        'center',
    },

    fieldGroup: {
      marginBottom:
        18,
    },

    label: {
      color:
        '#202020',

      fontSize:
        13,

      fontWeight:
        '600',

      marginBottom:
        8,
    },

    passwordLabelRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    forgotPasswordText: {
      color:
        '#A00B0F',

      fontSize:
        11,

      fontWeight:
        '700',

      marginBottom:
        8,
    },

    inputContainer: {
      width:
        '100%',

      minHeight:
        54,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#F2F2F2',

      borderRadius:
        13,

      paddingHorizontal:
        14,
    },

    inputIconImage: {
      width:
        20,

      height:
        20,

      marginRight:
        10,
    },

    input: {
      flex:
        1,

      minHeight:
        52,

      color:
        '#222222',

      fontSize:
        14,

      paddingVertical:
        0,
    },

    passwordEyeImage: {
      width:
        20,

      height:
        20,

      marginLeft:
        10,
    },

    loginButton: {
      width:
        '100%',

      minHeight:
        54,

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

      shadowColor:
        '#A00B0F',

      shadowOffset: {
        width:
          0,

        height:
          5,
      },

      shadowOpacity:
        0.28,

      shadowRadius:
        10,

      elevation:
        5,
    },

    loginButtonDisabled: {
      opacity:
        0.7,
    },

    loginButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        15,

      fontWeight:
        '800',
    },

    loginArrow: {
      color:
        '#FFFFFF',

      fontSize:
        20,

      fontWeight:
        '700',

      marginLeft:
        8,
    },

    loadingContainer: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    loadingText: {
      color:
        '#FFFFFF',

      fontSize:
        14,

      fontWeight:
        '700',

      marginLeft:
        10,
    },

    createAccountContainer: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      flexWrap:
        'wrap',

      marginTop:
        30,
    },

    accountText: {
      color:
        '#555555',

      fontSize:
        12,
    },

    createAccountText: {
      color:
        '#A00B0F',

      fontSize:
        12,

      fontWeight:
        '800',
    },

    guestButton: {
      minHeight:
        42,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginTop:
        16,

      borderWidth:
        1,

      borderColor:
        '#E3D4D0',

      borderRadius:
        11,

      backgroundColor:
        '#FFF9F6',
    },

    guestButtonText: {
      color:
        '#A00B0F',

      fontSize:
        11,

      fontWeight:
        '700',
    },

    footerContainer: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginTop:
        28,
    },

    footerText: {
      color:
        '#A0A0A0',

      fontSize:
        10,
    },

    footerSeparator: {
      width:
        1,

      height:
        11,

      backgroundColor:
        '#D0D0D0',

      marginHorizontal:
        10,
    },
  });