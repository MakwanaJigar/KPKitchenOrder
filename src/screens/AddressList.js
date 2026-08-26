import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Modal,
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
 * Storage
 * ========================================================= */

const ADDRESS_STORAGE_KEY =
  'kp_customer_addresses';

/* =========================================================
 * Address List
 * ========================================================= */

const AddressList = ({
  navigation,
}) => {
  const {
    width,
  } = useWindowDimensions();

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
                  width - 80,
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
   * Address Data
   * ===================================================== */

  const [
    addresses,
    setAddresses,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  /* =====================================================
   * Delete Popup
   * ===================================================== */

  const [
    deletePopupVisible,
    setDeletePopupVisible,
  ] = useState(false);

  const [
    selectedAddress,
    setSelectedAddress,
  ] = useState(null);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  /* =====================================================
   * Default Address Warning Popup
   * ===================================================== */

  const [
    defaultWarningVisible,
    setDefaultWarningVisible,
  ] = useState(false);

  /* =====================================================
   * Load Addresses
   * ===================================================== */

  const loadAddresses =
    async () => {
      try {
        setLoading(
          true,
        );

        const stored =
          await AsyncStorage.getItem(
            ADDRESS_STORAGE_KEY,
          );

        if (!stored) {
          setAddresses([]);

          return;
        }

        let parsed =
          [];

        try {
          parsed =
            JSON.parse(
              stored,
            );
        } catch (
          parseError
        ) {
          console.log(
            'ADDRESS JSON PARSE ERROR:',
            parseError,
          );

          setAddresses([]);

          return;
        }

        if (
          !Array.isArray(
            parsed,
          )
        ) {
          setAddresses([]);

          return;
        }

        /* =============================================
         * Normalize
         * ============================================= */

        const normalized =
          parsed.map(
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
                '',

              addressLine2:
                item?.addressLine2 ??
                item?.address_line_2 ??
                '',

              suburb:
                item?.suburb ??
                item?.city ??
                '',

              state:
                item?.state ??
                '',

              postcode:
                item?.postcode ??
                item?.pincode ??
                '',

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
            }),
          );

        /* =============================================
         * Safety:
         * If addresses exist but none are default,
         * make first one default.
         * ============================================= */

        let finalAddresses =
          normalized;

        if (
          finalAddresses.length >
            0 &&
          !finalAddresses.some(
            item =>
              item.isDefault,
          )
        ) {
          finalAddresses =
            finalAddresses.map(
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

          await AsyncStorage.setItem(
            ADDRESS_STORAGE_KEY,

            JSON.stringify(
              finalAddresses,
            ),
          );
        }

        setAddresses(
          finalAddresses,
        );
      } catch (
        error
      ) {
        console.log(
          'LOAD ADDRESS ERROR:',
          error,
        );

        setAddresses([]);
      } finally {
        setLoading(
          false,
        );
      }
    };

  /* =====================================================
   * Reload Every Time Page Gets Focus
   * ===================================================== */

  useFocusEffect(
    useCallback(
      () => {
        loadAddresses();
      },
      [],
    ),
  );

  /* =====================================================
   * Save Updated Address List
   * ===================================================== */

  const saveAddresses =
    async updated => {
      try {
        setAddresses(
          updated,
        );

        await AsyncStorage.setItem(
          ADDRESS_STORAGE_KEY,

          JSON.stringify(
            updated,
          ),
        );
      } catch (
        error
      ) {
        console.log(
          'SAVE ADDRESS LIST ERROR:',
          error,
        );
      }
    };

  /* =====================================================
   * Delete Address Press
   * ===================================================== */

  const handleDeleteAddress =
    address => {
      if (!address) {
        return;
      }

      /* =============================================
       * Default cannot be deleted
       * ============================================= */

      if (
        address.isDefault
      ) {
        setSelectedAddress(
          address,
        );

        setDefaultWarningVisible(
          true,
        );

        return;
      }

      setSelectedAddress(
        address,
      );

      setDeletePopupVisible(
        true,
      );
    };

  /* =====================================================
   * Close Delete Popup
   * ===================================================== */

  const closeDeletePopup =
    () => {
      if (
        deleting
      ) {
        return;
      }

      setDeletePopupVisible(
        false,
      );

      setSelectedAddress(
        null,
      );
    };

  /* =====================================================
   * Confirm Delete
   * ===================================================== */

  const confirmDeleteAddress =
    async () => {
      if (
        !selectedAddress ||
        deleting
      ) {
        return;
      }

      try {
        setDeleting(
          true,
        );

        const updated =
          addresses.filter(
            item =>
              String(
                item.id,
              ) !==
              String(
                selectedAddress.id,
              ),
          );

        await saveAddresses(
          updated,
        );

        setDeletePopupVisible(
          false,
        );

        setSelectedAddress(
          null,
        );
      } catch (
        error
      ) {
        console.log(
          'DELETE ADDRESS ERROR:',
          error,
        );
      } finally {
        setDeleting(
          false,
        );
      }
    };

  /* =====================================================
   * Set Default
   * ===================================================== */

  const handleSetDefault =
    async id => {
      try {
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
            }),
          );

        await saveAddresses(
          updated,
        );
      } catch (
        error
      ) {
        console.log(
          'SET DEFAULT ADDRESS ERROR:',
          error,
        );
      }
    };

  /* =====================================================
   * Edit Address
   * ===================================================== */

  const handleEditAddress =
    address => {
      navigation.navigate(
        'AddAddress',
        {
          mode:
            'edit',

          address,
        },
      );
    };

  /* =====================================================
   * Add Address
   * ===================================================== */

  const handleAddAddress =
    () => {
      navigation.navigate(
        'AddAddress',
        {
          mode:
            'add',
        },
      );
    };

  /* =====================================================
   * Loading
   * ===================================================== */

  if (
    loading
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }>

        <StatusBar
          barStyle="dark-content"

          backgroundColor="#FFF9F6"
        />

        <View
          style={
            styles.loadingContainer
          }>

          <ActivityIndicator
            size="large"

            color="#A00B0F"
          />

          <Text
            style={
              styles.loadingTitle
            }>
            Loading Addresses
          </Text>

          <Text
            style={
              styles.loadingDescription
            }>
            Please wait...
          </Text>

        </View>

      </SafeAreaView>
    );
  }

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
                  DELIVERY DETAILS
                </Text>

                <Text
                  style={
                    styles.headerTitle
                  }>
                  My Addresses
                </Text>

              </View>

              <View
                style={
                  styles.headerSpacer
                }
              />

            </View>

            {/* ================================================= */}
            {/* INFO */}
            {/* ================================================= */}

            <View
              style={
                styles.infoCard
              }>

              <View
                style={
                  styles.infoIconContainer
                }>

                <Image
                  source={require('../assets/login-icons/location-light.png')}

                  style={
                    styles.infoIcon
                  }

                  resizeMode="contain"
                />

              </View>

              <View
                style={
                  styles.infoDetails
                }>

                <Text
                  style={
                    styles.infoTitle
                  }>
                  Delivery Addresses
                </Text>

                <Text
                  style={
                    styles.infoText
                  }>
                  Manage the addresses where you receive your tiffin deliveries.
                </Text>

              </View>

            </View>

            {/* ================================================= */}
            {/* ADDRESS LIST */}
            {/* ================================================= */}

            <View
              style={
                styles.sectionHeader
              }>

              <Text
                style={
                  styles.sectionTitle
                }>
                Saved Addresses
              </Text>

              <Text
                style={
                  styles.addressCount
                }>

                {addresses.length}{' '}

                {addresses.length ===
                1
                  ? 'Address'
                  : 'Addresses'}

              </Text>

            </View>

            {addresses.length >
            0 ? (
              addresses.map(
                address => (
                  <AddressCard
                    key={
                      String(
                        address.id,
                      )
                    }

                    address={
                      address
                    }

                    onEdit={() =>
                      handleEditAddress(
                        address,
                      )
                    }

                    onDelete={() =>
                      handleDeleteAddress(
                        address,
                      )
                    }

                    onSetDefault={() =>
                      handleSetDefault(
                        address.id,
                      )
                    }
                  />
                ),
              )
            ) : (
              <View
                style={
                  styles.emptyCard
                }>

                <View
                  style={
                    styles.emptyIconContainer
                  }>

                  <Image
                    source={require('../assets/login-icons/location.png')}

                    style={
                      styles.emptyIcon
                    }

                    resizeMode="contain"
                  />

                </View>

                <Text
                  style={
                    styles.emptyTitle
                  }>
                  No Address Added
                </Text>

                <Text
                  style={
                    styles.emptySubtitle
                  }>
                  Add your delivery address to start ordering your tiffin.
                </Text>

              </View>
            )}

            {/* ================================================= */}
            {/* ADD NEW ADDRESS */}
            {/* ================================================= */}

            <TouchableOpacity
              activeOpacity={
                0.85
              }

              style={
                styles.addButton
              }

              onPress={
                handleAddAddress
              }>

              <Text
                style={
                  styles.addButtonPlus
                }>
                +
              </Text>

              <Text
                style={
                  styles.addButtonText
                }>
                Add New Address
              </Text>

            </TouchableOpacity>

          </ScrollView>

        </View>

      </SafeAreaView>

      {/* ================================================= */}
      {/* DELETE ADDRESS CONFIRMATION POPUP */}
      {/* ================================================= */}

      <Modal
        visible={
          deletePopupVisible
        }

        transparent

        animationType="fade"

        statusBarTranslucent

        onRequestClose={
          closeDeletePopup
        }>

        <Pressable
          style={
            styles.modalOverlay
          }

          onPress={
            closeDeletePopup
          }>

          <Pressable
            style={
              styles.deletePopupCard
            }

            onPress={() => {}}>

            {/* =========================================== */}
            {/* Icon */}
            {/* =========================================== */}

            <View
              style={
                styles.deletePopupIconOuter
              }>

              <View
                style={
                  styles.deletePopupIconInner
                }>

                <Text
                  style={
                    styles.deletePopupIcon
                  }>
                  ×
                </Text>

              </View>

            </View>

            {/* =========================================== */}
            {/* Heading */}
            {/* =========================================== */}

            <Text
              style={
                styles.deletePopupTitle
              }>
              Delete Address?
            </Text>

            <Text
              style={
                styles.deletePopupDescription
              }>
              Are you sure you want to delete this saved address?
            </Text>

            {/* =========================================== */}
            {/* Address Preview */}
            {/* =========================================== */}

            {!!selectedAddress && (
              <View
                style={
                  styles.popupAddressPreview
                }>

                <Text
                  style={
                    styles.popupAddressType
                  }>

                  {
                    selectedAddress.type
                  }

                </Text>

                <Text
                  style={
                    styles.popupAddressName
                  }>

                  {
                    selectedAddress.name
                  }

                </Text>

                <Text
                  style={
                    styles.popupAddressText
                  }>

                  {[
                    selectedAddress
                      .addressLine1,

                    selectedAddress
                      .addressLine2,

                    selectedAddress
                      .suburb,

                    selectedAddress
                      .state,

                    selectedAddress
                      .postcode,

                    selectedAddress
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
            {/* Buttons */}
            {/* =========================================== */}

            <View
              style={
                styles.popupButtons
              }>

              <TouchableOpacity
                disabled={
                  deleting
                }

                activeOpacity={
                  0.8
                }

                style={
                  styles.popupCancelButton
                }

                onPress={
                  closeDeletePopup
                }>

                <Text
                  style={
                    styles.popupCancelText
                  }>
                  Cancel
                </Text>

              </TouchableOpacity>

              <TouchableOpacity
                disabled={
                  deleting
                }

                activeOpacity={
                  0.85
                }

                style={[
                  styles.popupDeleteButton,

                  deleting &&
                    styles.popupButtonDisabled,
                ]}

                onPress={
                  confirmDeleteAddress
                }>

                {deleting ? (
                  <ActivityIndicator
                    size="small"

                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.popupDeleteText
                    }>
                    Delete
                  </Text>
                )}

              </TouchableOpacity>

            </View>

          </Pressable>

        </Pressable>

      </Modal>

      {/* ================================================= */}
      {/* DEFAULT ADDRESS WARNING POPUP */}
      {/* ================================================= */}

      <Modal
        visible={
          defaultWarningVisible
        }

        transparent

        animationType="fade"

        statusBarTranslucent

        onRequestClose={() => {
          setDefaultWarningVisible(
            false,
          );

          setSelectedAddress(
            null,
          );
        }}>

        <Pressable
          style={
            styles.modalOverlay
          }

          onPress={() => {
            setDefaultWarningVisible(
              false,
            );

            setSelectedAddress(
              null,
            );
          }}>

          <Pressable
            style={
              styles.warningPopupCard
            }

            onPress={() => {}}>

            {/* =========================================== */}
            {/* Warning Icon */}
            {/* =========================================== */}

            <View
              style={
                styles.warningIconOuter
              }>

              <View
                style={
                  styles.warningIconInner
                }>

                <Text
                  style={
                    styles.warningIconText
                  }>
                  !
                </Text>

              </View>

            </View>

            <Text
              style={
                styles.warningPopupTitle
              }>
              Default Address
            </Text>

            <Text
              style={
                styles.warningPopupDescription
              }>
              You cannot delete your default address.
            </Text>

            <View
              style={
                styles.warningInfoBox
              }>

              <Text
                style={
                  styles.warningInfoText
                }>
                Set another saved address as default first, then you can delete this address.
              </Text>

            </View>

            <TouchableOpacity
              activeOpacity={
                0.85
              }

              style={
                styles.warningDoneButton
              }

              onPress={() => {
                setDefaultWarningVisible(
                  false,
                );

                setSelectedAddress(
                  null,
                );
              }}>

              <Text
                style={
                  styles.warningDoneText
                }>
                OK
              </Text>

            </TouchableOpacity>

          </Pressable>

        </Pressable>

      </Modal>
    </>
  );
};

/* =========================================================
 * Address Card
 * ========================================================= */

const AddressCard = ({
  address,
  onEdit,
  onDelete,
  onSetDefault,
}) => {
  return (
    <View
      style={[
        styles.addressCard,

        address.isDefault &&
          styles.defaultAddressCard,
      ]}>

      {/* ================================================= */}
      {/* TOP */}
      {/* ================================================= */}

      <View
        style={
          styles.addressTopRow
        }>

        <View
          style={
            styles.addressTypeRow
          }>

          <View
            style={[
              styles.addressTypeIcon,

              address.isDefault &&
                styles.defaultTypeIcon,
            ]}>

            <Image
              source={require('../assets/login-icons/home.png')}

              style={
                styles.addressIcon
              }

              resizeMode="contain"
            />

          </View>

          <View
            style={
              styles.addressTopDetails
            }>

            <View
              style={
                styles.titleRow
              }>

              <Text
                style={
                  styles.addressType
                }>
                {address.type}
              </Text>

              {address.isDefault ? (
                <View
                  style={
                    styles.defaultBadge
                  }>

                  <Text
                    style={
                      styles.defaultBadgeText
                    }>
                    Default
                  </Text>

                </View>
              ) : null}

            </View>

            <Text
              numberOfLines={
                1
              }

              style={
                styles.addressName
              }>
              {address.name}
            </Text>

          </View>

        </View>

        {/* Edit */}

        <Pressable
          hitSlop={
            10
          }

          style={
            styles.editButton
          }

          onPress={
            onEdit
          }>

          <Image
            source={require('../assets/login-icons/edit.png')}

            style={
              styles.editIcon
            }

            resizeMode="contain"
          />

        </Pressable>

      </View>

      {/* ================================================= */}
      {/* ADDRESS */}
      {/* ================================================= */}

      <View
        style={
          styles.addressContent
        }>

        {!!address.addressLine1 && (
          <Text
            style={
              styles.addressLine
            }>
            {
              address.addressLine1
            }
          </Text>
        )}

        {!!address.addressLine2 && (
          <Text
            style={
              styles.addressLine
            }>
            {
              address.addressLine2
            }
          </Text>
        )}

        <Text
          style={
            styles.addressLine
          }>

          {[
            address.suburb,

            address.state,

            address.postcode,
          ]
            .filter(
              Boolean,
            )
            .join(
              ', ',
            )}

        </Text>

        {!!address.country && (
          <Text
            style={
              styles.addressLine
            }>
            {
              address.country
            }
          </Text>
        )}

      </View>

      {/* ================================================= */}
      {/* PHONE */}
      {/* ================================================= */}

      {!!address.phone && (
        <View
          style={
            styles.phoneRow
          }>

          <Text
            style={
              styles.phoneLabel
            }>
            Mobile:
          </Text>

          <Text
            style={
              styles.phoneText
            }>
            {
              address.phone
            }
          </Text>

        </View>
      )}

      {/* ================================================= */}
      {/* DELIVERY INSTRUCTIONS */}
      {/* ================================================= */}

      {!!address.deliveryInstructions && (
        <View
          style={
            styles.instructionsBox
          }>

          <Text
            style={
              styles.instructionsLabel
            }>
            Delivery Instructions
          </Text>

          <Text
            style={
              styles.instructionsText
            }>

            {
              address.deliveryInstructions
            }

          </Text>

        </View>
      )}

      {/* ================================================= */}
      {/* ACTIONS */}
      {/* ================================================= */}

      <View
        style={
          styles.actionRow
        }>

        {!address.isDefault ? (
          <TouchableOpacity
            activeOpacity={
              0.8
            }

            style={
              styles.defaultButton
            }

            onPress={
              onSetDefault
            }>

            <Text
              style={
                styles.defaultButtonText
              }>
              Set as Default
            </Text>

          </TouchableOpacity>
        ) : (
          <View
            style={
              styles.currentDefault
            }>

            <View
              style={
                styles.defaultDot
              }
            />

            <Text
              style={
                styles.currentDefaultText
              }>
              Default Delivery Address
            </Text>

          </View>
        )}

        {!address.isDefault ? (
          <TouchableOpacity
            activeOpacity={
              0.8
            }

            style={
              styles.deleteButton
            }

            onPress={
              onDelete
            }>

            <Text
              style={
                styles.deleteButtonText
              }>
              Delete
            </Text>

          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={
              0.8
            }

            style={[
              styles.deleteButton,

              styles.disabledDeleteButton,
            ]}

            onPress={
              onDelete
            }>

            <Text
              style={[
                styles.deleteButtonText,

                styles.disabledDeleteText,
              ]}>
              Delete
            </Text>

          </TouchableOpacity>
        )}

      </View>

    </View>
  );
};

export default AddressList;

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
        100,
    },

    /* =====================================================
     * Loading
     * ===================================================== */

    loadingContainer: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF9F6',

      paddingHorizontal:
        30,
    },

    loadingTitle: {
      color:
        '#2B1D18',

      fontSize:
        15,

      fontWeight:
        '900',

      marginTop:
        14,
    },

    loadingDescription: {
      color:
        '#928079',

      fontSize:
        9,

      marginTop:
        5,
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
        '#A00B0F',

      fontSize:
        9,

      fontWeight:
        '800',

      letterSpacing:
        1,
    },

    headerTitle: {
      color:
        '#000000',

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
     * Info
     * ===================================================== */

    infoCard: {
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

      padding:
        13,

      marginBottom:
        20,
    },

    infoIconContainer: {
      width:
        43,

      height:
        43,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#A00B0F',

      borderRadius:
        12,

      marginRight:
        11,
    },

    infoIcon: {
      width:
        21,

      height:
        21,
    },

    infoDetails: {
      flex:
        1,
    },

    infoTitle: {
      color:
        '#382720',

      fontSize:
        11,

      fontWeight:
        '800',
    },

    infoText: {
      color:
        '#8E7971',

      fontSize:
        8,

      lineHeight:
        12,

      marginTop:
        4,
    },

    /* =====================================================
     * Section
     * ===================================================== */

    sectionHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom:
        10,
    },

    sectionTitle: {
      color:
        '#2B1D18',

      fontSize:
        18,

      fontWeight:
        '900',
    },

    addressCount: {
      color:
        '#A00B0F',

      fontSize:
        9,

      fontWeight:
        '700',
    },

    /* =====================================================
     * Address Card
     * ===================================================== */

    addressCard: {
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
        12,

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

    defaultAddressCard: {
      borderColor:
        '#E6C1C3',

      backgroundColor:
        '#FFFCFA',
    },

    addressTopRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    addressTypeRow: {
      flex:
        1,

      flexDirection:
        'row',

      alignItems:
        'center',

      minWidth:
        0,
    },

    addressTopDetails: {
      flex:
        1,

      minWidth:
        0,
    },

    addressTypeIcon: {
      width:
        43,

      height:
        43,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#2D221D',

      borderRadius:
        12,

      marginRight:
        11,
    },

    defaultTypeIcon: {
      backgroundColor:
        '#A00B0F',
    },

    addressIcon: {
      width:
        21,

      height:
        21,
    },

    titleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      flexWrap:
        'wrap',
    },

    addressType: {
      color:
        '#2D201B',

      fontSize:
        13,

      fontWeight:
        '900',
    },

    defaultBadge: {
      backgroundColor:
        '#FBE4D8',

      borderRadius:
        10,

      paddingHorizontal:
        7,

      paddingVertical:
        3,

      marginLeft:
        7,
    },

    defaultBadgeText: {
      color:
        '#A00B0F',

      fontSize:
        7,

      fontWeight:
        '800',
    },

    addressName: {
      color:
        '#8C7972',

      fontSize:
        8.5,

      marginTop:
        3,
    },

    editButton: {
      width:
        36,

      height:
        36,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0E8',

      borderRadius:
        11,

      marginLeft:
        8,
    },

    editIcon: {
      width:
        18,

      height:
        18,
    },

    addressContent: {
      backgroundColor:
        '#FFF9F6',

      borderWidth:
        1,

      borderColor:
        '#EFE5E0',

      borderRadius:
        12,

      padding:
        11,

      marginTop:
        13,
    },

    addressLine: {
      color:
        '#66534C',

      fontSize:
        9.5,

      lineHeight:
        15,
    },

    phoneRow: {
      flexDirection:
        'row',

      marginTop:
        10,
    },

    phoneLabel: {
      color:
        '#9B8982',

      fontSize:
        8.5,
    },

    phoneText: {
      color:
        '#44332D',

      fontSize:
        8.5,

      fontWeight:
        '700',

      marginLeft:
        4,
    },

    /* =====================================================
     * Instructions
     * ===================================================== */

    instructionsBox: {
      backgroundColor:
        '#FFF9F6',

      borderWidth:
        1,

      borderColor:
        '#EFE5E0',

      borderRadius:
        11,

      padding:
        10,

      marginTop:
        10,
    },

    instructionsLabel: {
      color:
        '#A00B0F',

      fontSize:
        7.5,

      fontWeight:
        '900',

      marginBottom:
        4,
    },

    instructionsText: {
      color:
        '#75645E',

      fontSize:
        8.5,

      lineHeight:
        13,
    },

    /* =====================================================
     * Actions
     * ===================================================== */

    actionRow: {
      minHeight:
        43,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      borderTopWidth:
        1,

      borderTopColor:
        '#F1E9E5',

      marginTop:
        12,

      paddingTop:
        10,
    },

    defaultButton: {
      minHeight:
        34,

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0E8',

      borderRadius:
        10,

      paddingHorizontal:
        12,
    },

    defaultButtonText: {
      color:
        '#A00B0F',

      fontSize:
        8.5,

      fontWeight:
        '800',
    },

    deleteButton: {
      minHeight:
        34,

      justifyContent:
        'center',

      paddingHorizontal:
        10,
    },

    deleteButtonText: {
      color:
        '#A00B0F',

      fontSize:
        8.5,

      fontWeight:
        '800',
    },

    disabledDeleteButton: {
      opacity:
        0.45,
    },

    disabledDeleteText: {
      color:
        '#A89B96',
    },

    currentDefault: {
      flexDirection:
        'row',

      alignItems:
        'center',

      flex:
        1,
    },

    defaultDot: {
      width:
        7,

      height:
        7,

      backgroundColor:
        '#A00B0F',

      borderRadius:
        50,

      marginRight:
        6,
    },

    currentDefaultText: {
      color:
        '#A00B0F',

      fontSize:
        8.5,

      fontWeight:
        '700',
    },

    /* =====================================================
     * Empty
     * ===================================================== */

    emptyCard: {
      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EFE5E0',

      borderRadius:
        17,

      paddingVertical:
        35,

      paddingHorizontal:
        20,

      marginBottom:
        14,
    },

    emptyIconContainer: {
      width:
        60,

      height:
        60,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0E8',

      borderRadius:
        20,

      marginBottom:
        13,
    },

    emptyIcon: {
      width:
        27,

      height:
        27,
    },

    emptyTitle: {
      color:
        '#30231E',

      fontSize:
        14,

      fontWeight:
        '900',
    },

    emptySubtitle: {
      color:
        '#908079',

      fontSize:
        9,

      lineHeight:
        14,

      textAlign:
        'center',

      marginTop:
        6,
    },

    /* =====================================================
     * Add Button
     * ===================================================== */

    addButton: {
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
        14,

      marginTop:
        5,
    },

    addButtonPlus: {
      color:
        '#FFFFFF',

      fontSize:
        23,

      fontWeight:
        '500',

      lineHeight:
        26,

      marginRight:
        8,
    },

    addButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        15,

      fontWeight:
        '800',
    },

    /* =====================================================
     * Popup Common
     * ===================================================== */

    modalOverlay: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(27, 19, 17, 0.62)',

      paddingHorizontal:
        22,
    },

    /* =====================================================
     * Delete Popup
     * ===================================================== */

    deletePopupCard: {
      width:
        '100%',

      maxWidth:
        380,

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        25,

      paddingHorizontal:
        22,

      paddingTop:
        27,

      paddingBottom:
        20,

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

    deletePopupIconOuter: {
      width:
        82,

      height:
        82,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0F0',

      borderRadius:
        41,

      marginBottom:
        15,
    },

    deletePopupIconInner: {
      width:
        56,

      height:
        56,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#D74A4A',

      borderRadius:
        28,
    },

    deletePopupIcon: {
      color:
        '#FFFFFF',

      fontSize:
        32,

      lineHeight:
        34,

      fontWeight:
        '500',
    },

    deletePopupTitle: {
      color:
        '#281C19',

      fontSize:
        20,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    deletePopupDescription: {
      maxWidth:
        285,

      color:
        '#776B67',

      fontSize:
        10,

      lineHeight:
        16,

      textAlign:
        'center',

      marginTop:
        7,
    },

    popupAddressPreview: {
      width:
        '100%',

      backgroundColor:
        '#FFF9F6',

      borderWidth:
        1,

      borderColor:
        '#EEE3DE',

      borderRadius:
        12,

      padding:
        11,

      marginTop:
        16,
    },

    popupAddressType: {
      color:
        '#A00B0F',

      fontSize:
        8,

      fontWeight:
        '900',

      textTransform:
        'uppercase',
    },

    popupAddressName: {
      color:
        '#30231E',

      fontSize:
        10,

      fontWeight:
        '800',

      marginTop:
        5,
    },

    popupAddressText: {
      color:
        '#80716B',

      fontSize:
        8.5,

      lineHeight:
        13,

      marginTop:
        4,
    },

    popupButtons: {
      width:
        '100%',

      flexDirection:
        'row',

      marginTop:
        19,
    },

    popupCancelButton: {
      flex:
        1,

      minHeight:
        48,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F7F4F3',

      borderWidth:
        1,

      borderColor:
        '#E6DEDB',

      borderRadius:
        12,

      marginRight:
        5,
    },

    popupCancelText: {
      color:
        '#70625E',

      fontSize:
        9,

      fontWeight:
        '900',
    },

    popupDeleteButton: {
      flex:
        1,

      minHeight:
        48,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#D74A4A',

      borderRadius:
        12,

      marginLeft:
        5,
    },

    popupDeleteText: {
      color:
        '#FFFFFF',

      fontSize:
        9,

      fontWeight:
        '900',
    },

    popupButtonDisabled: {
      opacity:
        0.6,
    },

    /* =====================================================
     * Warning Popup
     * ===================================================== */

    warningPopupCard: {
      width:
        '100%',

      maxWidth:
        370,

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        25,

      paddingHorizontal:
        22,

      paddingTop:
        27,

      paddingBottom:
        20,

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

    warningIconOuter: {
      width:
        82,

      height:
        82,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF7E8',

      borderRadius:
        41,

      marginBottom:
        15,
    },

    warningIconInner: {
      width:
        56,

      height:
        56,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#D79833',

      borderRadius:
        28,
    },

    warningIconText: {
      color:
        '#FFFFFF',

      fontSize:
        29,

      fontWeight:
        '900',
    },

    warningPopupTitle: {
      color:
        '#281C19',

      fontSize:
        20,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    warningPopupDescription: {
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

    warningInfoBox: {
      width:
        '100%',

      backgroundColor:
        '#FFF9EE',

      borderWidth:
        1,

      borderColor:
        '#F0E1C4',

      borderRadius:
        11,

      padding:
        11,

      marginTop:
        16,
    },

    warningInfoText: {
      color:
        '#806A48',

      fontSize:
        8.5,

      lineHeight:
        14,

      fontWeight:
        '600',

      textAlign:
        'center',
    },

    warningDoneButton: {
      width:
        '100%',

      minHeight:
        48,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#A00B0F',

      borderRadius:
        12,

      marginTop:
        18,
    },

    warningDoneText: {
      color:
        '#FFFFFF',

      fontSize:
        9,

      fontWeight:
        '900',
    },
  });