import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
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

const LOGOUT_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/logout';

/* =========================================================
 * Profile
 * ========================================================= */

const Profile = ({
  navigation,
}) => {
  const {
    width,
  } =
    useWindowDimensions();

  const [
    notificationsEnabled,
    setNotificationsEnabled,
  ] =
    useState(true);

  const [
    autoRenewEnabled,
    setAutoRenewEnabled,
  ] =
    useState(false);

  const [
    profile,
    setProfile,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState(null);

  const [
    logoutLoading,
    setLogoutLoading,
  ] =
    useState(false);

  const [
    logoutPopupVisible,
    setLogoutPopupVisible,
  ] =
    useState(false);

  /* =====================================================
   * Responsive
   * ===================================================== */

  const responsive =
    useMemo(
      () => {
        const isTablet =
          width >=
          768;

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

          avatarSize:
            isTablet
              ? 105
              : 82,
        };
      },
      [
        width,
      ],
    );

  /* =====================================================
   * Fetch Profile
   * ===================================================== */

  const fetchProfile =
    async () => {
      try {
        setLoading(
          true,
        );

        setError(
          null,
        );

        const token =
          await AsyncStorage.getItem(
            'token',
          );

        console.log(
          '==============================',
        );

        console.log(
          'PROFILE API CALL',
        );

        console.log(
          'URL:',
          PROFILE_API_URL,
        );

        console.log(
          'TOKEN:',
          token,
        );

        console.log(
          '==============================',
        );

        if (
          !token
        ) {
          throw new Error(
            'Authentication token not found. Please login again.',
          );
        }

        const response =
          await fetch(
            PROFILE_API_URL,
            {
              method:
                'GET',

              headers: {
                Accept:
                  'application/json',

                'Content-Type':
                  'application/json',

                Authorization:
                  `Bearer ${token}`,
              },
            },
          );

        const responseText =
          await response.text();

        console.log(
          'PROFILE STATUS:',
          response.status,
        );

        console.log(
          'RAW PROFILE RESPONSE:',
          responseText,
        );

        let result;

        try {
          result =
            JSON.parse(
              responseText,
            );
        } catch (
          jsonError
        ) {
          throw new Error(
            'Invalid response received from server.',
          );
        }

        console.log(
          'PROFILE RESPONSE:',
          JSON.stringify(
            result,
            null,
            2,
          ),
        );

        if (
          !response.ok
        ) {
          if (
            response.status ===
              401 ||
            response.status ===
              403
          ) {
            await AsyncStorage.removeItem(
              'token',
            );

            navigation.reset({
              index:
                0,

              routes: [
                {
                  name:
                    'Login',
                },
              ],
            });

            return;
          }

          throw new Error(
            result?.message ||
              result?.error ||
              `Unable to load profile. Status: ${response.status}`,
          );
        }

        const profileData =
          result?.data ??
          result?.customer ??
          result?.user ??
          result;

        setProfile(
          profileData,
        );
      } catch (
        err
      ) {
        console.log(
          'PROFILE API ERROR:',
          err,
        );

        setError(
          err?.message ||
            'Unable to load profile.',
        );
      } finally {
        setLoading(
          false,
        );
      }
    };

  /* =====================================================
   * Initial Profile Load
   * ===================================================== */

  useEffect(
    () => {
      fetchProfile();
    },
    [],
  );

  /* =====================================================
   * Logout API
   * ===================================================== */

  const performLogout =
    async () => {
      try {
        setLogoutLoading(
          true,
        );

        const token =
          await AsyncStorage.getItem(
            'token',
          );

        console.log(
          '==============================',
        );

        console.log(
          'LOGOUT API CALL',
        );

        console.log(
          'URL:',
          LOGOUT_API_URL,
        );

        console.log(
          'TOKEN:',
          token,
        );

        console.log(
          '==============================',
        );

        if (
          token
        ) {
          const response =
            await fetch(
              LOGOUT_API_URL,
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
              },
            );

          const responseText =
            await response.text();

          console.log(
            'LOGOUT STATUS:',
            response.status,
          );

          console.log(
            'LOGOUT RESPONSE:',
            responseText,
          );
        }

        await AsyncStorage.removeItem(
          'token',
        );

        await AsyncStorage.removeItem(
          'user',
        );

        navigation.reset({
          index:
            0,

          routes: [
            {
              name:
                'Login',
            },
          ],
        });
      } catch (
        err
      ) {
        console.log(
          'LOGOUT ERROR:',
          err,
        );

        await AsyncStorage.removeItem(
          'token',
        );

        await AsyncStorage.removeItem(
          'user',
        );

        navigation.reset({
          index:
            0,

          routes: [
            {
              name:
                'Login',
            },
          ],
        });
      } finally {
        setLogoutLoading(
          false,
        );
      }
    };

  /* =====================================================
   * Logout Confirmation Popup
   * ===================================================== */

  const handleLogout =
    () => {
      if (
        logoutLoading
      ) {
        return;
      }

      setLogoutPopupVisible(
        true,
      );
    };

  const handleCancelLogout =
    () => {
      if (
        logoutLoading
      ) {
        return;
      }

      setLogoutPopupVisible(
        false,
      );
    };

  const handleConfirmLogout =
    async () => {
      if (
        logoutLoading
      ) {
        return;
      }

      await performLogout();

      setLogoutPopupVisible(
        false,
      );
    };

  /* =====================================================
   * Profile Values
   * ===================================================== */

  const userName =
    profile?.name ??
    profile?.full_name ??
    'Customer';

  const userEmail =
    profile?.email ??
    'No email';

  const userPhone =
    profile?.phone ??
    profile?.mobile ??
    'Not provided';

  const userPincode =
    profile?.pincode ??
    '';

  const userAddress =
    profile?.address ??
    'No address available';

  const dietaryPreference =
    profile
      ?.dietary_preference ??
    profile
      ?.dietaryPreference ??
    'Standard';

  const profileImage =
    profile
      ?.profile_image ??
    profile?.image ??
    profile?.avatar ??
    null;

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
        }
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FFF9F6"
        />

        <View
          style={
            styles.centerContainer
          }
        >
          <ActivityIndicator
            size="large"
            color="#A00B0F"
          />

          <Text
            style={
              styles.loadingTitle
            }
          >
            Loading Profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* =====================================================
   * Error
   * ===================================================== */

  if (
    error &&
    !profile
  ) {
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
          style={
            styles.centerContainer
          }
        >
          <Text
            style={
              styles.errorTitle
            }
          >
            Unable to Load Profile
          </Text>

          <Text
            style={
              styles.errorText
            }
          >
            {error}
          </Text>

          <TouchableOpacity
            style={
              styles.retryButton
            }
            onPress={
              fetchProfile
            }
          >
            <Text
              style={
                styles.retryButtonText
              }
            >
              TRY AGAIN
            </Text>
          </TouchableOpacity>
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
        }
      >
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
          ]}
        >
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
            ]}
          >
            {/* =================================================
             * Header
             * ================================================= */}

            <View
              style={
                styles.header
              }
            >
              <View>
                <Text
                  style={
                    styles.headerEyebrow
                  }
                >
                  MY ACCOUNT
                </Text>

                <Text
                  style={
                    styles.headerTitle
                  }
                >
                  Profile
                </Text>
              </View>

              <Pressable
                hitSlop={
                  10
                }
                style={
                  styles.notificationButton
                }
                onPress={() =>
                  navigation.navigate(
                    'Notification',
                  )
                }
              >
                <Image
                  source={require('../assets/login-icons/notification.png')}
                  style={
                    styles.smallIcon
                  }
                  resizeMode="contain"
                />

                <View
                  style={
                    styles.notificationDot
                  }
                />
              </Pressable>
            </View>

            {/* =================================================
             * Profile
             * ================================================= */}

            <View
              style={
                styles.profileSection
              }
            >
              <View>
                {profileImage ? (
                  <Image
                    source={{
                      uri:
                        profileImage,
                    }}
                    style={[
                      styles.profileImage,

                      {
                        width:
                          responsive.avatarSize,

                        height:
                          responsive.avatarSize,

                        borderRadius:
                          responsive.avatarSize /
                          2,
                      },
                    ]}
                    resizeMode="cover"
                  />
                ) : (
                  <Image
                    source={require('../assets/user-profile.jpg')}
                    style={[
                      styles.profileImage,

                      {
                        width:
                          responsive.avatarSize,

                        height:
                          responsive.avatarSize,

                        borderRadius:
                          responsive.avatarSize /
                          2,
                      },
                    ]}
                    resizeMode="cover"
                  />
                )}

                <TouchableOpacity
                  activeOpacity={
                    0.8
                  }
                  style={
                    styles.cameraButton
                  }
                  onPress={() =>
                    console.log(
                      'Change photo pressed',
                    )
                  }
                >
                  <Image
                    source={require('../assets/login-icons/camera.png')}
                    style={
                      styles.smallIcon
                    }
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>

              <View
                style={
                  styles.profileDetails
                }
              >
                <Text
                  numberOfLines={
                    1
                  }
                  style={
                    styles.userName
                  }
                >
                  {
                    userName
                  }
                </Text>

                <Text
                  numberOfLines={
                    1
                  }
                  style={
                    styles.userEmail
                  }
                >
                  {
                    userEmail
                  }
                </Text>
              </View>

              <Pressable
                hitSlop={
                  10
                }
                style={
                  styles.editProfileButton
                }
                onPress={() =>
                  navigation.navigate(
                    'EditProfile',
                    {
                      profile,
                    },
                  )
                }
              >
                <Image
                  source={require('../assets/login-icons/edit.png')}
                  style={
                    styles.smallIcon
                  }
                  resizeMode="contain"
                />
              </Pressable>
            </View>

            {/* =================================================
             * Personal Details
             * ================================================= */}

            <SectionCard
              title="Personal Details"
            >
              <ProfileInformationRow
                label="Full Name"
                value={
                  userName
                }
              />

              <ProfileInformationRow
                label="Email Address"
                value={
                  userEmail
                }
              />

              <ProfileInformationRow
                label="Mobile Number"
                value={
                  userPhone
                }
              />

              <ProfileInformationRow
                label="Dietary Preference"
                value={
                  dietaryPreference
                }
                showBorder={
                  false
                }
              />
            </SectionCard>

            {/* =================================================
             * Delivery Addresses
             * ================================================= */}

            <SectionCard
              title="Delivery Addresses"
              rightText="Manage"
              onRightPress={() =>
                navigation.navigate(
                  'AddressList',
                )
              }
            >
              <Pressable
                style={
                  styles.addressContainer
                }
                onPress={() =>
                  navigation.navigate(
                    'AddressList',
                  )
                }
              >
                <View
                  style={
                    styles.addressIconContainer
                  }
                >
                  <Image
                    source={require('../assets/login-icons/home-1.png')}
                    style={
                      styles.smallIcon
                    }
                    resizeMode="contain"
                  />
                </View>

                <View
                  style={
                    styles.addressDetails
                  }
                >
                  <View
                    style={
                      styles.addressTitleRow
                    }
                  >
                    <Text
                      style={
                        styles.addressTitle
                      }
                    >
                      Home
                    </Text>

                    <View
                      style={
                        styles.defaultBadge
                      }
                    >
                      <Text
                        style={
                          styles.defaultBadgeText
                        }
                      >
                        Default
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={
                      styles.addressText
                    }
                  >
                    {
                      userAddress
                    }
                  </Text>

                  {!!userPincode && (
                    <Text
                      style={
                        styles.addressText
                      }
                    >
                      {
                        userPincode
                      }
                    </Text>
                  )}
                </View>

                <Image
                  source={require('../assets/login-icons/location.png')}
                  style={
                    styles.smallIcon
                  }
                  resizeMode="contain"
                />
              </Pressable>
            </SectionCard>

            {/* =================================================
             * Payment Methods
             * ================================================= */}

            <SectionCard
              title="Payment Methods"
              rightText="Manage"
              onRightPress={() =>
                navigation.navigate(
                  'PaymentDetails',
                )
              }
            >
              <Pressable
                style={
                  styles.paymentContainer
                }
                onPress={() =>
                  navigation.navigate(
                    'PaymentDetails',
                  )
                }
              >
                <View
                  style={
                    styles.paymentIconContainer
                  }
                >
                  <Image
                    source={require('../assets/login-icons/wallet.png')}
                    style={
                      styles.smallIcon
                    }
                    resizeMode="contain"
                  />
                </View>

                <View
                  style={
                    styles.paymentDetails
                  }
                >
                  <Text
                    style={
                      styles.paymentTitle
                    }
                  >
                    Payment Methods
                  </Text>

                  <Text
                    style={
                      styles.paymentSubtitle
                    }
                  >
                    Manage your saved payment options
                  </Text>
                </View>
              </Pressable>
            </SectionCard>

            {/* =================================================
             * Orders
             * ================================================= */}

            <SectionCard
              title="Orders"
            >
              {/* Previous Orders */}

              <TouchableOpacity
                activeOpacity={
                  0.8
                }
                style={[
                  styles.previousOrderRow,

                  styles.orderMenuWithBorder,
                ]}
                onPress={() =>
                  navigation.navigate(
                    'PreviousOrder',
                  )
                }
              >
                <View
                  style={
                    styles.previousOrderIconContainer
                  }
                >
                  <Image
                    source={require('../assets/login-icons/spoon-and-fork-crossed.png')}
                    style={
                      styles.previousOrderIcon
                    }
                    resizeMode="contain"
                  />
                </View>

                <View
                  style={
                    styles.previousOrderDetails
                  }
                >
                  <Text
                    style={
                      styles.previousOrderTitle
                    }
                  >
                    Previous Orders
                  </Text>

                  <Text
                    style={
                      styles.previousOrderSubtitle
                    }
                  >
                    View your previous tiffin orders
                  </Text>
                </View>

                <Image
                  source={require('../assets/login-icons/next.png')}
                  style={
                    styles.previousOrderArrow
                  }
                  resizeMode="contain"
                />
              </TouchableOpacity>

              {/* =================================================
               * NEW - Weekly Order Invoices
               * ================================================= */}

              <TouchableOpacity
                activeOpacity={
                  0.8
                }
                style={
                  styles.previousOrderRow
                }
                onPress={() =>
                  navigation.navigate(
                    'WeeklyInvoice',
                  )
                }
              >
                <View
                  style={
                    styles.weeklyInvoiceIconContainer
                  }
                >
                  <Image
                    source={require('../assets/login-icons/wallet.png')}
                    style={
                      styles.previousOrderIcon
                    }
                    resizeMode="contain"
                  />
                </View>

                <View
                  style={
                    styles.previousOrderDetails
                  }
                >
                  <View
                    style={
                      styles.weeklyInvoiceTitleRow
                    }
                  >
                    <Text
                      style={
                        styles.previousOrderTitle
                      }
                    >
                      Weekly Order Invoices
                    </Text>

                    <View
                      style={
                        styles.weeklyBadge
                      }
                    >
                      <Text
                        style={
                          styles.weeklyBadgeText
                        }
                      >
                        WEEKLY
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={
                      styles.previousOrderSubtitle
                    }
                  >
                    Monday-to-Monday orders & weekly payment
                  </Text>
                </View>

                <Image
                  source={require('../assets/login-icons/next.png')}
                  style={
                    styles.previousOrderArrow
                  }
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </SectionCard>

            {/* =================================================
             * Account Preferences
             * ================================================= */}

            {/*
            <SectionCard
              title="Account Preferences"
            >
              <PreferenceRow
                image={require('../assets/login-icons/back.png')}
                title="Push Notifications"
                subtitle="Receive order and delivery updates"
                showSwitch={true}
                switchValue={notificationsEnabled}
                onSwitchChange={setNotificationsEnabled}
              />

              <PreferenceRow
                image={require('../assets/login-icons/back.png')}
                title="Auto-Renew Subscription"
                subtitle="Automatically renew your weekly plan"
                showSwitch={true}
                switchValue={autoRenewEnabled}
                onSwitchChange={setAutoRenewEnabled}
                showBorder={false}
              />
            </SectionCard>
            */}

            {/* =================================================
             * Logout
             * ================================================= */}

            <TouchableOpacity
              activeOpacity={
                0.8
              }
              disabled={
                logoutLoading
              }
              style={[
                styles.logoutButton,

                logoutLoading && {
                  opacity:
                    0.6,
                },
              ]}
              onPress={
                handleLogout
              }
            >
              {logoutLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Image
                    source={require('../assets/login-icons/logout-light.png')}
                    style={
                      styles.logoutIcon
                    }
                    resizeMode="contain"
                  />

                  <Text
                    style={
                      styles.logoutText
                    }
                  >
                    Log Out
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text
              style={
                styles.versionText
              }
            >
              App Version 1.0.0
            </Text>
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* =====================================================
       * CUSTOM LOGOUT CONFIRMATION POPUP
       * ===================================================== */}

      <Modal
        visible={
          logoutPopupVisible
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={
          handleCancelLogout
        }
      >
        <Pressable
          style={
            styles.logoutPopupOverlay
          }
          onPress={
            handleCancelLogout
          }
        >
          <Pressable
            style={
              styles.logoutPopupCard
            }
            onPress={() => {}}
          >
            {/* Logout Icon */}

            <View
              style={
                styles.logoutPopupIconOuter
              }
            >
              <View
                style={
                  styles.logoutPopupIconInner
                }
              >
                <Image
                  source={require('../assets/login-icons/logout-light.png')}
                  style={
                    styles.logoutPopupIcon
                  }
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Heading */}

            <Text
              style={
                styles.logoutPopupTitle
              }
            >
              Log Out?
            </Text>

            <Text
              style={
                styles.logoutPopupDescription
              }
            >
              Are you sure you want to log out of your account?
            </Text>

            {/* Information */}

            <View
              style={
                styles.logoutInfoBox
              }
            >
              <Text
                style={
                  styles.logoutInfoIcon
                }
              >
                i
              </Text>

              <Text
                style={
                  styles.logoutInfoText
                }
              >
                You will need to sign in again to access your account.
              </Text>
            </View>

            {/* Buttons */}

            <View
              style={
                styles.logoutPopupButtons
              }
            >
              <TouchableOpacity
                disabled={
                  logoutLoading
                }
                activeOpacity={
                  0.8
                }
                onPress={
                  handleCancelLogout
                }
                style={
                  styles.logoutCancelButton
                }
              >
                <Text
                  style={
                    styles.logoutCancelText
                  }
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={
                  logoutLoading
                }
                activeOpacity={
                  0.85
                }
                onPress={
                  handleConfirmLogout
                }
                style={[
                  styles.logoutConfirmButton,

                  logoutLoading &&
                    styles.logoutConfirmButtonDisabled,
                ]}
              >
                {logoutLoading ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <Image
                      source={require('../assets/login-icons/logout.png')}
                      style={
                        styles.logoutConfirmIcon
                      }
                      resizeMode="contain"
                    />

                    <Text
                      style={
                        styles.logoutConfirmText
                      }
                    >
                      Log Out
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

/* =========================================================
 * Section Card
 * ========================================================= */

const SectionCard = ({
  title,
  children,
  rightText,
  onRightPress,
}) => {
  return (
    <View
      style={
        styles.sectionCard
      }
    >
      <View
        style={
          styles.sectionHeader
        }
      >
        <View
          style={
            styles.sectionHeaderTitle
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            {title}
          </Text>
        </View>

        {rightText ? (
          <Pressable
            hitSlop={
              10
            }
            onPress={
              onRightPress
            }
          >
            <Text
              style={
                styles.sectionRightText
              }
            >
              {
                rightText
              }
            </Text>
          </Pressable>
        ) : null}
      </View>

      {children}
    </View>
  );
};

/* =========================================================
 * Profile Row
 * ========================================================= */

const ProfileInformationRow = ({
  label,
  value,
  showBorder =
    true,
}) => {
  return (
    <View
      style={[
        styles.informationRow,

        !showBorder &&
          styles.noBorder,
      ]}
    >
      <Text
        style={
          styles.informationLabel
        }
      >
        {label}
      </Text>

      <Text
        numberOfLines={
          2
        }
        style={
          styles.informationValue
        }
      >
        {String(
          value ??
            '',
        )}
      </Text>
    </View>
  );
};

/* =========================================================
 * Preference
 * ========================================================= */

const PreferenceRow = ({
  image,
  title,
  subtitle,
  onPress,
  showSwitch =
    false,
  switchValue,
  onSwitchChange,
  showBorder =
    true,
}) => {
  const content = (
    <>
      <View
        style={
          styles.preferenceIcon
        }
      >
        <Image
          source={
            image
          }
          style={
            styles.preferenceImage
          }
          resizeMode="contain"
        />
      </View>

      <View
        style={
          styles.preferenceDetails
        }
      >
        <Text
          style={
            styles.preferenceTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.preferenceSubtitle
          }
        >
          {subtitle}
        </Text>
      </View>

      {showSwitch ? (
        <Switch
          value={
            switchValue
          }
          onValueChange={
            onSwitchChange
          }
          trackColor={{
            false:
              '#DDD7D2',

            true:
              '#E6A27E',
          }}
          thumbColor={
            switchValue
              ? '#B64D19'
              : '#FFFFFF'
          }
        />
      ) : (
        <Image
          source={require('../assets/login-icons/back.png')}
          style={
            styles.preferenceArrow
          }
          resizeMode="contain"
        />
      )}
    </>
  );

  if (
    showSwitch
  ) {
    return (
      <View
        style={[
          styles.preferenceRow,

          !showBorder &&
            styles.noBorder,
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      style={[
        styles.preferenceRow,

        !showBorder &&
          styles.noBorder,
      ]}
      onPress={
        onPress
      }
    >
      {content}
    </Pressable>
  );
};

export default Profile;

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
        12,

      paddingBottom:
        120,
    },

    centerContainer: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        30,
    },

    loadingTitle: {
      marginTop:
        14,

      color:
        '#231815',

      fontSize:
        14,

      fontWeight:
        '700',
    },

    errorTitle: {
      color:
        '#231815',

      fontSize:
        18,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    errorText: {
      color:
        '#8B7770',

      fontSize:
        12,

      marginTop:
        8,

      textAlign:
        'center',
    },

    retryButton: {
      marginTop:
        18,

      backgroundColor:
        '#A00B0F',

      borderRadius:
        10,

      paddingHorizontal:
        22,

      paddingVertical:
        12,
    },

    retryButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        11,

      fontWeight:
        '800',
    },

    /* =====================================================
     * Header
     * ===================================================== */

    header: {
      minHeight:
        56,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom:
        14,
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

    notificationButton: {
      width:
        40,

      height:
        40,

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

    notificationDot: {
      position:
        'absolute',

      top:
        8,

      right:
        9,

      width:
        6,

      height:
        6,

      backgroundColor:
        '#A84B20',

      borderWidth:
        1,

      borderColor:
        '#FFFFFF',

      borderRadius:
        3,
    },

    smallIcon: {
      width:
        20,

      height:
        20,
    },

    /* =====================================================
     * Profile
     * ===================================================== */

    profileSection: {
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
        18,

      padding:
        14,

      marginBottom:
        13,

      shadowColor:
        '#583829',

      shadowOffset: {
        width:
          0,

        height:
          4,
      },

      shadowOpacity:
        0.06,

      shadowRadius:
        10,

      elevation:
        2,
    },

    profileImage: {
      backgroundColor:
        '#E8DDD7',
    },

    cameraButton: {
      position:
        'absolute',

      right:
        -8,

      bottom:
        -10,

      width:
        37,

      height:
        37,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        50,

      borderWidth:
        1,

      borderColor:
        '#EFE5E0',
    },

    profileDetails: {
      flex:
        1,

      marginLeft:
        13,

      paddingRight:
        8,
    },

    userName: {
      color:
        '#221714',

      fontSize:
        17,

      fontWeight:
        '900',
    },

    userEmail: {
      color:
        '#8B7770',

      fontSize:
        10,

      marginTop:
        4,
    },

    editProfileButton: {
      width:
        36,

      height:
        36,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF1E9',

      borderRadius:
        12,
    },

    /* =====================================================
     * Section Card
     * ===================================================== */

    sectionCard: {
      width:
        '100%',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EFE5E0',

      borderRadius:
        17,

      paddingHorizontal:
        13,

      paddingTop:
        13,

      paddingBottom:
        3,

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

    sectionHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom:
        8,
    },

    sectionHeaderTitle: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    sectionTitle: {
      color:
        '#2B1D18',

      fontSize:
        20,

      fontWeight:
        '800',
    },

    sectionRightText: {
      color:
        '#A84B20',

      fontSize:
        10,

      fontWeight:
        '700',
    },

    /* =====================================================
     * Information
     * ===================================================== */

    informationRow: {
      minHeight:
        49,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#F0E8E4',
    },

    informationLabel: {
      flex:
        0.42,

      color:
        '#8A7670',

      fontSize:
        10,
    },

    informationValue: {
      flex:
        0.58,

      color:
        '#32231E',

      fontSize:
        10,

      fontWeight:
        '600',

      textAlign:
        'right',
    },

    noBorder: {
      borderBottomWidth:
        0,
    },

    /* =====================================================
     * Address
     * ===================================================== */

    addressContainer: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF9F6',

      borderWidth:
        1,

      borderColor:
        '#EFE4DE',

      borderRadius:
        13,

      padding:
        11,

      marginBottom:
        11,
    },

    addressIconContainer: {
      width:
        40,

      height:
        40,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0E8',

      borderRadius:
        11,

      marginRight:
        11,
    },

    addressDetails: {
      flex:
        1,
    },

    addressTitleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    addressTitle: {
      color:
        '#2C201B',

      fontSize:
        11,

      fontWeight:
        '800',
    },

    defaultBadge: {
      backgroundColor:
        '#FBE4D8',

      borderRadius:
        12,

      paddingHorizontal:
        6,

      paddingVertical:
        3,

      marginLeft:
        6,
    },

    defaultBadgeText: {
      color:
        '#A00B0F',

      fontSize:
        7,

      fontWeight:
        '700',
    },

    addressText: {
      color:
        '#87766F',

      fontSize:
        9,

      lineHeight:
        13,

      marginTop:
        2,
    },

    /* =====================================================
     * Payment
     * ===================================================== */

    paymentContainer: {
      minHeight:
        61,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF9F6',

      borderWidth:
        1,

      borderColor:
        '#EFE4DE',

      borderRadius:
        13,

      padding:
        10,

      marginBottom:
        11,
    },

    paymentIconContainer: {
      width:
        40,

      height:
        40,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0E8',

      borderRadius:
        11,

      marginRight:
        11,
    },

    paymentDetails: {
      flex:
        1,
    },

    paymentTitle: {
      color:
        '#2D201B',

      fontSize:
        11,

      fontWeight:
        '800',
    },

    paymentSubtitle: {
      color:
        '#897871',

      fontSize:
        8,

      marginTop:
        3,
    },

    /* =====================================================
     * Order Menus
     * ===================================================== */

    previousOrderRow: {
      width:
        '100%',

      minHeight:
        66,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF9F6',

      borderWidth:
        1,

      borderColor:
        '#EFE4DE',

      borderRadius:
        13,

      paddingHorizontal:
        11,

      paddingVertical:
        10,

      marginBottom:
        11,
    },

    orderMenuWithBorder: {
      marginBottom:
        8,
    },

    previousOrderIconContainer: {
      width:
        40,

      height:
        40,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0E8',

      borderRadius:
        11,

      marginRight:
        11,
    },

    previousOrderIcon: {
      width:
        21,

      height:
        21,
    },

    previousOrderDetails: {
      flex:
        1,

      paddingRight:
        10,
    },

    previousOrderTitle: {
      color:
        '#30231E',

      fontSize:
        11,

      fontWeight:
        '800',
    },

    previousOrderSubtitle: {
      color:
        '#908079',

      fontSize:
        8.5,

      marginTop:
        4,
    },

    previousOrderArrow: {
      width:
        17,

      height:
        17,

      opacity:
        0.65,
    },

    /* =====================================================
     * NEW Weekly Invoice Menu
     * ===================================================== */

    weeklyInvoiceIconContainer: {
      width:
        40,

      height:
        40,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FDE8E8',

      borderRadius:
        11,

      marginRight:
        11,
    },

    weeklyInvoiceTitleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      flexWrap:
        'wrap',
    },

    weeklyBadge: {
      marginLeft:
        7,

      backgroundColor:
        '#FBE4D8',

      borderRadius:
        10,

      paddingHorizontal:
        6,

      paddingVertical:
        2,
    },

    weeklyBadgeText: {
      color:
        '#A00B0F',

      fontSize:
        6,

      fontWeight:
        '900',

      letterSpacing:
        0.4,
    },

    /* =====================================================
     * Preferences
     * ===================================================== */

    preferenceRow: {
      minHeight:
        61,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#F0E8E4',
    },

    preferenceIcon: {
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

      marginRight:
        10,
    },

    preferenceImage: {
      width:
        19,

      height:
        19,
    },

    preferenceDetails: {
      flex:
        1,

      paddingRight:
        8,
    },

    preferenceTitle: {
      color:
        '#30231E',

      fontSize:
        10,

      fontWeight:
        '700',
    },

    preferenceSubtitle: {
      color:
        '#908079',

      fontSize:
        8,

      marginTop:
        3,
    },

    preferenceArrow: {
      width:
        17,

      height:
        17,

      opacity:
        0.65,
    },

    /* =====================================================
     * Logout
     * ===================================================== */

    logoutButton: {
      minHeight:
        52,

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

      marginBottom:
        14,
    },

    logoutIcon: {
      width:
        19,

      height:
        19,
    },

    logoutText: {
      color:
        '#FFFFFF',

      fontSize:
        16,

      fontWeight:
        '800',

      marginLeft:
        7,
    },

    versionText: {
      color:
        '#AA9C96',

      fontSize:
        9,

      textAlign:
        'center',

      marginBottom:
        8,
    },

    /* =====================================================
     * Custom Logout Popup
     * ===================================================== */

    logoutPopupOverlay: {
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

    logoutPopupCard: {
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
        28,

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
        0.24,

      shadowRadius:
        20,

      elevation:
        18,
    },

    logoutPopupIconOuter: {
      width:
        84,

      height:
        84,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0F0',

      borderRadius:
        42,

      marginBottom:
        15,
    },

    logoutPopupIconInner: {
      width:
        58,

      height:
        58,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F9DCDD',

      borderRadius:
        29,

      borderWidth:
        1,

      borderColor:
        '#EFC4C6',
    },

    logoutPopupIcon: {
      width:
        26,

      height:
        26,

      tintColor:
        '#A00B0F',
    },

    logoutPopupTitle: {
      color:
        '#281C19',

      fontSize:
        21,

      lineHeight:
        27,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    logoutPopupDescription: {
      maxWidth:
        290,

      color:
        '#766B67',

      fontSize:
        10.5,

      lineHeight:
        17,

      textAlign:
        'center',

      marginTop:
        7,
    },

    logoutInfoBox: {
      width:
        '100%',

      minHeight:
        50,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF7F4',

      borderWidth:
        1,

      borderColor:
        '#F0E3DE',

      borderRadius:
        12,

      paddingHorizontal:
        11,

      paddingVertical:
        9,

      marginTop:
        18,
    },

    logoutInfoIcon: {
      width:
        22,

      height:
        22,

      lineHeight:
        22,

      textAlign:
        'center',

      color:
        '#A00B0F',

      backgroundColor:
        '#F9E2E0',

      borderRadius:
        11,

      fontSize:
        11,

      fontWeight:
        '900',

      marginRight:
        8,
    },

    logoutInfoText: {
      flex:
        1,

      color:
        '#796B67',

      fontSize:
        8.5,

      lineHeight:
        13,

      fontWeight:
        '600',
    },

    logoutPopupButtons: {
      width:
        '100%',

      flexDirection:
        'row',

      alignItems:
        'center',

      marginTop:
        20,
    },

    logoutCancelButton: {
      flex:
        1,

      minHeight:
        49,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F8F5F4',

      borderWidth:
        1,

      borderColor:
        '#E8E0DD',

      borderRadius:
        12,

      marginRight:
        5,
    },

    logoutCancelText: {
      color:
        '#6E625E',

      fontSize:
        10,

      fontWeight:
        '900',
    },

    logoutConfirmButton: {
      flex:
        1,

      minHeight:
        49,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#A00B0F',

      borderRadius:
        12,

      marginLeft:
        5,

      shadowColor:
        '#A00B0F',

      shadowOffset: {
        width:
          0,

        height:
          4,
      },

      shadowOpacity:
        0.2,

      shadowRadius:
        7,

      elevation:
        4,
    },

    logoutConfirmButtonDisabled: {
      opacity:
        0.6,
    },

    logoutConfirmIcon: {
      width:
        17,

      height:
        17,

      tintColor:
        '#FFFFFF',

      marginRight:
        6,
    },

    logoutConfirmText: {
      color:
        '#FFFFFF',

      fontSize:
        10,

      fontWeight:
        '900',
    },
  });