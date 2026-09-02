import React, {
  useEffect,
  useMemo,
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
 * APIs
 * ========================================================= */

const PROFILE_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/profile';

const PROFILE_EDIT_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/profile/edit';

const ADDRESS_STORAGE_KEY =
  'kp_customer_addresses';

/* =========================================================
 * HELPERS
 * ========================================================= */

const getAddressLine =
  address =>
    [
      address?.addressLine1,
      address?.addressLine2,
      address?.suburb,
      address?.state,
      address?.country,
    ]
      .filter(Boolean)
      .map(value =>
        String(value).trim(),
      )
      .filter(Boolean)
      .join(', ');

const toApiAddress =
  address => ({
    type:
      String(
        address?.type ??
          'Home',
      ).trim(),

    address_line:
      address?.address_line ??
      getAddressLine(
        address,
      ),

    pincode:
      String(
        address?.postcode ??
          address?.pincode ??
          '',
      ).trim(),

    is_default:
      Boolean(
        address?.isDefault ??
          address?.is_default,
      ),
  });

/* =========================================================
 * ADD ADDRESS
 * ========================================================= */

const AddAddress = ({
  navigation,
  route,
}) => {
  const {
    width,
  } =
    useWindowDimensions();

  const mode =
    route?.params?.mode ??
    'add';

  const existingAddress =
    route?.params?.address ??
    null;

  const isEdit =
    mode ===
    'edit';

  /* =======================================================
   * FORM
   * ======================================================= */

  const [
    addressType,
    setAddressType,
  ] =
    useState('Home');

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
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    errors,
    setErrors,
  ] =
    useState({});

  const responsive =
    useMemo(
      () => ({
        width:
          width >= 768
            ? Math.min(
                width - 80,
                720,
              )
            : width,

        padding:
          width >= 768
            ? 28
            : 14,
      }),
      [
        width,
      ],
    );

  /* =======================================================
   * LOAD EDIT VALUES
   * ======================================================= */

  useEffect(
    () => {
      if (
        !existingAddress
      ) {
        return;
      }

      setAddressType(
        existingAddress?.type ??
          'Home',
      );

      setFullName(
        existingAddress?.name ??
          '',
      );

      setMobileNumber(
        existingAddress?.phone ??
          '',
      );

      setAddressLine1(
        existingAddress?.addressLine1 ??
        existingAddress?.address_line_1 ??
        existingAddress?.address_line ??
        '',
      );

      setAddressLine2(
        existingAddress?.addressLine2 ??
        existingAddress?.address_line_2 ??
        '',
      );

      setSuburb(
        existingAddress?.suburb ??
        existingAddress?.city ??
        '',
      );

      setState(
        existingAddress?.state ??
          '',
      );

      setPostcode(
        String(
          existingAddress?.postcode ??
            existingAddress?.pincode ??
            '',
        ),
      );

      setCountry(
        existingAddress?.country ??
          'Australia',
      );

      setDeliveryInstructions(
        existingAddress?.deliveryInstructions ??
        existingAddress?.delivery_instructions ??
        '',
      );

      setIsDefault(
        Boolean(
          existingAddress?.isDefault ??
            existingAddress?.is_default ??
            false,
        ),
      );
    },
    [
      existingAddress,
    ],
  );

  /* =======================================================
   * GET STORED ADDRESSES
   * ======================================================= */

  const getStoredAddresses =
    async () => {
      try {
        const stored =
          await AsyncStorage.getItem(
            ADDRESS_STORAGE_KEY,
          );

        const parsed =
          stored
            ? JSON.parse(
                stored,
              )
            : [];

        return Array.isArray(
          parsed,
        )
          ? parsed
          : [];
      } catch {
        return [];
      }
    };

  /* =======================================================
   * GET PROFILE
   * ======================================================= */

  const getProfile =
    async token => {
      const response =
        await fetch(
          PROFILE_API_URL,
          {
            headers: {
              Accept:
                'application/json',

              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const text =
        await response.text();

      let result =
        {};

      try {
        result =
          text
            ? JSON.parse(
                text,
              )
            : {};
      } catch {
        result =
          {};
      }

      if (
        !response.ok
      ) {
        throw new Error(
          result?.message ??
            'Unable to load profile.',
        );
      }

      return (
        result?.data?.customer ??
        result?.data?.user ??
        result?.data?.profile ??
        result?.data ??
        result?.customer ??
        result
      );
    };

  /* =======================================================
   * SYNC PROFILE
   * ======================================================= */

  const syncAddressList =
    async addressList => {
      const token =
        await AsyncStorage.getItem(
          'token',
        );

      if (!token) {
        throw new Error(
          'Authentication token not found.',
        );
      }

      const profile =
        await getProfile(
          token,
        );

      let firstName =
        profile?.first_name ??
        '';

      let lastName =
        profile?.last_name ??
        '';

      if (
        !firstName &&
        profile?.name
      ) {
        const parts =
          String(
            profile.name,
          )
            .trim()
            .split(
              /\s+/,
            );

        firstName =
          parts[0] ??
          '';

        lastName =
          parts
            .slice(
              1,
            )
            .join(
              ' ',
            );
      }

      const payload = {
        first_name:
          firstName,

        last_name:
          lastName,

        phone:
          profile?.phone ??
          '',

        email:
          profile?.email ??
          '',

        addresses:
          addressList.map(
            toApiAddress,
          ),
      };

      console.log(
        'ADD ADDRESS PROFILE PAYLOAD:',
        JSON.stringify(
          payload,
          null,
          2,
        ),
      );

      const response =
        await fetch(
          PROFILE_EDIT_API_URL,
          {
            method:
              'POST',

            headers: {
              Accept:
                'application/json',

              'Content-Type':
                'application/json',

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify(
                payload,
              ),
          },
        );

      const text =
        await response.text();

      let result =
        {};

      try {
        result =
          text
            ? JSON.parse(
                text,
              )
            : {};
      } catch {
        result =
          {};
      }

      console.log(
        'ADD ADDRESS SYNC STATUS:',
        response.status,
      );

      console.log(
        'ADD ADDRESS SYNC RESPONSE:',
        text,
      );

      /*
       * IMPORTANT:
       * No automatic logout/reset.
       */

      if (
        !response.ok ||
        result?.success ===
          false
      ) {
        throw new Error(
          result?.message ??
            result?.error ??
            'Unable to save address.',
        );
      }
    };

  /* =======================================================
   * VALIDATE
   * ======================================================= */

  const validate =
    () => {
      const nextErrors =
        {};

      if (
        !fullName.trim()
      ) {
        nextErrors.fullName =
          'Please enter full name';
      }

      if (
        !mobileNumber.trim()
      ) {
        nextErrors.mobileNumber =
          'Please enter mobile number';
      }

      if (
        !addressLine1.trim()
      ) {
        nextErrors.addressLine1 =
          'Please enter address';
      }

      if (
        !suburb.trim()
      ) {
        nextErrors.suburb =
          'Please enter suburb';
      }

      if (
        !state.trim()
      ) {
        nextErrors.state =
          'Please enter state';
      }

      if (
        !postcode.trim()
      ) {
        nextErrors.postcode =
          'Please enter postcode';
      }

      setErrors(
        nextErrors,
      );

      return (
        Object.keys(
          nextErrors,
        ).length === 0
      );
    };

  /* =======================================================
   * SAVE
   * ======================================================= */

  const handleSaveAddress =
    async () => {
      if (
        saving ||
        !validate()
      ) {
        return;
      }

      try {
        setSaving(
          true,
        );

        const addressData = {
          id:
            existingAddress?.id
              ? String(
                  existingAddress.id,
                )
              : `address-${Date.now()}`,

          type:
            addressType,

          name:
            fullName.trim(),

          phone:
            mobileNumber.trim(),

          addressLine1:
            addressLine1.trim(),

          addressLine2:
            addressLine2.trim(),

          suburb:
            suburb.trim(),

          city:
            suburb.trim(),

          state:
            state.trim(),

          postcode:
            postcode.trim(),

          pincode:
            postcode.trim(),

          country:
            country.trim(),

          deliveryInstructions:
            deliveryInstructions.trim(),

          isDefault:
            Boolean(
              isDefault,
            ),

          is_default:
            Boolean(
              isDefault,
            ),

          address_line:
            [
              addressLine1.trim(),
              addressLine2.trim(),
              suburb.trim(),
              state.trim(),
              country.trim(),
            ]
              .filter(Boolean)
              .join(', '),
        };

        let addressList =
          await getStoredAddresses();

        /*
         * First address becomes default.
         */

        if (
          !isEdit &&
          addressList.length ===
            0
        ) {
          addressData.isDefault =
            true;

          addressData.is_default =
            true;
        }

        /*
         * When new/current is default,
         * unset all others.
         */

        if (
          addressData.isDefault
        ) {
          addressList =
            addressList.map(
              item => ({
                ...item,

                isDefault:
                  false,

                is_default:
                  false,
              }),
            );
        }

        if (
          isEdit &&
          existingAddress?.id
        ) {
          const index =
            addressList.findIndex(
              item =>
                String(
                  item?.id,
                ) ===
                String(
                  existingAddress.id,
                ),
            );

          if (
            index >= 0
          ) {
            addressList[index] =
              addressData;
          } else {
            addressList.push(
              addressData,
            );
          }
        } else {
          addressList.push(
            addressData,
          );
        }

        /*
         * Ensure exactly one default.
         */

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
                    addressData.id,
                  ),

                is_default:
                  String(
                    item.id,
                  ) ===
                  String(
                    addressData.id,
                  ),
              }),
            );
        }

        if (
          addressList.length > 0 &&
          !addressList.some(
            item =>
              item.isDefault,
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
                  index === 0,

                is_default:
                  index === 0,
              }),
            );
        }

        /*
         * FIRST sync backend.
         */

        await syncAddressList(
          addressList,
        );

        /*
         * Then persist exact same list locally.
         */

        await AsyncStorage.setItem(
          ADDRESS_STORAGE_KEY,
          JSON.stringify(
            addressList,
          ),
        );

        Alert.alert(
          isEdit
            ? 'Address Updated'
            : 'Address Added',

          isEdit
            ? 'Your address has been updated successfully.'
            : 'Your new address has been added successfully.',

          [
            {
              text:
                'OK',

              onPress: () =>
                navigation.goBack(),
            },
          ],
        );
      } catch (
        saveError
      ) {
        console.log(
          'SAVE ADDRESS ERROR:',
          saveError,
        );

        Alert.alert(
          'Address Save Failed',
          saveError?.message ??
            'Unable to save address.',
        );
      } finally {
        setSaving(
          false,
        );
      }
    };

  /* =======================================================
   * UI
   * ======================================================= */

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFF9F6"
      />

      <KeyboardAvoidingView
        style={{
          flex:
            1,
        }}
        behavior={
          Platform.OS ===
            'ios'
            ? 'padding'
            : undefined
        }
      >
        <View
          style={[
            styles.screen,

            {
              width:
                responsive.width,
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal:
                responsive.padding,

              paddingBottom:
                80,
            }}
          >
            {/* HEADER */}

            <View
              style={
                styles.header
              }
            >
              <Pressable
                style={
                  styles.backButton
                }
                onPress={() =>
                  navigation.goBack()
                }
              >
                <Image
                  source={require('../assets/login-icons/back.png')}
                  style={
                    styles.backIcon
                  }
                />
              </Pressable>

              <View>
                <Text
                  style={
                    styles.eyebrow
                  }
                >
                  DELIVERY ADDRESS
                </Text>

                <Text
                  style={
                    styles.title
                  }
                >
                  {isEdit
                    ? 'Edit Address'
                    : 'Add Address'}
                </Text>
              </View>
            </View>

            {/* TYPE */}

            <View
              style={
                styles.card
              }
            >
              <Text
                style={
                  styles.cardTitle
                }
              >
                Address Type
              </Text>

              <View
                style={
                  styles.typeRow
                }
              >
                {[
                  'Home',
                  'Work',
                  'Other',
                ].map(
                  type => (
                    <TouchableOpacity
                      key={
                        type
                      }
                      style={[
                        styles.typeButton,

                        addressType ===
                          type &&
                          styles.typeButtonActive,
                      ]}
                      onPress={() =>
                        setAddressType(
                          type,
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.typeButtonText,

                          addressType ===
                            type &&
                            styles.typeButtonTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>
            </View>

            {/* CONTACT */}

            <View
              style={
                styles.card
              }
            >
              <Text
                style={
                  styles.cardTitle
                }
              >
                Contact Details
              </Text>

              <FormInput
                label="Full Name"
                value={
                  fullName
                }
                onChangeText={
                  setFullName
                }
                error={
                  errors.fullName
                }
              />

              <FormInput
                label="Mobile Number"
                value={
                  mobileNumber
                }
                onChangeText={
                  setMobileNumber
                }
                keyboardType="phone-pad"
                error={
                  errors.mobileNumber
                }
              />
            </View>

            {/* ADDRESS */}

            <View
              style={
                styles.card
              }
            >
              <Text
                style={
                  styles.cardTitle
                }
              >
                Address Details
              </Text>

              <FormInput
                label="Address Line 1"
                value={
                  addressLine1
                }
                onChangeText={
                  setAddressLine1
                }
                error={
                  errors.addressLine1
                }
              />

              <FormInput
                label="Address Line 2"
                value={
                  addressLine2
                }
                onChangeText={
                  setAddressLine2
                }
              />

              <FormInput
                label="Suburb"
                value={
                  suburb
                }
                onChangeText={
                  setSuburb
                }
                error={
                  errors.suburb
                }
              />

              <FormInput
                label="State"
                value={
                  state
                }
                onChangeText={
                  setState
                }
                error={
                  errors.state
                }
              />

              <FormInput
                label="Postcode"
                value={
                  postcode
                }
                onChangeText={
                  setPostcode
                }
                keyboardType="number-pad"
                error={
                  errors.postcode
                }
              />

              <FormInput
                label="Country"
                value={
                  country
                }
                onChangeText={
                  setCountry
                }
              />

              <FormInput
                label="Delivery Instructions"
                value={
                  deliveryInstructions
                }
                onChangeText={
                  setDeliveryInstructions
                }
                multiline
              />

              <View
                style={
                  styles.defaultRow
                }
              >
                <View
                  style={
                    styles.defaultIconBox
                  }
                >
                  <Image
                    source={require('../assets/login-icons/home.png')}
                    style={
                      styles.defaultIcon
                    }
                  />
                </View>

                <View
                  style={{
                    flex:
                      1,
                  }}
                >
                  <Text
                    style={
                      styles.defaultTitle
                    }
                  >
                    Make Default Address
                  </Text>

                  <Text
                    style={
                      styles.defaultSubtitle
                    }
                  >
                    Use this as your main delivery address.
                  </Text>
                </View>

                <Switch
                  value={
                    isDefault
                  }
                  onValueChange={
                    setIsDefault
                  }
                />
              </View>
            </View>

            {/* SAVE */}

            <TouchableOpacity
              activeOpacity={
                0.85
              }
              disabled={
                saving
              }
              style={[
                styles.saveButton,

                saving && {
                  opacity:
                    0.6,
                },
              ]}
              onPress={
                handleSaveAddress
              }
            >
              {saving ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <Text
                  style={
                    styles.saveText
                  }
                >
                  {isEdit
                    ? 'Update Address'
                    : 'Save Address'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/* =========================================================
 * FORM INPUT
 * ========================================================= */

const FormInput = ({
  label,
  value,
  onChangeText,
  error,
  keyboardType = 'default',
  multiline = false,
}) => (
  <View
    style={
      styles.field
    }
  >
    <Text
      style={
        styles.label
      }
    >
      {label}
    </Text>

    <TextInput
      value={
        value
      }
      onChangeText={
        onChangeText
      }
      keyboardType={
        keyboardType
      }
      multiline={
        multiline
      }
      textAlignVertical={
        multiline
          ? 'top'
          : 'center'
      }
      style={[
        styles.input,

        multiline && {
          minHeight:
            75,
        },

        !!error &&
          styles.inputError,
      ]}
    />

    {!!error && (
      <Text
        style={
          styles.error
        }
      >
        {error}
      </Text>
    )}
  </View>
);

export default AddAddress;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles =
  StyleSheet.create({
    safeArea: {
      flex:
        1,

      backgroundColor:
        '#FFF9F6',
    },

    screen: {
      flex:
        1,

      alignSelf:
        'center',
    },

    header: {
      minHeight:
        72,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    backButton: {
      width:
        42,

      height:
        42,

      borderRadius:
        12,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EEE4DF',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        12,
    },

    backIcon: {
      width:
        20,

      height:
        20,
    },

    eyebrow: {
      color:
        '#A00B0F',

      fontSize:
        8,

      fontWeight:
        '900',

      letterSpacing:
        1,
    },

    title: {
      fontSize:
        21,

      fontWeight:
        '900',

      color:
        '#30231F',
    },

    card: {
      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EEE5E1',

      borderRadius:
        16,

      padding:
        14,

      marginBottom:
        13,
    },

    cardTitle: {
      fontSize:
        15,

      fontWeight:
        '900',

      color:
        '#30231F',

      marginBottom:
        12,
    },

    typeRow: {
      flexDirection:
        'row',

      gap:
        8,
    },

    typeButton: {
      flex:
        1,

      minHeight:
        42,

      borderRadius:
        11,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F8F4F2',

      borderWidth:
        1,

      borderColor:
        '#EDE4DF',
    },

    typeButtonActive: {
      backgroundColor:
        '#A00B0F',

      borderColor:
        '#A00B0F',
    },

    typeButtonText: {
      color:
        '#685A54',

      fontSize:
        9,

      fontWeight:
        '900',
    },

    typeButtonTextActive: {
      color:
        '#FFFFFF',
    },

    field: {
      marginBottom:
        12,
    },

    label: {
      color:
        '#554741',

      fontSize:
        9,

      fontWeight:
        '800',

      marginBottom:
        6,
    },

    input: {
      minHeight:
        47,

      borderRadius:
        11,

      borderWidth:
        1,

      borderColor:
        '#EAE1DD',

      backgroundColor:
        '#FBF8F6',

      paddingHorizontal:
        11,

      fontSize:
        10,

      color:
        '#332720',
    },

    inputError: {
      borderColor:
        '#D74747',
    },

    error: {
      color:
        '#D74747',

      fontSize:
        7,

      marginTop:
        4,
    },

    defaultRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      borderTopWidth:
        1,

      borderTopColor:
        '#EEE6E2',

      paddingTop:
        12,

      marginTop:
        4,
    },

    defaultIconBox: {
      width:
        40,

      height:
        40,

      borderRadius:
        11,

      backgroundColor:
        '#FFF0F0',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        10,
    },

    defaultIcon: {
      width:
        19,

      height:
        19,
    },

    defaultTitle: {
      color:
        '#3A2D27',

      fontSize:
        9,

      fontWeight:
        '900',
    },

    defaultSubtitle: {
      color:
        '#94847E',

      fontSize:
        7,

      marginTop:
        3,
    },

    saveButton: {
      minHeight:
        52,

      backgroundColor:
        '#A00B0F',

      borderRadius:
        13,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginBottom:
        20,
    },

    saveText: {
      color:
        '#FFFFFF',

      fontWeight:
        '900',

      fontSize:
        10,
    },
  });