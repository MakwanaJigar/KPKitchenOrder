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

const BASE_URL =
  'https://replete-software.com/projects/kp_admin/public';

const PROFILE_API =
  'https://replete-software.com/projects/kp_admin/api/customer/profile';

const NOTIFICATION_API =
  'https://replete-software.com/projects/kp_admin/api/customer/notifications';

const CART_STORAGE_KEY =
  'kp_customer_cart';

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

  const [
    cartCount,
    setCartCount,
  ] = useState(0);

  const [
    unreadNotificationCount,
    setUnreadNotificationCount,
  ] = useState(0);

  const [
    addingItemId,
    setAddingItemId,
  ] = useState(null);

  const [
    cartPopupVisible,
    setCartPopupVisible,
  ] = useState(false);

  const [
    addedTiffin,
    setAddedTiffin,
  ] = useState(null);

  const [
    userLocation,
    setUserLocation,
  ] = useState(
    'Set delivery location',
  );

  const layout =
    useMemo(
      () => {
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
      },
      [width],
    );

  useEffect(
    () => {
      dispatch(
        getTiffins(),
      );
    },
    [dispatch],
  );

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
        value.includes(
          '/uploads/',
        )
      ) {
        const uploadIndex =
          value.indexOf(
            '/uploads/',
          );

        const uploadPath =
          value.substring(
            uploadIndex,
          );

        return `${BASE_URL}${uploadPath}`;
      }

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

  /* =====================================================
   * NORMALIZE ADDON
   * ===================================================== */

  const normalizeAddon = (
    addon,
    groupName,
    addonIndex,
  ) => {
    if (!addon) {
      return null;
    }

    const addonId =
      addon?.id ??
      addon?.adon_id ??
      addon?.addon_id ??
      addon?.addonId ??
      null;

    const parsedPrice =
      Number(
        addon?.price ??
          addon?.unit_price ??
          0,
      );

    const addonPrice =
      Number.isFinite(
        parsedPrice,
      )
        ? parsedPrice
        : 0;

    const status =
      String(
        addon?.status ??
          'Active',
      )
        .trim()
        .toLowerCase();

    return {
      ...addon,

      id:
        addonId ??
        `addon-${groupName}-${addonIndex}`,

      adon_id:
        addonId,

      addon_id:
        addonId,

      addonId:
        addonId,

      name:
        addon?.name ??
        addon?.title ??
        `Add-on ${addonIndex + 1}`,

      rawPrice:
        addonPrice,

      price:
        addonPrice,

      group:
        groupName,

      groupName:
        groupName,

      addonGroup:
        groupName,

      categoryName:
        addon?.category?.name ??
        groupName,

      image:
        getImageUrl(
          addon?.image,
        ),

      status:
        addon?.status ??
        '',

      available:
        status ===
          'active' ||
        status ===
          'available' ||
        status ===
          '1' ||
        status ===
          'true',
    };
  };

  /* =====================================================
   * NORMALIZE API ADDONS
   *
   * API:
   *
   * adons: {
   *   salad: [],
   *   beverages: [],
   *   ...
   * }
   * ===================================================== */

  const normalizeAddonData =
    item => {
      const rawAdons =
        item?.adons ??
        item?.addons ??
        item?.add_ons ??
        {};

      const addonGroups =
        {};

      const addonList =
        [];

      if (
        rawAdons &&
        typeof rawAdons ===
          'object' &&
        !Array.isArray(
          rawAdons,
        )
      ) {
        Object.entries(
          rawAdons,
        ).forEach(
          ([
            groupName,
            values,
          ]) => {
            if (
              !Array.isArray(
                values,
              )
            ) {
              return;
            }

            const normalizedGroup =
              values
                .map(
                  (
                    addon,
                    addonIndex,
                  ) =>
                    normalizeAddon(
                      addon,
                      groupName,
                      addonIndex,
                    ),
                )
                .filter(
                  Boolean,
                );

            addonGroups[
              groupName
            ] =
              normalizedGroup;

            addonList.push(
              ...normalizedGroup,
            );
          },
        );
      }

      if (
        Array.isArray(
          rawAdons,
        )
      ) {
        rawAdons.forEach(
          (
            addon,
            addonIndex,
          ) => {
            const groupName =
              addon?.category?.name ??
              addon?.group ??
              'Add-ons';

            const normalizedAddon =
              normalizeAddon(
                addon,
                groupName,
                addonIndex,
              );

            if (
              !normalizedAddon
            ) {
              return;
            }

            if (
              !addonGroups[
                groupName
              ]
            ) {
              addonGroups[
                groupName
              ] = [];
            }

            addonGroups[
              groupName
            ].push(
              normalizedAddon,
            );

            addonList.push(
              normalizedAddon,
            );
          },
        );
      }

      return {
        addonGroups,
        addonList,
      };
    };

  /* =====================================================
   * NORMALIZED TIFFINS
   * ===================================================== */

  const meals =
    useMemo(
      () => {
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
            const rawPrice =
              Number(
                item?.price ??
                  item?.tiffin_price ??
                  0,
              );

            const image =
              getImageUrl(
                item?.image_url ??
                  item?.image ??
                  item?.tiffin_image,
              );

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
            }

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

            const categoryText =
              String(
                category,
              )
                .trim()
                .toLowerCase();

            let foodType =
              '';

            if (
              item?.food_type ||
              item?.foodType
            ) {
              foodType =
                String(
                  item?.food_type ??
                    item?.foodType,
                )
                  .trim()
                  .toUpperCase();
            } else if (
              categoryText.includes(
                'non-vegetarian',
              ) ||
              categoryText.includes(
                'non vegetarian',
              ) ||
              categoryText.includes(
                'non-veg',
              )
            ) {
              foodType =
                'NON-VEGETARIAN';
            } else if (
              categoryText.includes(
                'vegetarian',
              ) ||
              categoryText ===
                'veg'
            ) {
              foodType =
                'VEGETARIAN';
            } else {
              foodType =
                String(
                  category,
                ).toUpperCase();
            }

            const tiffinItems =
              Array.isArray(
                item?.items,
              )
                ? item.items.filter(
                    value =>
                      value !== null &&
                      value !== undefined,
                  )
                : [];

            const {
              addonGroups,
              addonList,
            } =
              normalizeAddonData(
                item,
              );

            let preparationTime =
              item?.prep_time ??
              item?.preparation_time ??
              item?.preparationTime ??
              '';

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

            console.log(
              'TIFFIN:',
              item?.name,
            );

            console.log(
              'ADDON GROUPS:',
              Object.keys(
                addonGroups,
              ),
            );

            console.log(
              'TOTAL ADDONS:',
              addonList.length,
            );

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

              rawPrice:
                Number.isFinite(
                  rawPrice,
                )
                  ? rawPrice
                  : 0,

              price:
                `$${Number.isFinite(
                  rawPrice,
                )
                  ? rawPrice.toFixed(
                      2,
                    )
                  : '0.00'}`,

              image,

              description:
                item?.description ??
                item?.tiffin_description ??
                '',

              category,

              foodType,

              items:
                tiffinItems,

              /*
               * Available addon catalogue.
               */

              adons:
                addonGroups,

              addons:
                addonGroups,

              addonGroups,

              addonList,

              allAddons:
                addonList,

              flattenedAddons:
                addonList,

              available_add_ons:
                addonGroups,

              preparationTime,

              available,

              status:
                item?.status ??
                '',
            };
          },
        );
      },
      [tiffins],
    );

  /* =====================================================
   * CART
   * ===================================================== */

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
      } catch (error) {
        console.log(
          'GET CART ERROR:',
          error,
        );

        return [];
      }
    };

  const updateCartCount =
    async () => {
      const cart =
        await getStoredCart();

      const count =
        cart.reduce(
          (
            total,
            item,
          ) =>
            total +
            Number(
              item?.quantity ??
                1,
            ),
          0,
        );

      setCartCount(
        count,
      );
    };

  /* =====================================================
   * NOTIFICATION HELPERS
   * ===================================================== */

  const getNotificationArray =
    result => {
      if (
        Array.isArray(
          result,
        )
      ) {
        return result;
      }

      if (
        Array.isArray(
          result?.data,
        )
      ) {
        return result.data;
      }

      if (
        Array.isArray(
          result?.notifications,
        )
      ) {
        return result.notifications;
      }

      if (
        Array.isArray(
          result?.data?.notifications,
        )
      ) {
        return result.data.notifications;
      }

      if (
        Array.isArray(
          result?.data?.data,
        )
      ) {
        return result.data.data;
      }

      if (
        Array.isArray(
          result?.notifications?.data,
        )
      ) {
        return result.notifications.data;
      }

      return null;
    };

  const isNotificationRead =
    notification => {
      const readAt =
        notification?.read_at ??
        notification?.readAt ??
        null;

      if (readAt) {
        return true;
      }

      const value =
        notification?.is_read ??
        notification?.isRead ??
        null;

      return (
        value === true ||
        value === 1 ||
        value === '1' ||
        String(
          value ?? '',
        ).toLowerCase() ===
          'true'
      );
    };

  /* =====================================================
   * FIX NOTIFICATION BELL
   * ===================================================== */

  const fetchUnreadNotificationCount =
    async () => {
      try {
        const token =
          await AsyncStorage.getItem(
            'token',
          );

        if (!token) {
          setUnreadNotificationCount(
            0,
          );

          return;
        }

        const response =
          await fetch(
            `${NOTIFICATION_API}?_=${Date.now()}`,
            {
              headers: {
                Accept:
                  'application/json',

                Authorization:
                  `Bearer ${token}`,

                'Cache-Control':
                  'no-cache',
              },
            },
          );

        const text =
          await response.text();

        const result =
          text
            ? JSON.parse(
                text,
              )
            : {};

        if (
          !response.ok
        ) {
          setUnreadNotificationCount(
            0,
          );

          return;
        }

        const notifications =
          getNotificationArray(
            result,
          );

        /*
         * IMPORTANT:
         *
         * Calculate from notification rows first.
         * Do not blindly trust stale unread_count.
         */

        if (
          Array.isArray(
            notifications,
          )
        ) {
          const unreadCount =
            notifications.filter(
              item =>
                !isNotificationRead(
                  item,
                ),
            ).length;

          setUnreadNotificationCount(
            unreadCount,
          );

          return;
        }

        const count =
          Number(
            result?.unread_count ??
            result?.data?.unread_count ??
            0,
          );

        setUnreadNotificationCount(
          Number.isFinite(
            count,
          )
            ? count
            : 0,
        );
      } catch (error) {
        console.log(
          'NOTIFICATION COUNT ERROR:',
          error,
        );

        setUnreadNotificationCount(
          0,
        );
      }
    };

  /* =====================================================
   * PROFILE
   * ===================================================== */

  const fetchLocation =
    async () => {
      try {
        const token =
          await AsyncStorage.getItem(
            'token',
          );

        if (!token) {
          setUserLocation(
            'Set delivery location',
          );

          return;
        }

        const response =
          await fetch(
            PROFILE_API,
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

        const result =
          text
            ? JSON.parse(
                text,
              )
            : {};

        if (!response.ok) {
          return;
        }

        const profile =
          result?.data?.customer ??
          result?.data ??
          result;

        let location =
          profile?.delivery_address ??
          profile?.delivery_location ??
          '';

        if (
          !location &&
          Array.isArray(
            profile?.addresses,
          )
        ) {
          const defaultAddress =
            profile.addresses.find(
              item =>
                item?.is_default ===
                  true ||
                item?.is_default ===
                  1,
            ) ??
            profile.addresses[0];

          location =
            defaultAddress?.address_line ??
            defaultAddress?.address ??
            '';
        }

        setUserLocation(
          location ||
            'Set delivery location',
        );
      } catch (error) {
        console.log(
          'PROFILE ERROR:',
          error,
        );
      }
    };

  /* =====================================================
   * FOCUS
   * ===================================================== */

  useFocusEffect(
    useCallback(
      () => {
        updateCartCount();

        fetchLocation();

        /*
         * Immediately remove stale bell badge.
         */

        setUnreadNotificationCount(
          0,
        );

        fetchUnreadNotificationCount();
      },
      [],
    ),
  );

  /* =====================================================
   * CUSTOMIZE TIFFIN
   * ===================================================== */

  const handleTiffinPress =
    meal => {
      if (!meal.available) {
        return;
      }

      navigation.navigate(
        'CustomizeTiffin',
        {
          tiffin:
            meal,

          mode:
            'customize',

          adons:
            meal?.addonGroups ??
            {},

          addons:
            meal?.addonGroups ??
            {},

          addonGroups:
            meal?.addonGroups ??
            {},

          addonList:
            meal?.addonList ??
            [],

          allAddons:
            meal?.addonList ??
            [],

          available_add_ons:
            meal?.addonGroups ??
            {},
        },
      );
    };

  /* =====================================================
   * ADD NORMAL TIFFIN TO CART
   * ===================================================== */

  const handleAddToCart =
    async meal => {
      if (!meal.available) {
        return;
      }

      try {
        setAddingItemId(
          meal.id,
        );

        const cart =
          await getStoredCart();

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
              cartItem?.isCustomized !==
                true,
          );

        let updatedCart;

        if (
          existingIndex >= 0
        ) {
          updatedCart = [
            ...cart,
          ];

          updatedCart[
            existingIndex
          ] = {
            ...updatedCart[
              existingIndex
            ],

            quantity:
              Number(
                updatedCart[
                  existingIndex
                ]?.quantity ??
                  1,
              ) + 1,

            originalTiffin:
              meal,

            addonGroups:
              meal?.addonGroups ??
              {},

            addonList:
              meal?.addonList ??
              [],

            available_add_ons:
              meal?.addonGroups ??
              {},
          };
        } else {
          const price =
            Number(
              meal.rawPrice ??
                0,
            );

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

            items:
              meal.items,

            /*
             * Available add-ons.
             */

            addonGroups:
              meal?.addonGroups ??
              {},

            addonList:
              meal?.addonList ??
              [],

            allAddons:
              meal?.addonList ??
              [],

            available_add_ons:
              meal?.addonGroups ??
              {},

            /*
             * Selected add-ons.
             */

            add_ons:
              [],

            extras:
              [],

            selectedExtras:
              [],

            selectedAddons:
              [],

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

            selections:
              [],

            customizations:
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

        await AsyncStorage.setItem(
          CART_STORAGE_KEY,

          JSON.stringify(
            updatedCart,
          ),
        );

        await updateCartCount();

        setAddedTiffin(
          meal,
        );

        setCartPopupVisible(
          true,
        );
      } catch (error) {
        Alert.alert(
          'Unable to Add',
          'Unable to add this tiffin.',
        );
      } finally {
        setAddingItemId(
          null,
        );
      }
    };

  const closeCartPopup =
    () => {
      setCartPopupVisible(
        false,
      );

      setAddedTiffin(
        null,
      );
    };

  const renderMeal = ({
    item,
  }) => {
    const isAdding =
      addingItemId ===
      item.id;

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
        style={
          styles.card
        }
      >
        <View
          style={
            styles.imageContainer
          }
        >
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
              ]}
            >
              <Image
                source={require('../assets/login-icons/spoon-and-fork-crossed.png')}
                style={
                  styles.noImageIcon
                }
                resizeMode="contain"
              />
            </View>
          )}
        </View>

        <View
          style={
            styles.cardContent
          }
        >
          <View
            style={
              styles.titleRow
            }
          >
            <Text
              style={
                styles.name
              }
              numberOfLines={
                2
              }
            >
              {item.name}
            </Text>

            <Text
              style={
                styles.price
              }
            >
              {item.price}
            </Text>
          </View>

          {!!item.description && (
            <Text
              style={
                styles.description
              }
              numberOfLines={
                3
              }
            >
              {
                item.description
              }
            </Text>
          )}

          <TouchableOpacity
            disabled={
              isAdding
            }
            style={
              styles.addCartButton
            }
            onPress={() =>
              handleAddToCart(
                item,
              )
            }
          >
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
                />

                <Text
                  style={
                    styles.addCartText
                  }
                >
                  ADD TO CART
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text
            style={
              styles.tapText
            }
          >
            Tap card to customize
          </Text>
        </View>
      </Pressable>
    );
  };

  if (
    loading &&
    meals.length === 0
  ) {
    return (
      <SafeAreaView
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          size="large"
          color="#A00B0F"
        />
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
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
          ]}
        >
          <FlatList
            data={
              meals
            }
            renderItem={
              renderMeal
            }
            keyExtractor={
              item =>
                String(
                  item.id,
                )
            }
            showsVerticalScrollIndicator={
              false
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

                  setUnreadNotificationCount(
                    0,
                  );

                  fetchUnreadNotificationCount();

                  updateCartCount();
                }}
                tintColor="#A00B0F"
              />
            }
            ListHeaderComponent={
              <>
                <View
                  style={
                    styles.header
                  }
                >
                  <Pressable
                    style={
                      styles.locationArea
                    }
                  >
                    <Image
                      source={require('../assets/login-icons/location.png')}
                      style={
                        styles.locationIcon
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
                          styles.locationLabel
                        }
                      >
                        Delivering to
                      </Text>

                      <Text
                        numberOfLines={
                          1
                        }
                        style={
                          styles.location
                        }
                      >
                        {
                          userLocation
                        }
                      </Text>
                    </View>
                  </Pressable>

                  <View
                    style={
                      styles.actions
                    }
                  >
                    <Pressable
                      style={
                        styles.iconButton
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
                          styles.headerIcon
                        }
                      />

                      {unreadNotificationCount >
                        0 && (
                        <View
                          style={
                            styles.notificationCountBadge
                          }
                        >
                          <Text
                            style={
                              styles.notificationCountText
                            }
                          >
                            {unreadNotificationCount}
                          </Text>
                        </View>
                      )}
                    </Pressable>

                    <Pressable
                      style={
                        styles.iconButton
                      }
                      onPress={() =>
                        navigation.navigate(
                          'Order',
                        )
                      }
                    >
                      <Image
                        source={require('../assets/login-icons/add-cart.png')}
                        style={
                          styles.headerIcon
                        }
                      />

                      {cartCount >
                        0 && (
                        <View
                          style={
                            styles.cartCountBadge
                          }
                        >
                          <Text
                            style={
                              styles.cartCountText
                            }
                          >
                            {
                              cartCount
                            }
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  </View>
                </View>

                <View
                  style={
                    styles.heading
                  }
                >
                  <Text
                    style={
                      styles.headingText
                    }
                  >
                    Freshly prepared for you
                  </Text>
                </View>
              </>
            }
          />
        </View>
      </SafeAreaView>

      <Modal
        visible={
          cartPopupVisible
        }
        transparent
        animationType="fade"
        onRequestClose={
          closeCartPopup
        }
      >
        <Pressable
          style={
            styles.cartPopupOverlay
          }
          onPress={
            closeCartPopup
          }
        >
          <View
            style={
              styles.cartPopupCard
            }
          >
            <Text
              style={
                styles.cartPopupCheck
              }
            >
              ✓
            </Text>

            <Text
              style={
                styles.cartPopupTitle
              }
            >
              Added to Cart!
            </Text>

            {!!addedTiffin && (
              <Text
                style={
                  styles.cartPopupDescription
                }
              >
                {addedTiffin.name} has been added.
              </Text>
            )}

            <TouchableOpacity
              style={
                styles.viewCartButton
              }
              onPress={() => {
                closeCartPopup();

                navigation.navigate(
                  'Order',
                );
              }}
            >
              <Text
                style={
                  styles.viewCartText
                }
              >
                View Cart
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        '#FAF8FD',
    },

    page: {
      flex: 1,
      alignSelf:
        'center',
    },

    header: {
      minHeight: 65,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    locationArea: {
      flex: 1,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    locationIcon: {
      width: 20,
      height: 20,
      marginRight: 8,
    },

    locationLabel: {
      color:
        '#99909D',
      fontSize: 9,
    },

    location: {
      color:
        '#211A25',
      fontSize: 12,
      fontWeight:
        '800',
    },

    actions: {
      flexDirection:
        'row',
    },

    iconButton: {
      width: 38,
      height: 38,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#FFFFFF',
      borderRadius: 12,
      marginLeft: 8,
    },

    headerIcon: {
      width: 19,
      height: 19,
    },

    notificationCountBadge: {
      position:
        'absolute',
      top: -5,
      right: -5,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor:
        '#A00B0F',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    notificationCountText: {
      color:
        '#FFFFFF',
      fontSize: 7,
      fontWeight:
        '900',
    },

    cartCountBadge: {
      position:
        'absolute',
      top: -5,
      right: -5,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor:
        '#A00B0F',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    cartCountText: {
      color:
        '#FFFFFF',
      fontSize: 7,
      fontWeight:
        '900',
    },

    heading: {
      marginTop: 10,
      marginBottom: 15,
    },

    headingText: {
      color:
        '#211A25',
      fontSize: 21,
      fontWeight:
        '900',
    },

    card: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 18,
      overflow:
        'hidden',
      marginBottom: 16,
      borderWidth: 1,
      borderColor:
        '#EEE8F1',
    },

    imageContainer: {
      height: 180,
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
    },

    noImageIcon: {
      width: 45,
      height: 45,
    },

    cardContent: {
      padding: 14,
    },

    titleRow: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
    },

    name: {
      flex: 1,
      fontSize: 15,
      fontWeight:
        '900',
      color:
        '#251D27',
    },

    price: {
      fontSize: 14,
      fontWeight:
        '900',
      color:
        '#A00B0F',
    },

    description: {
      marginTop: 7,
      color:
        '#8D848A',
      fontSize: 9,
      lineHeight: 14,
    },

    addCartButton: {
      height: 44,
      marginTop: 13,
      borderRadius: 12,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#FFF4F4',
    },

    addCartIcon: {
      width: 18,
      height: 18,
      marginRight: 7,
    },

    addCartText: {
      color:
        '#A00B0F',
      fontSize: 9,
      fontWeight:
        '900',
    },

    tapText: {
      textAlign:
        'center',
      marginTop: 7,
      color:
        '#9A9097',
      fontSize: 7,
    },

    loadingContainer: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    cartPopupOverlay: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        'rgba(0,0,0,0.6)',
      padding: 20,
    },

    cartPopupCard: {
      width:
        '100%',
      maxWidth: 380,
      padding: 25,
      backgroundColor:
        '#FFFFFF',
      borderRadius: 20,
      alignItems:
        'center',
    },

    cartPopupCheck: {
      fontSize: 35,
      color:
        '#2F955B',
      fontWeight:
        '900',
    },

    cartPopupTitle: {
      fontSize: 18,
      fontWeight:
        '900',
      marginTop: 10,
    },

    cartPopupDescription: {
      marginTop: 8,
      color:
        '#777',
      textAlign:
        'center',
    },

    viewCartButton: {
      width:
        '100%',
      height: 48,
      backgroundColor:
        '#A00B0F',
      borderRadius: 12,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 20,
    },

    viewCartText: {
      color:
        '#FFFFFF',
      fontWeight:
        '900',
    },
  });

export default Home;