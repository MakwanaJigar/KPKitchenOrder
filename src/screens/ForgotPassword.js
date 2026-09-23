import React, { useState } from 'react';

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

import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import axios from 'axios';

/* =========================================================
 * API
 * ========================================================= */

const FORGOT_PASSWORD_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/forget-password';

/* =========================================================
 * RESET PASSWORD STORAGE
 * ========================================================= */

const RESET_EMAIL_STORAGE_KEY = 'kp_reset_password_email';

const RESET_OTP_STORAGE_KEY = 'kp_reset_password_otp';

const RESET_TOKEN_STORAGE_KEY = 'kp_reset_password_token';

/* =========================================================
 * FORGOT PASSWORD
 * ========================================================= */

const ForgotPassword = ({ navigation }) => {
  const { width, height } = useWindowDimensions();

  /* =======================================================
   * STATE
   * ======================================================= */

  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(false);

  /* =======================================================
   * RESPONSIVE
   * ======================================================= */

  const isSmallScreen = width <= 360;

  const isTablet = width >= 768;

  const isShortScreen = height <= 700;

  const containerWidth = isTablet ? 500 : width - 32;

  /* =======================================================
   * EMAIL VALIDATION
   * ======================================================= */

  const validateEmail = emailValue => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailPattern.test(emailValue.trim());
  };

  /* =======================================================
   * API ERROR
   * ======================================================= */

  const getApiErrorMessage = error => {
    if (!error?.response) {
      if (error?.code === 'ECONNABORTED') {
        return 'The request timed out. Please try again.';
      }

      return 'Unable to connect to the server. Please check your internet connection.';
    }

    const responseData = error.response.data;

    if (responseData?.errors) {
      const validationMessages = Object.values(responseData.errors)
        .flat()
        .filter(Boolean);

      if (validationMessages.length > 0) {
        return validationMessages.join('\n');
      }
    }

    if (error.response.status === 404) {
      return (
        responseData?.message ||
        'No customer account was found with this email address.'
      );
    }

    if (error.response.status === 422) {
      return (
        responseData?.message ||
        'Please enter a valid registered email address.'
      );
    }

    if (error.response.status === 429) {
      return (
        responseData?.message ||
        'Too many reset requests. Please wait before trying again.'
      );
    }

    return (
      responseData?.message ||
      responseData?.error ||
      'Unable to send the verification code. Please try again.'
    );
  };

  /* =======================================================
   * CLEAR OLD RESET SESSION
   * ======================================================= */

  const clearOldResetSession = async () => {
    try {
      await AsyncStorage.multiRemove([
        RESET_OTP_STORAGE_KEY,
        RESET_TOKEN_STORAGE_KEY,
      ]);
    } catch (error) {
      console.log('CLEAR OLD RESET SESSION ERROR:', error);
    }
  };

  /* =======================================================
   * SEND CODE
   * ======================================================= */

  const handleSendCode = async () => {
    /*
     * Prevent multiple requests
     */
    if (loading) {
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    /* =============================================
     * VALIDATE
     * ============================================= */

    if (!cleanEmail) {
      Alert.alert(
        'Email Required',

        'Please enter your registered email address.',
      );

      return;
    }

    if (!validateEmail(cleanEmail)) {
      Alert.alert(
        'Invalid Email',

        'Please enter a valid email address.',
      );

      return;
    }

    try {
      setLoading(true);

      /* =============================================
       * Remove stale OTP/token from previous reset
       * ============================================= */

      await clearOldResetSession();

      /* =============================================
       * API
       * ============================================= */

      console.log('=====================================');

      console.log('FORGOT PASSWORD API');

      console.log('EMAIL:', cleanEmail);

      console.log('=====================================');

      const response = await axios.post(
        FORGOT_PASSWORD_API_URL,

        {
          email: cleanEmail,
        },

        {
          headers: {
            Accept: 'application/json',

            'Content-Type': 'application/json',
          },

          timeout: 20000,
        },
      );

      console.log('FORGOT PASSWORD STATUS:', response.status);

      console.log(
        'FORGOT PASSWORD RESPONSE:',
        JSON.stringify(response.data, null, 2),
      );

      /* =============================================
       * API returned logical failure
       * ============================================= */

      if (response.data?.status === false || response.data?.success === false) {
        Alert.alert(
          'Request Failed',

          response.data?.message || 'Unable to send the verification code.',
        );

        return;
      }

      /* =============================================
       * Store email
       * ============================================= */

      await AsyncStorage.setItem(RESET_EMAIL_STORAGE_KEY, cleanEmail);

      console.log('RESET EMAIL STORED:', cleanEmail);

      const successMessage =
        response.data?.message ||
        'A verification code has been sent to your email address.';

      Alert.alert(
        'Code Sent',

        successMessage,

        [
          {
            text: 'Continue',

            onPress: () => {
              if (!navigation) {
                return;
              }

              navigation.navigate('Otp', {
                email: cleanEmail,
              });
            },
          },
        ],

        {
          cancelable: false,
        },
      );
    } catch (error) {
      console.log('Forgot password error:', {
        message: error?.message,

        status: error?.response?.status,

        response: error?.response?.data,
      });

      const errorMessage = axios.isAxiosError(error)
        ? getApiErrorMessage(error)
        : 'An unexpected error occurred. Please try again.';

      Alert.alert(
        'Request Failed',

        errorMessage,
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
   * BACK
   * ======================================================= */

  const handleBackToLogin = () => {
    if (navigation && !loading) {
      navigation.goBack();
    }
  };

  /* =======================================================
   * UI
   * ======================================================= */

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F4" />

      {/* ==================================================
          KEYBOARD AVOIDING VIEW
          ================================================== */}

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,

            isShortScreen && styles.scrollContentShort,
          ]}
          showsVerticalScrollIndicator={false}
          /*
           * Keep controls clickable
           * while keyboard is open.
           */
          keyboardShouldPersistTaps="handled"
          /*
           * IMPORTANT:
           * Scrolling will NOT
           * automatically dismiss
           * the keyboard.
           */
          keyboardDismissMode="none"
          /*
           * User can manually scroll
           * while typing.
           */
          scrollEnabled={true}
          /*
           * Better Android scrolling.
           */
          nestedScrollEnabled={true}
          bounces={false}
          overScrollMode="never"
        >
          <View
            style={[
              styles.card,

              {
                width: containerWidth,
              },

              isSmallScreen && styles.cardSmall,

              isShortScreen && styles.cardShort,
            ]}
          >
            {/* ================================================= */}
            {/* BACK */}
            {/* ================================================= */}

            <Pressable
              disabled={loading}
              hitSlop={10}
              onPress={handleBackToLogin}
              style={({ pressed }) => [
                styles.backButton,

                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back to login"
            >
              <Text style={styles.backArrow}>‹</Text>

              <Text style={styles.backText}>Back</Text>
            </Pressable>

            {/* ================================================= */}
            {/* LOGO */}
            {/* ================================================= */}

            <Image
              source={require('../assets/logo.png')}
              style={[
                styles.logo,

                isSmallScreen && styles.logoSmall,

                isShortScreen && styles.logoShort,
              ]}
              resizeMode="contain"
            />

            {/* ================================================= */}
            {/* ICON */}
            {/* ================================================= */}

            <View style={styles.iconCircle}>
              <Image
                source={require('../assets/login-icons/mail.png')}
                style={styles.mainIcon}
                resizeMode="contain"
              />
            </View>

            {/* ================================================= */}
            {/* TITLE */}
            {/* ================================================= */}

            <Text style={[styles.title, isSmallScreen && styles.titleSmall]}>
              Forgot Password?
            </Text>

            <Text
              style={[styles.subtitle, isSmallScreen && styles.subtitleSmall]}
            >
              Enter your registered email address and we will send you a
              verification code to reset your password.
            </Text>

            {/* ================================================= */}
            {/* EMAIL */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>

              <View
                style={[
                  styles.inputContainer,

                  loading && styles.inputContainerDisabled,
                ]}
              >
                <Image
                  source={require('../assets/login-icons/mail.png')}
                  style={styles.inputIconImage}
                  resizeMode="contain"
                />

                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor="#9B9B9B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  /*
                   * Send button on keyboard
                   * submits the request.
                   */
                  returnKeyType="send"
                  onSubmitEditing={handleSendCode}
                  editable={!loading}
                  style={styles.input}
                />
              </View>
            </View>

            {/* ================================================= */}
            {/* SEND BUTTON */}
            {/* ================================================= */}

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={loading}
              style={[
                styles.submitButton,

                loading && styles.submitButtonDisabled,
              ]}
              onPress={handleSendCode}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FFFFFF" />

                  <Text style={styles.loadingText}>Sending Code...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.submitButtonText}>
                    Send Verification Code
                  </Text>

                  <Text style={styles.submitArrow}>→</Text>
                </>
              )}
            </TouchableOpacity>

            {/* ================================================= */}
            {/* SIGN IN */}
            {/* ================================================= */}

            <View style={styles.loginContainer}>
              <Text style={styles.loginQuestion}>Remember your password? </Text>

              <Pressable
                disabled={loading}
                hitSlop={8}
                onPress={handleBackToLogin}
              >
                <Text style={styles.loginText}>Sign In</Text>
              </Pressable>
            </View>

            {/* ================================================= */}
            {/* HELP */}
            {/* ================================================= */}

            <View style={styles.helpCard}>
              <View style={styles.helpIconCircle}>
                <Text style={styles.helpIcon}>i</Text>
              </View>

              <Text style={styles.helpText}>
                Check your spam or junk folder if you do not receive the
                verification email within a few minutes.
              </Text>
            </View>

            {/* ================================================= */}
            {/* FOOTER */}
            {/* ================================================= */}

            <View style={styles.footerContainer}>
              <Pressable disabled={loading}>
                <Text style={styles.footerText}>Privacy Policy</Text>
              </Pressable>

              <View style={styles.footerSeparator} />

              <Pressable disabled={loading}>
                <Text style={styles.footerText}>Terms of Service</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ForgotPassword;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles = StyleSheet.create({
  screen: {
    flex: 1,

    backgroundColor: '#FFF8F4',
  },

  keyboardContainer: {
    flex: 1,
  },

  /*
   * IMPORTANT:
   * ScrollView takes the complete
   * available height.
   */
  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 16,

    paddingTop: 24,

    /*
     * Increased from 24.
     *
     * This gives the user enough
     * empty space to scroll the
     * form above the keyboard.
     */
    paddingBottom: 120,
  },

  scrollContentShort: {
    justifyContent: 'flex-start',

    paddingTop: 16,
  },

  card: {
    maxWidth: 500,

    backgroundColor: '#FFFFFF',

    borderRadius: 24,

    paddingHorizontal: 22,

    paddingTop: 18,

    paddingBottom: 20,

    shadowColor: '#7D6B63',

    shadowOffset: {
      width: 0,

      height: 6,
    },

    shadowOpacity: 0.14,

    shadowRadius: 16,

    elevation: 6,
  },

  cardSmall: {
    paddingHorizontal: 17,

    borderRadius: 20,
  },

  cardShort: {
    paddingTop: 14,

    paddingBottom: 17,
  },

  pressed: {
    opacity: 0.65,
  },

  backButton: {
    alignSelf: 'flex-start',

    minHeight: 38,

    paddingRight: 12,

    flexDirection: 'row',

    alignItems: 'center',
  },

  backArrow: {
    marginTop: -3,

    color: '#A00B0F',

    fontSize: 32,

    lineHeight: 34,

    fontWeight: '400',
  },

  backText: {
    marginLeft: 3,

    color: '#A00B0F',

    fontSize: 12,

    fontWeight: '700',
  },

  logo: {
    width: 120,

    height: 120,

    alignSelf: 'center',

    marginTop: -5,

    marginBottom: 7,
  },

  logoSmall: {
    width: 105,

    height: 105,
  },

  logoShort: {
    width: 90,

    height: 90,

    marginBottom: 4,
  },

  iconCircle: {
    width: 62,

    height: 62,

    alignSelf: 'center',

    marginBottom: 16,

    borderRadius: 31,

    backgroundColor: '#FFF1F1',

    alignItems: 'center',

    justifyContent: 'center',
  },

  mainIcon: {
    width: 28,

    height: 28,

    tintColor: '#A00B0F',
  },

  title: {
    color: '#111111',

    fontSize: 27,

    fontWeight: '800',

    textAlign: 'center',
  },

  titleSmall: {
    fontSize: 24,
  },

  subtitle: {
    maxWidth: 390,

    alignSelf: 'center',

    marginTop: 7,

    marginBottom: 27,

    color: '#777777',

    fontSize: 13,

    lineHeight: 20,

    textAlign: 'center',
  },

  subtitleSmall: {
    fontSize: 12,

    lineHeight: 18,

    marginBottom: 23,
  },

  fieldGroup: {
    width: '100%',

    marginBottom: 22,
  },

  label: {
    marginBottom: 8,

    color: '#202020',

    fontSize: 13,

    fontWeight: '600',
  },

  inputContainer: {
    width: '100%',

    minHeight: 54,

    paddingHorizontal: 14,

    borderWidth: 1,

    borderColor: 'transparent',

    borderRadius: 13,

    backgroundColor: '#F2F2F2',

    flexDirection: 'row',

    alignItems: 'center',
  },

  inputContainerDisabled: {
    opacity: 0.7,
  },

  inputIconImage: {
    width: 20,

    height: 20,

    marginRight: 10,
  },

  input: {
    flex: 1,

    minHeight: 52,

    paddingVertical: 0,

    color: '#222222',

    fontSize: 14,
  },

  submitButton: {
    width: '100%',

    minHeight: 54,

    paddingHorizontal: 14,

    borderRadius: 13,

    backgroundColor: '#A00B0F',

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    shadowColor: '#A00B0F',

    shadowOffset: {
      width: 0,

      height: 5,
    },

    shadowOpacity: 0.28,

    shadowRadius: 10,

    elevation: 5,
  },

  submitButtonDisabled: {
    opacity: 0.7,
  },

  submitButtonText: {
    color: '#FFFFFF',

    fontSize: 14,

    fontWeight: '800',

    textAlign: 'center',
  },

  submitArrow: {
    marginLeft: 8,

    color: '#FFFFFF',

    fontSize: 20,

    fontWeight: '700',
  },

  loadingContainer: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',
  },

  loadingText: {
    marginLeft: 10,

    color: '#FFFFFF',

    fontSize: 14,

    fontWeight: '700',
  },

  loginContainer: {
    marginTop: 27,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    flexWrap: 'wrap',
  },

  loginQuestion: {
    color: '#555555',

    fontSize: 12,
  },

  loginText: {
    color: '#A00B0F',

    fontSize: 12,

    fontWeight: '800',
  },

  helpCard: {
    width: '100%',

    marginTop: 24,

    padding: 13,

    borderWidth: 1,

    borderColor: '#F0D6D4',

    borderRadius: 12,

    backgroundColor: '#FFF8F7',

    flexDirection: 'row',

    alignItems: 'flex-start',
  },

  helpIconCircle: {
    width: 24,

    height: 24,

    marginRight: 10,

    borderRadius: 12,

    backgroundColor: '#A00B0F',

    alignItems: 'center',

    justifyContent: 'center',
  },

  helpIcon: {
    color: '#FFFFFF',

    fontSize: 13,

    fontWeight: '800',
  },

  helpText: {
    flex: 1,

    color: '#765E5D',

    fontSize: 10.5,

    lineHeight: 16,
  },

  footerContainer: {
    marginTop: 26,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',
  },

  footerText: {
    color: '#A0A0A0',

    fontSize: 10,
  },

  footerSeparator: {
    width: 1,

    height: 11,

    marginHorizontal: 10,

    backgroundColor: '#D0D0D0',
  },
});
