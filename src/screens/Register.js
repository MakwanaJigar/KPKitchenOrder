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

// Driver registration API
const REGISTER_API_URL =
  'https://replete-software.com/projects/kp_kitchen/api/driver/register';

const Register = ({navigation}) => {
  const {width} = useWindowDimensions();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
    device_name: Platform.OS === 'android' ? 'Android Device' : 'iOS Device',
    license_number: '',
    vehicle_number: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const formWidth = width >= 768 ? 520 : width - 32;

  /**
   * Update a specific form field.
   */
  const updateField = (field, value) => {
    setFormData(previousData => ({
      ...previousData,
      [field]: value,
    }));
  };

  /**
   * Extract the validation/error message returned by Laravel.
   */
  const getApiErrorMessage = error => {
    if (!error.response) {
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

    return (
      responseData?.message ||
      responseData?.error ||
      'Registration failed. Please check your details and try again.'
    );
  };

  /**
   * Validate fields and call the registration API.
   */
  const handleRegister = async () => {
  const {
    name,
    email,
    phone,
    password,
    password_confirmation,
    device_name,
    license_number,
    vehicle_number,
  } = formData;

  if (
    !name.trim() ||
    !email.trim() ||
    !phone.trim() ||
    !password ||
    !password_confirmation ||
    !device_name.trim() ||
    !license_number.trim() ||
    !vehicle_number.trim()
  ) {
    Alert.alert(
      'Required Fields',
      'Please fill in all the registration fields.',
    );
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email.trim())) {
    Alert.alert('Invalid Email', 'Please enter a valid email address.');
    return;
  }

  if (password !== password_confirmation) {
    Alert.alert(
      'Password Mismatch',
      'Password and confirm password must be the same.',
    );
    return;
  }

  const payload = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    password,
    password_confirmation,
    device_name: device_name.trim(),
    license_number: license_number.trim().toUpperCase(),
    vehicle_number: vehicle_number.trim().toUpperCase(),
  };

  try {
    setLoading(true);

    console.log('Sending payload:', {
      ...payload,
      password: '********',
      password_confirmation: '********',
    });

    const response = await axios.post(
      'https://replete-software.com/projects/kp_kitchen/api/driver/register',
      payload,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      },
    );

    console.log('Registration response:', response.data);

    Alert.alert(
      'Registration Successful',
      response.data?.message || 'Your account has been created successfully.',
      [
        {
          text: 'Continue',
          onPress: () => navigation.replace('Login'),
        },
      ],
    );
  } catch (error) {
    console.log('Status:', error.response?.status);
    console.log('Error response:', error.response?.data);

    const validationErrors = error.response?.data?.errors;

    if (validationErrors) {
      const messages = Object.values(validationErrors).flat().join('\n');

      Alert.alert('Registration Failed', messages);
    } else {
      Alert.alert(
        'Registration Failed',
        error.response?.data?.message ||
          'Unable to register. Please try again.',
      );
    }
  } finally {
    setLoading(false);
  }
};

  /**
   * Navigate to login screen.
   */
  const handleLogin = () => {
    if (navigation) {
      navigation.navigate('Login');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={[styles.formContainer, {width: formWidth}]}>
            {/* Logo */}
            <Image
              source={require('../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* Heading */}
            <Text style={styles.title}>Create Account</Text>

            <Text style={styles.subtitle}>
              Complete your profile to start your meal journey.
            </Text>

            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name</Text>

              <View style={styles.inputContainer}>
                <Image
                  source={require('../assets/login-icons/user-1.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  value={formData.name}
                  onChangeText={value => updateField('name', value)}
                  placeholder="John Doe"
                  placeholderTextColor="#9B9B9B"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!loading}
                  style={styles.input}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>

              <View style={styles.inputContainer}>
                <Image
                  source={require('../assets/login-icons/mail.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                    value={formData.email}
  onChangeText={value => updateField('email', value)}
  placeholder="john@example.com"
  placeholderTextColor="#9B9B9B"
  keyboardType="email-address"
  autoCapitalize="none"
  autoCorrect={false}
  style={styles.input}

                />
              </View>
            </View>

            {/* Mobile Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Mobile Number</Text>

              <View style={styles.inputContainer}>
                <Image
                  source={require('../assets/login-icons/phone-call.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  value={formData.phone}
                  onChangeText={value => updateField('phone', value)}
                  placeholder="+91 XXXXX XXXXX"
                  placeholderTextColor="#9B9B9B"
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  editable={!loading}
                  style={styles.input}
                />
              </View>
            </View>

            {/* Device Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Device Name</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.textInputIcon}>📱</Text>

                <TextInput
                  value={formData.device_name}
                  onChangeText={value => updateField('device_name', value)}
                  placeholder="Android Device"
                  placeholderTextColor="#9B9B9B"
                  autoCapitalize="words"
                  returnKeyType="next"
                  editable={!loading}
                  style={styles.input}
                />
              </View>
            </View>

            {/* Licence Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Licence Number</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.textInputIcon}>🪪</Text>

                <TextInput
                  value={formData.license_number}
                  onChangeText={value =>
                    updateField('license_number', value.toUpperCase())
                  }
                  placeholder="Enter licence number"
                  placeholderTextColor="#9B9B9B"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!loading}
                  style={styles.input}
                />
              </View>
            </View>

            {/* Vehicle Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Vehicle Number</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.textInputIcon}>🚚</Text>

                <TextInput
                  value={formData.vehicle_number}
                  onChangeText={value =>
                    updateField('vehicle_number', value.toUpperCase())
                  }
                  placeholder="GJ 01 AB 1234"
                  placeholderTextColor="#9B9B9B"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!loading}
                  style={styles.input}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>

              <View style={styles.inputContainer}>
                <Image
                  source={require('../assets/login-icons/unlock.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
                  value={formData.password}
                  onChangeText={value => updateField('password', value)}
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
                    setShowPassword(previousValue => !previousValue)
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

            {/* Confirm Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm Password</Text>

              <View style={styles.inputContainer}>
                <Image
                  source={require('../assets/login-icons/unlock.png')}
                  style={styles.inputImageIcon}
                  resizeMode="contain"
                />

                <TextInput
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
                  onSubmitEditing={handleRegister}
                  editable={!loading}
                  style={styles.input}
                />

                <Pressable
                  hitSlop={10}
                  disabled={loading}
                  onPress={() =>
                    setShowConfirmPassword(previousValue => !previousValue)
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

            {/* Register Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={loading}
              style={[
                styles.registerButton,
                loading && styles.registerButtonDisabled,
              ]}
              onPress={handleRegister}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FFFFFF" />

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

            {/* Login */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>
                Already have an account?{' '}
              </Text>

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