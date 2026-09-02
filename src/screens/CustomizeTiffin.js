import React, {
  useMemo,
  useRef,
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

import Ionicons from 'react-native-vector-icons/Ionicons';

import AsyncStorage from '@react-native-async-storage/async-storage';

/* =========================================================
 * CONFIG
 * ========================================================= */

const BASE_URL =
  'https://replete-software.com/projects/kp_admin/public';

const CART_STORAGE_KEY =
  'kp_customer_cart';

const FREE_SHIPPING_MINIMUM =
  11;

const SHIPPING_CHARGE =
  2;

/* =========================================================
 * HELPERS
 * ========================================================= */

const normalizeMoney = value => {
  const number =
    Number(
      String(
        value ?? 0,
      ).replace(
        '$',
        '',
      ),
    );

  return Number.isFinite(
    number,
  )
    ? number
    : 0;
};

/* =========================================================
 * NORMALIZE INCLUDED ITEM
 * ========================================================= */

const normalizeIncludedItem = (
  item,
  index,
) => {
  if (
    typeof item ===
    'string'
  ) {
    return {
      id:
        `included-${index}`,

      name:
        item,

      price:
        0,
    };
  }

  if (
    item &&
    typeof item ===
      'object'
  ) {
    return {
      ...item,

      id:
        item?.id ??
        item?.item_id ??
        `included-${index}`,

      name:
        item?.name ??
        item?.item_name ??
        item?.title ??
        item?.food_name ??
        `Item ${index + 1}`,

      price:
        normalizeMoney(
          item?.price ??
          item?.pivot?.price ??
          0,
        ),
    };
  }

  return null;
};

/* =========================================================
 * NORMALIZE ADD-ON
 * ========================================================= */

const normalizeAddon = (
  addon,
  index,
  groupName = 'Add-ons',
) => {
  if (
    !addon
  ) {
    return null;
  }

  if (
    typeof addon ===
    'string'
  ) {
    return {
      id:
        `addon-${index}`,

      adon_id:
        null,

      addon_id:
        null,

      addonId:
        null,

      name:
        addon,

      price:
        0,

      addonGroup:
        groupName,

      group:
        groupName,

      groupName,
    };
  }

  if (
    typeof addon !==
    'object'
  ) {
    return null;
  }

  const nested =
    addon?.addon ??
    addon?.adon ??
    addon?.item ??
    addon?.extra ??
    {};

  const rawId =
    addon?.id ??
    addon?.adon_id ??
    addon?.addon_id ??
    addon?.addonId ??
    nested?.id ??
    null;

  const numericId =
    Number(
      rawId,
    );

  const addonId =
    rawId === null ||
    rawId === undefined
      ? null
      : Number.isFinite(
            numericId,
          )
        ? numericId
        : rawId;

  const price =
    normalizeMoney(
      addon?.price ??
      addon?.unit_price ??
      addon?.unitPrice ??
      addon?.additional_price ??
      addon?.extra_price ??
      addon?.pivot?.price ??
      nested?.price ??
      0,
    );

  const resolvedGroup =
    addon?.addonGroup ??
    addon?.group ??
    addon?.groupName ??
    addon?.category?.name ??
    groupName ??
    'Add-ons';

  return {
    ...addon,

    id:
      addonId ??
      `addon-${index}`,

    adon_id:
      addonId,

    addon_id:
      addonId,

    addonId:
      addonId,

    name:
      addon?.name ??
      addon?.adon_name ??
      addon?.addon_name ??
      addon?.title ??
      nested?.name ??
      nested?.title ??
      `Add-on ${index + 1}`,

    price,

    rawPrice:
      price,

    addonGroup:
      resolvedGroup,

    group:
      resolvedGroup,

    groupName:
      resolvedGroup,
  };
};

/* =========================================================
 * COMPONENT
 * ========================================================= */

const CustomizeTiffin = ({
  navigation,
  route,
}) => {
  const {
    width,
  } =
    useWindowDimensions();

  /* =======================================================
   * TIFFIN / EDIT MODE
   * ======================================================= */

  const tiffin =
    route?.params?.tiffin ??
    {};

  const mode =
    route?.params?.mode ??
    'customize';

  const isEditMode =
    mode ===
    'edit';

  const editingCartId =
    route?.params?.cartId ??
    route?.params?.cartItem?.cartId ??
    null;

  const existingCartItem =
    route?.params?.cartItem ??
    null;

  const existingQuantity =
    Math.max(
      1,

      Number(
        route?.params?.quantity ??
        existingCartItem?.quantity ??
        1,
      ) || 1,
    );

  /* =======================================================
   * EXISTING SELECTED ADD-ONS
   * ======================================================= */

  const existingExtras =
    Array.isArray(
      route?.params?.extras,
    )
      ? route.params.extras
      : Array.isArray(
            existingCartItem?.add_ons,
          )
        ? existingCartItem.add_ons
        : Array.isArray(
              existingCartItem?.extras,
            )
          ? existingCartItem.extras
          : Array.isArray(
                existingCartItem?.selectedExtras,
              )
            ? existingCartItem.selectedExtras
            : Array.isArray(
                  existingCartItem?.selectedAddons,
                )
              ? existingCartItem.selectedAddons
              : Array.isArray(
                    existingCartItem?.addons,
                  )
                ? existingCartItem.addons
                : Array.isArray(
                      existingCartItem?.adons,
                    )
                  ? existingCartItem.adons
                  : [];

  /* =======================================================
   * BASIC TIFFIN DETAILS
   * ======================================================= */

  const tiffinId =
    tiffin?.id ??
    tiffin?.tiffin_id ??
    null;

  const tiffinName =
    tiffin?.name ??
    tiffin?.tiffin_name ??
    'Tiffin';

  const description =
    tiffin?.description ??
    tiffin?.tiffin_description ??
    '';

  const basePrice =
    normalizeMoney(
      tiffin?.rawPrice ??
      tiffin?.price ??
      tiffin?.tiffin_price ??
      0,
    );

  const status =
    tiffin?.status ??
    '';

  /* =======================================================
   * CATEGORY
   * ======================================================= */

  const category =
    useMemo(
      () => {
        if (
          tiffin?.category &&
          typeof tiffin.category ===
            'object'
        ) {
          return (
            tiffin.category?.name ??
            tiffin.category?.title ??
            ''
          );
        }

        return (
          tiffin?.category ??
          tiffin?.category_name ??
          ''
        );
      },
      [
        tiffin,
      ],
    );

  /* =======================================================
   * FOOD TYPE
   * ======================================================= */

  const foodType =
    useMemo(
      () => {
        if (
          tiffin?.foodType ||
          tiffin?.food_type
        ) {
          return String(
            tiffin?.foodType ??
            tiffin?.food_type,
          ).toUpperCase();
        }

        const value =
          String(
            category ??
            '',
          )
            .trim()
            .toLowerCase();

        if (
          value.includes(
            'non-vegetarian',
          ) ||
          value.includes(
            'non vegetarian',
          ) ||
          value.includes(
            'non-veg',
          ) ||
          value.includes(
            'non veg',
          )
        ) {
          return 'NON-VEGETARIAN';
        }

        if (
          value.includes(
            'vegetarian',
          ) ||
          value ===
            'veg'
        ) {
          return 'VEGETARIAN';
        }

        return '';
      },
      [
        tiffin,
        category,
      ],
    );

  /* =======================================================
   * PREPARATION TIME
   * ======================================================= */

  const preparationTime =
    useMemo(
      () => {
        const value =
          tiffin?.preparationTime ??
          tiffin?.prep_time ??
          tiffin?.preparation_time ??
          '';

        if (
          !value
        ) {
          return '';
        }

        if (
          String(
            value,
          )
            .toLowerCase()
            .includes(
              'min',
            )
        ) {
          return String(
            value,
          );
        }

        return `${value} min`;
      },
      [
        tiffin,
      ],
    );

  /* =======================================================
   * IMAGE
   * ======================================================= */

  const getImageUrl =
    value => {
      if (
        !value
      ) {
        return null;
      }

      const imageValue =
        String(
          value,
        ).trim();

      if (
        imageValue.includes(
          '/uploads/',
        )
      ) {
        const index =
          imageValue.indexOf(
            '/uploads/',
          );

        const path =
          imageValue.substring(
            index,
          );

        return `${BASE_URL}${path}`;
      }

      if (
        imageValue.startsWith(
          'http://',
        ) ||
        imageValue.startsWith(
          'https://',
        )
      ) {
        return imageValue;
      }

      if (
        imageValue.startsWith(
          '/',
        )
      ) {
        return `${BASE_URL}${imageValue}`;
      }

      return `${BASE_URL}/${imageValue}`;
    };

  const image =
    getImageUrl(
      tiffin?.image ??
      tiffin?.image_url ??
      tiffin?.tiffin_image,
    );

  /* =======================================================
   * INCLUDED ITEMS
   * ======================================================= */

  const includedItems =
    useMemo(
      () => {
        const possibleItems =
          tiffin?.items ??
          tiffin?.included_items ??
          tiffin?.includedItems ??
          tiffin?.tiffin_items ??
          tiffin?.tiffinItems ??
          tiffin?.menu_items ??
          [];

        if (
          !Array.isArray(
            possibleItems,
          )
        ) {
          return [];
        }

        return possibleItems
          .map(
            (
              item,
              index,
            ) =>
              normalizeIncludedItem(
                item,
                index,
              ),
          )
          .filter(
            Boolean,
          );
      },
      [
        tiffin,
      ],
    );

  /* =======================================================
   * API ADD-ONS ONLY
   *
   * NO:
   * Bread customization
   * Dal customization
   * Rice customization
   * Salad customization
   * Papad customization
   * Hard-coded fallback extras
   * ======================================================= */

  const addonItems =
    useMemo(
      () => {
        /*
         * Prefer the normalized flat addonList
         * coming from Home.js.
         */

        const backendAddons =
          route?.params?.addonList ??
          route?.params?.allAddons ??
          tiffin?.addonList ??
          tiffin?.allAddons ??
          tiffin?.flattenedAddons ??
          route?.params?.available_add_ons ??
          route?.params?.addonGroups ??
          route?.params?.adons ??
          route?.params?.addons ??
          tiffin?.available_add_ons ??
          tiffin?.addonGroups ??
          tiffin?.adons ??
          tiffin?.addons ??
          tiffin?.add_ons ??
          [];

        let flattened =
          [];

        /* =============================================
         * API ALREADY FLAT
         * ============================================= */

        if (
          Array.isArray(
            backendAddons,
          )
        ) {
          flattened =
            backendAddons;
        }

        /* =============================================
         * GROUPED API OBJECT
         *
         * {
         *   salad: [...],
         *   breads: [...],
         *   beverages: [...]
         * }
         * ============================================= */

        else if (
          backendAddons &&
          typeof backendAddons ===
            'object'
        ) {
          flattened =
            Object.entries(
              backendAddons,
            ).flatMap(
              ([
                groupName,
                values,
              ]) => {
                if (
                  !Array.isArray(
                    values,
                  )
                ) {
                  return [];
                }

                return values.map(
                  item => ({
                    ...item,

                    addonGroup:
                      item?.addonGroup ??
                      groupName,

                    group:
                      item?.group ??
                      groupName,

                    groupName:
                      item?.groupName ??
                      groupName,
                  }),
                );
              },
            );
        }

        /* =============================================
         * NORMALIZE
         * ============================================= */

        const normalized =
          flattened
            .map(
              (
                addon,
                index,
              ) =>
                normalizeAddon(
                  addon,
                  index,
                  addon?.addonGroup ??
                  addon?.group ??
                  addon?.groupName ??
                  addon?.category?.name ??
                  'Add-ons',
                ),
            )
            .filter(
              Boolean,
            )
            .filter(
              addon => {
                const statusValue =
                  String(
                    addon?.status ??
                    'Active',
                  )
                    .trim()
                    .toLowerCase();

                return (
                  statusValue ===
                    '' ||
                  statusValue ===
                    'active' ||
                  statusValue ===
                    'available' ||
                  statusValue ===
                    '1' ||
                  statusValue ===
                    'true'
                );
              },
            );

        console.log(
          '==========================================',
        );

        console.log(
          'CUSTOMIZE TIFFIN API ADD-ONS:',
        );

        console.log(
          JSON.stringify(
            normalized,
            null,
            2,
          ),
        );

        console.log(
          'ADD-ON COUNT:',
          normalized.length,
        );

        console.log(
          '==========================================',
        );

        /*
         * IMPORTANT:
         *
         * Do NOT return fallback addons.
         *
         * If API gives no addons,
         * this returns [].
         */

        return normalized;
      },
      [
        tiffin,
        route?.params,
      ],
    );

  /* =======================================================
   * RESTORE SELECTED ADD-ONS IN EDIT MODE
   * ======================================================= */

  const initialExtras =
    useMemo(
      () => {
        const result =
          {};

        existingExtras.forEach(
          savedExtra => {
            const extraId =
              savedExtra?.id ??
              savedExtra?.adon_id ??
              savedExtra?.addon_id ??
              savedExtra?.extra_id ??
              null;

            if (
              extraId ===
                null ||
              extraId ===
                undefined
            ) {
              return;
            }

            result[
              String(
                extraId,
              )
            ] =
              Math.max(
                0,

                Number(
                  savedExtra?.quantity ??
                  savedExtra?.qty ??
                  1,
                ) || 0,
              );
          },
        );

        return result;
      },
      [
        existingExtras,
      ],
    );

  const [
    extras,
    setExtras,
  ] =
    useState(
      initialExtras,
    );

  const [
    adding,
    setAdding,
  ] =
    useState(false);

  /*
   * Prevent duplicate rapid taps.
   */

  const addLockRef =
    useRef(false);

  /* =======================================================
   * RESPONSIVE
   * ======================================================= */

  const responsive =
    useMemo(
      () => {
        const isTablet =
          width >= 768;

        return {
          width:
            isTablet
              ? Math.min(
                  width - 80,
                  720,
                )
              : width,

          padding:
            isTablet
              ? 28
              : 16,
        };
      },
      [
        width,
      ],
    );

  /* =======================================================
   * SELECTED ADD-ONS
   * ======================================================= */

  const selectedExtras =
    useMemo(
      () => {
        return addonItems
          .filter(
            item =>
              Number(
                extras[
                  item.id
                ] ??
                0,
              ) >
              0,
          )
          .map(
            item => {
              const quantity =
                Math.max(
                  1,

                  Number(
                    extras[
                      item.id
                    ] ??
                    1,
                  ) || 1,
                );

              const price =
                normalizeMoney(
                  item?.price,
                );

              const addonId =
                item?.id ??
                item?.adon_id ??
                item?.addon_id ??
                null;

              return {
                ...item,

                id:
                  addonId,

                adon_id:
                  addonId,

                addon_id:
                  addonId,

                addonId:
                  addonId,

                name:
                  item?.name ??
                  item?.title ??
                  'Add-on',

                price:
                  Number(
                    price.toFixed(
                      2,
                    ),
                  ),

                quantity,

                /*
                 * Backend response uses qty.
                 */

                qty:
                  quantity,

                lineTotal:
                  Number(
                    (
                      quantity *
                      price
                    ).toFixed(
                      2,
                    ),
                  ),
              };
            },
          );
      },
      [
        addonItems,
        extras,
      ],
    );

  /* =======================================================
   * EXACT BACKEND ADD_ON STRUCTURE
   *
   * [
   *   {
   *     id: 9,
   *     name: "Green Salad",
   *     price: 3,
   *     qty: 1
   *   }
   * ]
   * ======================================================= */

  const backendAddOns =
    useMemo(
      () => {
        return selectedExtras.map(
          addon => ({
            id:
              addon?.id ??
              addon?.adon_id ??
              addon?.addon_id,

            name:
              addon?.name ??
              'Add-on',

            price:
              Number(
                normalizeMoney(
                  addon?.price,
                ).toFixed(
                  2,
                ),
              ),

            qty:
              Math.max(
                1,

                Number(
                  addon?.quantity ??
                  addon?.qty ??
                  1,
                ) || 1,
              ),
          }),
        );
      },
      [
        selectedExtras,
      ],
    );

  /* =======================================================
   * ADD-ONS PRICE
   * ======================================================= */

  const extrasPrice =
    useMemo(
      () => {
        return selectedExtras.reduce(
          (
            totalValue,
            item,
          ) =>
            totalValue +
            normalizeMoney(
              item?.lineTotal,
            ),
          0,
        );
      },
      [
        selectedExtras,
      ],
    );

  /* =======================================================
   * TOTAL
   *
   * No customization price anymore.
   * ======================================================= */

  const subtotal =
    basePrice +
    extrasPrice;

  const shippingCharge =
    subtotal <
    FREE_SHIPPING_MINIMUM
      ? SHIPPING_CHARGE
      : 0;

  const total =
    subtotal +
    shippingCharge;

  /* =======================================================
   * CHANGE ADD-ON QUANTITY
   * ======================================================= */

  const changeExtra = (
    id,
    change,
  ) => {
    setExtras(
      current => {
        const existing =
          Number(
            current[
              id
            ] ??
            0,
          );

        return {
          ...current,

          [id]:
            Math.max(
              0,

              existing +
              change,
            ),
        };
      },
    );
  };

  /* =======================================================
   * ADD / UPDATE CART
   * ======================================================= */

  const handleAddToCart =
    async () => {
      if (
        !tiffinId
      ) {
        Alert.alert(
          'Unable to Add',

          'Tiffin information is missing.',
        );

        return;
      }

      if (
        adding ||
        addLockRef.current
      ) {
        return;
      }

      addLockRef.current =
        true;

      try {
        setAdding(
          true,
        );

        /* =============================================
         * EDIT = KEEP SAME CART ID
         * NEW = CREATE CART ID
         * ============================================= */

        const resolvedCartId =
          isEditMode &&
          editingCartId
            ? String(
                editingCartId,
              )
            : `${tiffinId}-${Date.now()}`;

        /* =============================================
         * BUILD CART ITEM
         * ============================================= */

        const cartItem = {
          /*
           * Keep any fields already stored.
           */

          ...existingCartItem,

          cartId:
            resolvedCartId,

          tiffinId,

          productId:
            tiffinId,

          id:
            tiffinId,

          name:
            tiffinName,

          description,

          image,

          category,

          foodType,

          status,

          preparationTime,

          currency:
            existingCartItem?.currency ??
            'USD',

          quantity:
            isEditMode
              ? existingQuantity
              : 1,

          /* =========================================
           * BASE TIFFIN ITEMS
           * ========================================= */

          items:
            includedItems,

          includedItems,

          /* =========================================
           * PRICES
           * ========================================= */

          basePrice,

          rawPrice:
            basePrice,

          /*
           * Customizations removed.
           */

          customizationPrice:
            0,

          extrasPrice,

          subtotal,

          shippingCharge,

          totalPrice:
            total,

          /* =========================================
           * NO CUSTOMIZATION SELECTIONS
           * ========================================= */

          selections:
            [],

          customizations:
            [],

          /* =========================================
           * SELECTED API ADD-ONS
           * ========================================= */

          extras:
            selectedExtras,

          selectedExtras:
            selectedExtras,

          selectedAddons:
            selectedExtras,

          addons:
            selectedExtras,

          adons:
            selectedExtras,

          /*
           * Exact Laravel-compatible structure.
           */

          add_ons:
            backendAddOns,

          isCustomized:
            true,

          /*
           * Keep the complete tiffin so the full
           * available addon catalogue remains available
           * when editing the cart item again.
           */

          originalTiffin:
            tiffin,

          addedAt:
            existingCartItem?.addedAt ??
            existingCartItem?.added_at ??
            new Date()
              .toISOString(),

          updatedAt:
            new Date()
              .toISOString(),
        };

        console.log(
          '=============================================',
        );

        console.log(
          'SELECTED ADD-ONS:',
          JSON.stringify(
            backendAddOns,
            null,
            2,
          ),
        );

        console.log(
          'CUSTOMIZED CART ITEM:',
          JSON.stringify(
            cartItem,
            null,
            2,
          ),
        );

        console.log(
          '=============================================',
        );

        /* =============================================
         * READ CURRENT CART
         * ============================================= */

        const stored =
          await AsyncStorage.getItem(
            CART_STORAGE_KEY,
          );

        let cart =
          [];

        if (
          stored
        ) {
          try {
            const parsed =
              JSON.parse(
                stored,
              );

            if (
              Array.isArray(
                parsed,
              )
            ) {
              cart =
                parsed;
            }
          } catch (
            parseError
          ) {
            console.log(
              'CART JSON ERROR:',
              parseError,
            );

            cart =
              [];
          }
        }

        let updatedCart =
          [];

        /* =============================================
         * EDIT EXISTING CART ITEM
         * ============================================= */

        if (
          isEditMode
        ) {
          let existingIndex =
            -1;

          /*
           * First use exact cartId.
           */

          if (
            editingCartId
          ) {
            existingIndex =
              cart.findIndex(
                item =>
                  String(
                    item?.cartId ??
                    '',
                  ) ===
                  String(
                    editingCartId,
                  ),
              );
          }

          /*
           * Old cart fallback.
           */

          if (
            existingIndex <
            0
          ) {
            existingIndex =
              cart.findIndex(
                item =>
                  String(
                    item?.tiffinId ??
                    item?.productId ??
                    item?.id ??
                    '',
                  ) ===
                  String(
                    tiffinId,
                  ),
              );
          }

          /* =========================================
           * REPLACE EXISTING ROW
           *
           * This prevents duplicate cart item.
           * ========================================= */

          if (
            existingIndex >=
            0
          ) {
            const originalRow =
              cart[
                existingIndex
              ];

            const replacement = {
              ...cartItem,

              cartId:
                originalRow?.cartId ??
                resolvedCartId,

              quantity:
                Math.max(
                  1,

                  Number(
                    route?.params?.quantity ??
                    originalRow?.quantity ??
                    existingQuantity,
                  ) || 1,
                ),
            };

            updatedCart =
              cart.map(
                (
                  item,
                  index,
                ) =>
                  index ===
                  existingIndex
                    ? replacement
                    : item,
              );

            console.log(
              'CART TIFFIN UPDATED - NO DUPLICATE',
            );
          } else {
            /*
             * Source row somehow disappeared.
             */

            updatedCart = [
              ...cart,

              cartItem,
            ];
          }
        } else {
          /* =========================================
           * NEW CUSTOMIZED TIFFIN
           * ========================================= */

          updatedCart = [
            ...cart,

            cartItem,
          ];
        }

        /* =============================================
         * SAVE
         * ============================================= */

        await AsyncStorage.setItem(
          CART_STORAGE_KEY,

          JSON.stringify(
            updatedCart,
          ),
        );

        navigation.navigate(
          'Order',
        );
      } catch (
        error
      ) {
        console.log(
          'ADD / UPDATE CART ERROR:',
          error,
        );

        Alert.alert(
          isEditMode
            ? 'Unable to Update'
            : 'Unable to Add',

          isEditMode
            ? 'Something went wrong while updating the tiffin.'
            : 'Something went wrong while adding the tiffin.',
        );
      } finally {
        addLockRef.current =
          false;

        setAdding(
          false,
        );
      }
    };

  /* =======================================================
   * VEG STATUS
   * ======================================================= */

  const isVegetarian =
    foodType ===
      'VEGETARIAN' ||
    foodType ===
      'VEG';

  /* =======================================================
   * UI
   * ======================================================= */

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={[
        'top',
        'left',
        'right',
      ]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFDFB"
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
        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <View
          style={[
            styles.header,

            {
              paddingHorizontal:
                responsive.padding,
            },
          ]}
        >
          <Pressable
            hitSlop={
              10
            }
            style={({
              pressed,
            }) => [
              styles.headerButton,

              pressed &&
                styles.headerButtonPressed,
            ]}
            onPress={() =>
              navigation.goBack()
            }
          >
            <Image
              source={require('../assets/login-icons/back.png')}
              style={
                styles.headerIcon
              }
              resizeMode="contain"
            />
          </Pressable>

          <View
            style={
              styles.headerTextContainer
            }
          >
            <Text
              style={
                styles.headerEyebrow
              }
            >
              {isEditMode
                ? 'EDIT YOUR MEAL'
                : 'BUILD YOUR MEAL'}
            </Text>

            <Text
              style={
                styles.headerTitle
              }
            >
              Add-ons
            </Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* SCROLL */}
        {/* ================================================= */}

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={{
            paddingBottom:
              130,
          }}
        >
          {/* ================================================= */}
          {/* IMAGE */}
          {/* ================================================= */}

          <View
            style={
              styles.hero
            }
          >
            {image ? (
              <Image
                source={{
                  uri:
                    image,
                }}
                style={
                  styles.heroImage
                }
                resizeMode="cover"
              />
            ) : (
              <Image
                source={require('../assets/tiffin-2.png')}
                style={
                  styles.heroImage
                }
                resizeMode="cover"
              />
            )}

            {!!foodType && (
              <View
                style={[
                  styles.foodTypeBadge,

                  !isVegetarian &&
                    styles.nonVegBadge,
                ]}
              >
                <View
                  style={[
                    styles.foodTypeDot,

                    !isVegetarian &&
                      styles.nonVegDot,
                  ]}
                />

                <Text
                  style={[
                    styles.foodTypeText,

                    !isVegetarian &&
                      styles.nonVegText,
                  ]}
                >
                  {foodType}
                </Text>
              </View>
            )}

            {!!status && (
              <View
                style={
                  styles.statusBadge
                }
              >
                <View
                  style={
                    styles.statusDot
                  }
                />

                <Text
                  style={
                    styles.statusText
                  }
                >
                  {String(
                    status,
                  ).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* ================================================= */}
          {/* BODY */}
          {/* ================================================= */}

          <View
            style={{
              paddingHorizontal:
                responsive.padding,

              paddingTop:
                18,
            }}
          >
            {/* ================================================= */}
            {/* TIFFIN INFO */}
            {/* ================================================= */}

            <View
              style={
                styles.tiffinInfoCard
              }
            >
              <View
                style={
                  styles.titleRow
                }
              >
                <View
                  style={
                    styles.titleArea
                  }
                >
                  <Text
                    style={
                      styles.title
                    }
                  >
                    {tiffinName}
                  </Text>

                  {!!description && (
                    <Text
                      style={
                        styles.description
                      }
                    >
                      {description}
                    </Text>
                  )}
                </View>

                <Text
                  style={
                    styles.basePrice
                  }
                >
                  $
                  {basePrice.toFixed(
                    2,
                  )}
                </Text>
              </View>
            </View>

            {/* ================================================= */}
            {/* INCLUDED ITEMS */}
            {/* ================================================= */}

            {includedItems.length >
              0 && (
              <View
                style={
                  styles.section
                }
              >
                <View
                  style={
                    styles.sectionHeader
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.sectionEyebrow
                      }
                    >
                      YOUR TIFFIN
                    </Text>

                    <Text
                      style={
                        styles.sectionTitle
                      }
                    >
                      Included Items
                    </Text>
                  </View>

                  <View
                    style={
                      styles.itemCountBadge
                    }
                  >
                    <Text
                      style={
                        styles.itemCountText
                      }
                    >
                      {
                        includedItems.length
                      }
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.includedCard
                  }
                >
                  {includedItems.map(
                    (
                      item,
                      index,
                    ) => (
                      <View
                        key={
                          String(
                            item.id ??
                            index,
                          )
                        }
                        style={[
                          styles.includedItem,

                          index ===
                            includedItems.length -
                              1 &&
                            styles.lastIncludedItem,
                        ]}
                      >
                        <View
                          style={
                            styles.includedCheck
                          }
                        >
                          <Image
                            source={require('../assets/login-icons/record-button.png')}
                            style={
                              styles.inputImageIcon
                            }
                            resizeMode="cover"
                          />
                        </View>

                        <View
                          style={
                            styles.includedItemContent
                          }
                        >
                          <Text
                            style={
                              styles.includedItemName
                            }
                          >
                            {item.name}
                          </Text>
                        </View>
                      </View>
                    ),
                  )}
                </View>
              </View>
            )}

            {/* ================================================= */}
            {/* API ADD-ONS ONLY */}
            {/* ================================================= */}

            {addonItems.length >
            0 ? (
              <View
                style={
                  styles.section
                }
              >
                <View
                  style={
                    styles.sectionHeader
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.sectionEyebrow
                      }
                    >
                      AVAILABLE EXTRAS
                    </Text>

                    <Text
                      style={
                        styles.sectionTitle
                      }
                    >
                      Add-ons
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.extraList
                  }
                >
                  {addonItems.map(
                    (
                      item,
                      index,
                    ) => {
                      const quantity =
                        Number(
                          extras[
                            item.id
                          ] ??
                          0,
                        );

                      return (
                        <View
                          key={
                            String(
                              item.id ??
                              index,
                            )
                          }
                          style={
                            styles.extraCard
                          }
                        >
                          <View
                            style={
                              styles.extraContent
                            }
                          >
                            <Text
                              style={
                                styles.extraName
                              }
                            >
                              {item.name}
                            </Text>

                            {!!item?.addonGroup && (
                              <Text
                                style={
                                  styles.extraGroup
                                }
                              >
                                {
                                  item.addonGroup
                                }
                              </Text>
                            )}

                            <Text
                              style={
                                styles.extraPrice
                              }
                            >
                              $
                              {normalizeMoney(
                                item.price,
                              ).toFixed(
                                2,
                              )}
                            </Text>
                          </View>

                          <View
                            style={
                              styles.quantityBox
                            }
                          >
                            <TouchableOpacity
                              style={[
                                styles.quantityButton,

                                quantity ===
                                  0 &&
                                  styles.quantityButtonDisabled,
                              ]}
                              disabled={
                                quantity ===
                                0
                              }
                              onPress={() =>
                                changeExtra(
                                  item.id,
                                  -1,
                                )
                              }
                            >
                              <Ionicons
                                name="remove"
                                size={
                                  16
                                }
                                color={
                                  quantity ===
                                  0
                                    ? '#C8BFBB'
                                    : '#A00B0F'
                                }
                              />
                            </TouchableOpacity>

                            <Text
                              style={
                                styles.quantityText
                              }
                            >
                              {quantity}
                            </Text>

                            <TouchableOpacity
                              style={
                                styles.quantityButton
                              }
                              onPress={() =>
                                changeExtra(
                                  item.id,
                                  1,
                                )
                              }
                            >
                              <Ionicons
                                name="add"
                                size={
                                  16
                                }
                                color="#A00B0F"
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    },
                  )}
                </View>
              </View>
            ) : (
              <View
                style={
                  styles.noAddonCard
                }
              >
                <Ionicons
                  name="restaurant-outline"
                  size={
                    26
                  }
                  color="#B19E96"
                />

                <Text
                  style={
                    styles.noAddonTitle
                  }
                >
                  No add-ons available
                </Text>

                <Text
                  style={
                    styles.noAddonDescription
                  }
                >
                  No extra items are currently available for this tiffin.
                </Text>
              </View>
            )}

            {/* ================================================= */}
            {/* PRICE SUMMARY */}
            {/* ================================================= */}

            <View
              style={
                styles.section
              }
            >
              <View
                style={
                  styles.sectionHeader
                }
              >
                <View>
                  <Text
                    style={
                      styles.sectionEyebrow
                    }
                  >
                    PRICE DETAILS
                  </Text>

                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    Order Summary
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.summaryCard
                }
              >
                <SummaryRow
                  label="Base Tiffin"
                  value={
                    basePrice
                  }
                />

                <SummaryRow
                  label="Add-ons"
                  value={
                    extrasPrice
                  }
                />

                <SummaryRow
                  label="Delivery"
                  value={
                    shippingCharge
                  }
                />

                <View
                  style={
                    styles.divider
                  }
                />

                <View
                  style={
                    styles.totalRow
                  }
                >
                  <Text
                    style={
                      styles.totalLabel
                    }
                  >
                    Total
                  </Text>

                  <Text
                    style={
                      styles.totalValue
                    }
                  >
                    $
                    {total.toFixed(
                      2,
                    )}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* ================================================= */}
        {/* BOTTOM CART BAR */}
        {/* ================================================= */}

        <View
          style={[
            styles.bottom,

            {
              paddingHorizontal:
                responsive.padding,
            },
          ]}
        >
          <View
            style={
              styles.bottomPriceArea
            }
          >
            <Text
              style={
                styles.bottomLabel
              }
            >
              Total
            </Text>

            <Text
              style={
                styles.bottomTotal
              }
            >
              $
              {total.toFixed(
                2,
              )}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={
              0.85
            }
            disabled={
              adding
            }
            onPress={
              handleAddToCart
            }
            style={[
              styles.addButton,

              adding &&
                styles.addButtonDisabled,
            ]}
          >
            {adding && (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            )}

            <Text
              style={
                styles.addText
              }
            >
              {adding
                ? isEditMode
                  ? 'Updating...'
                  : 'Adding...'
                : isEditMode
                  ? 'Update Cart'
                  : 'Add to Cart'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

/* =========================================================
 * SUMMARY ROW
 * ========================================================= */

const SummaryRow = ({
  label,
  value,
}) => (
  <View
    style={
      styles.summaryRow
    }
  >
    <Text
      style={
        styles.summaryLabel
      }
    >
      {label}
    </Text>

    <Text
      style={
        styles.summaryValue
      }
    >
      {Number(
        value,
      ) >
      0
        ? `$${Number(
            value,
          ).toFixed(
            2,
          )}`
        : 'FREE'}
    </Text>
  </View>
);

/* =========================================================
 * STYLES
 * ========================================================= */

const styles =
  StyleSheet.create({
    safeArea: {
      flex:
        1,

      backgroundColor:
        '#FFFDFB',
    },

    screen: {
      flex:
        1,

      alignSelf:
        'center',

      backgroundColor:
        '#FFFDFB',
    },

    /* =====================================================
     * HEADER
     * ===================================================== */

    header: {
      height:
        66,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#F0E8E4',
    },

    headerButton: {
      width:
        42,

      height:
        42,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        12,

      borderWidth:
        1,

      borderColor:
        '#EEE4DF',

      backgroundColor:
        '#FFFFFF',

      marginRight:
        12,
    },

    headerButtonPressed: {
      opacity:
        0.6,
    },

    headerIcon: {
      width:
        20,

      height:
        20,
    },

    headerTextContainer: {
      flex:
        1,
    },

    headerEyebrow: {
      color:
        '#A00B0F',

      fontSize:
        8,

      fontWeight:
        '900',

      letterSpacing:
        1,
    },

    headerTitle: {
      color:
        '#2B201C',

      fontSize:
        20,

      fontWeight:
        '900',

      marginTop:
        2,
    },

    /* =====================================================
     * HERO
     * ===================================================== */

    hero: {
      height:
        220,

      position:
        'relative',

      backgroundColor:
        '#F0E8E4',
    },

    heroImage: {
      width:
        '100%',

      height:
        '100%',
    },

    foodTypeBadge: {
      position:
        'absolute',

      left:
        16,

      bottom:
        14,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#EAF8ED',

      paddingHorizontal:
        10,

      paddingVertical:
        6,

      borderRadius:
        20,
    },

    foodTypeDot: {
      width:
        7,

      height:
        7,

      borderRadius:
        4,

      backgroundColor:
        '#2D9B51',

      marginRight:
        6,
    },

    foodTypeText: {
      color:
        '#287D45',

      fontSize:
        8,

      fontWeight:
        '900',
    },

    nonVegBadge: {
      backgroundColor:
        '#FFF0F0',
    },

    nonVegDot: {
      backgroundColor:
        '#A00B0F',
    },

    nonVegText: {
      color:
        '#A00B0F',
    },

    statusBadge: {
      position:
        'absolute',

      right:
        16,

      bottom:
        14,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        'rgba(255,255,255,0.94)',

      paddingHorizontal:
        10,

      paddingVertical:
        6,

      borderRadius:
        20,
    },

    statusDot: {
      width:
        7,

      height:
        7,

      borderRadius:
        4,

      backgroundColor:
        '#2D9B51',

      marginRight:
        6,
    },

    statusText: {
      color:
        '#51443E',

      fontSize:
        8,

      fontWeight:
        '900',
    },

    /* =====================================================
     * TIFFIN INFO
     * ===================================================== */

    tiffinInfoCard: {
      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EEE5E1',

      borderRadius:
        16,

      padding:
        15,

      marginBottom:
        14,
    },

    titleRow: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',
    },

    titleArea: {
      flex:
        1,

      paddingRight:
        12,
    },

    title: {
      color:
        '#2F221D',

      fontSize:
        18,

      fontWeight:
        '900',
    },

    description: {
      color:
        '#897B74',

      fontSize:
        9,

      lineHeight:
        14,

      marginTop:
        5,
    },

    basePrice: {
      color:
        '#A00B0F',

      fontSize:
        17,

      fontWeight:
        '900',
    },

    /* =====================================================
     * SECTION
     * ===================================================== */

    section: {
      marginBottom:
        17,
    },

    sectionHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom:
        9,
    },

    sectionEyebrow: {
      color:
        '#A00B0F',

      fontSize:
        7,

      fontWeight:
        '900',

      letterSpacing:
        0.9,
    },

    sectionTitle: {
      color:
        '#32251F',

      fontSize:
        15,

      fontWeight:
        '900',

      marginTop:
        2,
    },

    itemCountBadge: {
      minWidth:
        27,

      height:
        27,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0F0',

      borderRadius:
        9,
    },

    itemCountText: {
      color:
        '#A00B0F',

      fontSize:
        9,

      fontWeight:
        '900',
    },

    /* =====================================================
     * INCLUDED ITEMS
     * ===================================================== */

    includedCard: {
      backgroundColor:
        '#FFFFFF',

      borderRadius:
        14,

      borderWidth:
        1,

      borderColor:
        '#EEE5E1',

      paddingHorizontal:
        12,
    },

    includedItem: {
      minHeight:
        48,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#F0E9E6',
    },

    lastIncludedItem: {
      borderBottomWidth:
        0,
    },

    includedCheck: {
      width:
        28,

      height:
        28,

      borderRadius:
        9,

      backgroundColor:
        '#FFF0F0',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        10,
    },

    inputImageIcon: {
      width:
        14,

      height:
        14,
    },

    includedItemContent: {
      flex:
        1,
    },

    includedItemName: {
      color:
        '#453833',

      fontSize:
        9,

      fontWeight:
        '800',
    },

    /* =====================================================
     * ADD-ONS
     * ===================================================== */

    extraList: {
      gap:
        8,
    },

    extraCard: {
      minHeight:
        62,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#ECE3DF',

      borderRadius:
        13,

      paddingHorizontal:
        12,

      paddingVertical:
        10,
    },

    extraContent: {
      flex:
        1,

      paddingRight:
        10,
    },

    extraName: {
      color:
        '#473A34',

      fontSize:
        9,

      fontWeight:
        '900',
    },

    extraGroup: {
      color:
        '#9A8A82',

      fontSize:
        7,

      textTransform:
        'capitalize',

      marginTop:
        2,
    },

    extraPrice: {
      color:
        '#A00B0F',

      fontSize:
        8,

      fontWeight:
        '800',

      marginTop:
        3,
    },

    quantityBox: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF5F3',

      borderRadius:
        10,

      padding:
        3,
    },

    quantityButton: {
      width:
        30,

      height:
        30,

      borderRadius:
        8,

      backgroundColor:
        '#FFFFFF',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    quantityButtonDisabled: {
      opacity:
        0.55,
    },

    quantityText: {
      minWidth:
        30,

      textAlign:
        'center',

      color:
        '#322621',

      fontSize:
        10,

      fontWeight:
        '900',
    },

    /* =====================================================
     * NO ADD-ONS
     * ===================================================== */

    noAddonCard: {
      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#ECE3DF',

      borderRadius:
        14,

      paddingHorizontal:
        20,

      paddingVertical:
        24,

      marginBottom:
        17,
    },

    noAddonTitle: {
      color:
        '#493B35',

      fontSize:
        11,

      fontWeight:
        '900',

      marginTop:
        8,
    },

    noAddonDescription: {
      color:
        '#95867F',

      fontSize:
        8,

      lineHeight:
        13,

      textAlign:
        'center',

      marginTop:
        4,
    },

    /* =====================================================
     * SUMMARY
     * ===================================================== */

    summaryCard: {
      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#ECE3DF',

      borderRadius:
        14,

      padding:
        13,
    },

    summaryRow: {
      minHeight:
        34,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    summaryLabel: {
      color:
        '#7E706A',

      fontSize:
        9,
    },

    summaryValue: {
      color:
        '#493B35',

      fontSize:
        9,

      fontWeight:
        '800',
    },

    divider: {
      height:
        1,

      backgroundColor:
        '#EEE6E2',

      marginVertical:
        8,
    },

    totalRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      paddingVertical:
        3,
    },

    totalLabel: {
      color:
        '#2F231E',

      fontSize:
        12,

      fontWeight:
        '900',
    },

    totalValue: {
      color:
        '#A00B0F',

      fontSize:
        15,

      fontWeight:
        '900',
    },

    /* =====================================================
     * BOTTOM
     * ===================================================== */

    bottom: {
      position:
        'absolute',

      left:
        0,

      right:
        0,

      bottom:
        0,

      minHeight:
        78,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderTopWidth:
        1,

      borderTopColor:
        '#ECE3DF',

      paddingVertical:
        10,
    },

    bottomPriceArea: {
      flex:
        1,
    },

    bottomLabel: {
      color:
        '#93847D',

      fontSize:
        8,
    },

    bottomTotal: {
      color:
        '#2F231E',

      fontSize:
        18,

      fontWeight:
        '900',

      marginTop:
        2,
    },

    addButton: {
      minWidth:
        150,

      minHeight:
        50,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#A00B0F',

      borderRadius:
        13,

      paddingHorizontal:
        18,
    },

    addButtonDisabled: {
      opacity:
        0.65,
    },

    addText: {
      color:
        '#FFFFFF',

      fontSize:
        10,

      fontWeight:
        '900',

      marginLeft:
        6,
    },
  });

export default CustomizeTiffin;