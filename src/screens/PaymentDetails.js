import React, {useMemo, useState} from 'react';

import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import {SafeAreaView} from 'react-native-safe-area-context';

const PaymentDetails = ({navigation}) => {
  const {width} = useWindowDimensions();

  /*
  |--------------------------------------------------------------------------
  | States
  |--------------------------------------------------------------------------
  */

  const [cardHolderName, setCardHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');

  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const [showCvv, setShowCvv] = useState(false);

  const [errors, setErrors] = useState({});

  /*
  |--------------------------------------------------------------------------
  | Responsive
  |--------------------------------------------------------------------------
  */

  const responsive = useMemo(() => {
    const isTablet = width >= 768;

    return {
      isTablet,

      contentWidth: isTablet
        ? Math.min(width - 80, 720)
        : width,

      horizontalPadding: isTablet ? 28 : 14,
    };
  }, [width]);

  /*
  |--------------------------------------------------------------------------
  | Format Card Number
  |--------------------------------------------------------------------------
  */

  const formatCardNumber = value => {
    const cleaned = value.replace(/\D/g, '').slice(0, 16);

    const formatted = cleaned
      .replace(/(.{4})/g, '$1 ')
      .trim();

    setCardNumber(formatted);

    if (errors.cardNumber) {
      setErrors(prev => ({
        ...prev,
        cardNumber: '',
      }));
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Format Expiry
  |--------------------------------------------------------------------------
  */

  const formatExpiryDate = value => {
    let cleaned = value.replace(/\D/g, '').slice(0, 4);

    if (cleaned.length >= 3) {
      cleaned =
        cleaned.slice(0, 2) +
        '/' +
        cleaned.slice(2);
    }

    setExpiryDate(cleaned);

    if (errors.expiryDate) {
      setErrors(prev => ({
        ...prev,
        expiryDate: '',
      }));
    }
  };

  /*
  |--------------------------------------------------------------------------
  | CVV
  |--------------------------------------------------------------------------
  */

  const handleCvvChange = value => {
    const cleaned = value
      .replace(/\D/g, '')
      .slice(0, 4);

    setCvv(cleaned);

    if (errors.cvv) {
      setErrors(prev => ({
        ...prev,
        cvv: '',
      }));
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Validation
  |--------------------------------------------------------------------------
  */

  const validateForm = () => {
    const newErrors = {};

    const cleanedCardNumber =
      cardNumber.replace(/\s/g, '');

    if (!cardHolderName.trim()) {
      newErrors.cardHolderName =
        'Please enter the cardholder name';
    }

    if (cleanedCardNumber.length !== 16) {
      newErrors.cardNumber =
        'Please enter a valid 16-digit card number';
    }

    if (!expiryDate || expiryDate.length !== 5) {
      newErrors.expiryDate =
        'Please enter a valid expiry date';
    } else {
      const [month, year] =
        expiryDate.split('/');

      const numericMonth = Number(month);
      const numericYear = Number(year);

      if (
        numericMonth < 1 ||
        numericMonth > 12
      ) {
        newErrors.expiryDate =
          'Please enter a valid expiry month';
      } else {
        const now = new Date();

        const currentYear =
          Number(
            now
              .getFullYear()
              .toString()
              .slice(-2),
          );

        const currentMonth =
          now.getMonth() + 1;

        if (
          numericYear < currentYear ||
          (numericYear === currentYear &&
            numericMonth < currentMonth)
        ) {
          newErrors.expiryDate =
            'This card has expired';
        }
      }
    }

    if (cvv.length < 3) {
      newErrors.cvv =
        'Please enter a valid CVV';
    }

    setErrors(newErrors);

    return (
      Object.keys(newErrors).length === 0
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Save Card
  |--------------------------------------------------------------------------
  */

  const handleSaveCard = () => {
    if (!validateForm()) {
      return;
    }

    const cleanedCardNumber =
      cardNumber.replace(/\s/g, '');

    const cardData = {
      cardHolderName:
        cardHolderName.trim(),

      cardNumber:
        cleanedCardNumber,

      expiryDate,

      cvv,

      isDefault: saveAsDefault,
    };

    console.log(
      'Card details:',
      cardData,
    );

    Alert.alert(
      'Card Added',
      'Your payment card has been added successfully.',
      [
        {
          text: 'OK',

          onPress: () => {
            navigation.goBack();
          },
        },
      ],
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Display Card
  |--------------------------------------------------------------------------
  */

  const displayCardNumber =
    cardNumber ||
    '•••• •••• •••• ••••';

  const displayName =
    cardHolderName ||
    'CARD HOLDER';

  const displayExpiry =
    expiryDate || 'MM/YY';

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFF9F6"
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }>

        <View
          style={[
            styles.screenContainer,
            {
              width:
                responsive.contentWidth,
            },
          ]}>

          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingHorizontal:
                  responsive.horizontalPadding,
              },
            ]}>

            {/* ================================================= */}
            {/* HEADER */}
            {/* ================================================= */}

            <View style={styles.header}>

              <Pressable
                hitSlop={10}
                style={styles.backButton}
                onPress={() =>
                  navigation.goBack()
                }>

                <Image
                  source={require('../assets/login-icons/back.png')}
                  style={styles.backIcon}
                  resizeMode="contain"
                />

              </Pressable>

              <View style={styles.headerTextContainer}>
                <Text style={styles.headerEyebrow}>
                  PAYMENT METHOD
                </Text>

                <Text style={styles.headerTitle}>
                  Add Card
                </Text>
              </View>

              <View style={styles.headerSpacer} />

            </View>

            {/* ================================================= */}
            {/* CARD PREVIEW */}
            {/* ================================================= */}

            <View style={styles.cardPreview}>

              <View style={styles.cardTopRow}>

                <View>
                  <Text style={styles.cardLabel}>
                    PAYMENT CARD
                  </Text>

                  <Text style={styles.cardType}>
                    VISA
                  </Text>
                </View>

                <View style={styles.cardChip}>
                  <View style={styles.chipLine} />

                  <View style={styles.chipLine} />

                  <View style={styles.chipLine} />
                </View>

              </View>

              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={styles.previewCardNumber}>
                {displayCardNumber}
              </Text>

              <View style={styles.cardBottomRow}>

                <View style={styles.cardHolderContainer}>
                  <Text style={styles.previewSmallLabel}>
                    CARD HOLDER
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={styles.previewName}>
                    {displayName.toUpperCase()}
                  </Text>
                </View>

                <View>
                  <Text style={styles.previewSmallLabel}>
                    EXPIRES
                  </Text>

                  <Text style={styles.previewExpiry}>
                    {displayExpiry}
                  </Text>
                </View>

              </View>

              <View style={styles.cardDecorationOne} />
              <View style={styles.cardDecorationTwo} />

            </View>

            {/* ================================================= */}
            {/* CARD DETAILS */}
            {/* ================================================= */}

            <View style={styles.sectionCard}>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Card Details
                </Text>

                <Text style={styles.secureText}>
                  Secure Payment
                </Text>
              </View>

              {/* CARD HOLDER NAME */}

              <InputContainer
                label="Cardholder Name"
                error={
                  errors.cardHolderName
                }>

                <TextInput
                  value={cardHolderName}
                  onChangeText={value => {
                    setCardHolderName(value);

                    if (
                      errors.cardHolderName
                    ) {
                      setErrors(prev => ({
                        ...prev,
                        cardHolderName: '',
                      }));
                    }
                  }}
                  placeholder="Name on card"
                  placeholderTextColor="#B4A49E"
                  style={styles.input}
                  autoCapitalize="words"
                />

              </InputContainer>

              {/* CARD NUMBER */}

              <InputContainer
                label="Card Number"
                error={errors.cardNumber}>

                <View style={styles.inputWithIcon}>

                  <TextInput
                    value={cardNumber}
                    onChangeText={
                      formatCardNumber
                    }
                    placeholder="0000 0000 0000 0000"
                    placeholderTextColor="#B4A49E"
                    style={[
                      styles.input,
                      styles.flexInput,
                    ]}
                    keyboardType="number-pad"
                    maxLength={19}
                  />

                  <View
                    style={
                      styles.inputCardIconContainer
                    }>

                    <Image
                      source={require('../assets/login-icons/payment-credit-card.png')}
                      style={
                        styles.inputCardIcon
                      }
                      resizeMode="contain"
                    />

                  </View>

                </View>

              </InputContainer>

              {/* EXPIRY & CVV */}

              <View style={styles.doubleInputRow}>

                <View style={styles.halfInput}>

                  <InputContainer
                    label="Expiry Date"
                    error={
                      errors.expiryDate
                    }>

                    <TextInput
                      value={expiryDate}
                      onChangeText={
                        formatExpiryDate
                      }
                      placeholder="MM/YY"
                      placeholderTextColor="#B4A49E"
                      style={styles.input}
                      keyboardType="number-pad"
                      maxLength={5}
                    />

                  </InputContainer>

                </View>

                <View style={styles.inputGap} />

                <View style={styles.halfInput}>

                  <InputContainer
                    label="CVV"
                    error={errors.cvv}>

                    <View
                      style={
                        styles.inputWithIcon
                      }>

                      <TextInput
                        value={cvv}
                        onChangeText={
                          handleCvvChange
                        }
                        placeholder="•••"
                        placeholderTextColor="#B4A49E"
                        style={[
                          styles.input,
                          styles.flexInput,
                        ]}
                        keyboardType="number-pad"
                        secureTextEntry={
                          !showCvv
                        }
                        maxLength={4}
                      />

                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          setShowCvv(
                            previous =>
                              !previous,
                          )
                        }
                        style={
                          styles.cvvButton
                        }>

                        <Text
                          style={
                            styles.cvvButtonText
                          }>
                          {showCvv
                            ? 'Hide'
                            : 'Show'}
                        </Text>

                      </Pressable>

                    </View>

                  </InputContainer>

                </View>

              </View>

            </View>

            {/* ================================================= */}
            {/* SAVE DEFAULT */}
            {/* ================================================= */}

            <View style={styles.preferenceCard}>

              <View
                style={
                  styles.preferenceIconContainer
                }>

                <Image
                  source={require('../assets/login-icons/payment-credit-card.png')}
                  style={styles.preferenceIcon}
                  resizeMode="contain"
                />

              </View>

              <View
                style={
                  styles.preferenceDetails
                }>

                <Text
                  style={
                    styles.preferenceTitle
                  }>
                  Set as Default Card
                </Text>

                <Text
                  style={
                    styles.preferenceSubtitle
                  }>
                  Use this card automatically for future payments
                </Text>

              </View>

              <Switch
                value={saveAsDefault}
                onValueChange={
                  setSaveAsDefault
                }
                trackColor={{
                  false: '#DDD7D2',
                  true: '#E6A27E',
                }}
                thumbColor={
                  saveAsDefault
                    ? '#B64D19'
                    : '#FFFFFF'
                }
              />

            </View>

            {/* ================================================= */}
            {/* SECURITY MESSAGE */}
            {/* ================================================= */}

            <View style={styles.securityBox}>

              <View
                style={styles.securityIcon}>

                <Text
                  style={
                    styles.securityIconText
                  }>
                  ✓
                </Text>

              </View>

              <View style={styles.securityContent}>

                <Text
                  style={
                    styles.securityTitle
                  }>
                  Your payment is secure
                </Text>

                <Text
                  style={
                    styles.securityDescription
                  }>
                  Your card information is encrypted and securely processed.
                </Text>

              </View>

            </View>

            {/* ================================================= */}
            {/* SAVE BUTTON */}
            {/* ================================================= */}

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.saveButton}
              onPress={handleSaveCard}>

              <Text style={styles.saveButtonText}>
                Save Card
              </Text>

            </TouchableOpacity>

            {/* CANCEL */}

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.cancelButton}
              onPress={() =>
                navigation.goBack()
              }>

              <Text style={styles.cancelText}>
                Cancel
              </Text>

            </TouchableOpacity>

          </ScrollView>

        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/*
|--------------------------------------------------------------------------
| Input Container
|--------------------------------------------------------------------------
*/

const InputContainer = ({
  label,
  children,
  error,
}) => {
  return (
    <View style={styles.fieldContainer}>

      <Text style={styles.inputLabel}>
        {label}
      </Text>

      <View
        style={[
          styles.inputContainer,

          error
            ? styles.inputContainerError
            : null,
        ]}>
        {children}
      </View>

      {error ? (
        <Text style={styles.errorText}>
          {error}
        </Text>
      ) : null}

    </View>
  );
};

export default PaymentDetails;

/*
|--------------------------------------------------------------------------
| Styles
|--------------------------------------------------------------------------
*/

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F0ED',
  },

  keyboardView: {
    flex: 1,
  },

  screenContainer: {
    flex: 1,
    alignSelf: 'center',
    backgroundColor: '#FFF9F6',
  },

  scrollContent: {
    paddingTop: 10,
    paddingBottom: 60,
  },

  /*
  |--------------------------------------------------------------------------
  | Header
  |--------------------------------------------------------------------------
  */

  header: {
    minHeight: 65,

    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 14,
  },

  backButton: {
    width: 42,
    height: 42,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFFFFF',

    borderWidth: 1,

    borderColor: '#EFE5E0',

    borderRadius: 14,
  },

  backIcon: {
    width: 19,
    height: 19,
  },

  headerTextContainer: {
    flex: 1,

    paddingHorizontal: 12,
  },

  headerEyebrow: {
    color: '#A84B20',

    fontSize: 9,

    fontWeight: '800',

    letterSpacing: 1,
  },

  headerTitle: {
    color: '#231815',

    fontSize: 24,

    fontWeight: '900',

    marginTop: 2,
  },

  headerSpacer: {
    width: 42,
  },

  /*
  |--------------------------------------------------------------------------
  | Card Preview
  |--------------------------------------------------------------------------
  */

  cardPreview: {
    minHeight: 200,

    overflow: 'hidden',

    backgroundColor: '#2D211D',

    borderRadius: 21,

    padding: 20,

    marginBottom: 14,

    shadowColor: '#39241B',

    shadowOffset: {
      width: 0,
      height: 7,
    },

    shadowOpacity: 0.16,

    shadowRadius: 14,

    elevation: 5,
  },

  cardTopRow: {
    zIndex: 2,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',
  },

  cardLabel: {
    color: '#C9B8B0',

    fontSize: 7,

    fontWeight: '700',

    letterSpacing: 1.2,
  },

  cardType: {
    color: '#FFFFFF',

    fontSize: 18,

    fontWeight: '900',

    fontStyle: 'italic',

    marginTop: 3,
  },

  cardChip: {
    width: 43,
    height: 31,

    justifyContent: 'center',

    backgroundColor: '#E8C89A',

    borderRadius: 7,

    paddingHorizontal: 5,
  },

  chipLine: {
    width: '100%',
    height: 1,

    backgroundColor: '#A9875C',

    marginVertical: 3,
  },

  previewCardNumber: {
    zIndex: 2,

    color: '#FFFFFF',

    fontSize: 21,

    fontWeight: '700',

    letterSpacing: 2,

    marginTop: 34,
  },

  cardBottomRow: {
    zIndex: 2,

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'flex-end',

    marginTop: 28,
  },

  cardHolderContainer: {
    flex: 1,

    paddingRight: 20,
  },

  previewSmallLabel: {
    color: '#AD9D96',

    fontSize: 6.5,

    fontWeight: '700',

    letterSpacing: 0.8,
  },

  previewName: {
    color: '#FFFFFF',

    fontSize: 10,

    fontWeight: '800',

    marginTop: 4,
  },

  previewExpiry: {
    color: '#FFFFFF',

    fontSize: 10,

    fontWeight: '800',

    marginTop: 4,
  },

  cardDecorationOne: {
    position: 'absolute',

    width: 170,
    height: 170,

    borderRadius: 100,

    backgroundColor: '#A84B20',

    opacity: 0.19,

    right: -65,

    top: -45,
  },

  cardDecorationTwo: {
    position: 'absolute',

    width: 130,
    height: 130,

    borderRadius: 100,

    borderWidth: 25,

    borderColor: '#D87D50',

    opacity: 0.09,

    left: -48,

    bottom: -64,
  },

  /*
  |--------------------------------------------------------------------------
  | Section Card
  |--------------------------------------------------------------------------
  */

  sectionCard: {
    width: '100%',

    backgroundColor: '#FFFFFF',

    borderWidth: 1,

    borderColor: '#EFE5E0',

    borderRadius: 17,

    padding: 14,

    marginBottom: 13,

    shadowColor: '#503328',

    shadowOffset: {
      width: 0,
      height: 3,
    },

    shadowOpacity: 0.04,

    shadowRadius: 8,

    elevation: 2,
  },

  sectionHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginBottom: 17,
  },

  sectionTitle: {
    color: '#2B1D18',

    fontSize: 20,

    fontWeight: '800',
  },

  secureText: {
    color: '#A84B20',

    fontSize: 8,

    fontWeight: '700',

    backgroundColor: '#FFF0E8',

    paddingHorizontal: 9,

    paddingVertical: 5,

    borderRadius: 10,
  },

  /*
  |--------------------------------------------------------------------------
  | Inputs
  |--------------------------------------------------------------------------
  */

  fieldContainer: {
    marginBottom: 15,
  },

  inputLabel: {
    color: '#4A3831',

    fontSize: 10,

    fontWeight: '700',

    marginBottom: 7,
  },

  inputContainer: {
    minHeight: 52,

    justifyContent: 'center',

    backgroundColor: '#FFF9F6',

    borderWidth: 1,

    borderColor: '#EDE2DC',

    borderRadius: 13,
  },

  inputContainerError: {
    borderColor: '#A00B0F',
  },

  input: {
    minHeight: 50,

    color: '#2C201B',

    fontSize: 11,

    fontWeight: '600',

    paddingHorizontal: 13,

    paddingVertical: 0,
  },

  flexInput: {
    flex: 1,
  },

  inputWithIcon: {
    minHeight: 50,

    flexDirection: 'row',

    alignItems: 'center',
  },

  inputCardIconContainer: {
    width: 36,
    height: 36,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF0E8',

    borderRadius: 10,

    marginRight: 7,
  },

  inputCardIcon: {
    width: 18,
    height: 18,
  },

  doubleInputRow: {
    flexDirection: 'row',
  },

  halfInput: {
    flex: 1,
  },

  inputGap: {
    width: 10,
  },

  cvvButton: {
    height: 40,

    justifyContent: 'center',

    paddingHorizontal: 12,
  },

  cvvButtonText: {
    color: '#A84B20',

    fontSize: 9,

    fontWeight: '800',
  },

  errorText: {
    color: '#A00B0F',

    fontSize: 8,

    fontWeight: '600',

    marginTop: 5,

    marginLeft: 3,
  },

  /*
  |--------------------------------------------------------------------------
  | Default Card
  |--------------------------------------------------------------------------
  */

  preferenceCard: {
    minHeight: 74,

    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#FFFFFF',

    borderWidth: 1,

    borderColor: '#EFE5E0',

    borderRadius: 16,

    paddingHorizontal: 12,

    paddingVertical: 11,

    marginBottom: 13,
  },

  preferenceIconContainer: {
    width: 43,

    height: 43,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF0E8',

    borderRadius: 12,

    marginRight: 11,
  },

  preferenceIcon: {
    width: 21,
    height: 21,
  },

  preferenceDetails: {
    flex: 1,

    paddingRight: 8,
  },

  preferenceTitle: {
    color: '#30231E',

    fontSize: 11,

    fontWeight: '800',
  },

  preferenceSubtitle: {
    color: '#908079',

    fontSize: 8,

    lineHeight: 12,

    marginTop: 4,
  },

  /*
  |--------------------------------------------------------------------------
  | Security
  |--------------------------------------------------------------------------
  */

  securityBox: {
    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#FFF4EE',

    borderWidth: 1,

    borderColor: '#F2DDD2',

    borderRadius: 14,

    padding: 11,

    marginBottom: 14,
  },

  securityIcon: {
    width: 32,

    height: 32,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#A84B20',

    borderRadius: 10,

    marginRight: 10,
  },

  securityIconText: {
    color: '#FFFFFF',

    fontSize: 15,

    fontWeight: '900',
  },

  securityContent: {
    flex: 1,
  },

  securityTitle: {
    color: '#382720',

    fontSize: 10,

    fontWeight: '800',
  },

  securityDescription: {
    color: '#8C7770',

    fontSize: 8,

    lineHeight: 12,

    marginTop: 3,
  },

  /*
  |--------------------------------------------------------------------------
  | Buttons
  |--------------------------------------------------------------------------
  */

  saveButton: {
    minHeight: 54,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#A00B0F',

    borderRadius: 14,

    marginTop: 3,

    shadowColor: '#A00B0F',

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.15,

    shadowRadius: 8,

    elevation: 3,
  },

  saveButtonText: {
    color: '#FFFFFF',

    fontSize: 15,

    fontWeight: '800',
  },

  cancelButton: {
    minHeight: 48,

    alignItems: 'center',

    justifyContent: 'center',

    marginTop: 6,
  },

  cancelText: {
    color: '#8E7770',

    fontSize: 11,

    fontWeight: '700',
  },
});