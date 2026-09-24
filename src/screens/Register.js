import React, { useRef, useState } from 'react';

import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import AppAlert from '../components/AppAlert';

import { SafeAreaView } from 'react-native-safe-area-context';

import axios from 'axios';

/* =========================================================
 * CUSTOMER REGISTRATION API
 * ========================================================= */

const REGISTER_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/register';

/* =========================================================
 * REGISTER COMPONENT
 * ========================================================= */

const Register = ({ navigation }) => {
  const { width } = useWindowDimensions();

  /* =======================================================
   * FORM
   * ======================================================= */

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    street_address: '',
    city: '',
    pincode: '',
    password: '',
    password_confirmation: '',
  });

  /* =======================================================
   * PASSWORD VISIBILITY
   * ======================================================= */

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /* =======================================================
   * LOADING
   * ======================================================= */

  const [loading, setLoading] = useState(false);

  /* =======================================================
   * INPUT REFS
   * ======================================================= */

  const emailInputRef = useRef(null);

  const phoneInputRef = useRef(null);

  const streetAddressInputRef = useRef(null);

  const cityInputRef = useRef(null);

  const pincodeInputRef = useRef(null);

  const passwordInputRef = useRef(null);

  const confirmPasswordInputRef = useRef(null);

  /* =======================================================
   * RESPONSIVE WIDTH
   * ======================================================= */

  const formWidth = width >= 768 ? 520 : width - 32;

  /* =======================================================
   * UPDATE FIELD
   * ======================================================= */

  const updateField = (field, value) => {
    setFormData(previousData => ({
      ...previousData,

      [field]: value,
    }));
  };

  /* =======================================================
   * API ERROR MESSAGE
   * ======================================================= */

  const getApiErrorMessage = error => {
    if (!error.response) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }

    const responseData = error.response?.data;

    /*
     * Laravel validation errors
     */
    if (responseData?.errors) {
      const messages = [];

      Object.keys(responseData.errors).forEach(field => {
        const fieldErrors = responseData.errors[field];

        if (Array.isArray(fieldErrors)) {
          fieldErrors.forEach(message => {
            if (message) {
              messages.push(message);
            }
          });
        } else if (fieldErrors) {
          messages.push(String(fieldErrors));
        }
      });

      if (messages.length > 0) {
        return messages.join('\n');
      }
    }

    if (responseData?.message) {
      return responseData.message;
    }

    if (responseData?.error) {
      return responseData.error;
    }

    return `Registration failed. Server returned status ${
      error.response?.status || 'unknown'
    }.`;
  };

  /* =======================================================
   * REGISTER
   * ======================================================= */

  const handleRegister = async () => {
    /*
     * Prevent multiple requests
     */
    if (loading) {
      return;
    }

    const {
      name,
      email,
      phone,
      street_address,
      city,
      pincode,
      password,
      password_confirmation,
    } = formData;

    /* ===================================================
     * REQUIRED FIELDS
     * =================================================== */

    if (
      !name?.trim() ||
      !email?.trim() ||
      !phone?.trim() ||
      !street_address?.trim() ||
      !city?.trim() ||
      !pincode?.trim() ||
      !password ||
      !password_confirmation
    ) {
      AppAlert.alert(
        'Required Fields',

        'Please fill in all the registration fields.',
      );

      return;
    }

    /* ===================================================
     * NAME
     * =================================================== */

    if (name.trim().length < 2) {
      AppAlert.alert(
        'Invalid Name',

        'Please enter a valid full name.',
      );

      return;
    }

    /* ===================================================
     * EMAIL
     * =================================================== */

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email.trim())) {
      AppAlert.alert(
        'Invalid Email',

        'Please enter a valid email address.',
      );

      return;
    }

    /* ===================================================
     * PHONE
     * =================================================== */

    const cleanPhone = phone.replace(/\s+/g, '');

    if (cleanPhone.length < 8) {
      AppAlert.alert(
        'Invalid Mobile Number',

        'Please enter a valid mobile number.',
      );

      return;
    }

    /* ===================================================
     * CITY
     * =================================================== */

    if (city.trim().length < 2) {
      AppAlert.alert(
        'Invalid City',

        'Please enter a valid city.',
      );

      return;
    }

    /* ===================================================
     * PINCODE
     * =================================================== */

    const cleanPincode = pincode.trim().replace(/\s+/g, '');

    if (cleanPincode.length < 3) {
      AppAlert.alert(
        'Invalid Pincode',

        'Please enter a valid pincode.',
      );

      return;
    }

    /* ===================================================
     * PASSWORD
     * =================================================== */

    if (password.length < 8) {
      AppAlert.alert(
        'Invalid Password',

        'Password must contain at least 8 characters.',
      );

      return;
    }

    /* ===================================================
     * PASSWORD CONFIRMATION
     * =================================================== */

    if (password !== password_confirmation) {
      AppAlert.alert(
        'Password Mismatch',

        'Password and confirm password do not match.',
      );

      return;
    }

    /* ===================================================
     * PAYLOAD
     * =================================================== */

    const payload = {
      name: name.trim(),

      email: email.trim().toLowerCase(),

      phone: phone.trim(),

      password,

      street_address: street_address.trim(),

      city: city.trim(),

      pincode: pincode.trim(),
    };

    console.log('======================================');

    console.log('CUSTOMER REGISTER');

    console.log('REGISTER URL:', REGISTER_API_URL);

    console.log('REGISTER PAYLOAD:');

    console.log({
      ...payload,

      password: '********',
    });

    console.log('======================================');

    /* ===================================================
     * API REQUEST
     * =================================================== */

    try {
      setLoading(true);

      const response = await axios.post(
        REGISTER_API_URL,

        payload,

        {
          headers: {
            Accept: 'application/json',

            'Content-Type': 'application/json',
          },

          timeout: 20000,
        },
      );

      console.log('======================================');

      console.log('REGISTER SUCCESS');

      console.log('STATUS:', response.status);

      console.log('RESPONSE DATA:');

      console.log(JSON.stringify(response.data, null, 2));

      console.log('======================================');

      AppAlert.alert(
        'Registration Successful',

        response.data?.message || 'Your account has been created successfully.',

        [
          {
            text: 'Continue',

            onPress: () => {
              navigation.replace('Login');
            },
          },
        ],
      );
    } catch (error) {
      console.log('======================================');

      console.log('REGISTER FAILED');

      console.log('ERROR MESSAGE:', error.message);

      console.log('STATUS:', error.response?.status);

      console.log('SERVER RESPONSE:');

      console.log(JSON.stringify(error.response?.data, null, 2));

      console.log('======================================');

      if (!error.response) {
        AppAlert.alert(
          'Connection Error',

          'Unable to connect to the server. Please check your internet connection.',
        );

        return;
      }

      const message = getApiErrorMessage(error);

      AppAlert.alert(
        'Registration Failed',

        message,
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
   * LOGIN
   * ======================================================= */

  const handleLogin = () => {
    if (navigation && !loading) {
      navigation.navigate('Login');
    }
  };

  /* =======================================================
   * UI
   * ======================================================= */

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top', 'left', 'right', 'bottom']}
    >
      {/* ==================================================
          KEYBOARD AVOIDING VIEW
          ================================================== */}

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ================================================
            SCROLL VIEW
            ================================================ */}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          /*
           * IMPORTANT:
           *
           * Allows inputs/buttons to work
           * while keyboard is visible.
           */
          keyboardShouldPersistTaps="handled"
          /*
           * Scrolling will NOT close
           * keyboard automatically.
           */
          keyboardDismissMode="none"
          /*
           * User can scroll while
           * typing.
           */
          scrollEnabled={true}
          /*
           * Better Android support.
           */
          nestedScrollEnabled={true}
          bounces={false}
          overScrollMode="never"
        >
          <View
            style={[
              styles.formContainer,

              {
                width: formWidth,
              },
            ]}
          >
            {/* ================================================= */}
            {/* LOGO */}
            {/* ================================================= */}

            <Image
              source={require('../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* ================================================= */}
            {/* HEADING */}
            {/* ================================================= */}

            <Text style={styles.title}>Create Account</Text>

            <Text style={styles.subtitle}>
              Complete your profile to start your meal journey.
            </Text>

            {/* ================================================= */}
            {/* FULL NAME */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Full Name <Text style={styles.requiredStar}>*</Text>
              </Text>

              <View style={styles.inputContainer}>
                <Image
                  source={require('../assets/login-icons/user-1.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  value={formData.name}
                  onChangeText={value => updateField('name', value)}
                  placeholder="Jane Doe"
                  placeholderTextColor="#9B9B9B"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  /*
                   * Do not close keyboard
                   * when pressing Next.
                   */
                  blurOnSubmit={false}
                  /*
                   * Next:
                   * Full Name → Email
                   */
                  onSubmitEditing={() => {
                    emailInputRef.current?.focus();
                  }}
                  editable={!loading}
                  style={styles.input}
                />
              </View>
            </View>

            {/* ================================================= */}
            {/* EMAIL */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Email Address <Text style={styles.requiredStar}>*</Text>
              </Text>

              <View style={styles.inputContainer}>
                <Image
                  source={require('../assets/login-icons/mail.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  ref={emailInputRef}
                  value={formData.email}
                  onChangeText={value => updateField('email', value)}
                  placeholder="jane.doe@example.com"
                  placeholderTextColor="#9B9B9B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    phoneInputRef.current?.focus();
                  }}
                  editable={!loading}
                  style={styles.input}
                />
              </View>
            </View>

            {/* ================================================= */}
            {/* PHONE */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Mobile Number <Text style={styles.requiredStar}>*</Text>
              </Text>

              <View style={styles.inputContainer}>
                <Image
                  source={require('../assets/login-icons/phone-call.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  ref={phoneInputRef}
                  value={formData.phone}
                  onChangeText={value => updateField('phone', value)}
                  placeholder="+61 400 123 456"
                  placeholderTextColor="#9B9B9B"
                  keyboardType="phone-pad"
                  autoCorrect={false}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    streetAddressInputRef.current?.focus();
                  }}
                  editable={!loading}
                  style={styles.input}
                />
              </View>
            </View>

            {/* ================================================= */}
            {/* STREET ADDRESS */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Street Address <Text style={styles.requiredStar}>*</Text>
              </Text>

              <View style={styles.inputContainer}>
                <Image
                  source={require('../assets/login-icons/location.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  ref={streetAddressInputRef}
                  value={formData.street_address}
                  onChangeText={value => updateField('street_address', value)}
                  placeholder="Suite 4B, 100 Queen St"
                  placeholderTextColor="#9B9B9B"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    cityInputRef.current?.focus();
                  }}
                  editable={!loading}
                  style={styles.input}
                />
              </View>
            </View>

            {/* ================================================= */}
            {/* CITY */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                City <Text style={styles.requiredStar}>*</Text>
              </Text>

              <View style={styles.inputContainer}>
                <Image
                  source={require('../assets/login-icons/home.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  ref={cityInputRef}
                  value={formData.city}
                  onChangeText={value => updateField('city', value)}
                  placeholder="Melbourne"
                  placeholderTextColor="#9B9B9B"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    pincodeInputRef.current?.focus();
                  }}
                  editable={!loading}
                  style={styles.input}
                />
              </View>
            </View>

            {/* ================================================= */}
            {/* PINCODE */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Pincode <Text style={styles.requiredStar}>*</Text>
              </Text>

              <View style={styles.inputContainer}>
                <Image
                  source={require('../assets/login-icons/residential-area.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  ref={pincodeInputRef}
                  value={formData.pincode}
                  onChangeText={value => updateField('pincode', value)}
                  placeholder="3000"
                  placeholderTextColor="#9B9B9B"
                  keyboardType="number-pad"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    passwordInputRef.current?.focus();
                  }}
                  editable={!loading}
                  style={styles.input}
                />
              </View>
            </View>

            {/* ================================================= */}
            {/* PASSWORD */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Password <Text style={styles.requiredStar}>*</Text>
              </Text>

              <View style={styles.inputContainer}>
                <Image
                  source={require('../assets/login-icons/unlock.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  ref={passwordInputRef}
                  value={formData.password}
                  onChangeText={value => updateField('password', value)}
                  placeholder="Enter password"
                  placeholderTextColor="#9B9B9B"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  /*
                   * Keep keyboard active
                   */
                  blurOnSubmit={false}
                  /*
                   * Password →
                   * Confirm Password
                   */
                  onSubmitEditing={() => {
                    confirmPasswordInputRef.current?.focus();
                  }}
                  editable={!loading}
                  style={styles.input}
                />

                <Pressable
                  hitSlop={10}
                  disabled={loading}
                  onPress={() =>
                    setShowPassword(previousValue => !previousValue)
                  }
                >
                  <Image
                    source={
                      showPassword
                        ? require('../assets/login-icons/eye.png')
                        : require('../assets/login-icons/close-eye.png')
                    }
                    style={styles.passwordEye}
                    resizeMode="contain"
                  />
                </Pressable>
              </View>

              <Text style={styles.passwordHint}>Minimum 8 characters</Text>
            </View>

            {/* ================================================= */}
            {/* CONFIRM PASSWORD */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Confirm Password <Text style={styles.requiredStar}>*</Text>
              </Text>

              <View style={styles.inputContainer}>
                <Image
                  source={require('../assets/login-icons/unlock.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  ref={confirmPasswordInputRef}
                  value={formData.password_confirmation}
                  onChangeText={value =>
                    updateField('password_confirmation', value)
                  }
                  placeholder="Confirm password"
                  placeholderTextColor="#9B9B9B"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  /*
                   * Done button submits
                   * registration.
                   */
                  onSubmitEditing={handleRegister}
                  editable={!loading}
                  style={styles.input}
                />

                <Pressable
                  hitSlop={10}
                  disabled={loading}
                  onPress={() =>
                    setShowConfirmPassword(previousValue => !previousValue)
                  }
                >
                  <Image
                    source={
                      showConfirmPassword
                        ? require('../assets/login-icons/eye.png')
                        : require('../assets/login-icons/close-eye.png')
                    }
                    style={styles.passwordEye}
                    resizeMode="contain"
                  />
                </Pressable>
              </View>

              {formData.password_confirmation.length > 0 && (
                <Text
                  style={[
                    styles.passwordHint,

                    formData.password === formData.password_confirmation
                      ? styles.passwordMatchText
                      : styles.passwordMismatchText,
                  ]}
                >
                  {formData.password === formData.password_confirmation
                    ? 'Passwords match'
                    : 'Passwords do not match'}
                </Text>
              )}
            </View>

            {/* ================================================= */}
            {/* REGISTER BUTTON */}
            {/* ================================================= */}

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={loading}
              style={[
                styles.registerButton,

                loading && styles.registerButtonDisabled,
              ]}
              onPress={handleRegister}
            >
              {loading ? (
                <View style={styles.buttonLoadingContainer}>
                  <ActivityIndicator size="small" color="#FFFFFF" />

                  <Text style={styles.buttonLoadingText}>
                    Creating Account...
                  </Text>
                </View>
              ) : (
                <Text style={styles.registerButtonText}>Create My Account</Text>
              )}
            </TouchableOpacity>

            {/* ================================================= */}
            {/* LOGIN */}
            {/* ================================================= */}

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>

              <Pressable disabled={loading} onPress={handleLogin}>
                <Text style={styles.loginLink}>Log In</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Register;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles = StyleSheet.create({
  /* =====================================================
   * SCREEN
   * ===================================================== */

  screen: {
    flex: 1,

    backgroundColor: '#FFF9F4',
  },

  keyboardContainer: {
    flex: 1,
  },

  /*
   * IMPORTANT:
   * ScrollView needs full
   * available screen height.
   */
  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,

    alignItems: 'center',

    paddingHorizontal: 16,

    paddingTop: 24,

    /*
     * Extra bottom space allows
     * the Password / Confirm
     * Password fields and button
     * to scroll above keyboard.
     */
    paddingBottom: 120,
  },

  /* =====================================================
   * FORM
   * ===================================================== */

  formContainer: {
    maxWidth: 520,

    backgroundColor: '#FFFFFF',

    borderRadius: 22,

    paddingHorizontal: 20,

    paddingTop: 24,

    paddingBottom: 22,

    shadowColor: '#8D6E63',

    shadowOffset: {
      width: 0,

      height: 4,
    },

    shadowOpacity: 0.1,

    shadowRadius: 12,

    elevation: 4,
  },

  /* =====================================================
   * LOGO
   * ===================================================== */

  logo: {
    width: 200,

    height: 100,

    alignSelf: 'center',

    marginBottom: 12,
  },

  /* =====================================================
   * TITLE
   * ===================================================== */

  title: {
    color: '#172A46',

    fontSize: 25,

    fontWeight: '800',

    textAlign: 'center',
  },

  subtitle: {
    color: '#8A8A8A',

    fontSize: 13,

    lineHeight: 19,

    textAlign: 'center',

    marginTop: 6,

    marginBottom: 25,
  },

  /* =====================================================
   * FIELD
   * ===================================================== */

  fieldGroup: {
    marginBottom: 16,
  },

  label: {
    color: '#25344A',

    fontSize: 13,

    fontWeight: '600',

    marginBottom: 7,
  },
  requiredStar: {
    color: '#E53935',

    fontSize: 14,

    fontWeight: '800',
  },

  /* =====================================================
   * INPUT
   * ===================================================== */

  inputContainer: {
    width: '100%',

    minHeight: 52,

    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#FFFFFF',

    borderWidth: 1,

    borderColor: '#DDE2E8',

    borderRadius: 12,

    paddingHorizontal: 14,
  },

  inputImageIcon: {
    width: 20,

    height: 20,

    marginRight: 10,
  },

  input: {
    flex: 1,

    minHeight: 50,

    color: '#182230',

    fontSize: 14,

    paddingVertical: 0,
  },

  /* =====================================================
   * PASSWORD
   * ===================================================== */

  passwordEye: {
    width: 20,

    height: 20,

    marginLeft: 10,
  },

  passwordHint: {
    color: '#9198A3',

    fontSize: 10,

    marginTop: 6,

    marginLeft: 2,
  },

  passwordMatchText: {
    color: '#23834B',

    fontWeight: '700',
  },

  passwordMismatchText: {
    color: '#A00B0F',

    fontWeight: '700',
  },

  /* =====================================================
   * REGISTER
   * ===================================================== */

  registerButton: {
    width: '100%',

    minHeight: 53,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#A00B0F',

    borderRadius: 13,

    marginTop: 8,

    shadowColor: '#A00B0F',

    shadowOffset: {
      width: 0,

      height: 4,
    },

    shadowOpacity: 0.25,

    shadowRadius: 8,

    elevation: 4,
  },

  registerButtonDisabled: {
    opacity: 0.7,
  },

  registerButtonText: {
    color: '#FFFFFF',

    fontSize: 14,

    fontWeight: '800',
  },

  buttonLoadingContainer: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',
  },

  buttonLoadingText: {
    color: '#FFFFFF',

    fontSize: 14,

    fontWeight: '700',

    marginLeft: 10,
  },

  /* =====================================================
   * LOGIN
   * ===================================================== */

  loginContainer: {
    flexDirection: 'row',

    justifyContent: 'center',

    flexWrap: 'wrap',

    marginTop: 18,
  },

  loginText: {
    color: '#828A96',

    fontSize: 12,
  },

  loginLink: {
    color: '#A00B0F',

    fontSize: 12,

    fontWeight: '700',
  },
});
