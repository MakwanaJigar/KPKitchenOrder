import React, { useMemo, useState } from 'react';

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
import axios from 'axios';

const RESET_PASSWORD_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/reset-password';

const ResetPassword = ({ navigation, route }) => {
  const { width, height } = useWindowDimensions();

  const email = route?.params?.email || '';
  const otp = route?.params?.otp || '';
  const resetToken = route?.params?.resetToken || '';

  const [formData, setFormData] = useState({
    password: '',
    passwordConfirmation: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const isSmallScreen = width <= 360;
  const isTablet = width >= 768;
  const isShortScreen = height <= 700;

  const containerWidth = isTablet ? 500 : width - 32;

  const updateField = (field, value) => {
    setFormData(previousData => ({
      ...previousData,
      [field]: value,
    }));
  };

  const passwordChecks = useMemo(() => {
    const password = formData.password;

    return {
      minimumLength: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      specialCharacter: /[^A-Za-z0-9]/.test(password),
    };
  }, [formData.password]);

  const passwordStrength = useMemo(() => {
    const completedChecks = Object.values(passwordChecks).filter(
      Boolean,
    ).length;

    if (!formData.password) {
      return {
        label: '',
        width: '0%',
      };
    }

    if (completedChecks <= 2) {
      return {
        label: 'Weak',
        width: '33%',
      };
    }

    if (completedChecks <= 4) {
      return {
        label: 'Medium',
        width: '66%',
      };
    }

    return {
      label: 'Strong',
      width: '100%',
    };
  }, [formData.password, passwordChecks]);

  const getApiErrorMessage = error => {
    if (!error?.response) {
      if (error?.code === 'ECONNABORTED') {
        return 'The request timed out. Please try again.';
      }

      return 'Unable to connect to the server. Please check your internet connection.';
    }

    const responseData = error.response.data;

    if (responseData?.errors) {
      const validationMessages = Object.values(
        responseData.errors,
      )
        .flat()
        .filter(Boolean);

      if (validationMessages.length > 0) {
        return validationMessages.join('\n');
      }
    }

    if (error.response.status === 401) {
      return (
        responseData?.message ||
        'Your password reset session is invalid or has expired.'
      );
    }

    if (error.response.status === 404) {
      return (
        responseData?.message ||
        'The password reset request was not found.'
      );
    }

    if (error.response.status === 422) {
      return (
        responseData?.message ||
        'Please check the password details and try again.'
      );
    }

    if (error.response.status === 429) {
      return (
        responseData?.message ||
        'Too many reset attempts. Please wait before trying again.'
      );
    }

    return (
      responseData?.message ||
      responseData?.error ||
      'Unable to reset your password. Please try again.'
    );
  };

  const validateForm = () => {
    const password = formData.password;
    const passwordConfirmation =
      formData.passwordConfirmation;

    if (!email.trim()) {
      Alert.alert(
        'Email Missing',
        'Your email address is missing. Please restart the forgot password process.',
      );

      return false;
    }

    if (!password) {
      Alert.alert(
        'Password Required',
        'Please enter your new password.',
      );

      return false;
    }

    if (password.length < 8) {
      Alert.alert(
        'Password Too Short',
        'Your password must contain at least 8 characters.',
      );

      return false;
    }

    if (!passwordChecks.uppercase) {
      Alert.alert(
        'Uppercase Letter Required',
        'Your password must contain at least one uppercase letter.',
      );

      return false;
    }

    if (!passwordChecks.lowercase) {
      Alert.alert(
        'Lowercase Letter Required',
        'Your password must contain at least one lowercase letter.',
      );

      return false;
    }

    if (!passwordChecks.number) {
      Alert.alert(
        'Number Required',
        'Your password must contain at least one number.',
      );

      return false;
    }

    if (!passwordChecks.specialCharacter) {
      Alert.alert(
        'Special Character Required',
        'Your password must contain at least one special character.',
      );

      return false;
    }

    if (!passwordConfirmation) {
      Alert.alert(
        'Confirmation Required',
        'Please confirm your new password.',
      );

      return false;
    }

    if (password !== passwordConfirmation) {
      Alert.alert(
        'Passwords Do Not Match',
        'The new password and confirmation password must match.',
      );

      return false;
    }

    return true;
  };

  const handleResetPassword = async () => {
    if (!validateForm()) {
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    const payload = {
      email: cleanEmail,
      password: formData.password,
      password_confirmation:
        formData.passwordConfirmation,
    };

    /*
     * Include the OTP when it was passed from VerifyOtp.
     */
    if (otp) {
      payload.otp = otp;
    }

    /*
     * Include the reset token when the backend returns one.
     */
    if (resetToken) {
      payload.reset_token = resetToken;
      payload.token = resetToken;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        RESET_PASSWORD_API_URL,
        payload,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      );

      if (
        response.data?.status === false ||
        response.data?.success === false
      ) {
        Alert.alert(
          'Reset Failed',
          response.data?.message ||
            'Unable to reset your password.',
        );

        return;
      }

      Alert.alert(
        'Password Updated',
        response.data?.message ||
          'Your password has been reset successfully. You can now sign in using your new password.',
        [
          {
            text: 'Sign In',
            onPress: () => {
              if (!navigation) {
                return;
              }

              navigation.reset({
                index: 0,
                routes: [
                  {
                    name: 'Login',
                  },
                ],
              });
            },
          },
        ],
        {
          cancelable: false,
        },
      );
    } catch (error) {
      console.log('Reset password error:', {
        message: error?.message,
        status: error?.response?.status,
        response: error?.response?.data,
      });

      const errorMessage = axios.isAxiosError(error)
        ? getApiErrorMessage(error)
        : 'An unexpected error occurred. Please try again.';

      Alert.alert('Reset Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (!loading) {
      navigation?.goBack();
    }
  };

  const handleGoToLogin = () => {
    if (!loading && navigation) {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'Login',
          },
        ],
      });
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFF8F4"
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={
          Platform.OS === 'ios' ? 'padding' : undefined
        }
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isShortScreen &&
              styles.scrollContentShort,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
            <Pressable
              disabled={loading}
              hitSlop={10}
              onPress={handleBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.backArrow}>‹</Text>

              <Text style={styles.backText}>Back</Text>
            </Pressable>

            <Image
              source={require('../assets/logo.png')}
              style={[
                styles.logo,
                isSmallScreen && styles.logoSmall,
                isShortScreen && styles.logoShort,
              ]}
              resizeMode="contain"
            />

            <View style={styles.lockIconCircle}>
              <View style={styles.lockIcon}>
                <View style={styles.lockTop} />

                <View style={styles.lockBody}>
                  <View style={styles.keyHoleTop} />

                  <View style={styles.keyHoleBottom} />
                </View>
              </View>
            </View>

            <Text
              style={[
                styles.title,
                isSmallScreen && styles.titleSmall,
              ]}
            >
              Create New Password
            </Text>

            <Text
              style={[
                styles.subtitle,
                isSmallScreen &&
                  styles.subtitleSmall,
              ]}
            >
              Create a strong password that you have not
              previously used for this account.
            </Text>

            {email ? (
              <View style={styles.emailContainer}>
                <Text style={styles.emailLabel}>
                  Resetting password for
                </Text>

                <Text
                  numberOfLines={1}
                  style={styles.emailText}
                >
                  {email}
                </Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                New Password
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  loading &&
                    styles.inputContainerDisabled,
                ]}
              >
                <Image
                  source={require('../assets/login-icons/unlock.png')}
                  style={styles.inputIconImage}
                  resizeMode="contain"
                />

                <TextInput
                  value={formData.password}
                  onChangeText={value =>
                    updateField('password', value)
                  }
                  placeholder="Enter your new password"
                  placeholderTextColor="#9B9B9B"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  editable={!loading}
                  style={styles.input}
                />

                <Pressable
                  disabled={loading}
                  hitSlop={10}
                  onPress={() =>
                    setShowPassword(
                      previousValue => !previousValue,
                    )
                  }
                >
                  <Image
                    source={
                      showPassword
                        ? require('../assets/login-icons/eye.png')
                        : require('../assets/login-icons/close-eye.png')
                    }
                    style={styles.passwordEyeImage}
                    resizeMode="contain"
                  />
                </Pressable>
              </View>

              {formData.password ? (
                <View style={styles.strengthSection}>
                  <View style={styles.strengthHeader}>
                    <Text style={styles.strengthLabel}>
                      Password strength
                    </Text>

                    <Text
                      style={[
                        styles.strengthText,
                        passwordStrength.label ===
                          'Strong' &&
                          styles.strongText,
                        passwordStrength.label ===
                          'Medium' &&
                          styles.mediumText,
                        passwordStrength.label ===
                          'Weak' &&
                          styles.weakText,
                      ]}
                    >
                      {passwordStrength.label}
                    </Text>
                  </View>

                  <View style={styles.strengthTrack}>
                    <View
                      style={[
                        styles.strengthProgress,
                        {
                          width:
                            passwordStrength.width,
                        },
                        passwordStrength.label ===
                          'Strong' &&
                          styles.strongProgress,
                        passwordStrength.label ===
                          'Medium' &&
                          styles.mediumProgress,
                        passwordStrength.label ===
                          'Weak' &&
                          styles.weakProgress,
                      ]}
                    />
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Confirm New Password
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  loading &&
                    styles.inputContainerDisabled,
                ]}
              >
                <Image
                  source={require('../assets/login-icons/unlock.png')}
                  style={styles.inputIconImage}
                  resizeMode="contain"
                />

                <TextInput
                  value={formData.passwordConfirmation}
                  onChangeText={value =>
                    updateField(
                      'passwordConfirmation',
                      value,
                    )
                  }
                  placeholder="Confirm your new password"
                  placeholderTextColor="#9B9B9B"
                  secureTextEntry={
                    !showPasswordConfirmation
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={handleResetPassword}
                  editable={!loading}
                  style={styles.input}
                />

                <Pressable
                  disabled={loading}
                  hitSlop={10}
                  onPress={() =>
                    setShowPasswordConfirmation(
                      previousValue => !previousValue,
                    )
                  }
                >
                  <Image
                    source={
                      showPasswordConfirmation
                        ? require('../assets/login-icons/eye.png')
                        : require('../assets/login-icons/close-eye.png')
                    }
                    style={styles.passwordEyeImage}
                    resizeMode="contain"
                  />
                </Pressable>
              </View>

              {formData.passwordConfirmation ? (
                <Text
                  style={[
                    styles.passwordMatchText,
                    formData.password ===
                    formData.passwordConfirmation
                      ? styles.passwordMatchedText
                      : styles.passwordNotMatchedText,
                  ]}
                >
                  {formData.password ===
                  formData.passwordConfirmation
                    ? '✓ Passwords match'
                    : 'Passwords do not match'}
                </Text>
              ) : null}
            </View>

            <View style={styles.requirementsCard}>
              <Text style={styles.requirementsTitle}>
                Your password must contain:
              </Text>

              <PasswordRequirement
                completed={
                  passwordChecks.minimumLength
                }
                label="At least 8 characters"
              />

              <PasswordRequirement
                completed={passwordChecks.uppercase}
                label="At least one uppercase letter"
              />

              <PasswordRequirement
                completed={passwordChecks.lowercase}
                label="At least one lowercase letter"
              />

              <PasswordRequirement
                completed={passwordChecks.number}
                label="At least one number"
              />

              <PasswordRequirement
                completed={
                  passwordChecks.specialCharacter
                }
                label="At least one special character"
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={loading}
              style={[
                styles.resetButton,
                loading &&
                  styles.resetButtonDisabled,
              ]}
              onPress={handleResetPassword}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />

                  <Text style={styles.loadingText}>
                    Updating Password...
                  </Text>
                </View>
              ) : (
                <>
                  <Text
                    style={styles.resetButtonText}
                  >
                    Reset Password
                  </Text>

                  <Text style={styles.resetArrow}>
                    →
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginQuestion}>
                Remember your password?{' '}
              </Text>

              <Pressable
                disabled={loading}
                hitSlop={8}
                onPress={handleGoToLogin}
              >
                <Text style={styles.loginText}>
                  Sign In
                </Text>
              </Pressable>
            </View>

            <View style={styles.securityCard}>
              <View style={styles.securityIconCircle}>
                <Text style={styles.securityIcon}>
                  ✓
                </Text>
              </View>

              <Text style={styles.securityText}>
                Your new password is securely encrypted and
                cannot be viewed by anyone.
              </Text>
            </View>

            <View style={styles.footerContainer}>
              <Pressable disabled={loading}>
                <Text style={styles.footerText}>
                  Privacy Policy
                </Text>
              </Pressable>

              <View style={styles.footerSeparator} />

              <Pressable disabled={loading}>
                <Text style={styles.footerText}>
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

const PasswordRequirement = ({
  completed,
  label,
}) => (
  <View style={styles.requirementRow}>
    <View
      style={[
        styles.requirementIcon,
        completed &&
          styles.requirementIconCompleted,
      ]}
    >
      <Text
        style={[
          styles.requirementIconText,
          completed &&
            styles.requirementIconTextCompleted,
        ]}
      >
        {completed ? '✓' : '•'}
      </Text>
    </View>

    <Text
      style={[
        styles.requirementText,
        completed &&
          styles.requirementTextCompleted,
      ]}
    >
      {label}
    </Text>
  </View>
);

export default ResetPassword;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF8F4',
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },

  scrollContentShort: {
    justifyContent: 'flex-start',
    paddingTop: 16,
  },

  card: {
    maxWidth: 500,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',

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
    paddingHorizontal: 16,
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
    width: 110,
    height: 110,
    alignSelf: 'center',
    marginTop: -5,
    marginBottom: 5,
  },

  logoSmall: {
    width: 95,
    height: 95,
  },

  logoShort: {
    width: 80,
    height: 80,
    marginBottom: 2,
  },

  lockIconCircle: {
    width: 64,
    height: 64,
    alignSelf: 'center',
    marginBottom: 16,
    borderRadius: 32,
    backgroundColor: '#FFF1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  lockIcon: {
    width: 31,
    height: 35,
    alignItems: 'center',
  },

  lockTop: {
    width: 19,
    height: 16,
    borderWidth: 3,
    borderColor: '#A00B0F',
    borderBottomWidth: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },

  lockBody: {
    position: 'relative',
    width: 30,
    height: 23,
    marginTop: -1,
    borderRadius: 5,
    backgroundColor: '#A00B0F',
    alignItems: 'center',
    justifyContent: 'center',
  },

  keyHoleTop: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },

  keyHoleBottom: {
    width: 3,
    height: 7,
    marginTop: -1,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },

  title: {
    color: '#111111',
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'center',
  },

  titleSmall: {
    fontSize: 23,
  },

  subtitle: {
    maxWidth: 400,
    alignSelf: 'center',
    marginTop: 7,
    marginBottom: 18,
    color: '#777777',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  subtitleSmall: {
    fontSize: 12,
    lineHeight: 18,
  },

  emailContainer: {
    width: '100%',
    marginBottom: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0D6D4',
    borderRadius: 11,
    backgroundColor: '#FFF8F7',
    alignItems: 'center',
  },

  emailLabel: {
    color: '#85706F',
    fontSize: 9.5,
  },

  emailText: {
    maxWidth: '100%',
    marginTop: 3,
    color: '#A00B0F',
    fontSize: 12,
    fontWeight: '800',
  },

  fieldGroup: {
    width: '100%',
    marginBottom: 18,
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

  passwordEyeImage: {
    width: 20,
    height: 20,
    marginLeft: 10,
  },

  strengthSection: {
    marginTop: 10,
  },

  strengthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  strengthLabel: {
    color: '#777777',
    fontSize: 9.5,
  },

  strengthText: {
    fontSize: 9.5,
    fontWeight: '800',
  },

  weakText: {
    color: '#D14343',
  },

  mediumText: {
    color: '#C27B00',
  },

  strongText: {
    color: '#278A4D',
  },

  strengthTrack: {
    width: '100%',
    height: 5,
    marginTop: 6,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: '#E5E5E5',
  },

  strengthProgress: {
    height: '100%',
    borderRadius: 3,
  },

  weakProgress: {
    backgroundColor: '#D14343',
  },

  mediumProgress: {
    backgroundColor: '#D89520',
  },

  strongProgress: {
    backgroundColor: '#278A4D',
  },

  passwordMatchText: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '700',
  },

  passwordMatchedText: {
    color: '#278A4D',
  },

  passwordNotMatchedText: {
    color: '#D14343',
  },

  requirementsCard: {
    width: '100%',
    marginBottom: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
  },

  requirementsTitle: {
    marginBottom: 9,
    color: '#303030',
    fontSize: 11,
    fontWeight: '800',
  },

  requirementRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },

  requirementIcon: {
    width: 17,
    height: 17,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#C6C6C6',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  requirementIconCompleted: {
    borderColor: '#278A4D',
    backgroundColor: '#278A4D',
  },

  requirementIconText: {
    marginTop: -1,
    color: '#9B9B9B',
    fontSize: 11,
    fontWeight: '800',
  },

  requirementIconTextCompleted: {
    color: '#FFFFFF',
    fontSize: 9,
  },

  requirementText: {
    flex: 1,
    color: '#777777',
    fontSize: 10.5,
    lineHeight: 15,
  },

  requirementTextCompleted: {
    color: '#278A4D',
  },

  resetButton: {
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

  resetButtonDisabled: {
    opacity: 0.7,
  },

  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  resetArrow: {
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
    marginTop: 26,
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

  securityCard: {
    width: '100%',
    marginTop: 23,
    padding: 13,
    borderWidth: 1,
    borderColor: '#D8ECDD',
    borderRadius: 12,
    backgroundColor: '#F4FBF6',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  securityIconCircle: {
    width: 24,
    height: 24,
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: '#278A4D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  securityIcon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  securityText: {
    flex: 1,
    color: '#52705B',
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

