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
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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

import Ionicons from 'react-native-vector-icons/Ionicons';

/* =========================================================
 * API
 * ========================================================= */

const ORDER_API =
  'https://replete-software.com/projects/kp_admin/api/customer/orders';

const PROFILE_API =
  'https://replete-software.com/projects/kp_admin/api/customer/profile';

/* =========================================================
 * STORAGE
 * ========================================================= */

const CART_STORAGE_KEY =
  'kp_customer_cart';

const WEEKLY_ORDERS_STORAGE_KEY =
  'kp_customer_weekly_orders';

/* =========================================================
 * NUMBER HELPER
 * ========================================================= */

const toSafeNumber = value => {
  const parsed = Number(
    String(
      value ?? 0,
    ).replace(
      /[^\d.-]/g,
      '',
    ),
  );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
};

/* =========================================================
 * EXTRACT ORDER ID
 * ========================================================= */

const extractOrderId = result => {
  return (
    result?.order?.id ??
    result?.data?.order?.id ??
    result?.order_id ??
    result?.data?.order_id ??
    result?.data?.id ??
    result?.id ??
    null
  );
};

/* =========================================================
 * SERVER ORDER
 * ========================================================= */

const extractServerOrder = result => {
  return (
    result?.order ??
    result?.data?.order ??
    result?.data ??
    null
  );
};

/* =========================================================
 * DEFAULT TIFFIN ITEMS
 * ========================================================= */

const getDefaultTiffinItems = cartItem => {
  const tiffin =
    cartItem?.originalTiffin ??
    cartItem?.tiffin ??
    cartItem ??
    {};

  const possibleItems =
    tiffin?.default_items ??
    tiffin?.defaultItems ??
    tiffin?.tiffin_items ??
    tiffin?.tiffinItems ??
    tiffin?.included_items ??
    tiffin?.includedItems ??
    tiffin?.menu_items ??
    tiffin?.menuItems ??
    tiffin?.items ??
    cartItem?.items ??
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
        value,
        index,
      ) => {
        if (
          typeof value ===
          'string'
        ) {
          return {
            id:
              `default-${index}`,

            name:
              value,
          };
        }

        if (
          value &&
          typeof value ===
            'object'
        ) {
          const nested =
            value?.item ??
            value?.food_item ??
            value?.product ??
            {};

          return {
            ...value,

            id:
              value?.id ??
              value?.item_id ??
              nested?.id ??
              `default-${index}`,

            name:
              value?.name ??
              value?.item_name ??
              value?.title ??
              value?.food_name ??
              nested?.name ??
              nested?.title ??
              `Item ${index + 1}`,
          };
        }

        return null;
      },
    )
    .filter(
      Boolean,
    );
};

/* =========================================================
 * CUSTOMIZATIONS
 * ========================================================= */

const getCartCustomizations = item => {
  if (
    Array.isArray(
      item?.selections,
    )
  ) {
    return item.selections;
  }

  if (
    Array.isArray(
      item?.customizations,
    )
  ) {
    return item.customizations;
  }

  return [];
};

/* =========================================================
 * SELECTED ADD-ONS
 *
 * IMPORTANT:
 *
 * The tiffins API gives the complete catalogue in:
 *
 * tiffin.adons = {
 *   salad: [...],
 *   beverages: [...],
 *   ...
 * }
 *
 * But the cart must contain ONLY SELECTED add-ons as an array.
 * ========================================================= */

const getCartAddons = item => {
  const possibleSelectedAddons = [
    item?.extras,
    item?.selectedExtras,
    item?.selectedAddons,
    item?.addons,
    item?.adons,
  ];

  for (
    const value
    of possibleSelectedAddons
  ) {
    if (
      Array.isArray(
        value,
      ) &&
      value.length >
        0
    ) {
      return value;
    }
  }

  return [];
};

/* =========================================================
 * NORMALIZE ONE ADD-ON
 *
 * Your backend/tiffin API spelling is "adons".
 *
 * Every selected addon is converted to:
 *
 * {
 *   adon_id: 9,
 *   addon_id: 9,
 *   id: 9,
 *   name: "Green Salad",
 *   quantity: 1,
 *   price: 3,
 *   total: 3
 * }
 * ========================================================= */

const normalizeOrderAddon = (
  addon,
  index = 0,
) => {
  if (
    !addon
  ) {
    return null;
  }

  const nestedAddon =
    addon?.addon ??
    addon?.adon ??
    addon?.item ??
    addon?.extra ??
    {};

  /* =====================================================
   * REAL ADD-ON DATABASE ID
   * ===================================================== */

  const rawAddonId =
    addon?.adon_id ??
    addon?.addon_id ??
    addon?.addonId ??
    addon?.extra_id ??
    addon?.extraId ??
    addon?.id ??
    nestedAddon?.id ??
    null;

  if (
    rawAddonId ===
      null ||
    rawAddonId ===
      undefined ||
    String(
      rawAddonId,
    ).trim() ===
      ''
  ) {
    console.log(
      'ADDON WITHOUT DATABASE ID:',
      JSON.stringify(
        addon,
        null,
        2,
      ),
    );

    return null;
  }

  const numericId =
    Number(
      rawAddonId,
    );

  const addonId =
    Number.isFinite(
      numericId,
    )
      ? numericId
      : rawAddonId;

  /* =====================================================
   * QUANTITY
   * ===================================================== */

  const quantity =
    Math.max(
      1,

      toSafeNumber(
        addon?.quantity ??
          addon?.qty ??
          addon?.pivot
            ?.quantity ??
          addon?.pivot
            ?.qty ??
          1,
      ) || 1,
    );

  /* =====================================================
   * PRICE
   * ===================================================== */

  const price =
    toSafeNumber(
      addon?.price ??
        addon?.unit_price ??
        addon?.unitPrice ??
        addon?.additional_price ??
        addon?.extra_price ??
        addon?.pivot?.price ??
        nestedAddon?.price ??
        0,
    );

  /* =====================================================
   * NAME
   * ===================================================== */

  const name =
    addon?.name ??
    addon?.adon_name ??
    addon?.addon_name ??
    addon?.addonName ??
    addon?.extra_name ??
    addon?.title ??
    nestedAddon?.name ??
    nestedAddon?.title ??
    `Add-on ${index + 1}`;

  const total =
    Number(
      (
        price *
        quantity
      ).toFixed(
        2,
      ),
    );

  return {
    /*
     * Primary backend spelling.
     */
    adon_id:
      addonId,

    /*
     * Compatibility spellings.
     */
    addon_id:
      addonId,

    addonId:
      addonId,

    id:
      addonId,

    name,

    adon_name:
      name,

    addon_name:
      name,

    quantity,

    qty:
      quantity,

    price:
      Number(
        price.toFixed(
          2,
        ),
      ),

    unit_price:
      Number(
        price.toFixed(
          2,
        ),
      ),

    total,

    line_total:
      total,

    total_price:
      total,
  };
};

/* =========================================================
 * NORMALIZED SELECTED ADD-ONS
 * ========================================================= */

const getNormalizedOrderAddons = item => {
  const selected =
    getCartAddons(
      item,
    );

  return selected
    .map(
      (
        addon,
        index,
      ) =>
        normalizeOrderAddon(
          addon,
          index,
        ),
    )
    .filter(
      Boolean,
    );
};

/* =========================================================
 * BASE PRICE
 * ========================================================= */

const getCartBasePrice = item => {
  return toSafeNumber(
    item?.basePrice ??
      item?.rawPrice ??
      item?.originalTiffin
        ?.rawPrice ??
      item?.originalTiffin
        ?.price ??
      item?.price ??
      0,
  );
};

/* =========================================================
 * CUSTOMIZATION TOTAL
 * ========================================================= */

const getCartCustomizationTotal = item => {
  const explicitTotal =
    item?.customizationPrice ??
    item?.customizationsPrice ??
    item?.customization_total;

  if (
    explicitTotal !==
      null &&
    explicitTotal !==
      undefined
  ) {
    return toSafeNumber(
      explicitTotal,
    );
  }

  return getCartCustomizations(
    item,
  ).reduce(
    (
      total,
      customization,
    ) => {
      const quantity =
        Math.max(
          1,

          toSafeNumber(
            customization
              ?.quantity ??
              customization
                ?.qty ??
              1,
          ) || 1,
        );

      const price =
        toSafeNumber(
          customization
            ?.price ??
            customization
              ?.additional_price ??
            customization
              ?.extra_price ??
            0,
        );

      return (
        total +
        price *
          quantity
      );
    },

    0,
  );
};

/* =========================================================
 * ADD-ON TOTAL
 * ========================================================= */

const getCartAddonsTotal = item => {
  const addons =
    getNormalizedOrderAddons(
      item,
    );

  if (
    addons.length >
    0
  ) {
    return addons.reduce(
      (
        total,
        addon,
      ) =>
        total +
        toSafeNumber(
          addon?.total,
        ),

      0,
    );
  }

  return toSafeNumber(
    item?.extrasPrice ??
      item?.addonsPrice ??
      item?.addonPrice ??
      item?.adons_total ??
      item?.addons_total ??
      item?.extras_total ??
      0,
  );
};

/* =========================================================
 * COMPLETE UNIT PRICE
 *
 * BASE
 * +
 * CUSTOMIZATION
 * +
 * ADD-ONS
 * ========================================================= */

const getCartUnitPrice = item => {
  const basePrice =
    getCartBasePrice(
      item,
    );

  const customizationTotal =
    getCartCustomizationTotal(
      item,
    );

  const addonsTotal =
    getCartAddonsTotal(
      item,
    );

  const calculated =
    basePrice +
    customizationTotal +
    addonsTotal;

  const storedSubtotal =
    toSafeNumber(
      item?.subtotal,
    );

  return Number(
    Math.max(
      calculated,
      storedSubtotal,
      basePrice,
    ).toFixed(
      2,
    ),
  );
};

/* =========================================================
 * FOOD TYPE
 * ========================================================= */

const getTiffinFoodType = item => {
  const direct =
    item?.foodType ??
    item?.food_type ??
    item?.originalTiffin
      ?.foodType ??
    item?.originalTiffin
      ?.food_type ??
    '';

  if (
    direct
  ) {
    return direct;
  }

  const category =
    item?.originalTiffin
      ?.category ??
    item?.category ??
    '';

  let categoryName =
    '';

  if (
    category &&
    typeof category ===
      'object'
  ) {
    categoryName =
      category?.name ??
      category?.title ??
      '';
  } else {
    categoryName =
      String(
        category ?? '',
      );
  }

  const normalized =
    categoryName
      .trim()
      .toLowerCase();

  if (
    normalized.includes(
      'non-vegetarian',
    ) ||
    normalized.includes(
      'non vegetarian',
    ) ||
    normalized.includes(
      'non-veg',
    ) ||
    normalized.includes(
      'non veg',
    )
  ) {
    return 'NON-VEGETARIAN';
  }

  if (
    normalized.includes(
      'vegetarian',
    ) ||
    normalized ===
      'veg'
  ) {
    return 'VEGETARIAN';
  }

  return '';
};

/* =========================================================
 * DESCRIPTION
 * ========================================================= */

const getTiffinDescription = item => {
  return (
    item?.description ??
    item?.originalTiffin
      ?.description ??
    item?.originalTiffin
      ?.tiffin_description ??
    ''
  );
};

/* =========================================================
 * PREPARATION TIME
 * ========================================================= */

const getPreparationTime = item => {
  return (
    item?.preparationTime ??
    item?.originalTiffin
      ?.preparationTime ??
    item?.originalTiffin
      ?.preparation_time ??
    item?.originalTiffin
      ?.prep_time ??
    ''
  );
};

/* =========================================================
 * SAVE ORDER FOR WEEKLY BILLING
 * ========================================================= */

const saveOrderForWeeklyBilling =
  async ({
    orderId,
    serverOrder,
    foodSubtotal,
    shipping,
    grandTotal,
    cart,
    notes,
  }) => {
    try {
      const stored =
        await AsyncStorage.getItem(
          WEEKLY_ORDERS_STORAGE_KEY,
        );

      let weeklyOrders =
        [];

      if (
        stored
      ) {
        try {
          const parsed =
            JSON.parse(
              stored,
            );

          weeklyOrders =
            Array.isArray(
              parsed,
            )
              ? parsed
              : [];
        } catch (
          error
        ) {
          weeklyOrders =
            [];
        }
      }

      const alreadyExists =
        weeklyOrders.some(
          order =>
            String(
              order?.orderId ??
                order?.order_id ??
                order?.id ??
                '',
            ) ===
            String(
              orderId,
            ),
        );

      if (
        alreadyExists
      ) {
        return;
      }

      const items =
        cart.map(
          item => {
            const quantity =
              Math.max(
                1,

                Number(
                  item?.quantity ??
                    1,
                ) || 1,
              );

            const basePrice =
              getCartBasePrice(
                item,
              );

            const customizations =
              getCartCustomizations(
                item,
              );

            const adons =
              getNormalizedOrderAddons(
                item,
              );

            const customizationTotal =
              getCartCustomizationTotal(
                item,
              );

            const adonsTotal =
              getCartAddonsTotal(
                item,
              );

            const unitPrice =
              getCartUnitPrice(
                item,
              );

            return {
              tiffin_id:
                Number(
                  item?.tiffinId ??
                    item?.productId ??
                    item?.id,
                ),

              name:
                item?.name ??
                item
                  ?.originalTiffin
                  ?.name ??
                'Tiffin',

              quantity,

              base_price:
                Number(
                  basePrice.toFixed(
                    2,
                  ),
                ),

              customization_total:
                Number(
                  customizationTotal.toFixed(
                    2,
                  ),
                ),

              adons_total:
                Number(
                  adonsTotal.toFixed(
                    2,
                  ),
                ),

              addons_total:
                Number(
                  adonsTotal.toFixed(
                    2,
                  ),
                ),

              price:
                unitPrice,

              unit_price:
                unitPrice,

              line_total:
                Number(
                  (
                    unitPrice *
                    quantity
                  ).toFixed(
                    2,
                  ),
                ),

              customizations,

              adons,

              addons:
                adons,

              extras:
                adons,
            };
          },
        );

      const weeklyOrder = {
        id:
          orderId,

        orderId:
          orderId,

        order_id:
          orderId,

        subtotal:
          Number(
            foodSubtotal.toFixed(
              2,
            ),
          ),

        deliveryFee:
          Number(
            shipping.toFixed(
              2,
            ),
          ),

        delivery_fee:
          Number(
            shipping.toFixed(
              2,
            ),
          ),

        totalAmount:
          Number(
            grandTotal.toFixed(
              2,
            ),
          ),

        total_amount:
          Number(
            grandTotal.toFixed(
              2,
            ),
          ),

        grand_total:
          Number(
            grandTotal.toFixed(
              2,
            ),
          ),

        currency:
          'AUD',

        notes:
          notes.trim(),

        items,

        status:
          serverOrder?.status ??
          serverOrder
            ?.order_status ??
          'Placed',

        created_at:
          serverOrder?.created_at ??
          new Date()
            .toISOString(),

        updated_at:
          serverOrder?.updated_at ??
          new Date()
            .toISOString(),

        serverOrder:
          serverOrder ??
          null,
      };

      await AsyncStorage.setItem(
        WEEKLY_ORDERS_STORAGE_KEY,

        JSON.stringify([
          ...weeklyOrders,
          weeklyOrder,
        ]),
      );
    } catch (
      error
    ) {
      console.log(
        'SAVE WEEKLY ORDER ERROR:',
        error,
      );
    }
  };

/* =========================================================
 * ORDER SCREEN
 * ========================================================= */

const Order = ({
  navigation,
}) => {
  const {
    width,
  } =
    useWindowDimensions();

  /* =======================================================
   * STATES
   * ======================================================= */

  const [
    cart,
    setCart,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    placingOrder,
    setPlacingOrder,
  ] =
    useState(false);

  const [
    notes,
    setNotes,
  ] =
    useState('');

  const [
    location,
    setLocation,
  ] =
    useState(
      'Set delivery address',
    );

  const [
    loginPopupVisible,
    setLoginPopupVisible,
  ] =
    useState(false);

  const [
    orderSuccessVisible,
    setOrderSuccessVisible,
  ] =
    useState(false);

  const [
    successfulOrderId,
    setSuccessfulOrderId,
  ] =
    useState(null);

  /* =======================================================
   * RESPONSIVE
   * ======================================================= */

  const responsive =
    useMemo(
      () => ({
        width:
          width >=
          768
            ? Math.min(
                width -
                  80,
                720,
              )
            : width,

        padding:
          width >=
          768
            ? 28
            : 14,
      }),

      [
        width,
      ],
    );

  /* =======================================================
   * NORMALIZE CART
   * ======================================================= */

  const normalizeCart = items => {
    if (
      !Array.isArray(
        items,
      )
    ) {
      return [];
    }

    return items.map(
      (
        item,
        index,
      ) => {
        /*
         * IMPORTANT:
         *
         * extras should contain the selected
         * add-on records from CustomizeTiffin.
         */

        let selectedExtras =
          [];

        if (
          Array.isArray(
            item?.extras,
          )
        ) {
          selectedExtras =
            item.extras;
        } else if (
          Array.isArray(
            item?.selectedExtras,
          )
        ) {
          selectedExtras =
            item.selectedExtras;
        } else if (
          Array.isArray(
            item?.selectedAddons,
          )
        ) {
          selectedExtras =
            item.selectedAddons;
        } else if (
          Array.isArray(
            item?.addons,
          )
        ) {
          selectedExtras =
            item.addons;
        } else if (
          Array.isArray(
            item?.adons,
          )
        ) {
          selectedExtras =
            item.adons;
        }

        return {
          ...item,

          cartId:
            item?.cartId ??
            `cart-${
              item?.id ??
              index
            }-${index}`,

          tiffinId:
            item?.tiffinId ??
            item?.productId ??
            item?.id,

          quantity:
            Math.max(
              1,

              Number(
                item?.quantity ??
                  1,
              ) || 1,
            ),

          selections:
            Array.isArray(
              item?.selections,
            )
              ? item.selections
              : Array.isArray(
                    item?.customizations,
                  )
                ? item.customizations
                : [],

          /*
           * Selected add-ons.
           */

          extras:
            selectedExtras,

          selectedExtras:
            selectedExtras,

          selectedAddons:
            selectedExtras,

          addons:
            selectedExtras,
        };
      },
    );
  };

  /* =======================================================
   * LOAD CART
   * ======================================================= */

  const loadCart =
    async () => {
      try {
        setLoading(
          true,
        );

        const stored =
          await AsyncStorage.getItem(
            CART_STORAGE_KEY,
          );

        if (
          !stored
        ) {
          setCart(
            [],
          );

          return;
        }

        const parsed =
          JSON.parse(
            stored,
          );

        const normalized =
          normalizeCart(
            parsed,
          );

        console.log(
          '====================================',
        );

        console.log(
          'CART LOADED:',
        );

        console.log(
          JSON.stringify(
            normalized,
            null,
            2,
          ),
        );

        console.log(
          '====================================',
        );

        setCart(
          normalized,
        );

        await AsyncStorage.setItem(
          CART_STORAGE_KEY,

          JSON.stringify(
            normalized,
          ),
        );
      } catch (
        error
      ) {
        console.log(
          'LOAD CART ERROR:',
          error,
        );

        setCart(
          [],
        );
      } finally {
        setLoading(
          false,
        );
      }
    };

  /* =======================================================
   * LOAD PROFILE
   * ======================================================= */

  const loadProfile =
    async () => {
      try {
        const token =
          await AsyncStorage.getItem(
            'token',
          );

        if (
          !token
        ) {
          setLocation(
            'Login to set delivery address',
          );

          return;
        }

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

        let result =
          {};

        try {
          result =
            responseText
              ? JSON.parse(
                  responseText,
                )
              : {};
        } catch (
          error
        ) {
          return;
        }

        if (
          !response.ok
        ) {
          return;
        }

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
          result;

        let address =
          profile
            ?.delivery_address ??
          profile
            ?.delivery_location ??
          profile
            ?.full_address ??
          null;

        if (
          !address &&
          typeof profile
            ?.address ===
            'string'
        ) {
          address =
            profile.address;
        }

        if (
          !address &&
          Array.isArray(
            profile?.addresses,
          )
        ) {
          const defaultAddress =
            profile.addresses.find(
              value =>
                value?.is_default ===
                  true ||
                value?.is_default ===
                  1,
            ) ??
            profile.addresses[0];

          if (
            defaultAddress
          ) {
            address =
              defaultAddress
                ?.address_line ??
              defaultAddress
                ?.address ??
              [
                defaultAddress
                  ?.address_line_1,

                defaultAddress
                  ?.address_line_2,

                defaultAddress
                  ?.city,

                defaultAddress
                  ?.state,

                defaultAddress
                  ?.pincode,
              ]
                .filter(
                  Boolean,
                )
                .join(
                  ', ',
                );
          }
        }

        if (
          !address
        ) {
          address = [
            profile
              ?.address_line_1,

            profile
              ?.address_line_2,

            profile?.street,

            profile?.suburb,

            profile?.city,

            profile?.state,

            profile
              ?.postcode ??
              profile?.pincode,
          ]
            .filter(
              Boolean,
            )
            .join(
              ', ',
            );
        }

        setLocation(
          address ||
            'Set delivery address',
        );
      } catch (
        error
      ) {
        console.log(
          'PROFILE ERROR:',
          error,
        );
      }
    };

  /* =======================================================
   * INITIAL LOAD
   * ======================================================= */

  useEffect(
    () => {
      loadCart();
      loadProfile();
    },
    [],
  );

  useFocusEffect(
    useCallback(
      () => {
        loadCart();
        loadProfile();
      },

      [],
    ),
  );

  /* =======================================================
   * QUANTITY
   * ======================================================= */

  const updateQuantity =
    async (
      cartId,
      change,
    ) => {
      try {
        const updated =
          cart.map(
            item => {
              if (
                item?.cartId !==
                cartId
              ) {
                return item;
              }

              return {
                ...item,

                quantity:
                  Math.max(
                    1,

                    Number(
                      item?.quantity ??
                        1,
                    ) +
                      change,
                  ),
              };
            },
          );

        setCart(
          updated,
        );

        await AsyncStorage.setItem(
          CART_STORAGE_KEY,

          JSON.stringify(
            updated,
          ),
        );
      } catch (
        error
      ) {
        console.log(
          'QUANTITY ERROR:',
          error,
        );
      }
    };

  /* =======================================================
   * REMOVE
   * ======================================================= */

  const removeItem =
    item => {
      Alert.alert(
        'Remove Item',

        `Remove ${
          item?.name ??
          'this item'
        } from your cart?`,

        [
          {
            text:
              'Cancel',

            style:
              'cancel',
          },

          {
            text:
              'Remove',

            style:
              'destructive',

            onPress:
              async () => {
                try {
                  const updated =
                    cart.filter(
                      value =>
                        value?.cartId !==
                        item?.cartId,
                    );

                  setCart(
                    updated,
                  );

                  await AsyncStorage.setItem(
                    CART_STORAGE_KEY,

                    JSON.stringify(
                      updated,
                    ),
                  );
                } catch (
                  error
                ) {
                  console.log(
                    'REMOVE ERROR:',
                    error,
                  );
                }
              },
          },
        ],
      );
    };

  /* =======================================================
   * CUSTOMIZE
   * ======================================================= */

  const handleCustomizeTiffin =
    item => {
      const originalTiffin =
        item?.originalTiffin ??
        item?.tiffin ??
        {};

      const basePrice =
        getCartBasePrice(
          item,
        );

      const tiffinData = {
        ...originalTiffin,

        id:
          item?.tiffinId ??
          item?.productId ??
          item?.id ??
          originalTiffin
            ?.id,

        name:
          item?.name ??
          originalTiffin
            ?.name ??
          originalTiffin
            ?.tiffin_name ??
          'Tiffin',

        description:
          item?.description ??
          originalTiffin
            ?.description ??
          originalTiffin
            ?.tiffin_description ??
          '',

        image:
          item?.image ??
          originalTiffin
            ?.image ??
          originalTiffin
            ?.image_url ??
          originalTiffin
            ?.tiffin_image ??
          null,

        rawPrice:
          basePrice,

        price:
          basePrice,

        category:
          originalTiffin
            ?.category ??
          item?.category ??
          null,

        category_id:
          originalTiffin
            ?.category_id ??
          item?.category_id ??
          null,

        foodType:
          item?.foodType ??
          originalTiffin
            ?.foodType ??
          originalTiffin
            ?.food_type ??
          '',

        items:
          originalTiffin
            ?.items ??
          item?.items ??
          [],

        /*
         * IMPORTANT:
         *
         * Send the ORIGINAL full addon catalogue
         * back to CustomizeTiffin.
         */

        adons:
          originalTiffin
            ?.adons ??
          originalTiffin
            ?.addons ??
          originalTiffin
            ?.add_ons ??
          {},

        addons:
          originalTiffin
            ?.addons ??
          originalTiffin
            ?.adons ??
          originalTiffin
            ?.add_ons ??
          {},

        status:
          originalTiffin
            ?.status ??
          item?.status ??
          'Active',

        preparationTime:
          item
            ?.preparationTime ??
          originalTiffin
            ?.preparationTime ??
          originalTiffin
            ?.preparation_time ??
          originalTiffin
            ?.prep_time ??
          '',
      };

      navigation.navigate(
        'CustomizeTiffin',

        {
          tiffin:
            tiffinData,

          mode:
            'edit',

          cartId:
            item?.cartId,

          cartItem:
            item,

          quantity:
            Math.max(
              1,

              Number(
                item?.quantity ??
                  1,
              ) || 1,
            ),

          selections:
            getCartCustomizations(
              item,
            ),

          /*
           * ONLY selected extras.
           */

          extras:
            getCartAddons(
              item,
            ),
        },
      );
    };

  /* =======================================================
   * SUBTOTAL
   * ======================================================= */

  const foodSubtotal =
    useMemo(
      () => {
        return cart.reduce(
          (
            total,
            item,
          ) => {
            const quantity =
              Math.max(
                1,

                Number(
                  item?.quantity ??
                    1,
                ) || 1,
              );

            return (
              total +
              getCartUnitPrice(
                item,
              ) *
                quantity
            );
          },

          0,
        );
      },

      [
        cart,
      ],
    );

  /* =======================================================
   * SHIPPING
   * ======================================================= */

  const shipping =
    useMemo(
      () => {
        if (
          foodSubtotal <=
          0
        ) {
          return 0;
        }

        return foodSubtotal <
          11
          ? 2
          : 0;
      },

      [
        foodSubtotal,
      ],
    );

  const grandTotal =
    foodSubtotal +
    shipping;

  /* =======================================================
   * LOGIN
   * ======================================================= */

  const closeLoginPopup =
    () => {
      setLoginPopupVisible(
        false,
      );
    };

  const handleLoginFromPopup =
    () => {
      setLoginPopupVisible(
        false,
      );

      navigation.navigate(
        'Login',

        {
          redirectTo:
            'Order',

          action:
            'placeOrder',
        },
      );
    };

  /* =======================================================
   * ORDER SUCCESS
   * ======================================================= */

  const handleOrderSuccessContinue =
    () => {
      setOrderSuccessVisible(
        false,
      );

      setSuccessfulOrderId(
        null,
      );

      navigation.reset({
        index:
          0,

        routes: [
          {
            name:
              'MainTabs',
          },
        ],
      });
    };

  /* =======================================================
   * PLACE ORDER
   * ======================================================= */

  const handlePlaceOrder =
    async () => {
      if (
        placingOrder
      ) {
        return;
      }

      if (
        cart.length ===
        0
      ) {
        Alert.alert(
          'Cart Empty',

          'Please add a tiffin before placing your order.',
        );

        return;
      }

      try {
        const token =
          await AsyncStorage.getItem(
            'token',
          );

        if (
          !token
        ) {
          setLoginPopupVisible(
            true,
          );

          return;
        }

        setPlacingOrder(
          true,
        );

        /* =================================================
         * BUILD ORDER ITEMS
         * ================================================= */

        const orderItems =
          cart.map(
            item => {
              const quantity =
                Math.max(
                  1,

                  toSafeNumber(
                    item?.quantity ??
                      1,
                  ) || 1,
                );

              const tiffinId =
                Number(
                  item?.tiffinId ??
                    item?.productId ??
                    item?.id,
                );

              const basePrice =
                getCartBasePrice(
                  item,
                );

              const customizations =
                getCartCustomizations(
                  item,
                );

              /*
               * IMPORTANT:
               * Selected add-ons, with their actual IDs.
               */

              const adons =
                getNormalizedOrderAddons(
                  item,
                );

              const customizationTotal =
                Number(
                  getCartCustomizationTotal(
                    item,
                  ).toFixed(
                    2,
                  ),
                );

              const adonsTotal =
                Number(
                  adons
                    .reduce(
                      (
                        total,
                        adon,
                      ) =>
                        total +
                        toSafeNumber(
                          adon?.total,
                        ),

                      0,
                    )
                    .toFixed(
                      2,
                    ),
                );

              /*
               * Full unit price.
               */

              const calculatedUnitPrice =
                Number(
                  (
                    basePrice +
                    customizationTotal +
                    adonsTotal
                  ).toFixed(
                    2,
                  ),
                );

              const storedSubtotal =
                toSafeNumber(
                  item?.subtotal,
                );

              const unitPrice =
                Number(
                  Math.max(
                    calculatedUnitPrice,
                    storedSubtotal,
                  ).toFixed(
                    2,
                  ),
                );

              const lineTotal =
                Number(
                  (
                    unitPrice *
                    quantity
                  ).toFixed(
                    2,
                  ),
                );

              const adonIds =
                adons.map(
                  adon =>
                    adon.adon_id,
                );

              return {
                tiffin_id:
                  tiffinId,

                quantity,

                /*
                 * FULL price including
                 * customization and add-ons.
                 */

                price:
                  unitPrice,

                unit_price:
                  unitPrice,

                /*
                 * Base price separately.
                 */

                base_price:
                  Number(
                    basePrice.toFixed(
                      2,
                    ),
                  ),

                customization_total:
                  customizationTotal,

                /*
                 * Add-on amount for ONE tiffin.
                 */

                adons_total:
                  adonsTotal,

                addons_total:
                  adonsTotal,

                addon_total:
                  adonsTotal,

                extras_total:
                  adonsTotal,

                line_total:
                  lineTotal,

                total:
                  lineTotal,

                total_price:
                  lineTotal,

                default_items:
                  getDefaultTiffinItems(
                    item,
                  ),

                customizations,

                selections:
                  customizations,

                /*
                 * =====================================
                 * MOST IMPORTANT PART
                 *
                 * Your tiffin API uses "adons".
                 * =====================================
                 */

                adons,

                /*
                 * Compatibility aliases.
                 */

                addons:
                  adons,

                extras:
                  adons,

                /*
                 * IDs separately in case Laravel's
                 * controller expects an ID array.
                 */

                adon_ids:
                  adonIds,

                addon_ids:
                  adonIds,
              };
            },
          );

        /* =================================================
         * FLAT ADD-ONS
         * ================================================= */

        const allOrderAdons =
          orderItems.flatMap(
            item =>
              (
                item?.adons ??
                []
              ).map(
                adon => ({
                  ...adon,

                  tiffin_id:
                    item
                      .tiffin_id,

                  tiffin_quantity:
                    item
                      .quantity,
                }),
              ),
          );

        /* =================================================
         * TOP LEVEL ADD-ON TOTAL
         * ================================================= */

        const completeOrderAdonsTotal =
          orderItems.reduce(
            (
              total,
              item,
            ) =>
              total +
              toSafeNumber(
                item?.adons_total,
              ) *
                Math.max(
                  1,

                  toSafeNumber(
                    item?.quantity ??
                      1,
                  ),
                ),

            0,
          );

        const completeOrderCustomizationTotal =
          orderItems.reduce(
            (
              total,
              item,
            ) =>
              total +
              toSafeNumber(
                item
                  ?.customization_total,
              ) *
                Math.max(
                  1,

                  toSafeNumber(
                    item?.quantity ??
                      1,
                  ),
                ),

            0,
          );

        const allAdonIds =
          allOrderAdons.map(
            adon =>
              adon.adon_id,
          );

        /* =================================================
         * FINAL REQUEST PAYLOAD
         * ================================================= */

        const payload = {
          items:
            orderItems,

          notes:
            notes.trim(),

          order_notes:
            notes.trim(),

          subtotal:
            Number(
              foodSubtotal.toFixed(
                2,
              ),
            ),

          delivery_fee:
            Number(
              shipping.toFixed(
                2,
              ),
            ),

          total_amount:
            Number(
              grandTotal.toFixed(
                2,
              ),
            ),

          customization_total:
            Number(
              completeOrderCustomizationTotal.toFixed(
                2,
              ),
            ),

          /*
           * Add-on totals.
           */

          adons_total:
            Number(
              completeOrderAdonsTotal.toFixed(
                2,
              ),
            ),

          addons_total:
            Number(
              completeOrderAdonsTotal.toFixed(
                2,
              ),
            ),

          addon_total:
            Number(
              completeOrderAdonsTotal.toFixed(
                2,
              ),
            ),

          extras_total:
            Number(
              completeOrderAdonsTotal.toFixed(
                2,
              ),
            ),

          /*
           * ===========================================
           * PRIMARY ADD-ON FIELD
           * ===========================================
           */

          adons:
            allOrderAdons,

          /*
           * Compatibility.
           */

          addons:
            allOrderAdons,

          extras:
            allOrderAdons,

          adon_ids:
            allAdonIds,

          addon_ids:
            allAdonIds,

          /*
           * Existing backward-compatible
           * single-tiffin fields.
           */

          tiffin_id:
            Number(
              cart[0]
                ?.tiffinId ??
                cart[0]
                  ?.productId ??
                cart[0]?.id,
            ),

          quantity:
            Number(
              cart[0]
                ?.quantity ??
                1,
            ),
        };

        /* =================================================
         * DEBUG
         *
         * CHECK THIS IN METRO.
         * ================================================= */

        console.log(
          '====================================================',
        );

        console.log(
          'FINAL PLACE ORDER PAYLOAD:',
        );

        console.log(
          JSON.stringify(
            payload,
            null,
            2,
          ),
        );

        console.log(
          'SELECTED ADONS:',
          JSON.stringify(
            allOrderAdons,
            null,
            2,
          ),
        );

        console.log(
          'SELECTED ADON IDS:',
          allAdonIds,
        );

        console.log(
          'ADONS TOTAL:',
          payload.adons_total,
        );

        console.log(
          '====================================================',
        );

        /* =================================================
         * API CALL
         * ================================================= */

        const response =
          await fetch(
            ORDER_API,

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

        const responseText =
          await response.text();

        let result =
          {};

        if (
          responseText
        ) {
          try {
            result =
              JSON.parse(
                responseText,
              );
          } catch (
            error
          ) {
            console.log(
              'RAW ORDER RESPONSE:',
              responseText,
            );

            throw new Error(
              'Invalid response from the order server.',
            );
          }
        }

        console.log(
          'ORDER STATUS:',
          response.status,
        );

        console.log(
          'ORDER RESPONSE:',
          JSON.stringify(
            result,
            null,
            2,
          ),
        );

        /* =================================================
         * UNAUTHORIZED
         * ================================================= */

        if (
          response.status ===
          401
        ) {
          setLoginPopupVisible(
            true,
          );

          return;
        }

        /* =================================================
         * VALIDATION
         * ================================================= */

        if (
          response.status ===
            422 &&
          result?.errors
        ) {
          const validationErrors =
            Object.values(
              result.errors,
            ).flat();

          throw new Error(
            validationErrors[0] ??
              result?.message ??
              'Order validation failed.',
          );
        }

        if (
          !response.ok
        ) {
          throw new Error(
            result?.message ??
              result?.error ??
              'Unable to place your order.',
          );
        }

        if (
          result?.success ===
          false
        ) {
          throw new Error(
            result?.message ??
              'Unable to place your order.',
          );
        }

        /* =================================================
         * SUCCESS
         * ================================================= */

        const orderId =
          extractOrderId(
            result,
          );

        if (
          !orderId
        ) {
          throw new Error(
            'Order was created but the order ID was not returned by the server.',
          );
        }

        const serverOrder =
          extractServerOrder(
            result,
          );

        await saveOrderForWeeklyBilling({
          orderId,

          serverOrder,

          foodSubtotal,

          shipping,

          grandTotal,

          cart,

          notes,
        });

        /*
         * Clear cart ONLY after API success.
         */

        await AsyncStorage.removeItem(
          CART_STORAGE_KEY,
        );

        setCart(
          [],
        );

        setNotes(
          '',
        );

        setSuccessfulOrderId(
          orderId,
        );

        setOrderSuccessVisible(
          true,
        );
      } catch (
        error
      ) {
        console.log(
          'PLACE ORDER ERROR:',
          error,
        );

        Alert.alert(
          'Order Failed',

          error?.message ??
            'Unable to place your order.',
        );
      } finally {
        setPlacingOrder(
          false,
        );
      }
    };

  /* =======================================================
   * RENDER ITEM
   * ======================================================= */

  const renderItem =
    ({
      item,
    }) => {
      const quantity =
        Math.max(
          1,

          Number(
            item?.quantity ??
              1,
          ) || 1,
        );

      const unitPrice =
        getCartUnitPrice(
          item,
        );

      const customizations =
        getCartCustomizations(
          item,
        );

      const addons =
        getNormalizedOrderAddons(
          item,
        );

      const description =
        getTiffinDescription(
          item,
        );

      const foodType =
        getTiffinFoodType(
          item,
        );

      const preparationTime =
        getPreparationTime(
          item,
        );

      return (
        <View
          style={
            styles.productCard
          }
        >
          {/* ================================================= */}
          {/* TOP */}
          {/* ================================================= */}

          <View
            style={
              styles.productTop
            }
          >
            {item?.image ? (
              <Image
                source={{
                  uri:
                    item.image,
                }}
                style={
                  styles.productImage
                }
                resizeMode="cover"
              />
            ) : (
              <Image
                source={require('../assets/tiffin-2.png')}
                style={
                  styles.productImage
                }
                resizeMode="cover"
              />
            )}

            <View
              style={
                styles.productInfo
              }
            >
              <View
                style={
                  styles.titleRow
                }
              >
                <Text
                  numberOfLines={
                    2
                  }
                  style={
                    styles.productName
                  }
                >
                  {item?.name ??
                    'Tiffin'}
                </Text>

                <Text
                  style={
                    styles.productPrice
                  }
                >
                  $
                  {(
                    unitPrice *
                    quantity
                  ).toFixed(
                    2,
                  )}
                </Text>
              </View>

              {!!foodType && (
                <View
                  style={
                    styles.foodTypeBadge
                  }
                >
                  <View
                    style={
                      styles.foodTypeDot
                    }
                  />

                  <Text
                    style={
                      styles.foodTypeText
                    }
                  >
                    {String(
                      foodType,
                    ).toUpperCase()}
                  </Text>
                </View>
              )}

              {!!preparationTime && (
                <View
                  style={
                    styles.prepRow
                  }
                >
                  <Image
                    source={require('../assets/login-icons/time-left.png')}
                    style={
                      styles.smallIcon
                    }
                    resizeMode="contain"
                  />

                  <Text
                    style={
                      styles.prepText
                    }
                  >
                    {
                      preparationTime
                    }
                  </Text>
                </View>
              )}

              {!!description && (
                <Text
                  numberOfLines={
                    2
                  }
                  style={
                    styles.description
                  }
                >
                  {
                    description
                  }
                </Text>
              )}
            </View>
          </View>

          {/* ================================================= */}
          {/* CUSTOMIZATION */}
          {/* ================================================= */}

          {customizations.length >
            0 && (
            <View
              style={
                styles.detailSection
              }
            >
              <Text
                style={
                  styles.detailTitle
                }
              >
                Your Customization
              </Text>

              {customizations.map(
                (
                  selection,
                  index,
                ) => (
                  <View
                    key={`custom-${item?.cartId}-${index}`}
                    style={
                      styles.detailRow
                    }
                  >
                    <Text
                      style={
                        styles.detailLabel
                      }
                    >
                      {selection?.category ??
                        selection?.groupTitle ??
                        'Option'}
                    </Text>

                    <Text
                      style={
                        styles.detailValue
                      }
                    >
                      {selection?.name ??
                        selection?.title ??
                        'Selected'}
                    </Text>
                  </View>
                ),
              )}
            </View>
          )}

          {/* ================================================= */}
          {/* SELECTED ADD-ONS */}
          {/* ================================================= */}

          {addons.length >
            0 && (
            <View
              style={
                styles.detailSection
              }
            >
              <View
                style={
                  styles.addonHeading
                }
              >
                <Text
                  style={
                    styles.detailTitle
                  }
                >
                  Add-ons
                </Text>

                <Text
                  style={
                    styles.addonTotal
                  }
                >
                  +$
                  {getCartAddonsTotal(
                    item,
                  ).toFixed(
                    2,
                  )}
                </Text>
              </View>

              {addons.map(
                (
                  addon,
                  index,
                ) => (
                  <View
                    key={`addon-${
                      addon?.adon_id ??
                      index
                    }`}
                    style={
                      styles.addonRow
                    }
                  >
                    <View
                      style={
                        styles.addonIcon
                      }
                    >
                      <Image
                        source={require('../assets/login-icons/invoice.png')}
                        style={
                          styles.extraIcon
                        }
                        resizeMode="contain"
                      />
                    </View>

                    <Text
                      numberOfLines={
                        1
                      }
                      style={
                        styles.addonName
                      }
                    >
                      {
                        addon.name
                      }
                    </Text>

                    <Text
                      style={
                        styles.addonQty
                      }
                    >
                      ×{' '}
                      {
                        addon.quantity
                      }
                    </Text>

                    <Text
                      style={
                        styles.addonPrice
                      }
                    >
                      +$
                      {toSafeNumber(
                        addon.total,
                      ).toFixed(
                        2,
                      )}
                    </Text>
                  </View>
                ),
              )}
            </View>
          )}

          {/* ================================================= */}
          {/* CUSTOMIZE */}
          {/* ================================================= */}

          <TouchableOpacity
            activeOpacity={
              0.8
            }
            style={
              styles.customizeButton
            }
            onPress={() =>
              handleCustomizeTiffin(
                item,
              )
            }
          >
            <View
              style={
                styles.customizeIcon
              }
            >
              <Image
                source={require('../assets/login-icons/spoon-and-fork-crossed.png')}
                style={
                  styles.mediumIcon
                }
                resizeMode="contain"
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
                  styles.customizeTitle
                }
              >
                Customize Tiffin
              </Text>

              <Text
                style={
                  styles.customizeSubtitle
                }
              >
                Change items, options or add-ons
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={
                17
              }
              color="#A00B0F"
            />
          </TouchableOpacity>

          {/* ================================================= */}
          {/* QUANTITY / REMOVE */}
          {/* ================================================= */}

          <View
            style={
              styles.actions
            }
          >
            <View
              style={
                styles.quantityContainer
              }
            >
              <TouchableOpacity
                style={
                  styles.quantityButton
                }
                onPress={() =>
                  updateQuantity(
                    item.cartId,
                    -1,
                  )
                }
              >
                <Image
                  source={require('../assets/login-icons/minus.png')}
                  style={
                    styles.quantityIcon
                  }
                  resizeMode="contain"
                />
              </TouchableOpacity>

              <Text
                style={
                  styles.quantityText
                }
              >
                {
                  quantity
                }
              </Text>

              <TouchableOpacity
                style={
                  styles.quantityButton
                }
                onPress={() =>
                  updateQuantity(
                    item.cartId,
                    1,
                  )
                }
              >
                <Image
                  source={require('../assets/login-icons/add.png')}
                  style={
                    styles.quantityIcon
                  }
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={
                styles.removeButton
              }
              onPress={() =>
                removeItem(
                  item,
                )
              }
            >
              <Image
                source={require('../assets/login-icons/delete.png')}
                style={
                  styles.smallIcon
                }
                resizeMode="contain"
              />

              <Text
                style={
                  styles.removeText
                }
              >
                Remove
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    };

  /* =======================================================
   * LOADING
   * ======================================================= */

  if (
    loading
  ) {
    return (
      <SafeAreaView
        style={
          styles.loadingScreen
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
          Loading your cart...
        </Text>
      </SafeAreaView>
    );
  }

  /* =======================================================
   * UI
   * ======================================================= */

  return (
    <>
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
                resizeMode="contain"
              />
            </Pressable>

            <View
              style={
                styles.headerContent
              }
            >
              <Text
                style={
                  styles.headerEyebrow
                }
              >
                YOUR ORDER
              </Text>

              <Text
                style={
                  styles.headerTitle
                }
              >
                Cart Summary
              </Text>

              <Text
                numberOfLines={
                  1
                }
                style={
                  styles.headerLocation
                }
              >
                {
                  location
                }
              </Text>
            </View>
          </View>

          {/* ================================================= */}
          {/* EMPTY */}
          {/* ================================================= */}

          {cart.length ===
          0 ? (
            <View
              style={
                styles.emptyContainer
              }
            >
              <View
                style={
                  styles.emptyIcon
                }
              >
                <Image
                  source={require('../assets/login-icons/add-cart.png')}
                  style={
                    styles.emptyCartIcon
                  }
                  resizeMode="contain"
                />
              </View>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Your cart is empty
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Add your favourite tiffin to continue.
              </Text>

              <TouchableOpacity
                style={
                  styles.browseButton
                }
                onPress={() =>
                  navigation.navigate(
                    'MainTabs',
                  )
                }
              >
                <Text
                  style={
                    styles.browseText
                  }
                >
                  Browse Menu
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <FlatList
                data={
                  cart
                }
                renderItem={
                  renderItem
                }
                keyExtractor={(
                  item,
                  index,
                ) =>
                  String(
                    item?.cartId ??
                      index,
                  )
                }
                showsVerticalScrollIndicator={
                  false
                }
                contentContainerStyle={{
                  paddingHorizontal:
                    responsive.padding,

                  paddingBottom:
                    230,
                }}
                ListHeaderComponent={
                  <View
                    style={
                      styles.addressCard
                    }
                  >
                    <View
                      style={
                        styles.addressIcon
                      }
                    >
                      <Image
                        source={require('../assets/login-icons/location.png')}
                        style={
                          styles.mediumIcon
                        }
                        resizeMode="contain"
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
                          styles.addressTitle
                        }
                      >
                        Delivery Address
                      </Text>

                      <Text
                        numberOfLines={
                          2
                        }
                        style={
                          styles.addressText
                        }
                      >
                        {
                          location
                        }
                      </Text>
                    </View>
                  </View>
                }
                ListFooterComponent={
                  <>
                    {/* ========================================= */}
                    {/* NOTES */}
                    {/* ========================================= */}

                    <View
                      style={
                        styles.sectionCard
                      }
                    >
                      <Text
                        style={
                          styles.sectionTitle
                        }
                      >
                        Order Notes
                      </Text>

                      <TextInput
                        value={
                          notes
                        }
                        onChangeText={
                          setNotes
                        }
                        placeholder="Any special instructions?"
                        placeholderTextColor="#A69CA2"
                        multiline
                        textAlignVertical="top"
                        style={
                          styles.notesInput
                        }
                      />
                    </View>

                    {/* ========================================= */}
                    {/* BILL */}
                    {/* ========================================= */}

                    <View
                      style={
                        styles.sectionCard
                      }
                    >
                      <Text
                        style={
                          styles.sectionTitle
                        }
                      >
                        Bill Details
                      </Text>

                      <BillRow
                        label="Food Subtotal"
                        value={`$${foodSubtotal.toFixed(
                          2,
                        )}`}
                      />

                      <BillRow
                        label="Delivery Fee"
                        value={
                          shipping ===
                          0
                            ? 'FREE'
                            : `$${shipping.toFixed(
                                2,
                              )}`
                        }
                      />

                      <View
                        style={
                          styles.divider
                        }
                      />

                      <BillRow
                        total
                        label="Grand Total"
                        value={`$${grandTotal.toFixed(
                          2,
                        )}`}
                      />
                    </View>

                    {/* ========================================= */}
                    {/* WEEKLY BILLING */}
                    {/* ========================================= */}

                    <View
                      style={
                        styles.infoCard
                      }
                    >
                      <View
                        style={
                          styles.infoIcon
                        }
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={
                            20
                          }
                          color="#A00B0F"
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
                            styles.infoTitle
                          }
                        >
                          Weekly Billing
                        </Text>

                        <Text
                          style={
                            styles.infoText
                          }
                        >
                          This order will be added to your weekly total. Payment is available after the Monday invoice is generated.
                        </Text>
                      </View>
                    </View>
                  </>
                }
              />

              {/* ================================================= */}
              {/* BOTTOM */}
              {/* ================================================= */}

              <View
                style={[
                  styles.bottomBar,

                  {
                    paddingHorizontal:
                      responsive.padding,
                  },
                ]}
              >
                <View
                  style={
                    styles.bottomSummary
                  }
                >
                  <View>
                    <Text
                      style={
                        styles.bottomLabel
                      }
                    >
                      Total Amount
                    </Text>

                    <Text
                      style={
                        styles.bottomTotal
                      }
                    >
                      $
                      {grandTotal.toFixed(
                        2,
                      )}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.itemCount
                    }
                  >
                    {cart.reduce(
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
                    )}{' '}
                    item(s)
                  </Text>
                </View>

                <TouchableOpacity
                  disabled={
                    placingOrder
                  }
                  activeOpacity={
                    0.85
                  }
                  style={[
                    styles.placeOrderButton,

                    placingOrder &&
                      styles.disabledButton,
                  ]}
                  onPress={
                    handlePlaceOrder
                  }
                >
                  {placingOrder ? (
                    <>
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                      />

                      <Text
                        style={
                          styles.placeOrderText
                        }
                      >
                        Placing Order...
                      </Text>
                    </>
                  ) : (
                    <Text
                      style={
                        styles.placeOrderText
                      }
                    >
                      Place Order
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>

      {/* =======================================================
       * LOGIN MODAL
       * ======================================================= */}

      <Modal
        visible={
          loginPopupVisible
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={
          closeLoginPopup
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            <View
              style={
                styles.loginIconCircle
              }
            >
              <Ionicons
                name="person-outline"
                size={
                  30
                }
                color="#A00B0F"
              />
            </View>

            <Text
              style={
                styles.modalTitle
              }
            >
              Login Required
            </Text>

            <Text
              style={
                styles.modalDescription
              }
            >
              Please login before placing your order. Your cart will remain saved.
            </Text>

            <View
              style={
                styles.modalActions
              }
            >
              <TouchableOpacity
                style={
                  styles.cancelButton
                }
                onPress={
                  closeLoginPopup
                }
              >
                <Text
                  style={
                    styles.cancelText
                  }
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.loginButton
                }
                onPress={
                  handleLoginFromPopup
                }
              >
                <Text
                  style={
                    styles.loginText
                  }
                >
                  Login
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =======================================================
       * SUCCESS MODAL
       * ======================================================= */}

      <Modal
        visible={
          orderSuccessVisible
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            <View
              style={
                styles.successIconCircle
              }
            >
              <Ionicons
                name="checkmark"
                size={
                  40
                }
                color="#FFFFFF"
              />
            </View>

            <Text
              style={
                styles.modalTitle
              }
            >
              Order Placed Successfully!
            </Text>

            <Text
              style={
                styles.modalDescription
              }
            >
              Your order has been placed successfully and your cart is now empty.
            </Text>

            {!!successfulOrderId && (
              <View
                style={
                  styles.orderIdCard
                }
              >
                <Text
                  style={
                    styles.orderIdLabel
                  }
                >
                  ORDER ID
                </Text>

                <Text
                  style={
                    styles.orderIdText
                  }
                >
                  #
                  {
                    successfulOrderId
                  }
                </Text>
              </View>
            )}

            <View
              style={
                styles.billingNotice
              }
            >
              <Ionicons
                name="calendar-outline"
                size={
                  20
                }
                color="#A00B0F"
              />

              <Text
                style={
                  styles.billingNoticeText
                }
              >
                You do not need to pay now. Your weekly invoice will be generated on Monday.
              </Text>
            </View>

            <TouchableOpacity
              style={
                styles.homeButton
              }
              onPress={
                handleOrderSuccessContinue
              }
            >
              <Ionicons
                name="home-outline"
                size={
                  18
                }
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.homeButtonText
                }
              >
                Back to Home
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

/* =========================================================
 * BILL ROW
 * ========================================================= */

const BillRow = ({
  label,
  value,
  total = false,
}) => {
  return (
    <View
      style={
        styles.billRow
      }
    >
      <Text
        style={[
          styles.billLabel,

          total &&
            styles.billTotalLabel,
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.billValue,

          total &&
            styles.billTotalValue,
        ]}
      >
        {value}
      </Text>
    </View>
  );
};

/* =========================================================
 * STYLES
 * ========================================================= */

const styles =
  StyleSheet.create({
    safeArea: {
      flex:
        1,

      backgroundColor:
        '#F8F6FA',
    },

    screen: {
      flex:
        1,

      alignSelf:
        'center',

      backgroundColor:
        '#F8F6FA',
    },

    loadingScreen: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F8F6FA',
    },

    loadingText: {
      marginTop:
        10,

      color:
        '#817782',

      fontSize:
        11,
    },

    /* =====================================================
     * HEADER
     * ===================================================== */

    header: {
      minHeight:
        82,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF9F6',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#F0E7E3',

      paddingVertical:
        11,
    },

    backButton: {
      width:
        48,

      height:
        48,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EADFD9',

      borderRadius:
        15,
    },

    backIcon: {
      width:
        19,

      height:
        19,

      tintColor:
        '#A00B0F',
    },

    headerContent: {
      flex:
        1,

      marginLeft:
        14,

      minWidth:
        0,
    },

    headerEyebrow: {
      color:
        '#A94C2B',

      fontSize:
        8,

      fontWeight:
        '900',

      letterSpacing:
        1,
    },

    headerTitle: {
      color:
        '#241D2B',

      fontSize:
        20,

      fontWeight:
        '900',

      marginTop:
        2,
    },

    headerLocation: {
      color:
        '#91888E',

      fontSize:
        8.5,

      marginTop:
        2,
    },

    /* =====================================================
     * ADDRESS
     * ===================================================== */

    addressCard: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EEE8EF',

      borderRadius:
        15,

      padding:
        12,

      marginTop:
        13,
    },

    addressIcon: {
      width:
        42,

      height:
        42,

      borderRadius:
        13,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0F0',

      marginRight:
        11,
    },

    addressTitle: {
      color:
        '#3B3037',

      fontSize:
        9,

      fontWeight:
        '900',
    },

    addressText: {
      color:
        '#8B8187',

      fontSize:
        8,

      lineHeight:
        12,

      marginTop:
        3,
    },

    /* =====================================================
     * PRODUCT
     * ===================================================== */

    productCard: {
      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EEE8EF',

      borderRadius:
        17,

      padding:
        12,

      marginTop:
        13,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          2,
      },

      shadowOpacity:
        0.04,

      shadowRadius:
        6,

      elevation:
        2,
    },

    productTop: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',
    },

    productImage: {
      width:
        92,

      height:
        92,

      borderRadius:
        14,

      backgroundColor:
        '#F3EFF1',
    },

    productInfo: {
      flex:
        1,

      paddingLeft:
        12,

      minWidth:
        0,
    },

    titleRow: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',
    },

    productName: {
      flex:
        1,

      color:
        '#2A212C',

      fontSize:
        13,

      fontWeight:
        '900',

      lineHeight:
        18,

      paddingRight:
        8,
    },

    productPrice: {
      color:
        '#A00B0F',

      fontSize:
        13,

      fontWeight:
        '900',
    },

    description: {
      color:
        '#91878D',

      fontSize:
        8.5,

      lineHeight:
        13,

      marginTop:
        6,
    },

    foodTypeBadge: {
      alignSelf:
        'flex-start',

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#F2F8F3',

      borderRadius:
        12,

      paddingHorizontal:
        7,

      paddingVertical:
        4,

      marginTop:
        7,
    },

    foodTypeDot: {
      width:
        5,

      height:
        5,

      borderRadius:
        3,

      backgroundColor:
        '#278850',

      marginRight:
        4,
    },

    foodTypeText: {
      color:
        '#4E6B56',

      fontSize:
        7,

      fontWeight:
        '800',
    },

    prepRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      marginTop:
        5,
    },

    prepText: {
      color:
        '#82777C',

      fontSize:
        8,

      marginLeft:
        4,
    },

    smallIcon: {
      width:
        17,

      height:
        17,
    },

    mediumIcon: {
      width:
        20,

      height:
        20,
    },

    extraIcon: {
      width:
        10,

      height:
        10,
    },

    /* =====================================================
     * DETAIL SECTIONS
     * ===================================================== */

    detailSection: {
      borderTopWidth:
        1,

      borderTopColor:
        '#F1ECEF',

      marginTop:
        12,

      paddingTop:
        11,
    },

    detailTitle: {
      color:
        '#51464C',

      fontSize:
        9,

      fontWeight:
        '900',

      marginBottom:
        7,
    },

    detailRow: {
      minHeight:
        25,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    detailLabel: {
      color:
        '#978D93',

      fontSize:
        8,
    },

    detailValue: {
      flex:
        1,

      marginLeft:
        10,

      color:
        '#51464C',

      fontSize:
        8,

      fontWeight:
        '800',

      textAlign:
        'right',
    },

    addonHeading: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',
    },

    addonTotal: {
      color:
        '#A00B0F',

      fontSize:
        8,

      fontWeight:
        '900',
    },

    addonRow: {
      minHeight:
        28,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    addonIcon: {
      width:
        19,

      height:
        19,

      borderRadius:
        10,

      backgroundColor:
        '#FFF0F1',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        6,
    },

    addonName: {
      flex:
        1,

      color:
        '#5C5057',

      fontSize:
        8.5,
    },

    addonQty: {
      color:
        '#968B91',

      fontSize:
        8,

      marginHorizontal:
        8,
    },

    addonPrice: {
      color:
        '#A00B0F',

      fontSize:
        8,

      fontWeight:
        '900',
    },

    /* =====================================================
     * CUSTOMIZE
     * ===================================================== */

    customizeButton: {
      minHeight:
        54,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF8F7',

      borderWidth:
        1,

      borderColor:
        '#F0D6D4',

      borderRadius:
        13,

      paddingHorizontal:
        10,

      marginTop:
        13,
    },

    customizeIcon: {
      width:
        34,

      height:
        34,

      borderRadius:
        10,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0F1',

      marginRight:
        9,
    },

    customizeTitle: {
      color:
        '#A00B0F',

      fontSize:
        9.5,

      fontWeight:
        '900',
    },

    customizeSubtitle: {
      color:
        '#917D7E',

      fontSize:
        7,

      marginTop:
        2,
    },

    /* =====================================================
     * ACTIONS
     * ===================================================== */

    actions: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      borderTopWidth:
        1,

      borderTopColor:
        '#F1ECEF',

      marginTop:
        11,

      paddingTop:
        11,
    },

    quantityContainer: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF5F5',

      borderWidth:
        1,

      borderColor:
        '#F2DADB',

      borderRadius:
        10,
    },

    quantityButton: {
      width:
        34,

      height:
        32,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    quantityIcon: {
      width:
        16,

      height:
        16,
    },

    quantityText: {
      minWidth:
        28,

      color:
        '#3D3035',

      fontSize:
        11,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    removeButton: {
      minHeight:
        34,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF4F4',

      borderRadius:
        10,

      paddingHorizontal:
        10,
    },

    removeText: {
      color:
        '#D34848',

      fontSize:
        8,

      fontWeight:
        '800',

      marginLeft:
        4,
    },

    /* =====================================================
     * SECTIONS
     * ===================================================== */

    sectionCard: {
      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EEE8EF',

      borderRadius:
        15,

      padding:
        13,

      marginTop:
        13,
    },

    sectionTitle: {
      color:
        '#312632',

      fontSize:
        11,

      fontWeight:
        '900',

      marginBottom:
        10,
    },

    notesInput: {
      minHeight:
        80,

      color:
        '#3D3338',

      fontSize:
        9,

      textAlignVertical:
        'top',

      backgroundColor:
        '#FAF7F8',

      borderWidth:
        1,

      borderColor:
        '#ECE5E8',

      borderRadius:
        12,

      padding:
        11,
    },

    /* =====================================================
     * BILL
     * ===================================================== */

    billRow: {
      minHeight:
        30,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    billLabel: {
      color:
        '#81767D',

      fontSize:
        9,
    },

    billValue: {
      color:
        '#3E343A',

      fontSize:
        9,

      fontWeight:
        '800',
    },

    billTotalLabel: {
      color:
        '#271E29',

      fontSize:
        11,

      fontWeight:
        '900',
    },

    billTotalValue: {
      color:
        '#A00B0F',

      fontSize:
        15,

      fontWeight:
        '900',
    },

    divider: {
      height:
        1,

      backgroundColor:
        '#ECE6EA',

      marginVertical:
        7,
    },

    /* =====================================================
     * INFO
     * ===================================================== */

    infoCard: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF4F4',

      borderWidth:
        1,

      borderColor:
        '#F1DCDD',

      borderRadius:
        14,

      padding:
        11,

      marginTop:
        13,
    },

    infoIcon: {
      width:
        40,

      height:
        40,

      borderRadius:
        12,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFE6E7',

      marginRight:
        10,
    },

    infoTitle: {
      color:
        '#6F2629',

      fontSize:
        9,

      fontWeight:
        '900',
    },

    infoText: {
      color:
        '#836A6C',

      fontSize:
        7.5,

      lineHeight:
        12,

      marginTop:
        3,
    },

    /* =====================================================
     * BOTTOM BAR
     * ===================================================== */

    bottomBar: {
      position:
        'absolute',

      left:
        0,

      right:
        0,

      bottom:
        0,

      backgroundColor:
        '#FFFFFF',

      paddingTop:
        10,

      paddingBottom:
        13,

      borderTopWidth:
        1,

      borderTopColor:
        '#ECE7EA',

      elevation:
        10,
    },

    bottomSummary: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom:
        9,
    },

    bottomLabel: {
      color:
        '#8A8086',

      fontSize:
        8,
    },

    bottomTotal: {
      color:
        '#A00B0F',

      fontSize:
        17,

      fontWeight:
        '900',

      marginTop:
        2,
    },

    itemCount: {
      color:
        '#8A8086',

      fontSize:
        8,

      fontWeight:
        '700',
    },

    placeOrderButton: {
      minHeight:
        53,

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

      gap:
        8,
    },

    placeOrderText: {
      color:
        '#FFFFFF',

      fontSize:
        12,

      fontWeight:
        '900',
    },

    disabledButton: {
      opacity:
        0.6,
    },

    /* =====================================================
     * EMPTY
     * ===================================================== */

    emptyContainer: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        25,
    },

    emptyIcon: {
      width:
        95,

      height:
        95,

      borderRadius:
        48,

      backgroundColor:
        '#FFF0F0',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    emptyCartIcon: {
      width:
        50,

      height:
        50,
    },

    emptyTitle: {
      color:
        '#302734',

      fontSize:
        18,

      fontWeight:
        '900',

      marginTop:
        16,
    },

    emptyText: {
      color:
        '#887F8C',

      fontSize:
        10,

      marginTop:
        6,

      textAlign:
        'center',
    },

    browseButton: {
      backgroundColor:
        '#A00B0F',

      borderRadius:
        12,

      paddingHorizontal:
        23,

      paddingVertical:
        13,

      marginTop:
        18,
    },

    browseText: {
      color:
        '#FFFFFF',

      fontSize:
        10,

      fontWeight:
        '900',
    },

    /* =====================================================
     * MODALS
     * ===================================================== */

    modalOverlay: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(24,17,20,0.65)',

      paddingHorizontal:
        22,
    },

    modalCard: {
      width:
        '100%',

      maxWidth:
        380,

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        24,

      paddingHorizontal:
        22,

      paddingTop:
        27,

      paddingBottom:
        22,
    },

    loginIconCircle: {
      width:
        78,

      height:
        78,

      borderRadius:
        39,

      backgroundColor:
        '#FFF0F1',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginBottom:
        15,
    },

    successIconCircle: {
      width:
        72,

      height:
        72,

      borderRadius:
        36,

      backgroundColor:
        '#2B965C',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginBottom:
        16,
    },

    modalTitle: {
      color:
        '#241D2B',

      fontSize:
        19,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    modalDescription: {
      color:
        '#756B72',

      fontSize:
        10,

      lineHeight:
        17,

      textAlign:
        'center',

      marginTop:
        7,
    },

    modalActions: {
      width:
        '100%',

      flexDirection:
        'row',

      marginTop:
        20,
    },

    cancelButton: {
      flex:
        1,

      minHeight:
        48,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F8F4F5',

      borderRadius:
        12,

      marginRight:
        5,
    },

    cancelText: {
      color:
        '#6D6268',

      fontSize:
        10,

      fontWeight:
        '900',
    },

    loginButton: {
      flex:
        1,

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

      marginLeft:
        5,
    },

    loginText: {
      color:
        '#FFFFFF',

      fontSize:
        10,

      fontWeight:
        '900',
    },

    orderIdCard: {
      minWidth:
        145,

      alignItems:
        'center',

      backgroundColor:
        '#FFF6F6',

      borderWidth:
        1,

      borderColor:
        '#F0DFDF',

      borderRadius:
        13,

      paddingHorizontal:
        18,

      paddingVertical:
        11,

      marginTop:
        16,
    },

    orderIdLabel: {
      color:
        '#9A898F',

      fontSize:
        7,

      fontWeight:
        '900',

      letterSpacing:
        1,
    },

    orderIdText: {
      color:
        '#A00B0F',

      fontSize:
        15,

      fontWeight:
        '900',

      marginTop:
        4,
    },

    billingNotice: {
      width:
        '100%',

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF4F4',

      borderRadius:
        13,

      padding:
        11,

      marginTop:
        15,

      gap:
        10,
    },

    billingNoticeText: {
      flex:
        1,

      color:
        '#785D60',

      fontSize:
        8.5,

      lineHeight:
        14,
    },

    homeButton: {
      width:
        '100%',

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
        13,

      marginTop:
        18,

      gap:
        8,
    },

    homeButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        10.5,

      fontWeight:
        '900',
    },
  });

export default Order;