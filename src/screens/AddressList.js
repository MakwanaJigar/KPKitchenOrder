import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  useFocusEffect,
} from '@react-navigation/native';

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
  address => {
    if (
      address?.address_line
    ) {
      return String(
        address.address_line,
      );
    }

    return [
      address?.addressLine1 ??
        address?.address_line_1,

      address?.addressLine2 ??
        address?.address_line_2,

      address?.suburb ??
        address?.city,

      address?.state,

      address?.country,
    ]
      .filter(Boolean)
      .map(value =>
        String(value).trim(),
      )
      .filter(Boolean)
      .join(', ');
  };

const normalizeAddress =
  (
    item,
    index,
  ) => ({
    ...item,

    id:
      String(
        item?.id ??
          `address-${index}`,
      ),

    type:
      item?.type ??
      item?.address_type ??
      'Home',

    name:
      item?.name ??
      item?.full_name ??
      '',

    phone:
      item?.phone ??
      item?.mobile ??
      '',

    addressLine1:
      item?.addressLine1 ??
      item?.address_line_1 ??
      item?.address_line ??
      '',

    addressLine2:
      item?.addressLine2 ??
      item?.address_line_2 ??
      '',

    suburb:
      item?.suburb ??
      item?.city ??
      '',

    city:
      item?.city ??
      item?.suburb ??
      '',

    state:
      item?.state ??
      '',

    postcode:
      String(
        item?.postcode ??
          item?.pincode ??
          '',
      ),

    pincode:
      String(
        item?.pincode ??
          item?.postcode ??
          '',
      ),

    country:
      item?.country ??
      'Australia',

    deliveryInstructions:
      item?.deliveryInstructions ??
      item?.delivery_instructions ??
      '',

    isDefault:
      Boolean(
        item?.isDefault ??
          item?.is_default ??
          false,
      ),

    is_default:
      Boolean(
        item?.is_default ??
          item?.isDefault ??
          false,
      ),

    address_line:
      getAddressLine(
        item,
      ),
  });

const ensureDefault =
  list => {
    if (
      list.length === 0
    ) {
      return [];
    }

    if (
      list.some(
        item =>
          item.isDefault,
      )
    ) {
      return list;
    }

    return list.map(
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
  };

const addressToApi =
  address => ({
    type:
      String(
        address?.type ??
          'Home',
      ).trim(),

    address_line:
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
 * ADDRESS LIST
 * ========================================================= */

const AddressList = ({
  navigation,
}) => {
  const {
    width,
  } =
    useWindowDimensions();

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

  const [
    addresses,
    setAddresses,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    syncing,
    setSyncing,
  ] =
    useState(false);

  /* =======================================================
   * LOAD
   * ======================================================= */

  const loadAddresses =
    useCallback(
      async () => {
        try {
          setLoading(
            true,
          );

          const stored =
            await AsyncStorage.getItem(
              ADDRESS_STORAGE_KEY,
            );

          let parsed =
            [];

          try {
            parsed =
              stored
                ? JSON.parse(
                    stored,
                  )
                : [];
          } catch {
            parsed =
              [];
          }

          const normalized =
            ensureDefault(
              Array.isArray(
                parsed,
              )
                ? parsed.map(
                    normalizeAddress,
                  )
                : [],
            );

          setAddresses(
            normalized,
          );

          if (
            normalized.length >
            0
          ) {
            await AsyncStorage.setItem(
              ADDRESS_STORAGE_KEY,
              JSON.stringify(
                normalized,
              ),
            );
          }
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useFocusEffect(
    useCallback(
      () => {
        loadAddresses();
      },
      [
        loadAddresses,
      ],
    ),
  );

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
   * SYNC COMPLETE ADDRESS LIST TO PROFILE API
   * ======================================================= */

  const syncAddressesToServer =
    async updatedAddresses => {
      const token =
        await AsyncStorage.getItem(
          'token',
        );

      if (!token) {
        throw new Error(
          'Please login again.',
        );
      }

      const profile =
        await getProfile(
          token,
        );

      const firstName =
        profile?.first_name ??
        (
          profile?.name
            ? String(
                profile.name,
              ).split(
                ' ',
              )[0]
            : ''
        );

      const lastName =
        profile?.last_name ??
        (
          profile?.name
            ? String(
                profile.name,
              )
                .split(
                  ' ',
                )
                .slice(
                  1,
                )
                .join(
                  ' ',
                )
            : ''
        );

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
          updatedAddresses.map(
            addressToApi,
          ),
      };

      console.log(
        'ADDRESS LIST PROFILE PAYLOAD:',
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
        'ADDRESS SYNC STATUS:',
        response.status,
      );

      console.log(
        'ADDRESS SYNC RESPONSE:',
        text,
      );

      /*
       * DO NOT redirect to login automatically.
       */

      if (
        !response.ok ||
        result?.success ===
          false
      ) {
        throw new Error(
          result?.message ??
            result?.error ??
            'Unable to update addresses.',
        );
      }

      return true;
    };

  /* =======================================================
   * SAVE LOCAL + SERVER
   * ======================================================= */

  const saveAndSync =
    async updated => {
      const normalized =
        ensureDefault(
          updated.map(
            normalizeAddress,
          ),
        );

      try {
        setSyncing(
          true,
        );

        /*
         * First sync server.
         *
         * If server fails, do not permanently
         * update local state.
         */

        await syncAddressesToServer(
          normalized,
        );

        await AsyncStorage.setItem(
          ADDRESS_STORAGE_KEY,
          JSON.stringify(
            normalized,
          ),
        );

        setAddresses(
          normalized,
        );

        return true;
      } catch (
        syncError
      ) {
        console.log(
          'SAVE ADDRESS ERROR:',
          syncError,
        );

        Alert.alert(
          'Address Update Failed',
          syncError?.message ??
            'Unable to update address.',
        );

        return false;
      } finally {
        setSyncing(
          false,
        );
      }
    };

  /* =======================================================
   * DEFAULT
   * ======================================================= */

  const setDefaultAddress =
    async id => {
      const updated =
        addresses.map(
          item => ({
            ...item,

            isDefault:
              String(
                item.id,
              ) ===
              String(
                id,
              ),

            is_default:
              String(
                item.id,
              ) ===
              String(
                id,
              ),
          }),
        );

      await saveAndSync(
        updated,
      );
    };

  /* =======================================================
   * DELETE
   * ======================================================= */

  const deleteAddress =
    address => {
      if (
        address.isDefault
      ) {
        Alert.alert(
          'Default Address',
          'Set another address as default before deleting this address.',
        );

        return;
      }

      Alert.alert(
        'Delete Address',
        'Are you sure you want to delete this address?',
        [
          {
            text:
              'Cancel',

            style:
              'cancel',
          },

          {
            text:
              'Delete',

            style:
              'destructive',

            onPress:
              async () => {
                const updated =
                  addresses.filter(
                    item =>
                      String(
                        item.id,
                      ) !==
                      String(
                        address.id,
                      ),
                  );

                await saveAndSync(
                  updated,
                );
              },
          },
        ],
      );
    };

  /* =======================================================
   * UI
   * ======================================================= */

  if (
    loading
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.loading
          }
        >
          <ActivityIndicator
            size="large"
            color="#A00B0F"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading Addresses...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
          contentContainerStyle={{
            paddingHorizontal:
              responsive.padding,

            paddingBottom:
              100,
          }}
          showsVerticalScrollIndicator={
            false
          }
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
              {/* <Text
                style={
                  styles.eyebrow
                }
              >
                DELIVERY DETAILS
              </Text> */}

              <Text
                style={
                  styles.title
                }
              >
                My Addresses
              </Text>
            </View>
          </View>

          {/* INFO */}

          {/* <View
            style={
              styles.infoCard
            }
          >
            <Image
              source={require('../assets/login-icons/location-light.png')}
              style={
                styles.infoIcon
              }
            />

            <View
              style={{
                flex:
                  1,
              }}
            >
              <Text
                style={
                  styles.infoTitle
                }
              >
                Delivery Addresses
              </Text>

              <Text
                style={
                  styles.infoText
                }
              >
                All addresses here are synchronized with your profile.
              </Text>
            </View>
          </View> */}

          <View
            style={
              styles.sectionRow
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Saved Addresses
            </Text>

            <Text
              style={
                styles.count
              }
            >
              {addresses.length}
            </Text>
          </View>

          {addresses.length ===
          0 ? (
            <View
              style={
                styles.empty
              }
            >
              <Image
                source={require('../assets/login-icons/location.png')}
                style={
                  styles.emptyIcon
                }
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No Address Added
              </Text>
            </View>
          ) : (
            addresses.map(
              address => (
                <View
                  key={
                    String(
                      address.id,
                    )
                  }
                  style={
                    styles.addressCard
                  }
                >
                  <View
                    style={
                      styles.addressTop
                    }
                  >
                    <View
                      style={
                        styles.addressTypeIcon
                      }
                    >
                      <Image
                        source={require('../assets/login-icons/home.png')}
                        style={
                          styles.homeIcon
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.addressContent
                      }
                    >
                      <View
                        style={
                          styles.typeRow
                        }
                      >
                        <Text
                          style={
                            styles.typeText
                          }
                        >
                          {address.type}
                        </Text>

                        {address.isDefault && (
                          <View
                            style={
                              styles.defaultBadge
                            }
                          >
                            <Text
                              style={
                                styles.defaultText
                              }
                            >
                              DEFAULT
                            </Text>
                          </View>
                        )}
                      </View>

                      {!!address.name && (
                        <Text
                          style={
                            styles.name
                          }
                        >
                          {address.name}
                        </Text>
                      )}

                      <Text
                        style={
                          styles.addressText
                        }
                      >
                        {getAddressLine(
                          address,
                        )}
                      </Text>

                      {!!address.postcode && (
                        <Text
                          style={
                            styles.addressText
                          }
                        >
                          {address.postcode}
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      style={
                        styles.editButton
                      }
                      onPress={() =>
                        navigation.navigate(
                          'AddAddress',
                          {
                            mode:
                              'edit',

                            address,
                          },
                        )
                      }
                    >
                      <Image
                        source={require('../assets/login-icons/edit.png')}
                        style={
                          styles.editIcon
                        }
                      />
                    </TouchableOpacity>
                  </View>

                  <View
                    style={
                      styles.actions
                    }
                  >
                    {!address.isDefault && (
                      <TouchableOpacity
                        disabled={
                          syncing
                        }
                        style={
                          styles.defaultButton
                        }
                        onPress={() =>
                          setDefaultAddress(
                            address.id,
                          )
                        }
                      >
                        <Text
                          style={
                            styles.defaultButtonText
                          }
                        >
                          Set as Default
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      disabled={
                        syncing
                      }
                      style={
                        styles.deleteButton
                      }
                      onPress={() =>
                        deleteAddress(
                          address,
                        )
                      }
                    >
                      <Text
                        style={
                          styles.deleteText
                        }
                      >
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ),
            )
          )}

          {/* ADD */}

          <TouchableOpacity
            activeOpacity={
              0.85
            }
            style={
              styles.addButton
            }
            onPress={() =>
              navigation.navigate(
                'AddAddress',
                {
                  mode:
                    'add',
                },
              )
            }
          >
            <Text
              style={
                styles.addButtonText
              }
            >
              + Add New Address
            </Text>
          </TouchableOpacity>

          {syncing && (
            <ActivityIndicator
              color="#A00B0F"
              style={{
                marginTop:
                  15,
              }}
            />
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default AddressList;

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

    loading: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    loadingText: {
      marginTop:
        10,

      fontWeight:
        '700',
    },

    header: {
      flexDirection:
        'row',

      alignItems:
        'center',

      minHeight:
        70,
    },

    backButton: {
      width:
        42,

      height:
        42,

      borderRadius:
        12,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EEE4DF',

      marginRight:
        12,
    },

    backIcon: {
      width:
        20,

      height:
        20,

      resizeMode:
        'contain',
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
      color:
        '#2C211D',

      fontSize:
        22,

      fontWeight:
        '900',
    },

    infoCard: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#A00B0F',

      padding:
        13,

      borderRadius:
        15,

      marginBottom:
        18,
    },

    infoIcon: {
      width:
        28,

      height:
        28,

      tintColor:
        '#FFFFFF',

      marginRight:
        12,
    },

    infoTitle: {
      color:
        '#FFFFFF',

      fontSize:
        11,

      fontWeight:
        '900',
    },

    infoText: {
      color:
        '#F6DDDE',

      fontSize:
        8,

      marginTop:
        3,
    },

    sectionRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom:
        10,

        margintop:
        30,
    },

    sectionTitle: {
      fontSize:
        16,

      fontWeight:
        '900',

      color:
        '#30231F',
    },

    count: {
      color:
        '#A00B0F',

      fontWeight:
        '900',
    },

    addressCard: {
      backgroundColor:
        '#FFFFFF',

      borderRadius:
        16,

      borderWidth:
        1,

      borderColor:
        '#EEE5E1',

      padding:
        13,

      marginBottom:
        12,
    },

    addressTop: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',
    },

    addressTypeIcon: {
      width:
        42,

      height:
        42,

      borderRadius:
        12,

      backgroundColor:
        '#FFF0F0',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        10,
    },

    homeIcon: {
      width:
        20,

      height:
        20,

      resizeMode:
        'contain',
    },

    addressContent: {
      flex:
        1,
    },

    typeRow: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    typeText: {
      fontWeight:
        '900',

      color:
        '#352824',
    },

    defaultBadge: {
      backgroundColor:
        '#FBE4E4',

      paddingHorizontal:
        6,

      paddingVertical:
        2,

      borderRadius:
        8,

      marginLeft:
        6,
    },

    defaultText: {
      color:
        '#A00B0F',

      fontSize:
        6,

      fontWeight:
        '900',
    },

    name: {
      fontSize:
        9,

      fontWeight:
        '700',

      marginTop:
        5,
    },

    addressText: {
      color:
        '#877972',

      fontSize:
        8,

      lineHeight:
        12,

      marginTop:
        3,
    },

    editButton: {
      width:
        34,

      height:
        34,

      borderRadius:
        10,

      backgroundColor:
        '#FFF0F0',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    editIcon: {
      width:
        17,

      height:
        17,
    },

    actions: {
      flexDirection:
        'row',

      justifyContent:
        'flex-end',

      borderTopWidth:
        1,

      borderTopColor:
        '#F1EBE8',

      marginTop:
        12,

      paddingTop:
        10,
    },

    defaultButton: {
      paddingHorizontal:
        12,

      paddingVertical:
        8,

      backgroundColor:
        '#FFF0F0',

      borderRadius:
        9,

      marginRight:
        7,
    },

    defaultButtonText: {
      color:
        '#A00B0F',

      fontSize:
        8,

      fontWeight:
        '900',
    },

    deleteButton: {
      paddingHorizontal:
        12,

      paddingVertical:
        8,

      backgroundColor:
        '#FFF1F1',

      borderRadius:
        9,
    },

    deleteText: {
      color:
        '#D44646',

      fontSize:
        8,

      fontWeight:
        '900',
    },

    addButton: {
      minHeight:
        52,

      borderRadius:
        13,

      borderWidth:
        1,

      borderColor:
        '#A00B0F',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginTop:
        8,
    },

    addButtonText: {
      color:
        '#A00B0F',

      fontWeight:
        '900',

      fontSize:
        10,
    },

    empty: {
      backgroundColor:
        '#FFFFFF',

      borderRadius:
        16,

      alignItems:
        'center',

      paddingVertical:
        40,

      marginBottom:
        10,
    },

    emptyIcon: {
      width:
        38,

      height:
        38,

      opacity:
        0.5,
    },

    emptyTitle: {
      marginTop:
        10,

      fontWeight:
        '900',
    },
  });