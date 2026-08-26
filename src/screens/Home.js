import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
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

import {
  useDispatch,
  useSelector,
} from 'react-redux';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getTiffins,
} from '../redux/Action';

/* =========================================================
 * API
 * ========================================================= */

const BASE_URL =
  'https://replete-software.com/projects/kp_admin';

const PROFILE_API =
  'https://replete-software.com/projects/kp_admin/api/customer/profile';

const NOTIFICATION_API =
  'https://replete-software.com/projects/kp_admin/api/customer/notifications';

/* =========================================================
 * Local Storage
 * ========================================================= */

const CART_STORAGE_KEY =
  'kp_customer_cart';

/* =========================================================
 * Home
 * ========================================================= */

const Home = ({
  navigation,
}) => {
  const {
    width,
  } = useWindowDimensions();

  const dispatch =
    useDispatch();

  const {
    tiffins,
    loading,
    error,
  } = useSelector(
    state =>
      state.tiffin,
  );

  /* =======================================================
   * Cart Count
   * ======================================================= */

  const [
    cartCount,
    setCartCount,
  ] = useState(0);

  /* =======================================================
   * Notification Count
   * ======================================================= */

  const [
    unreadNotificationCount,
    setUnreadNotificationCount,
  ] = useState(0);

  /* =======================================================
   * Add To Cart Loader
   * ======================================================= */

  const [
    addingItemId,
    setAddingItemId,
  ] = useState(null);

  /* =======================================================
   * Custom Cart Popup
   * ======================================================= */

  const [
    cartPopupVisible,
    setCartPopupVisible,
  ] = useState(false);

  const [
    addedTiffin,
    setAddedTiffin,
  ] = useState(null);

  /* =======================================================
   * Location
   * ======================================================= */

  const [
    userLocation,
    setUserLocation,
  ] = useState(
    'Set delivery location',
  );

  /* =======================================================
   * Responsive Layout
   * ======================================================= */

  const layout =
    useMemo(() => {
      const isTablet =
        width >= 768;

      return {
        pageWidth:
          isTablet
            ? Math.min(
                width - 64,
                900,
              )
            : width,

        horizontalPadding:
          isTablet
            ? 28
            : 16,

        cardColumns:
          isTablet
            ? 2
            : 1,
      };
    }, [
      width,
    ]);

  /* =======================================================
   * Fetch Tiffin API
   * ======================================================= */

  useEffect(() => {
    dispatch(
      getTiffins(),
    );
  }, [
    dispatch,
  ]);

  /* =======================================================
   * Image URL Helper
   * ======================================================= */

  const getImageUrl =
    image => {
      if (!image) {
        return null;
      }

      const value =
        String(
          image,
        ).trim();

      if (
        value.startsWith(
          'http://',
        ) ||
        value.startsWith(
          'https://',
        )
      ) {
        return value;
      }

      if (
        value.startsWith(
          '/',
        )
      ) {
        return `${BASE_URL}${value}`;
      }

      return `${BASE_URL}/${value}`;
    };

  /* =======================================================
   * Normalize Tiffin API
   * ======================================================= */

  const meals =
    useMemo(() => {
      if (
        !Array.isArray(
          tiffins,
        )
      ) {
        return [];
      }

      return tiffins.map(
        (
          item,
          index,
        ) => {
          /* =============================================
           * Price
           * ============================================= */

          const rawPrice =
            Number(
              item?.price ??
                item?.tiffin_price ??
                0,
            );

          /* =============================================
           * Image
           * ============================================= */

          const image =
            getImageUrl(
              item?.image_url ??
                item?.image ??
                item?.tiffin_image,
            );

          /* =============================================
           * Availability
           * ============================================= */

          let available =
            true;

          if (
            item?.status !==
              undefined &&
            item?.status !==
              null
          ) {
            const status =
              String(
                item.status,
              )
                .trim()
                .toLowerCase();

            available =
              status ===
                'active' ||
              status ===
                'available' ||
              status ===
                '1' ||
              status ===
                'true';
          } else if (
            item?.is_active !==
              undefined &&
            item?.is_active !==
              null
          ) {
            available =
              item.is_active ===
                true ||
              item.is_active ===
                1 ||
              item.is_active ===
                '1';
          } else if (
            item?.available !==
              undefined &&
            item?.available !==
              null
          ) {
            available =
              item.available ===
                true ||
              item.available ===
                1 ||
              item.available ===
                '1';
          }

          /* =============================================
           * Category
           * ============================================= */

          let category =
            'Tiffin';

          if (
            item?.category &&
            typeof item.category ===
              'object'
          ) {
            category =
              item.category?.name ??
              item.category?.title ??
              'Tiffin';
          } else if (
            item?.category_name
          ) {
            category =
              item.category_name;
          } else if (
            typeof item?.category ===
            'string'
          ) {
            category =
              item.category;
          }

          /* =============================================
           * Preparation Time
           * ============================================= */

          let preparationTime =
            item?.prep_time ??
            item?.preparation_time ??
            item?.preparationTime ??
            '20 min';

          if (
            preparationTime &&
            !String(
              preparationTime,
            )
              .toLowerCase()
              .includes(
                'min',
              )
          ) {
            preparationTime =
              `${preparationTime} min`;
          }

          /* =============================================
           * Food Type
           * ============================================= */

          const foodType =
            String(
              item?.food_type ??
                item?.foodType ??
                'VEGETARIAN',
            ).toUpperCase();

          return {
            ...item,

            id:
              String(
                item?.id ??
                  index,
              ),

            name:
              item?.name ??
              item?.tiffin_name ??
              'Tiffin',

            rawPrice,

            price:
              `$${rawPrice.toFixed(
                2,
              )}`,

            image,

            description:
              item?.description ??
              item?.tiffin_description ??
              '',

            category,

            preparationTime,

            foodType,

            available,
          };
        },
      );
    }, [
      tiffins,
    ]);

  /* =======================================================
   * Get Stored Cart
   * ======================================================= */

  const getStoredCart =
    async () => {
      try {
        const stored =
          await AsyncStorage.getItem(
            CART_STORAGE_KEY,
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
          'GET CART ERROR:',
          error,
        );

        return [];
      }
    };

  /* =======================================================
   * Update Cart Count
   * ======================================================= */

  const updateCartCount =
    async () => {
      try {
        const cart =
          await getStoredCart();

        const count =
          cart.reduce(
            (
              total,
              item,
            ) => {
              return (
                total +
                Number(
                  item?.quantity ??
                    1,
                )
              );
            },
            0,
          );

        setCartCount(
          count,
        );
      } catch (
        error
      ) {
        console.log(
          'CART COUNT ERROR:',
          error,
        );
      }
    };

  /* =======================================================
   * Fetch Unread Notification Count
   * ======================================================= */

  const fetchUnreadNotificationCount =
    async () => {
      try {
        /* =============================================
         * Token
         * ============================================= */

        const token =
          await AsyncStorage.getItem(
            'token',
          );

        /* =============================================
         * Guest
         * ============================================= */

        if (!token) {
          setUnreadNotificationCount(
            0,
          );

          return;
        }

        /* =============================================
         * Notification API
         * ============================================= */

        const response =
          await fetch(
            NOTIFICATION_API,
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

        let result;

        try {
          result =
            JSON.parse(
              responseText,
            );
        } catch (
          parseError
        ) {
          console.log(
            'NOTIFICATION JSON ERROR:',
            parseError,
          );

          setUnreadNotificationCount(
            0,
          );

          return;
        }

        /* =============================================
         * API Error
         * ============================================= */

        if (
          !response.ok
        ) {
          console.log(
            'NOTIFICATION API ERROR:',
            result,
          );

          return;
        }

        /* =============================================
         * Backend Direct Count
         *
         * If Laravel already gives unread_count,
         * use that first.
         * ============================================= */

        const directUnreadCount =
          result?.unread_count ??
          result?.unreadCount ??
          result?.data
            ?.unread_count ??
          result?.data
            ?.unreadCount ??
          null;

        if (
          directUnreadCount !==
            null &&
          directUnreadCount !==
            undefined
        ) {
          setUnreadNotificationCount(
            Number(
              directUnreadCount,
            ) || 0,
          );

          return;
        }

        /* =============================================
         * Extract Notification Array
         * ============================================= */

        let notificationData =
          [];

        if (
          Array.isArray(
            result,
          )
        ) {
          notificationData =
            result;
        } else if (
          Array.isArray(
            result?.data,
          )
        ) {
          notificationData =
            result.data;
        } else if (
          Array.isArray(
            result?.notifications,
          )
        ) {
          notificationData =
            result.notifications;
        } else if (
          Array.isArray(
            result?.data
              ?.notifications,
          )
        ) {
          notificationData =
            result.data.notifications;
        } else if (
          Array.isArray(
            result?.data
              ?.data,
          )
        ) {
          /*
           * Laravel pagination example:
           *
           * {
           *   data: {
           *     data: [...]
           *   }
           * }
           */

          notificationData =
            result.data.data;
        } else if (
          Array.isArray(
            result?.notifications
              ?.data,
          )
        ) {
          notificationData =
            result.notifications.data;
        } else if (
          Array.isArray(
            result?.data
              ?.notifications
              ?.data,
          )
        ) {
          notificationData =
            result.data
              .notifications
              .data;
        }

        /* =============================================
         * Count Unread Notifications
         * ============================================= */

        const unreadCount =
          notificationData.filter(
            notification => {
              const rawData =
                notification?.data &&
                typeof notification.data ===
                  'object'
                  ? notification.data
                  : {};

              const readAt =
                notification?.read_at ??
                notification?.readAt ??
                rawData?.read_at ??
                rawData?.readAt ??
                null;

              const isRead =
                Boolean(
                  readAt ||
                    notification?.is_read ===
                      true ||
                    notification?.is_read ===
                      1 ||
                    notification?.is_read ===
                      '1' ||
                    rawData?.is_read ===
                      true ||
                    rawData?.is_read ===
                      1 ||
                    rawData?.is_read ===
                      '1',
                );

              return !isRead;
            },
          ).length;

        setUnreadNotificationCount(
          unreadCount,
        );
      } catch (
        error
      ) {
        console.log(
          'FETCH UNREAD NOTIFICATION ERROR:',
          error,
        );
      }
    };

  /* =======================================================
   * Fetch Profile Location
   * ======================================================= */

  const fetchLocation =
    async () => {
      try {
        const token =
          await AsyncStorage.getItem(
            'token',
          );

        /* =============================================
         * Guest
         * ============================================= */

        if (!token) {
          setUserLocation(
            'Set delivery location',
          );

          return;
        }

        /* =============================================
         * Profile API
         * ============================================= */

        const response =
          await fetch(
            PROFILE_API,
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

        let result;

        try {
          result =
            JSON.parse(
              responseText,
            );
        } catch (
          parseError
        ) {
          console.log(
            'PROFILE JSON ERROR:',
            parseError,
          );

          return;
        }

        if (
          !response.ok
        ) {
          console.log(
            'PROFILE API ERROR:',
            result,
          );

          return;
        }

        /* =============================================
         * Profile Object
         * ============================================= */

        const profile =
          result?.data
            ?.customer ??
          result?.data
            ?.user ??
          result?.data
            ?.profile ??
          result?.data ??
          result?.customer ??
          result?.user ??
          result?.profile ??
          result;

        /* =============================================
         * Location
         * ============================================= */

        let location =
          profile
            ?.delivery_address ??
          profile
            ?.delivery_location ??
          profile
            ?.full_address ??
          null;

        if (
          !location &&
          typeof profile?.address ===
            'string'
        ) {
          location =
            profile.address;
        }

        if (
          !location &&
          profile?.address &&
          typeof profile.address ===
            'object'
        ) {
          location = [
            profile.address
              ?.address_line_1,

            profile.address
              ?.address_line_2,

            profile.address
              ?.street,

            profile.address
              ?.suburb,

            profile.address
              ?.city,

            profile.address
              ?.state,

            profile.address
              ?.postcode ??
              profile.address
                ?.pincode,
          ]
            .filter(
              Boolean,
            )
            .join(', ');
        }

        if (!location) {
          location = [
            profile?.address_line_1,

            profile?.address_line_2,

            profile?.street,

            profile?.suburb,

            profile?.city,

            profile?.state,

            profile?.postcode ??
              profile?.pincode,
          ]
            .filter(
              Boolean,
            )
            .join(', ');
        }

        setUserLocation(
          location ||
            'Set delivery location',
        );
      } catch (
        error
      ) {
        console.log(
          'LOCATION ERROR:',
          error,
        );
      }
    };

  /* =======================================================
   * Refresh Data Whenever Home Gets Focus
   * ======================================================= */

  useFocusEffect(
    useCallback(() => {
      updateCartCount();

      fetchLocation();

      fetchUnreadNotificationCount();
    }, []),
  );

  /* =======================================================
   * Open Customize Tiffin
   * ======================================================= */

  const handleTiffinPress =
    meal => {
      if (
        !meal.available
      ) {
        return;
      }

      navigation.navigate(
        'CustomizeTiffin',
        {
          tiffin:
            meal,

          mode:
            'customize',
        },
      );
    };

  /* =======================================================
   * Add To Cart
   * ======================================================= */

  const handleAddToCart =
    async meal => {
      if (
        !meal.available
      ) {
        return;
      }

      try {
        setAddingItemId(
          meal.id,
        );

        const cart =
          await getStoredCart();

        /* ===============================================
         * Existing Normal Tiffin
         * =============================================== */

        const existingIndex =
          cart.findIndex(
            cartItem =>
              String(
                cartItem?.tiffinId ??
                  cartItem?.id,
              ) ===
                String(
                  meal.id,
                ) &&
              cartItem
                ?.isCustomized !==
                true,
          );

        let updatedCart;

        /* ===============================================
         * Increment Existing
         * =============================================== */

        if (
          existingIndex !==
          -1
        ) {
          updatedCart = [
            ...cart,
          ];

          const currentQuantity =
            Number(
              updatedCart[
                existingIndex
              ]?.quantity ??
                1,
            );

          updatedCart[
            existingIndex
          ] = {
            ...updatedCart[
              existingIndex
            ],

            quantity:
              currentQuantity +
              1,
          };
        }

        /* ===============================================
         * New Tiffin
         * =============================================== */

        else {
          const price =
            Number(
              meal.rawPrice ??
                0,
            );

          const shippingCharge =
            price < 11
              ? 2
              : 0;

          const cartItem = {
            cartId:
              `normal-${meal.id}-${Date.now()}`,

            id:
              meal.id,

            tiffinId:
              meal.id,

            productId:
              meal.id,

            name:
              meal.name,

            description:
              meal.description,

            image:
              meal.image,

            preparationTime:
              meal.preparationTime,

            category:
              meal.category,

            foodType:
              meal.foodType,

            quantity:
              1,

            basePrice:
              price,

            rawPrice:
              price,

            subtotal:
              price,

            customizationPrice:
              0,

            extrasPrice:
              0,

            shippingCharge,

            totalPrice:
              price +
              shippingCharge,

            selections:
              [],

            extras:
              [],

            isCustomized:
              false,

            originalTiffin:
              meal,

            addedAt:
              new Date()
                .toISOString(),
          };

          updatedCart = [
            ...cart,
            cartItem,
          ];
        }

        /* ===============================================
         * Save Cart
         * =============================================== */

        await AsyncStorage.setItem(
          CART_STORAGE_KEY,

          JSON.stringify(
            updatedCart,
          ),
        );

        /* ===============================================
         * Refresh Badge
         * =============================================== */

        await updateCartCount();

        /* ===============================================
         * Custom Popup
         * =============================================== */

        setAddedTiffin(
          meal,
        );

        setCartPopupVisible(
          true,
        );
      } catch (
        error
      ) {
        console.log(
          'ADD TO CART ERROR:',
          error,
        );

        Alert.alert(
          'Unable to Add',
          'Unable to add this tiffin to your cart. Please try again.',
        );
      } finally {
        setAddingItemId(
          null,
        );
      }
    };

  /* =======================================================
   * Close Cart Popup
   * ======================================================= */

  const closeCartPopup =
    () => {
      setCartPopupVisible(
        false,
      );

      setAddedTiffin(
        null,
      );
    };

  /* =======================================================
   * View Cart
   * ======================================================= */

  const handleViewCart =
    () => {
      closeCartPopup();

      navigation.navigate(
        'Order',
      );
    };

  /* =======================================================
   * Location Press
   * ======================================================= */

  const handleLocationPress =
    async () => {
      try {
        const token =
          await AsyncStorage.getItem(
            'token',
          );

        if (token) {
          navigation.navigate(
            'AddressList',
          );

          return;
        }

        Alert.alert(
          'Login Required',

          'Please sign in to manage your delivery address.',

          [
            {
              text:
                'Cancel',

              style:
                'cancel',
            },

            {
              text:
                'Sign In',

              onPress:
                () => {
                  navigation.navigate(
                    'Login',
                    {
                      redirectTo:
                        'AddressList',
                    },
                  );
                },
            },
          ],
        );
      } catch (
        error
      ) {
        console.log(
          'LOCATION LOGIN CHECK ERROR:',
          error,
        );
      }
    };

  /* =======================================================
   * Notification Press
   * ======================================================= */

  const handleNotificationPress =
    () => {
      navigation.navigate(
        'Notification',
      );
    };

  /* =======================================================
   * Render Tiffin
   * ======================================================= */

  const renderMeal =
    ({
      item,
    }) => {
      const isAdding =
        addingItemId ===
        item.id;

      const isVegetarian =
        item.foodType ===
          'VEGETARIAN' ||
        item.foodType ===
          'VEG';

      return (
        <Pressable
          disabled={
            !item.available
          }

          onPress={() =>
            handleTiffinPress(
              item,
            )
          }

          style={({
            pressed,
          }) => [
            styles.card,

            layout.cardColumns ===
              2 &&
              styles.tabletCard,

            pressed &&
              item.available &&
              styles.pressedCard,
          ]}>

          {/* =========================================== */}
          {/* Image */}
          {/* =========================================== */}

          <View
            style={
              styles.imageContainer
            }>

            {item.image ? (
              <Image
                source={{
                  uri:
                    item.image,
                }}

                style={
                  styles.image
                }

                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.image,

                  styles.noImage,
                ]}>

                <Image
                  source={require('../assets/login-icons/spoon-and-fork-crossed.png')}

                  style={
                    styles.noImageIcon
                  }

                  resizeMode="contain"
                />

                <Text
                  style={
                    styles.noImageText
                  }>
                  No Image
                </Text>

              </View>
            )}

            {/* ========================================= */}
            {/* Food Type */}
            {/* ========================================= */}

            <View
              style={[
                styles.foodBadge,

                !isVegetarian &&
                  styles.nonVegBadge,
              ]}>

              <View
                style={[
                  styles.foodDot,

                  !isVegetarian &&
                    styles.nonVegDot,
                ]}
              />

              <Text
                style={[
                  styles.foodBadgeText,

                  !isVegetarian &&
                    styles.nonVegText,
                ]}>

                {
                  item.foodType
                }

              </Text>

            </View>

            {/* ========================================= */}
            {/* Sold Out */}
            {/* ========================================= */}

            {!item.available && (
              <View
                style={
                  styles.soldOutOverlay
                }>

                <View
                  style={
                    styles.soldOutBadge
                  }>

                  <Text
                    style={
                      styles.soldOutText
                    }>
                    SOLD OUT
                  </Text>

                </View>

              </View>
            )}

          </View>

          {/* =========================================== */}
          {/* Content */}
          {/* =========================================== */}

          <View
            style={
              styles.cardContent
            }>

            <View
              style={
                styles.titleRow
              }>

              <Text
                numberOfLines={
                  2
                }

                style={
                  styles.name
                }>

                {
                  item.name
                }

              </Text>

              <Text
                style={
                  styles.price
                }>

                {
                  item.price
                }

              </Text>

            </View>

            {!!item.description && (
              <Text
                numberOfLines={
                  3
                }

                style={
                  styles.description
                }>

                {
                  item.description
                }

              </Text>
            )}

            {/* ========================================= */}
            {/* Meta */}
            {/* ========================================= */}

            <View
              style={
                styles.metaRow
              }>

              {!!item.category && (
                <View
                  style={
                    styles.meta
                  }>

                  <Image
                    source={require('../assets/login-icons/spoon-and-fork-crossed.png')}

                    style={
                      styles.metaIcon
                    }

                    resizeMode="contain"
                  />

                  <Text
                    style={
                      styles.metaText
                    }>

                    {
                      item.category
                    }

                  </Text>

                </View>
              )}

              {!!item.preparationTime && (
                <View
                  style={
                    styles.meta
                  }>

                  <Image
                    source={require('../assets/login-icons/time-left.png')}

                    style={
                      styles.metaIcon
                    }

                    resizeMode="contain"
                  />

                  <Text
                    style={
                      styles.metaText
                    }>

                    {
                      item.preparationTime
                    }

                  </Text>

                </View>
              )}

            </View>

            {/* ========================================= */}
            {/* Add To Cart */}
            {/* ========================================= */}

            <TouchableOpacity
              activeOpacity={
                0.85
              }

              disabled={
                !item.available ||
                isAdding
              }

              onPress={
                event => {
                  event
                    ?.stopPropagation
                    ?.();

                  handleAddToCart(
                    item,
                  );
                }
              }

              style={[
                styles.addCartButton,

                (!item.available ||
                  isAdding) &&
                  styles.addCartButtonDisabled,
              ]}>

              {isAdding ? (
                <ActivityIndicator
                  size="small"

                  color="#A00B0F"
                />
              ) : (
                <>
                  <Image
                    source={require('../assets/login-icons/add-cart.png')}

                    style={
                      styles.addCartIcon
                    }

                    resizeMode="contain"
                  />

                  <Text
                    style={
                      styles.addCartText
                    }>
                    ADD TO CART
                  </Text>
                </>
              )}

            </TouchableOpacity>

            {/* ========================================= */}
            {/* Customize */}
            {/* ========================================= */}

            {item.available && (
              <Text
                style={
                  styles.tapText
                }>
                Tap card to customize
              </Text>
            )}

          </View>

        </Pressable>
      );
    };

  /* =======================================================
   * Loading
   * ======================================================= */

  if (
    loading &&
    meals.length ===
      0
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }>

        <StatusBar
          barStyle="dark-content"

          backgroundColor="#FAF8FD"
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
            Loading Today&apos;s Menu
          </Text>

          <Text
            style={
              styles.loadingText
            }>
            Fresh meals are being prepared for you...
          </Text>

        </View>

      </SafeAreaView>
    );
  }

  /* =======================================================
   * Main
   * ======================================================= */

  return (
    <>
      <SafeAreaView
        style={
          styles.safeArea
        }>

        <StatusBar
          barStyle="dark-content"

          backgroundColor="#FAF8FD"
        />

        <View
          style={[
            styles.page,

            {
              width:
                layout.pageWidth,

              paddingHorizontal:
                layout.horizontalPadding,
            },
          ]}>

          <FlatList
            key={
              layout.cardColumns
            }

            data={
              meals
            }

            numColumns={
              layout.cardColumns
            }

            keyExtractor={
              item =>
                String(
                  item.id,
                )
            }

            renderItem={
              renderMeal
            }

            showsVerticalScrollIndicator={
              false
            }

            contentContainerStyle={
              styles.listContent
            }

            columnWrapperStyle={
              layout.cardColumns ===
              2
                ? styles.column
                : undefined
            }

            refreshControl={
              <RefreshControl
                refreshing={
                  loading
                }

                onRefresh={() => {
                  dispatch(
                    getTiffins(),
                  );

                  fetchLocation();

                  fetchUnreadNotificationCount();

                  updateCartCount();
                }}

                colors={[
                  '#A00B0F',
                ]}

                tintColor="#A00B0F"
              />
            }

            ListHeaderComponent={
              <>
                {/* ======================================= */}
                {/* Header */}
                {/* ======================================= */}

                <View
                  style={
                    styles.header
                  }>

                  {/* ===================================== */}
                  {/* Location */}
                  {/* ===================================== */}

                  <Pressable
                    style={
                      styles.locationArea
                    }

                    onPress={
                      handleLocationPress
                    }>

                    <View
                      style={
                        styles.locationIconContainer
                      }>

                      <Image
                        source={require('../assets/login-icons/location.png')}

                        style={
                          styles.locationIcon
                        }

                        resizeMode="contain"
                      />

                    </View>

                    <View
                      style={
                        styles.locationContent
                      }>

                      <Text
                        style={
                          styles.locationLabel
                        }>
                        Delivering to
                      </Text>

                      <Text
                        numberOfLines={
                          1
                        }

                        ellipsizeMode="tail"

                        style={
                          styles.location
                        }>

                        {
                          userLocation
                        }

                      </Text>

                    </View>

                  </Pressable>

                  {/* ===================================== */}
                  {/* Header Actions */}
                  {/* ===================================== */}

                  <View
                    style={
                      styles.actions
                    }>

                    {/* =================================== */}
                    {/* Notification Bell */}
                    {/* =================================== */}

                    <Pressable
                      hitSlop={
                        10
                      }

                      style={
                        styles.iconButton
                      }

                      onPress={
                        handleNotificationPress
                      }>

                      <Image
                        source={require('../assets/login-icons/notification.png')}

                        style={
                          styles.headerIcon
                        }

                        resizeMode="contain"
                      />

                      {/* =================================
                       * UNREAD NOTIFICATION NUMBER
                       * ================================= */}

                      {unreadNotificationCount >
                        0 && (
                        <View
                          style={
                            styles.notificationCountBadge
                          }>

                          <Text
                            style={
                              styles.notificationCountText
                            }>

                            {unreadNotificationCount >
                            99
                              ? '99+'
                              : unreadNotificationCount}

                          </Text>

                        </View>
                      )}

                    </Pressable>

                    {/* =================================== */}
                    {/* Cart */}
                    {/* =================================== */}

                    <Pressable
                      hitSlop={
                        10
                      }

                      style={
                        styles.iconButton
                      }

                      onPress={() =>
                        navigation.navigate(
                          'Order',
                        )
                      }>

                      <Image
                        source={require('../assets/login-icons/add-cart.png')}

                        style={
                          styles.headerIcon
                        }

                        resizeMode="contain"
                      />

                      {cartCount >
                        0 && (
                        <View
                          style={
                            styles.cartCountBadge
                          }>

                          <Text
                            style={
                              styles.cartCountText
                            }>

                            {cartCount >
                            99
                              ? '99+'
                              : cartCount}

                          </Text>

                        </View>
                      )}

                    </Pressable>

                  </View>

                </View>

                {/* ======================================= */}
                {/* Menu Heading */}
                {/* ======================================= */}

                <View
                  style={
                    styles.heading
                  }>

                  <View>
                    <Text
                      style={
                        styles.eyebrow
                      }>
                      TODAY&apos;S MENU
                    </Text>

                    <Text
                      style={
                        styles.headingText
                      }>
                      Freshly prepared for you
                    </Text>
                  </View>

                  <View
                    style={
                      styles.mealCountBadge
                    }>

                    <Text
                      style={
                        styles.mealCountText
                      }>

                      {meals.length}{' '}

                      {meals.length ===
                      1
                        ? 'meal'
                        : 'meals'}

                    </Text>

                  </View>

                </View>
              </>
            }

            ListEmptyComponent={
              !loading ? (
                <View
                  style={
                    styles.emptyContainer
                  }>

                  <Image
                    source={require('../assets/login-icons/spoon-and-fork-crossed.png')}

                    style={
                      styles.emptyIcon
                    }

                    resizeMode="contain"
                  />

                  <Text
                    style={
                      styles.emptyTitle
                    }>
                    No tiffins available
                  </Text>

                  <Text
                    style={
                      styles.emptyDescription
                    }>

                    {error
                      ? String(
                          error,
                        )
                      : 'There are currently no tiffins available.'}

                  </Text>

                </View>
              ) : null
            }
          />

        </View>

      </SafeAreaView>

      {/* ================================================= */}
      {/* CUSTOM ADD TO CART POPUP */}
      {/* ================================================= */}

      <Modal
        visible={
          cartPopupVisible
        }

        transparent

        animationType="fade"

        statusBarTranslucent

        onRequestClose={
          closeCartPopup
        }>

        <Pressable
          style={
            styles.cartPopupOverlay
          }

          onPress={
            closeCartPopup
          }>

          <Pressable
            style={
              styles.cartPopupCard
            }

            onPress={() => {}}>

            {/* =========================================== */}
            {/* Success Icon */}
            {/* =========================================== */}

            <View
              style={
                styles.cartPopupIconOuter
              }>

              <View
                style={
                  styles.cartPopupIconInner
                }>

                <Text
                  style={
                    styles.cartPopupCheck
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
                styles.cartPopupTitle
              }>
              Added to Cart!
            </Text>

            <Text
              style={
                styles.cartPopupDescription
              }>
              Your tiffin has been added successfully to your cart.
            </Text>

            {/* =========================================== */}
            {/* Product */}
            {/* =========================================== */}

            {!!addedTiffin && (
              <View
                style={
                  styles.cartPopupProduct
                }>

                {addedTiffin?.image ? (
                  <Image
                    source={{
                      uri:
                        addedTiffin.image,
                    }}

                    style={
                      styles.cartPopupProductImage
                    }

                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.cartPopupProductImage,

                      styles.cartPopupNoImage,
                    ]}>

                    <Image
                      source={require('../assets/login-icons/spoon-and-fork-crossed.png')}

                      style={
                        styles.cartPopupNoImageIcon
                      }

                      resizeMode="contain"
                    />

                  </View>
                )}

                <View
                  style={
                    styles.cartPopupProductDetails
                  }>

                  <Text
                    numberOfLines={
                      2
                    }

                    style={
                      styles.cartPopupItemName
                    }>

                    {
                      addedTiffin?.name
                    }

                  </Text>

                  {!!addedTiffin
                    ?.category && (
                    <Text
                      numberOfLines={
                        1
                      }

                      style={
                        styles.cartPopupCategory
                      }>

                      {
                        addedTiffin.category
                      }

                    </Text>
                  )}

                  <Text
                    style={
                      styles.cartPopupPrice
                    }>

                    {
                      addedTiffin?.price ??
                      `$${Number(
                        addedTiffin?.rawPrice ??
                          0,
                      ).toFixed(
                        2,
                      )}`
                    }

                  </Text>

                </View>

                <View
                  style={
                    styles.cartPopupAddedBadge
                  }>

                  <Text
                    style={
                      styles.cartPopupAddedText
                    }>
                    Added
                  </Text>

                </View>

              </View>
            )}

            {/* =========================================== */}
            {/* Buttons */}
            {/* =========================================== */}

            <View
              style={
                styles.cartPopupButtons
              }>

              <TouchableOpacity
                activeOpacity={
                  0.8
                }

                onPress={
                  closeCartPopup
                }

                style={
                  styles.continueShoppingButton
                }>

                <Text
                  style={
                    styles.continueShoppingText
                  }>
                  Continue Shopping
                </Text>

              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={
                  0.85
                }

                onPress={
                  handleViewCart
                }

                style={
                  styles.viewCartButton
                }>

                <Image
                  source={require('../assets/login-icons/add-cart.png')}

                  style={
                    styles.viewCartIcon
                  }

                  resizeMode="contain"
                />

                <Text
                  style={
                    styles.viewCartText
                  }>
                  View Cart
                </Text>

              </TouchableOpacity>

            </View>

          </Pressable>

        </Pressable>

      </Modal>
    </>
  );
};

export default Home;

/* =========================================================
 * Styles
 * ========================================================= */

const styles =
  StyleSheet.create({
    safeArea: {
      flex:
        1,

      backgroundColor:
        '#FAF8FD',
    },

    page: {
      flex:
        1,

      alignSelf:
        'center',
    },

    listContent: {
      paddingBottom:
        120,
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

      justifyContent:
        'space-between',
    },

    locationArea: {
      flex:
        1,

      flexDirection:
        'row',

      alignItems:
        'center',

      marginRight:
        10,
    },

    locationContent: {
      flex:
        1,
    },

    locationIconContainer: {
      width:
        32,

      height:
        32,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F6EDEE',

      borderRadius:
        10,

      marginRight:
        8,
    },

    locationIcon: {
      width:
        17,

      height:
        17,

      tintColor:
        '#A00B0F',
    },

    locationLabel: {
      color:
        '#99909D',

      fontSize:
        9,
    },

    location: {
      color:
        '#211A25',

      fontSize:
        12,

      fontWeight:
        '800',

      marginTop:
        2,
    },

    /* =====================================================
     * Header Actions
     * ===================================================== */

    actions: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    iconButton: {
      width:
        38,

      height:
        38,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        12,

      borderWidth:
        1,

      borderColor:
        '#EEE8F1',

      marginLeft:
        7,
    },

    headerIcon: {
      width:
        19,

      height:
        19,

      resizeMode:
        'contain',
    },

    /* =====================================================
     * Notification Count Badge
     * ===================================================== */

    notificationCountBadge: {
      position:
        'absolute',

      top:
        -6,

      right:
        -6,

      minWidth:
        19,

      height:
        19,

      paddingHorizontal:
        4,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#A00B0F',

      borderRadius:
        10,

      borderWidth:
        2,

      borderColor:
        '#FAF8FD',
    },

    notificationCountText: {
      color:
        '#FFFFFF',

      fontSize:
        7.5,

      lineHeight:
        10,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    /* =====================================================
     * Cart Badge
     * ===================================================== */

    cartCountBadge: {
      position:
        'absolute',

      top:
        -6,

      right:
        -6,

      minWidth:
        19,

      height:
        19,

      paddingHorizontal:
        4,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#A00B0F',

      borderRadius:
        10,

      borderWidth:
        2,

      borderColor:
        '#FAF8FD',
    },

    cartCountText: {
      color:
        '#FFFFFF',

      fontSize:
        7.5,

      lineHeight:
        10,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    /* =====================================================
     * Heading
     * ===================================================== */

    heading: {
      flexDirection:
        'row',

      alignItems:
        'flex-end',

      justifyContent:
        'space-between',

      marginTop:
        15,

      marginBottom:
        12,
    },

    eyebrow: {
      color:
        '#A00B0F',

      fontSize:
        9,

      fontWeight:
        '900',

      letterSpacing:
        0.7,
    },

    headingText: {
      color:
        '#1B1720',

      fontSize:
        18,

      fontWeight:
        '900',

      marginTop:
        3,
    },

    mealCountBadge: {
      backgroundColor:
        '#F3EAEF',

      borderRadius:
        20,

      paddingHorizontal:
        9,

      paddingVertical:
        5,
    },

    mealCountText: {
      color:
        '#A00B0F',

      fontSize:
        8,

      fontWeight:
        '800',
    },

    /* =====================================================
     * Tiffin Card
     * ===================================================== */

    card: {
      width:
        '100%',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        17,

      borderWidth:
        1,

      borderColor:
        '#ECE7EF',

      overflow:
        'hidden',

      marginBottom:
        15,

      elevation:
        3,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          4,
      },

      shadowOpacity:
        0.06,

      shadowRadius:
        8,
    },

    tabletCard: {
      width:
        '48.5%',
    },

    pressedCard: {
      opacity:
        0.92,

      transform: [
        {
          scale:
            0.995,
        },
      ],
    },

    column: {
      justifyContent:
        'space-between',
    },

    /* =====================================================
     * Tiffin Image
     * ===================================================== */

    imageContainer: {
      height:
        190,
    },

    image: {
      width:
        '100%',

      height:
        '100%',
    },

    noImage: {
      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#EEE9F0',
    },

    noImageIcon: {
      width:
        30,

      height:
        30,

      opacity:
        0.4,
    },

    noImageText: {
      color:
        '#8B828D',

      fontSize:
        10,

      fontWeight:
        '600',

      marginTop:
        7,
    },

    /* =====================================================
     * Food Type
     * ===================================================== */

    foodBadge: {
      position:
        'absolute',

      top:
        10,

      left:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      paddingHorizontal:
        9,

      paddingVertical:
        5,

      borderRadius:
        20,

      borderWidth:
        1,

      borderColor:
        '#D6EBD9',
    },

    foodDot: {
      width:
        6,

      height:
        6,

      borderRadius:
        3,

      backgroundColor:
        '#2F8B45',

      marginRight:
        5,
    },

    foodBadgeText: {
      color:
        '#2F8B45',

      fontSize:
        8,

      fontWeight:
        '900',
    },

    nonVegBadge: {
      borderColor:
        '#F0CEC8',
    },

    nonVegDot: {
      backgroundColor:
        '#D65343',
    },

    nonVegText: {
      color:
        '#D65343',
    },

    /* =====================================================
     * Sold Out
     * ===================================================== */

    soldOutOverlay: {
      ...StyleSheet.absoluteFillObject,

      backgroundColor:
        'rgba(0,0,0,.35)',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    soldOutBadge: {
      backgroundColor:
        '#FFFFFF',

      paddingHorizontal:
        15,

      paddingVertical:
        7,

      borderRadius:
        20,
    },

    soldOutText: {
      color:
        '#555',

      fontSize:
        10,

      fontWeight:
        '900',
    },

    /* =====================================================
     * Tiffin Content
     * ===================================================== */

    cardContent: {
      padding:
        14,
    },

    titleRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'flex-start',
    },

    name: {
      flex:
        1,

      color:
        '#17121E',

      fontSize:
        15,

      fontWeight:
        '900',

      lineHeight:
        20,

      paddingRight:
        10,
    },

    price: {
      color:
        '#A00B0F',

      fontSize:
        14,

      fontWeight:
        '900',
    },

    description: {
      color:
        '#6F6773',

      fontSize:
        10,

      lineHeight:
        15,

      marginTop:
        7,
    },

    /* =====================================================
     * Metadata
     * ===================================================== */

    metaRow: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      marginTop:
        10,
    },

    meta: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#F9E8E9',

      paddingHorizontal:
        8,

      paddingVertical:
        5,

      borderRadius:
        20,

      marginRight:
        6,

      marginBottom:
        4,
    },

    metaIcon: {
      width:
        11,

      height:
        11,

      tintColor:
        '#A00B0F',

      marginRight:
        4,
    },

    metaText: {
      color:
        '#A00B0F',

      fontSize:
        8,

      fontWeight:
        '700',
    },

    /* =====================================================
     * Add To Cart
     * ===================================================== */

    addCartButton: {
      width:
        '100%',

      minHeight:
        43,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#A00B0F',

      borderRadius:
        11,

      marginTop:
        13,
    },

    addCartButtonDisabled: {
      opacity:
        0.5,
    },

    addCartIcon: {
      width:
        17,

      height:
        17,

      tintColor:
        '#A00B0F',

      marginRight:
        7,
    },

    addCartText: {
      color:
        '#A00B0F',

      fontSize:
        10,

      fontWeight:
        '900',

      letterSpacing:
        0.3,
    },

    tapText: {
      textAlign:
        'center',

      color:
        '#9C939F',

      fontSize:
        8,

      fontWeight:
        '700',

      marginTop:
        9,
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

      paddingHorizontal:
        30,
    },

    loadingTitle: {
      color:
        '#211A25',

      fontSize:
        16,

      fontWeight:
        '900',

      marginTop:
        15,
    },

    loadingText: {
      color:
        '#887E8A',

      fontSize:
        10,

      marginTop:
        5,
    },

    /* =====================================================
     * Empty
     * ===================================================== */

    emptyContainer: {
      minHeight:
        350,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        25,
    },

    emptyIcon: {
      width:
        44,

      height:
        44,

      opacity:
        0.35,
    },

    emptyTitle: {
      color:
        '#211A25',

      fontSize:
        16,

      fontWeight:
        '900',

      textAlign:
        'center',

      marginTop:
        13,
    },

    emptyDescription: {
      color:
        '#887E8A',

      fontSize:
        10,

      lineHeight:
        16,

      textAlign:
        'center',

      marginTop:
        6,
    },

    /* =====================================================
     * Cart Popup
     * ===================================================== */

    cartPopupOverlay: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(24, 17, 20, 0.62)',

      paddingHorizontal:
        22,
    },

    cartPopupCard: {
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
        20,

      paddingTop:
        28,

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
        0.25,

      shadowRadius:
        20,

      elevation:
        16,
    },

    cartPopupIconOuter: {
      width:
        84,

      height:
        84,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#EEF8F1',

      borderRadius:
        42,

      marginBottom:
        15,
    },

    cartPopupIconInner: {
      width:
        58,

      height:
        58,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#2E9C55',

      borderRadius:
        29,

      shadowColor:
        '#2E9C55',

      shadowOffset: {
        width:
          0,

        height:
          4,
      },

      shadowOpacity:
        0.25,

      shadowRadius:
        7,

      elevation:
        5,
    },

    cartPopupCheck: {
      color:
        '#FFFFFF',

      fontSize:
        30,

      lineHeight:
        34,

      fontWeight:
        '900',
    },

    cartPopupTitle: {
      color:
        '#21191D',

      fontSize:
        20,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    cartPopupDescription: {
      maxWidth:
        290,

      color:
        '#7A7075',

      fontSize:
        10,

      lineHeight:
        16,

      textAlign:
        'center',

      marginTop:
        7,
    },

    cartPopupProduct: {
      width:
        '100%',

      minHeight:
        82,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FAF7F8',

      borderWidth:
        1,

      borderColor:
        '#EEE6E9',

      borderRadius:
        14,

      padding:
        8,

      marginTop:
        18,
    },

    cartPopupProductImage: {
      width:
        64,

      height:
        64,

      borderRadius:
        10,

      backgroundColor:
        '#ECE7EA',
    },

    cartPopupNoImage: {
      alignItems:
        'center',

      justifyContent:
        'center',
    },

    cartPopupNoImageIcon: {
      width:
        25,

      height:
        25,

      opacity:
        0.4,
    },

    cartPopupProductDetails: {
      flex:
        1,

      paddingHorizontal:
        11,
    },

    cartPopupItemName: {
      color:
        '#241B20',

      fontSize:
        11,

      lineHeight:
        16,

      fontWeight:
        '900',
    },

    cartPopupCategory: {
      color:
        '#8C8086',

      fontSize:
        8,

      marginTop:
        2,
    },

    cartPopupPrice: {
      color:
        '#A00B0F',

      fontSize:
        12,

      fontWeight:
        '900',

      marginTop:
        5,
    },

    cartPopupAddedBadge: {
      backgroundColor:
        '#EAF7EE',

      borderRadius:
        20,

      paddingHorizontal:
        8,

      paddingVertical:
        4,

      marginRight:
        3,
    },

    cartPopupAddedText: {
      color:
        '#2E8C4B',

      fontSize:
        7,

      fontWeight:
        '900',
    },

    cartPopupButtons: {
      width:
        '100%',

      flexDirection:
        'row',

      alignItems:
        'center',

      marginTop:
        20,
    },

    continueShoppingButton: {
      flex:
        1,

      minHeight:
        48,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF7F5',

      borderWidth:
        1,

      borderColor:
        '#E6D8D5',

      borderRadius:
        12,

      marginRight:
        5,

      paddingHorizontal:
        6,
    },

    continueShoppingText: {
      color:
        '#74645F',

      fontSize:
        9,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    viewCartButton: {
      flex:
        1,

      minHeight:
        48,

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
        0.22,

      shadowRadius:
        7,

      elevation:
        4,
    },

    viewCartIcon: {
      width:
        16,

      height:
        16,

      tintColor:
        '#FFFFFF',

      marginRight:
        6,
    },

    viewCartText: {
      color:
        '#FFFFFF',

      fontSize:
        10,

      fontWeight:
        '900',
    },
  });