import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
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

import {SafeAreaView} from 'react-native-safe-area-context';
import axios from 'axios';

/* ========================================================= */
/* Customer Registration API */
/* ========================================================= */

const REGISTER_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/register';

/* ========================================================= */
/* Register Component */
/* ========================================================= */

const Register = ({navigation}) => {
  const {width} = useWindowDimensions();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirm_password: '',
    pincode: '',
    address: '',
  });

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const formWidth = width >= 768 ? 520 : width - 32;

  /* ========================================================= */
  /* Update Field */
  /* ========================================================= */

  const updateField = (field, value) => {
    setFormData(previousData => ({
      ...previousData,
      [field]: value,
    }));
  };

  /* ========================================================= */
  /* Get API Error Message */
  /* ========================================================= */

  const getApiErrorMessage = error => {
    if (!error.response) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }

    const responseData = error.response?.data;

    /*
     * Laravel validation errors
     *
     * Example:
     *
     * {
     *   errors: {
     *     email: ["The email has already been taken."]
     *   }
     * }
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

    /*
     * Normal API message
     */
    if (responseData?.message) {
      return responseData.message;
    }

    /*
     * Custom API error
     */
    if (responseData?.error) {
      return responseData.error;
    }

    return `Registration failed. Server returned status ${
      error.response?.status || 'unknown'
    }.`;
  };

  /* ========================================================= */
  /* Register Customer */
  /* ========================================================= */

  const handleRegister = async () => {
    const {
      name,
      phone,
      email,
      password,
      confirm_password,
      pincode,
      address,
    } = formData;

    /* ===================================================== */
    /* Required Fields Validation */
    /* ===================================================== */

    if (
      !name?.trim() ||
      !phone?.trim() ||
      !email?.trim() ||
      !password ||
      !confirm_password ||
      !pincode?.trim() ||
      !address?.trim()
    ) {
      Alert.alert(
        'Required Fields',
        'Please fill in all the registration fields.',
      );

      return;
    }

    /* ===================================================== */
    /* Email Validation */
    /* ===================================================== */

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email.trim())) {
      Alert.alert(
        'Invalid Email',
        'Please enter a valid email address.',
      );

      return;
    }

    /* ===================================================== */
    /* Password Length */
    /* ===================================================== */

    if (password.length < 8) {
      Alert.alert(
        'Invalid Password',
        'Password must contain at least 8 characters.',
      );

      return;
    }

    /* ===================================================== */
    /* Confirm Password */
    /* ===================================================== */

    if (password !== confirm_password) {
      Alert.alert(
        'Password Mismatch',
        'Password and confirm password must be the same.',
      );

      return;
    }

    /* ===================================================== */
    /* API Payload */
    /* ===================================================== */

    const payload = {
      name: name.trim(),

      phone: phone.trim(),

      email: email.trim().toLowerCase(),

      password: password,

      /*
       * Your API payload uses confirm_password.
       */
      confirm_password: confirm_password,

      /*
       * Laravel's standard "confirmed" validation rule
       * expects password_confirmation.
       *
       * Sending both makes the request compatible with
       * either backend implementation.
       */
      password_confirmation: confirm_password,

      pincode: pincode.trim(),

      address: address.trim(),
    };

    /* ===================================================== */
    /* Debug Payload */
    /* ===================================================== */

    console.log('======================================');
    console.log('CUSTOMER REGISTER');
    console.log('REGISTER URL:');
    console.log(REGISTER_API_URL);

    console.log('REGISTER PAYLOAD:');

    console.log({
      ...payload,

      password: '********',

      confirm_password: '********',

      password_confirmation: '********',
    });

    console.log('======================================');

    /* ===================================================== */
    /* API Request */
    /* ===================================================== */

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

      /* =================================================== */
      /* Success Response */
      /* =================================================== */

      console.log('======================================');
      console.log('REGISTER SUCCESS');

      console.log('STATUS:');
      console.log(response.status);

      console.log('RESPONSE DATA:');
      console.log(JSON.stringify(response.data, null, 2));

      console.log('======================================');

      Alert.alert(
        'Registration Successful',

        response.data?.message ||
          'Your account has been created successfully.',

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
      /* =================================================== */
      /* API Error Debug */
      /* =================================================== */

      console.log('======================================');
      console.log('REGISTER FAILED');

      console.log('ERROR MESSAGE:');
      console.log(error.message);

      console.log('STATUS:');
      console.log(error.response?.status);

      console.log('SERVER RESPONSE:');
      console.log(
        JSON.stringify(error.response?.data, null, 2),
      );

      console.log('======================================');

      /* =================================================== */
      /* Connection Error */
      /* =================================================== */

      if (!error.response) {
        Alert.alert(
          'Connection Error',
          'Unable to connect to the server. Please check your internet connection.',
        );

        return;
      }

      /* =================================================== */
      /* API / Validation Error */
      /* =================================================== */

      const message = getApiErrorMessage(error);

      Alert.alert(
        'Registration Failed',
        message,
      );
    } finally {
      setLoading(false);
    }
  };

  /* ========================================================= */
  /* Login Navigation */
  /* ========================================================= */

  const handleLogin = () => {
    if (navigation) {
      navigation.navigate('Login');
    }
  };

  /* ========================================================= */
  /* UI */
  /* ========================================================= */

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          <View
            style={[
              styles.formContainer,
              {
                width: formWidth,
              },
            ]}>

            {/* ================================================= */}
            {/* Logo */}
            {/* ================================================= */}

            <Image
              source={require('../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* ================================================= */}
            {/* Heading */}
            {/* ================================================= */}

            <Text style={styles.title}>
              Create Account
            </Text>

            <Text style={styles.subtitle}>
              Complete your profile to start your meal journey.
            </Text>

            {/* ================================================= */}
            {/* Full Name */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>

              <Text style={styles.label}>
                Full Name
              </Text>

              <View style={styles.inputContainer}>

                <Image
                  source={require('../assets/login-icons/user-1.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  value={formData.name}
                  onChangeText={value =>
                    updateField('name', value)
                  }
                  placeholder="Jane Customer"
                  placeholderTextColor="#9B9B9B"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!loading}
                  style={styles.input}
                />

              </View>

            </View>

            {/* ================================================= */}
            {/* Mobile Number */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>

              <Text style={styles.label}>
                Mobile Number
              </Text>

              <View style={styles.inputContainer}>

                <Image
                  source={require('../assets/login-icons/phone-call.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  value={formData.phone}
                  onChangeText={value =>
                    updateField('phone', value)
                  }
                  placeholder="0400111222"
                  placeholderTextColor="#9B9B9B"
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  editable={!loading}
                  style={styles.input}
                />

              </View>

            </View>

            {/* ================================================= */}
            {/* Email */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>

              <Text style={styles.label}>
                Email Address
              </Text>

              <View style={styles.inputContainer}>

                <Image
                  source={require('../assets/login-icons/mail.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  value={formData.email}
                  onChangeText={value =>
                    updateField('email', value)
                  }
                  placeholder="jane@example.com"
                  placeholderTextColor="#9B9B9B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!loading}
                  style={styles.input}
                />

              </View>

            </View>

            {/* ================================================= */}
            {/* Pincode */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>

              <Text style={styles.label}>
                Pincode
              </Text>

              <View style={styles.inputContainer}>

                <Text style={styles.textInputIcon}>
                  📍
                </Text>

                <TextInput
                  value={formData.pincode}
                  onChangeText={value =>
                    updateField('pincode', value)
                  }
                  placeholder="3000"
                  placeholderTextColor="#9B9B9B"
                  keyboardType="number-pad"
                  returnKeyType="next"
                  editable={!loading}
                  style={styles.input}
                />

              </View>

            </View>

            {/* ================================================= */}
            {/* Address */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>

              <Text style={styles.label}>
                Address
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  styles.addressInputContainer,
                ]}>

                <Text style={styles.addressIcon}>
                  🏠
                </Text>

                <TextInput
                  value={formData.address}
                  onChangeText={value =>
                    updateField('address', value)
                  }
                  placeholder="789 High Street, Northcote"
                  placeholderTextColor="#9B9B9B"
                  autoCapitalize="sentences"
                  autoCorrect={false}
                  multiline={true}
                  textAlignVertical="top"
                  editable={!loading}
                  style={[
                    styles.input,
                    styles.addressInput,
                  ]}
                />

              </View>

            </View>

            {/* ================================================= */}
            {/* Password */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>

              <Text style={styles.label}>
                Password
              </Text>

              <View style={styles.inputContainer}>

                <Image
                  source={require('../assets/login-icons/unlock.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  value={formData.password}
                  onChangeText={value =>
                    updateField('password', value)
                  }
                  placeholder="Enter password"
                  placeholderTextColor="#9B9B9B"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!loading}
                  style={styles.input}
                />

                <Pressable
                  hitSlop={10}
                  disabled={loading}
                  onPress={() =>
                    setShowPassword(
                      previousValue => !previousValue,
                    )
                  }>

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

            </View>

            {/* ================================================= */}
            {/* Confirm Password */}
            {/* ================================================= */}

            <View style={styles.fieldGroup}>

              <Text style={styles.label}>
                Confirm Password
              </Text>

              <View style={styles.inputContainer}>

                <Image
                  source={require('../assets/login-icons/unlock.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  value={formData.confirm_password}
                  onChangeText={value =>
                    updateField(
                      'confirm_password',
                      value,
                    )
                  }
                  placeholder="Confirm password"
                  placeholderTextColor="#9B9B9B"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                  editable={!loading}
                  style={styles.input}
                />

                <Pressable
                  hitSlop={10}
                  disabled={loading}
                  onPress={() =>
                    setShowConfirmPassword(
                      previousValue =>
                        !previousValue,
                    )
                  }>

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

            </View>

            {/* ================================================= */}
            {/* Create Account Button */}
            {/* ================================================= */}

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={loading}
              style={[
                styles.registerButton,

                loading &&
                  styles.registerButtonDisabled,
              ]}
              onPress={handleRegister}>

              {loading ? (
                <View style={styles.loadingContainer}>

                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />

                  <Text style={styles.loadingText}>
                    Creating Account...
                  </Text>

                </View>
              ) : (
                <Text style={styles.registerButtonText}>
                  Create My Account
                </Text>
              )}

            </TouchableOpacity>

            {/* ================================================= */}
            {/* Login Link */}
            {/* ================================================= */}

            <View style={styles.loginContainer}>

              <Text style={styles.loginText}>
                Already have an account?{' '}
              </Text>

              <Pressable
                disabled={loading}
                onPress={handleLogin}>

                <Text style={styles.loginLink}>
                  Log In
                </Text>

              </Pressable>

            </View>

          </View>

        </ScrollView>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Register;

/* ========================================================= */
/* Styles */
/* ========================================================= */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF9F4',
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 30,
  },

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

  logo: {
    width: 200,
    height: 100,

    alignSelf: 'center',

    marginBottom: 12,
  },

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

  fieldGroup: {
    marginBottom: 16,
  },

  label: {
    color: '#25344A',

    fontSize: 13,

    fontWeight: '600',

    marginBottom: 7,
  },

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

  textInputIcon: {
    width: 24,

    marginRight: 8,

    fontSize: 17,

    textAlign: 'center',
  },

  input: {
    flex: 1,

    minHeight: 50,

    color: '#182230',

    fontSize: 14,

    paddingVertical: 0,
  },

  addressInputContainer: {
    minHeight: 90,

    alignItems: 'flex-start',

    paddingTop: 14,
  },

  addressIcon: {
    width: 24,

    marginRight: 8,

    marginTop: 2,

    fontSize: 17,

    textAlign: 'center',
  },

  addressInput: {
    minHeight: 75,

    paddingTop: 0,

    paddingBottom: 10,
  },

  passwordEye: {
    width: 20,

    height: 20,

    marginLeft: 10,
  },

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

  loadingContainer: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',
  },

  loadingText: {
    color: '#FFFFFF',

    fontSize: 14,

    fontWeight: '700',

    marginLeft: 10,
  },

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