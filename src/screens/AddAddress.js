import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
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

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

/* =========================================================
 * Storage
 * ========================================================= */

const ADDRESS_STORAGE_KEY =
  'kp_customer_addresses';

/* =========================================================
 * Add Address
 * ========================================================= */

const AddAddress = ({
  navigation,
  route,
}) => {
  const {
    width,
  } = useWindowDimensions();

  const mode =
    route?.params?.mode ||
    'add';

  const existingAddress =
    route?.params?.address ||
    null;

  const isEdit =
    mode ===
    'edit';

  /* =====================================================
   * Form State
   * ===================================================== */

  const [
    addressType,
    setAddressType,
  ] =
    useState(
      'Home',
    );

  const [
    fullName,
    setFullName,
  ] =
    useState('');

  const [
    mobileNumber,
    setMobileNumber,
  ] =
    useState('');

  const [
    addressLine1,
    setAddressLine1,
  ] =
    useState('');

  const [
    addressLine2,
    setAddressLine2,
  ] =
    useState('');

  const [
    suburb,
    setSuburb,
  ] =
    useState('');

  const [
    state,
    setState,
  ] =
    useState('');

  const [
    postcode,
    setPostcode,
  ] =
    useState('');

  const [
    country,
    setCountry,
  ] =
    useState(
      'Australia',
    );

  const [
    deliveryInstructions,
    setDeliveryInstructions,
  ] =
    useState('');

  const [
    isDefault,
    setIsDefault,
  ] =
    useState(false);

  const [
    errors,
    setErrors,
  ] =
    useState({});

  /* =====================================================
   * Save State
   * ===================================================== */

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    successPopupVisible,
    setSuccessPopupVisible,
  ] =
    useState(false);

  const [
    savedAddress,
    setSavedAddress,
  ] =
    useState(null);

  /* =====================================================
   * Responsive
   * ===================================================== */

  const responsive =
    useMemo(
      () => {
        const isTablet =
          width >= 768;

        return {
          isTablet,

          contentWidth:
            isTablet
              ? Math.min(
                  width -
                    80,

                  720,
                )
              : width,

          horizontalPadding:
            isTablet
              ? 28
              : 14,
        };
      },
      [
        width,
      ],
    );

  /* =====================================================
   * Load Address For Edit
   * ===================================================== */

  useEffect(
    () => {
      if (
        !existingAddress
      ) {
        return;
      }

      setAddressType(
        existingAddress
          ?.type ??
          'Home',
      );

      setFullName(
        existingAddress
          ?.name ??
          '',
      );

      setMobileNumber(
        existingAddress
          ?.phone ??
          '',
      );

      setAddressLine1(
        existingAddress
          ?.addressLine1 ??
          existingAddress
            ?.address_line_1 ??
          '',
      );

      setAddressLine2(
        existingAddress
          ?.addressLine2 ??
          existingAddress
            ?.address_line_2 ??
          '',
      );

      setSuburb(
        existingAddress
          ?.suburb ??
          existingAddress
            ?.city ??
          '',
      );

      setState(
        existingAddress
          ?.state ??
          '',
      );

      setPostcode(
        existingAddress
          ?.postcode ??
          existingAddress
            ?.pincode ??
          '',
      );

      setCountry(
        existingAddress
          ?.country ??
          'Australia',
      );

      setDeliveryInstructions(
        existingAddress
          ?.deliveryInstructions ??
          existingAddress
            ?.delivery_instructions ??
          '',
      );

      setIsDefault(
        Boolean(
          existingAddress
            ?.isDefault ??
            existingAddress
              ?.is_default ??
            false,
        ),
      );
    },
    [
      existingAddress,
    ],
  );

  /* =====================================================
   * Clear Field Error
   * ===================================================== */

  const clearError =
    field => {
      if (
        !errors[
          field
        ]
      ) {
        return;
      }

      setErrors(
        current => ({
          ...current,

          [field]:
            '',
        }),
      );
    };

  /* =====================================================
   * Validation
   * ===================================================== */

  const validateForm =
    () => {
      const newErrors =
        {};

      if (
        !fullName.trim()
      ) {
        newErrors.fullName =
          'Please enter your full name';
      }

      if (
        !mobileNumber.trim()
      ) {
        newErrors.mobileNumber =
          'Please enter your mobile number';
      }

      if (
        !addressLine1.trim()
      ) {
        newErrors.addressLine1 =
          'Please enter your street address';
      }

      if (
        !suburb.trim()
      ) {
        newErrors.suburb =
          'Please enter your suburb';
      }

      if (
        !state.trim()
      ) {
        newErrors.state =
          'Please enter your state';
      }

      if (
        !postcode.trim()
      ) {
        newErrors.postcode =
          'Please enter your postcode';
      }

      if (
        !country.trim()
      ) {
        newErrors.country =
          'Please enter your country';
      }

      setErrors(
        newErrors,
      );

      return (
        Object.keys(
          newErrors,
        ).length ===
        0
      );
    };

  /* =====================================================
   * Read Existing Stored Addresses
   * ===================================================== */

  const getStoredAddresses =
    async () => {
      try {
        const stored =
          await AsyncStorage.getItem(
            ADDRESS_STORAGE_KEY,
          );

        if (!stored) {
          return [];
        }

        const parsed =
          JSON.parse(
            stored,
          );

        return Array.isArray(
          parsed,
        )
          ? parsed
          : [];
      } catch (
        error
      ) {
        console.log(
          'READ ADDRESS ERROR:',
          error,
        );

        return [];
      }
    };

  /* =====================================================
   * Save Address
   * ===================================================== */

  const handleSaveAddress =
    async () => {
      if (
        saving
      ) {
        return;
      }

      if (
        !validateForm()
      ) {
        return;
      }

      try {
        setSaving(
          true,
        );

        setErrors(
          current => ({
            ...current,

            general:
              '',
          }),
        );

        /* =============================================
         * Build Address
         * ============================================= */

        const addressData = {
          id:
            existingAddress
              ?.id
              ? String(
                  existingAddress
                    .id,
                )
              : `address-${Date.now()}`,

          type:
            addressType,

          name:
            fullName
              .trim(),

          phone:
            mobileNumber
              .trim(),

          addressLine1:
            addressLine1
              .trim(),

          addressLine2:
            addressLine2
              .trim(),

          suburb:
            suburb
              .trim(),

          city:
            suburb
              .trim(),

          state:
            state
              .trim(),

          postcode:
            postcode
              .trim(),

          pincode:
            postcode
              .trim(),

          country:
            country
              .trim(),

          deliveryInstructions:
            deliveryInstructions
              .trim(),

          isDefault:
            Boolean(
              isDefault,
            ),

          createdAt:
            existingAddress
              ?.createdAt ??
            new Date()
              .toISOString(),

          updatedAt:
            new Date()
              .toISOString(),
        };

        /* =============================================
         * Existing List
         * ============================================= */

        let addressList =
          await getStoredAddresses();

        /* =============================================
         * New first address should automatically
         * become the default address.
         * ============================================= */

        if (
          !isEdit &&
          addressList.length ===
            0
        ) {
          addressData.isDefault =
            true;
        }

        /* =============================================
         * If current address is default,
         * remove default flag from others.
         * ============================================= */

        if (
          addressData.isDefault
        ) {
          addressList =
            addressList.map(
              item => ({
                ...item,

                isDefault:
                  false,
              }),
            );
        }

        /* =============================================
         * Edit Existing
         * ============================================= */

        if (
          isEdit &&
          existingAddress
            ?.id
        ) {
          const existingIndex =
            addressList.findIndex(
              item =>
                String(
                  item
                    ?.id,
                ) ===
                String(
                  existingAddress
                    .id,
                ),
            );

          if (
            existingIndex >=
            0
          ) {
            addressList[
              existingIndex
            ] =
              addressData;
          } else {
            /*
             * In case edit data did not originally
             * exist in local storage.
             */

            addressList.unshift(
              addressData,
            );
          }
        } else {
          /* =========================================
           * Add New
           * ========================================= */

          addressList.unshift(
            addressData,
          );
        }

        /* =============================================
         * Ensure only one Default Address
         * ============================================= */

        if (
          addressData.isDefault
        ) {
          addressList =
            addressList.map(
              item => ({
                ...item,

                isDefault:
                  String(
                    item.id,
                  ) ===
                  String(
                    addressData
                      .id,
                  ),
              }),
            );
        }

        /* =============================================
         * Safety:
         *
         * If somehow none are default,
         * make first one default.
         * ============================================= */

        if (
          addressList.length >
            0 &&
          !addressList.some(
            item =>
              item
                ?.isDefault,
          )
        ) {
          addressList =
            addressList.map(
              (
                item,
                index,
              ) => ({
                ...item,

                isDefault:
                  index ===
                  0,
              }),
            );

          /*
           * Also update the saved preview if
           * this current address became default.
           */

          const savedItem =
            addressList.find(
              item =>
                String(
                  item.id,
                ) ===
                String(
                  addressData
                    .id,
                ),
            );

          if (
            savedItem
          ) {
            Object.assign(
              addressData,
              savedItem,
            );
          }
        }

        /* =============================================
         * Persist
         * ============================================= */

        await AsyncStorage.setItem(
          ADDRESS_STORAGE_KEY,

          JSON.stringify(
            addressList,
          ),
        );

        console.log(
          'ADDRESS SAVED:',
          JSON.stringify(
            addressData,
            null,
            2,
          ),
        );

        console.log(
          'ALL SAVED ADDRESSES:',
          JSON.stringify(
            addressList,
            null,
            2,
          ),
        );

        /* =============================================
         * Custom Success Popup
         * ============================================= */

        setSavedAddress(
          addressData,
        );

        setSuccessPopupVisible(
          true,
        );
      } catch (
        saveError
      ) {
        console.log(
          'SAVE ADDRESS ERROR:',
          saveError,
        );

        setErrors(
          current => ({
            ...current,

            general:
              'Unable to save address. Please try again.',
          }),
        );
      } finally {
        setSaving(
          false,
        );
      }
    };

  /* =====================================================
   * Close Success + Go Back
   * ===================================================== */

  const handleSuccessDone =
    () => {
      setSuccessPopupVisible(
        false,
      );

      navigation.goBack();
    };

  /* =====================================================
   * UI
   * ===================================================== */

  return (
    <>
      <SafeAreaView
        style={
          styles.safeArea
        }>

        <StatusBar
          barStyle="dark-content"

          backgroundColor="#FFF9F6"
        />

        <KeyboardAvoidingView
          style={
            styles.keyboardView
          }

          behavior={
            Platform.OS ===
            'ios'
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

              <View
                style={
                  styles.header
                }>

                <Pressable
                  hitSlop={
                    10
                  }

                  style={
                    styles.backButton
                  }

                  onPress={() =>
                    navigation.goBack()
                  }>

                  <Image
                    source={require('../assets/login-icons/back.png')}

                    style={
                      styles.backIcon
                    }

                    resizeMode="contain"
                  />

                </Pressable>

                <View
                  style={
                    styles.headerTextContainer
                  }>

                  <Text
                    style={
                      styles.headerEyebrow
                    }>
                    DELIVERY ADDRESS
                  </Text>

                  <Text
                    style={
                      styles.headerTitle
                    }>

                    {isEdit
                      ? 'Edit Address'
                      : 'Add Address'}

                  </Text>

                </View>

                <View
                  style={
                    styles.headerSpacer
                  }
                />

              </View>

              {/* ================================================= */}
              {/* ADDRESS TYPE */}
              {/* ================================================= */}

              <View
                style={
                  styles.sectionCard
                }>

                <Text
                  style={
                    styles.sectionTitle
                  }>
                  Address Type
                </Text>

                <Text
                  style={
                    styles.sectionSubtitle
                  }>
                  Choose a label for this delivery address.
                </Text>

                <View
                  style={
                    styles.typeRow
                  }>

                  <AddressTypeButton
                    title="Home"

                    selected={
                      addressType ===
                      'Home'
                    }

                    onPress={() =>
                      setAddressType(
                        'Home',
                      )
                    }
                  />

                  <AddressTypeButton
                    title="Work"

                    selected={
                      addressType ===
                      'Work'
                    }

                    onPress={() =>
                      setAddressType(
                        'Work',
                      )
                    }
                  />

                  <AddressTypeButton
                    title="Other"

                    selected={
                      addressType ===
                      'Other'
                    }

                    onPress={() =>
                      setAddressType(
                        'Other',
                      )
                    }
                  />

                </View>

              </View>

              {/* ================================================= */}
              {/* CONTACT */}
              {/* ================================================= */}

              <View
                style={
                  styles.sectionCard
                }>

                <Text
                  style={
                    styles.sectionTitle
                  }>
                  Contact Details
                </Text>

                <Text
                  style={
                    styles.sectionSubtitle
                  }>
                  Used by the driver when delivering your order.
                </Text>

                <FormInput
                  label="Full Name"

                  placeholder="Enter full name"

                  value={
                    fullName
                  }

                  error={
                    errors.fullName
                  }

                  autoCapitalize="words"

                  onChangeText={
                    value => {
                      setFullName(
                        value,
                      );

                      clearError(
                        'fullName',
                      );
                    }
                  }
                />

                <FormInput
                  label="Mobile Number"

                  placeholder="+61 400 000 000"

                  value={
                    mobileNumber
                  }

                  error={
                    errors.mobileNumber
                  }

                  keyboardType="phone-pad"

                  onChangeText={
                    value => {
                      setMobileNumber(
                        value,
                      );

                      clearError(
                        'mobileNumber',
                      );
                    }
                  }
                />

              </View>

              {/* ================================================= */}
              {/* DELIVERY ADDRESS */}
              {/* ================================================= */}

              <View
                style={
                  styles.sectionCard
                }>

                <Text
                  style={
                    styles.sectionTitle
                  }>
                  Address Details
                </Text>

                <Text
                  style={
                    styles.sectionSubtitle
                  }>
                  Enter the complete address for your tiffin delivery.
                </Text>

                <FormInput
                  label="Address Line 1"

                  placeholder="Street address"

                  value={
                    addressLine1
                  }

                  error={
                    errors.addressLine1
                  }

                  onChangeText={
                    value => {
                      setAddressLine1(
                        value,
                      );

                      clearError(
                        'addressLine1',
                      );
                    }
                  }
                />

                <FormInput
                  label="Address Line 2"

                  placeholder="Apartment, unit, floor (optional)"

                  value={
                    addressLine2
                  }

                  onChangeText={
                    setAddressLine2
                  }
                />

                <FormInput
                  label="Suburb / City"

                  placeholder="Enter suburb or city"

                  value={
                    suburb
                  }

                  error={
                    errors.suburb
                  }

                  onChangeText={
                    value => {
                      setSuburb(
                        value,
                      );

                      clearError(
                        'suburb',
                      );
                    }
                  }
                />

                {/* ============================================= */}
                {/* State + Postcode */}
                {/* ============================================= */}

                <View
                  style={
                    styles.doubleRow
                  }>

                  <View
                    style={
                      styles.halfInput
                    }>

                    <FormInput
                      label="State"

                      placeholder="VIC"

                      value={
                        state
                      }

                      error={
                        errors.state
                      }

                      autoCapitalize="characters"

                      onChangeText={
                        value => {
                          setState(
                            value,
                          );

                          clearError(
                            'state',
                          );
                        }
                      }
                    />

                  </View>

                  <View
                    style={
                      styles.inputGap
                    }
                  />

                  <View
                    style={
                      styles.halfInput
                    }>

                    <FormInput
                      label="Postcode"

                      placeholder="3000"

                      value={
                        postcode
                      }

                      error={
                        errors.postcode
                      }

                      keyboardType="number-pad"

                      onChangeText={
                        value => {
                          setPostcode(
                            value,
                          );

                          clearError(
                            'postcode',
                          );
                        }
                      }
                    />

                  </View>

                </View>

                <FormInput
                  label="Country"

                  placeholder="Enter country"

                  value={
                    country
                  }

                  error={
                    errors.country
                  }

                  autoCapitalize="words"

                  onChangeText={
                    value => {
                      setCountry(
                        value,
                      );

                      clearError(
                        'country',
                      );
                    }
                  }
                />

              </View>

              {/* ================================================= */}
              {/* DELIVERY INSTRUCTIONS */}
              {/* ================================================= */}

              <View
                style={
                  styles.sectionCard
                }>

                <Text
                  style={
                    styles.sectionTitle
                  }>
                  Delivery Instructions
                </Text>

                <Text
                  style={
                    styles.sectionSubtitle
                  }>
                  Optional instructions for your delivery driver.
                </Text>

                <View
                  style={
                    styles.textAreaContainer
                  }>

                  <TextInput
                    value={
                      deliveryInstructions
                    }

                    onChangeText={
                      setDeliveryInstructions
                    }

                    placeholder="Example: Leave at front door, ring bell on arrival..."

                    placeholderTextColor="#B3A39D"

                    multiline

                    textAlignVertical="top"

                    maxLength={
                      200
                    }

                    style={
                      styles.textArea
                    }
                  />

                </View>

                <Text
                  style={
                    styles.characterCount
                  }>

                  {deliveryInstructions.length}/200

                </Text>

              </View>

              {/* ================================================= */}
              {/* DEFAULT */}
              {/* ================================================= */}

              <View
                style={
                  styles.defaultCard
                }>

                <View
                  style={
                    styles.defaultIconContainer
                  }>

                  <Image
                    source={require('../assets/login-icons/home.png')}

                    style={
                      styles.defaultIcon
                    }

                    resizeMode="contain"
                  />

                </View>

                <View
                  style={
                    styles.defaultDetails
                  }>

                  <Text
                    style={
                      styles.defaultTitle
                    }>
                    Set as Default Address
                  </Text>

                  <Text
                    style={
                      styles.defaultSubtitle
                    }>
                    Use this address automatically for future orders.
                  </Text>

                </View>

                <Switch
                  value={
                    isDefault
                  }

                  onValueChange={
                    setIsDefault
                  }

                  trackColor={{
                    false:
                      '#DDD7D2',

                    true:
                      '#E6A27E',
                  }}

                  thumbColor={
                    isDefault
                      ? '#B64D19'
                      : '#FFFFFF'
                  }
                />

              </View>

              {/* ================================================= */}
              {/* General Error */}
              {/* ================================================= */}

              {!!errors.general && (
                <View
                  style={
                    styles.generalErrorBox
                  }>

                  <Text
                    style={
                      styles.generalErrorText
                    }>
                    {
                      errors.general
                    }
                  </Text>

                </View>
              )}

              {/* ================================================= */}
              {/* SAVE */}
              {/* ================================================= */}

              <TouchableOpacity
                activeOpacity={
                  0.85
                }

                disabled={
                  saving
                }

                style={[
                  styles.saveButton,

                  saving &&
                    styles.saveButtonDisabled,
                ]}

                onPress={
                  handleSaveAddress
                }>

                {saving ? (
                  <ActivityIndicator
                    size="small"

                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.saveButtonText
                    }>

                    {isEdit
                      ? 'Update Address'
                      : 'Save Address'}

                  </Text>
                )}

              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={
                  0.8
                }

                disabled={
                  saving
                }

                style={
                  styles.cancelButton
                }

                onPress={() =>
                  navigation.goBack()
                }>

                <Text
                  style={
                    styles.cancelText
                  }>
                  Cancel
                </Text>

              </TouchableOpacity>

            </ScrollView>

          </View>

        </KeyboardAvoidingView>

      </SafeAreaView>

      {/* ================================================= */}
      {/* ADDRESS SAVED SUCCESS POPUP */}
      {/* ================================================= */}

      <Modal
        visible={
          successPopupVisible
        }

        transparent

        animationType="fade"

        statusBarTranslucent

        onRequestClose={() => {}}>

        <View
          style={
            styles.successOverlay
          }>

          <View
            style={
              styles.successPopupCard
            }>

            {/* =========================================== */}
            {/* Icon */}
            {/* =========================================== */}

            <View
              style={
                styles.successIconOuter
              }>

              <View
                style={
                  styles.successIconInner
                }>

                <Text
                  style={
                    styles.successCheck
                  }>
                  ✓
                </Text>

              </View>

            </View>

            {/* =========================================== */}
            {/* Heading */}
            {/* =========================================== */}

            <Text
              style={
                styles.successPopupTitle
              }>

              {isEdit
                ? 'Address Updated!'
                : 'Address Saved!'}

            </Text>

            <Text
              style={
                styles.successPopupDescription
              }>

              {isEdit
                ? 'Your delivery address has been updated successfully.'
                : 'Your new delivery address has been saved successfully.'}

            </Text>

            {/* =========================================== */}
            {/* Address Preview */}
            {/* =========================================== */}

            {!!savedAddress && (
              <View
                style={
                  styles.savedAddressPreview
                }>

                <View
                  style={
                    styles.savedAddressTopRow
                  }>

                  <Text
                    style={
                      styles.savedAddressType
                    }>

                    {
                      savedAddress.type
                    }

                  </Text>

                  {savedAddress.isDefault && (
                    <View
                      style={
                        styles.savedDefaultBadge
                      }>

                      <Text
                        style={
                          styles.savedDefaultBadgeText
                        }>
                        Default
                      </Text>

                    </View>
                  )}

                </View>

                <Text
                  style={
                    styles.savedAddressName
                  }>

                  {
                    savedAddress.name
                  }

                </Text>

                <Text
                  style={
                    styles.savedAddressPhone
                  }>

                  {
                    savedAddress.phone
                  }

                </Text>

                <Text
                  style={
                    styles.savedAddressText
                  }>

                  {[
                    savedAddress
                      .addressLine1,

                    savedAddress
                      .addressLine2,

                    savedAddress
                      .suburb,

                    savedAddress
                      .state,

                    savedAddress
                      .postcode,

                    savedAddress
                      .country,
                  ]
                    .filter(
                      Boolean,
                    )
                    .join(
                      ', ',
                    )}

                </Text>

              </View>
            )}

            {/* =========================================== */}
            {/* Done */}
            {/* =========================================== */}

            <TouchableOpacity
              activeOpacity={
                0.85
              }

              style={
                styles.successDoneButton
              }

              onPress={
                handleSuccessDone
              }>

              <Text
                style={
                  styles.successDoneText
                }>
                Done
              </Text>

            </TouchableOpacity>

          </View>

        </View>

      </Modal>
    </>
  );
};

/* =========================================================
 * Address Type Button
 * ========================================================= */

const AddressTypeButton = ({
  title,
  selected,
  onPress,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={
        0.8
      }

      style={[
        styles.typeButton,

        selected &&
          styles.typeButtonSelected,
      ]}

      onPress={
        onPress
      }>

      <View
        style={[
          styles.typeRadio,

          selected &&
            styles.typeRadioSelected,
        ]}>

        {selected ? (
          <View
            style={
              styles.typeRadioInner
            }
          />
        ) : null}

      </View>

      <Text
        style={[
          styles.typeButtonText,

          selected &&
            styles.typeButtonTextSelected,
        ]}>

        {
          title
        }

      </Text>

    </TouchableOpacity>
  );
};

/* =========================================================
 * Form Input
 * ========================================================= */

const FormInput = ({
  label,
  error,
  ...props
}) => {
  return (
    <View
      style={
        styles.fieldContainer
      }>

      <Text
        style={
          styles.inputLabel
        }>
        {label}
      </Text>

      <View
        style={[
          styles.inputContainer,

          error &&
            styles.inputContainerError,
        ]}>

        <TextInput
          {...props}

          placeholderTextColor="#B3A39D"

          style={
            styles.input
          }
        />

      </View>

      {error ? (
        <Text
          style={
            styles.errorText
          }>

          {
            error
          }

        </Text>
      ) : null}

    </View>
  );
};

export default AddAddress;

/* =========================================================
 * Styles
 * ========================================================= */

const styles =
  StyleSheet.create({
    safeArea: {
      flex:
        1,

      backgroundColor:
        '#F5F0ED',
    },

    keyboardView: {
      flex:
        1,
    },

    screenContainer: {
      flex:
        1,

      alignSelf:
        'center',

      backgroundColor:
        '#FFF9F6',
    },

    scrollContent: {
      paddingTop:
        10,

      paddingBottom:
        70,
    },

    /* =====================================================
     * Header
     * ===================================================== */

    header: {
      minHeight:
        65,

      flexDirection:
        'row',

      alignItems:
        'center',

      marginBottom:
        14,
    },

    backButton: {
      width:
        42,

      height:
        42,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EFE5E0',

      borderRadius:
        14,
    },

    backIcon: {
      width:
        19,

      height:
        19,
    },

    headerTextContainer: {
      flex:
        1,

      paddingHorizontal:
        12,
    },

    headerEyebrow: {
      color:
        '#A84B20',

      fontSize:
        9,

      fontWeight:
        '800',

      letterSpacing:
        1,
    },

    headerTitle: {
      color:
        '#231815',

      fontSize:
        24,

      fontWeight:
        '900',

      marginTop:
        2,
    },

    headerSpacer: {
      width:
        42,
    },

    /* =====================================================
     * Section
     * ===================================================== */

    sectionCard: {
      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EFE5E0',

      borderRadius:
        17,

      padding:
        14,

      marginBottom:
        13,

      shadowColor:
        '#503328',

      shadowOffset: {
        width:
          0,

        height:
          3,
      },

      shadowOpacity:
        0.04,

      shadowRadius:
        8,

      elevation:
        2,
    },

    sectionTitle: {
      color:
        '#2B1D18',

      fontSize:
        18,

      fontWeight:
        '900',
    },

    sectionSubtitle: {
      color:
        '#928079',

      fontSize:
        8.5,

      lineHeight:
        13,

      marginTop:
        4,

      marginBottom:
        15,
    },

    /* =====================================================
     * Address Type
     * ===================================================== */

    typeRow: {
      flexDirection:
        'row',
    },

    typeButton: {
      flex:
        1,

      minHeight:
        46,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF9F6',

      borderWidth:
        1,

      borderColor:
        '#EFE4DE',

      borderRadius:
        12,

      marginHorizontal:
        3,
    },

    typeButtonSelected: {
      backgroundColor:
        '#FFF0E8',

      borderColor:
        '#D99170',
    },

    typeRadio: {
      width:
        15,

      height:
        15,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderWidth:
        1.5,

      borderColor:
        '#B8AAA4',

      borderRadius:
        50,

      marginRight:
        6,
    },

    typeRadioSelected: {
      borderColor:
        '#A84B20',
    },

    typeRadioInner: {
      width:
        7,

      height:
        7,

      backgroundColor:
        '#A84B20',

      borderRadius:
        50,
    },

    typeButtonText: {
      color:
        '#71605A',

      fontSize:
        9,

      fontWeight:
        '700',
    },

    typeButtonTextSelected: {
      color:
        '#A84B20',

      fontWeight:
        '800',
    },

    /* =====================================================
     * Fields
     * ===================================================== */

    fieldContainer: {
      marginBottom:
        14,
    },

    inputLabel: {
      color:
        '#4A3831',

      fontSize:
        10,

      fontWeight:
        '700',

      marginBottom:
        7,
    },

    inputContainer: {
      minHeight:
        51,

      justifyContent:
        'center',

      backgroundColor:
        '#FFF9F6',

      borderWidth:
        1,

      borderColor:
        '#EDE2DC',

      borderRadius:
        13,
    },

    inputContainerError: {
      borderColor:
        '#A00B0F',
    },

    input: {
      minHeight:
        49,

      color:
        '#2C201B',

      fontSize:
        10.5,

      fontWeight:
        '600',

      paddingHorizontal:
        13,

      paddingVertical:
        0,
    },

    errorText: {
      color:
        '#A00B0F',

      fontSize:
        8,

      fontWeight:
        '600',

      marginTop:
        5,

      marginLeft:
        3,
    },

    doubleRow: {
      flexDirection:
        'row',
    },

    halfInput: {
      flex:
        1,
    },

    inputGap: {
      width:
        10,
    },

    /* =====================================================
     * Instructions
     * ===================================================== */

    textAreaContainer: {
      minHeight:
        110,

      backgroundColor:
        '#FFF9F6',

      borderWidth:
        1,

      borderColor:
        '#EDE2DC',

      borderRadius:
        13,
    },

    textArea: {
      minHeight:
        108,

      color:
        '#2C201B',

      fontSize:
        10,

      lineHeight:
        16,

      paddingHorizontal:
        13,

      paddingVertical:
        12,
    },

    characterCount: {
      color:
        '#A99B95',

      fontSize:
        7.5,

      textAlign:
        'right',

      marginTop:
        5,
    },

    /* =====================================================
     * Default
     * ===================================================== */

    defaultCard: {
      minHeight:
        76,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EFE5E0',

      borderRadius:
        16,

      paddingHorizontal:
        12,

      paddingVertical:
        11,

      marginBottom:
        14,
    },

    defaultIconContainer: {
      width:
        43,

      height:
        43,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0E8',

      borderRadius:
        12,

      marginRight:
        11,
    },

    defaultIcon: {
      width:
        21,

      height:
        21,
    },

    defaultDetails: {
      flex:
        1,

      paddingRight:
        8,
    },

    defaultTitle: {
      color:
        '#30231E',

      fontSize:
        11,

      fontWeight:
        '800',
    },

    defaultSubtitle: {
      color:
        '#908079',

      fontSize:
        8,

      lineHeight:
        12,

      marginTop:
        4,
    },

    /* =====================================================
     * General Error
     * ===================================================== */

    generalErrorBox: {
      width:
        '100%',

      backgroundColor:
        '#FFF1F1',

      borderWidth:
        1,

      borderColor:
        '#F0CECE',

      borderRadius:
        11,

      padding:
        10,

      marginBottom:
        10,
    },

    generalErrorText: {
      color:
        '#A00B0F',

      fontSize:
        9,

      lineHeight:
        14,

      fontWeight:
        '700',

      textAlign:
        'center',
    },

    /* =====================================================
     * Buttons
     * ===================================================== */

    saveButton: {
      minHeight:
        54,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#A00B0F',

      borderRadius:
        14,

      marginTop:
        3,

      shadowColor:
        '#A00B0F',

      shadowOffset: {
        width:
          0,

        height:
          4,
      },

      shadowOpacity:
        0.15,

      shadowRadius:
        8,

      elevation:
        3,
    },

    saveButtonDisabled: {
      opacity:
        0.6,
    },

    saveButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        15,

      fontWeight:
        '800',
    },

    cancelButton: {
      minHeight:
        48,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginTop:
        5,
    },

    cancelText: {
      color:
        '#8E7770',

      fontSize:
        11,

      fontWeight:
        '700',
    },

    /* =====================================================
     * Success Popup
     * ===================================================== */

    successOverlay: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(28, 19, 17, 0.62)',

      paddingHorizontal:
        22,
    },

    successPopupCard: {
      width:
        '100%',

      maxWidth:
        380,

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        26,

      paddingHorizontal:
        22,

      paddingTop:
        27,

      paddingBottom:
        21,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          10,
      },

      shadowOpacity:
        0.22,

      shadowRadius:
        18,

      elevation:
        18,
    },

    successIconOuter: {
      width:
        84,

      height:
        84,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#EDF8F1',

      borderRadius:
        42,

      marginBottom:
        15,
    },

    successIconInner: {
      width:
        58,

      height:
        58,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#27905B',

      borderRadius:
        29,
    },

    successCheck: {
      color:
        '#FFFFFF',

      fontSize:
        31,

      lineHeight:
        34,

      fontWeight:
        '900',
    },

    successPopupTitle: {
      color:
        '#281C19',

      fontSize:
        20,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    successPopupDescription: {
      maxWidth:
        290,

      color:
        '#766B67',

      fontSize:
        10,

      lineHeight:
        16,

      textAlign:
        'center',

      marginTop:
        7,
    },

    /* =====================================================
     * Saved Address Preview
     * ===================================================== */

    savedAddressPreview: {
      width:
        '100%',

      backgroundColor:
        '#FFF9F6',

      borderWidth:
        1,

      borderColor:
        '#EEE3DE',

      borderRadius:
        13,

      padding:
        12,

      marginTop:
        17,
    },

    savedAddressTopRow: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    savedAddressType: {
      color:
        '#A00B0F',

      fontSize:
        9,

      fontWeight:
        '900',

      textTransform:
        'uppercase',

      letterSpacing:
        0.4,
    },

    savedDefaultBadge: {
      backgroundColor:
        '#FBE4D8',

      borderRadius:
        12,

      paddingHorizontal:
        7,

      paddingVertical:
        3,

      marginLeft:
        7,
    },

    savedDefaultBadgeText: {
      color:
        '#A00B0F',

      fontSize:
        7,

      fontWeight:
        '800',
    },

    savedAddressName: {
      color:
        '#30231E',

      fontSize:
        11,

      fontWeight:
        '900',

      marginTop:
        7,
    },

    savedAddressPhone: {
      color:
        '#A84B20',

      fontSize:
        8.5,

      fontWeight:
        '700',

      marginTop:
        3,
    },

    savedAddressText: {
      color:
        '#82736D',

      fontSize:
        9,

      lineHeight:
        14,

      marginTop:
        4,
    },

    successDoneButton: {
      width:
        '100%',

      minHeight:
        49,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#A00B0F',

      borderRadius:
        13,

      marginTop:
        19,
    },

    successDoneText: {
      color:
        '#FFFFFF',

      fontSize:
        10,

      fontWeight:
        '900',
    },
  });