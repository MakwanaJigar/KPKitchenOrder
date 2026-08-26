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

import {
  useStripe,
} from '@stripe/stripe-react-native';

/* =========================================================
 * APIs
 * ========================================================= */

const ORDER_API =
  'https://replete-software.com/projects/kp_admin/api/customer/orders';

const PROFILE_API =
  'https://replete-software.com/projects/kp_admin/api/customer/profile';

/* =========================================================
 * Confirm Order API
 *
 * POST:
 * /api/customer/orders/{id}/confirm
 * ========================================================= */

const getConfirmOrderApi = orderId =>
  `https://replete-software.com/projects/kp_admin/api/customer/orders/${orderId}/confirm`;

/* =========================================================
 * Storage
 * ========================================================= */

const CART_STORAGE_KEY =
  'kp_customer_cart';

/* =========================================================
 * Safe Stripe Debug Logging
 *
 * Prevents complete Stripe client secret from appearing
 * in Metro logs.
 * ========================================================= */

const maskSensitiveStripeData =
  value => {
    try {
      return JSON.stringify(
        value,
        (
          key,
          currentValue,
        ) => {
          const normalizedKey =
            String(
              key,
            ).toLowerCase();

          if (
            normalizedKey.includes(
              'secret',
            ) &&
            typeof currentValue ===
              'string'
          ) {
            if (
              currentValue.length <=
              12
            ) {
              return '***MASKED***';
            }

            return `${currentValue.slice(
              0,
              12,
            )}...MASKED`;
          }

          return currentValue;
        },
        2,
      );
    } catch (
      error
    ) {
      return '[Unable to stringify response]';
    }
  };

/* =========================================================
 * Extract Order ID
 *
 * ACTUAL BACKEND RESPONSE:
 *
 * {
 *   "order": {
 *      "id": "ORDYTUOQGTT"
 *   }
 * }
 * ========================================================= */

const extractOrderId =
  result => {
    const orderId =
      result?.order?.id ??
      null;

    console.log(
      'EXTRACTED ORDER ID:',
      orderId,
    );

    return orderId;
  };

/* =========================================================
 * Extract Stripe Client Secret
 *
 * ACTUAL BACKEND RESPONSE:
 *
 * {
 *   "stripe_client_secret":
 *      "pi_xxx_secret_xxx"
 * }
 * ========================================================= */

const extractStripeClientSecret =
  result => {
    const clientSecret =
      typeof result
        ?.stripe_client_secret ===
      'string'
        ? result
            .stripe_client_secret
            .trim()
        : null;

    console.log(
      '==============================================',
    );

    console.log(
      'EXTRACTED STRIPE CLIENT SECRET:',
      clientSecret
        ? 'FOUND ✅'
        : 'NOT FOUND ❌',
    );

    console.log(
      '==============================================',
    );

    return clientSecret;
  };

/* =========================================================
 * Extract Payment Intent ID
 *
 * ACTUAL BACKEND RESPONSE:
 *
 * {
 *   "payment_intent_id":
 *      "pi_xxxxxxxxx"
 * }
 * ========================================================= */

const extractPaymentIntentId =
  result => {
    const paymentIntentId =
      result
        ?.payment_intent_id ??
      result?.order
        ?.payment_intent_id ??
      null;

    console.log(
      'PAYMENT INTENT ID:',
      paymentIntentId,
    );

    return paymentIntentId;
  };

/* =========================================================
 * Default Tiffin Items
 * ========================================================= */

const getDefaultTiffinItems =
  cartItem => {
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
          /* =============================================
           * String Item
           * ============================================= */

          if (
            typeof value ===
            'string'
          ) {
            return {
              id:
                `default-${index}`,

              name:
                value,

              quantity:
                null,

              price:
                null,
            };
          }

          /* =============================================
           * Object Item
           * ============================================= */

          if (
            value &&
            typeof value ===
              'object'
          ) {
            const nestedItem =
              value?.item ??
              value
                ?.food_item ??
              value?.product ??
              {};

            return {
              ...value,

              id:
                value?.id ??
                value?.item_id ??
                nestedItem?.id ??
                `default-${index}`,

              name:
                value?.name ??
                value
                  ?.item_name ??
                value?.title ??
                value
                  ?.food_name ??
                value
                  ?.food_item_name ??
                value
                  ?.product_name ??
                nestedItem?.name ??
                nestedItem?.title ??
                `Item ${index + 1}`,

              quantity:
                value?.quantity ??
                value?.qty ??
                value?.pivot
                  ?.quantity ??
                value?.pivot
                  ?.qty ??
                null,

              price:
                value?.price ??
                value?.pivot
                  ?.price ??
                nestedItem?.price ??
                null,
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
 * Description
 * ========================================================= */

const getTiffinDescription =
  item => {
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
 * Category
 * ========================================================= */

const getTiffinCategory =
  item => {
    const original =
      item?.originalTiffin ??
      {};

    if (
      original?.category &&
      typeof original
        .category ===
        'object'
    ) {
      return (
        original.category
          ?.name ??
        original.category
          ?.title ??
        item?.category ??
        ''
      );
    }

    return (
      item?.category ??
      original
        ?.category_name ??
      original?.category ??
      ''
    );
  };

/* =========================================================
 * Food Type
 * ========================================================= */

const getTiffinFoodType =
  item => {
    return (
      item?.foodType ??
      item?.originalTiffin
        ?.food_type ??
      item?.originalTiffin
        ?.foodType ??
      ''
    );
  };

/* =========================================================
 * Preparation Time
 * ========================================================= */

const getPreparationTime =
  item => {
    return (
      item?.preparationTime ??
      item?.originalTiffin
        ?.preparation_time ??
      item?.originalTiffin
        ?.prep_time ??
      ''
    );
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
   * Stripe
   * ======================================================= */

  const {
    initPaymentSheet,
    presentPaymentSheet,
  } =
    useStripe();

  /* =======================================================
   * State
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
    paymentProcessing,
    setPaymentProcessing,
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
    success,
    setSuccess,
  ] =
    useState(false);

  const [
    loginPopupVisible,
    setLoginPopupVisible,
  ] =
    useState(false);

  /* =======================================================
   * Responsive
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
   * Normalize Cart
   * ======================================================= */

  const normalizeCart =
    items => {
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
          const parsedPrice =
            Number(
              item
                ?.subtotal ??
                item
                  ?.rawPrice ??
                item
                  ?.basePrice ??
                String(
                  item?.price ??
                    0,
                ).replace(
                  /[^\d.]/g,
                  '',
                ),
            );

          return {
            ...item,

            cartId:
              item?.cartId ??
              `cart-${item?.id ?? index}-${index}`,

            tiffinId:
              item?.tiffinId ??
              item
                ?.productId ??
              item?.id,

            quantity:
              Number(
                item
                  ?.quantity ??
                  1,
              ),

            subtotal:
              Number.isNaN(
                parsedPrice,
              )
                ? 0
                : parsedPrice,

            selections:
              Array.isArray(
                item
                  ?.selections,
              )
                ? item
                    .selections
                : [],

            extras:
              Array.isArray(
                item?.extras,
              )
                ? item.extras
                : [],
          };
        },
      );
    };

  /* =======================================================
   * Load Cart
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
          setCart([]);

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

        setCart([]);
      } finally {
        setLoading(
          false,
        );
      }
    };

  /* =======================================================
   * Load Profile
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

        const text =
          await response.text();

        let result;

        try {
          result =
            JSON.parse(
              text,
            );
        } catch (
          error
        ) {
          console.log(
            'PROFILE JSON ERROR:',
            error,
          );

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
          result
            ?.customer ??
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

        /* =============================================
         * String Address
         * ============================================= */

        if (
          !address &&
          typeof profile
            ?.address ===
            'string'
        ) {
          address =
            profile.address;
        }

        /* =============================================
         * Address Object
         * ============================================= */

        if (
          !address &&
          profile
            ?.address &&
          typeof profile
            .address ===
            'object'
        ) {
          address =
            [
              profile.address
                ?.address_line_1,

              profile.address
                ?.address_line_2,

              profile.address
                ?.street,

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
              .join(
                ', ',
              );
        }

        /* =============================================
         * Flat Address Fields
         * ============================================= */

        if (
          !address
        ) {
          address =
            [
              profile
                ?.address_line_1,

              profile
                ?.address_line_2,

              profile?.street,

              profile?.city,

              profile?.state,

              profile
                ?.postcode ??
                profile
                  ?.pincode,
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
   * Initial Load
   * ======================================================= */

  useEffect(() => {
    loadCart();

    loadProfile();
  }, []);

  /* =======================================================
   * Refresh On Focus
   * ======================================================= */

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
   * Update Quantity
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
                item
                  .cartId !==
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
                      item
                        .quantity ??
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
   * Remove Item
   * ======================================================= */

  const removeItem =
    item => {
      Alert.alert(
        'Remove Item',

        `Remove ${item.name} from your cart?`,

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
                        value
                          .cartId !==
                        item
                          .cartId,
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
                    'REMOVE ITEM ERROR:',
                    error,
                  );
                }
              },
          },
        ],
      );
    };

  /* =======================================================
   * Food Subtotal
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
              Number(
                item
                  .quantity ??
                  1,
              );

            const price =
              Number(
                item
                  .subtotal ??
                  item
                    .rawPrice ??
                  item
                    .basePrice ??
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
      },
      [
        cart,
      ],
    );

  /* =======================================================
   * Delivery Fee
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

  /* =======================================================
   * Grand Total
   * ======================================================= */

  const grandTotal =
    foodSubtotal +
    shipping;

  /* =======================================================
   * Login Popup
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
   * CONFIRM PAYMENT WITH LARAVEL
   * ======================================================= */

  const confirmOrderPayment =
    async ({
      orderId,
      token,
    }) => {
      const confirmApi =
        getConfirmOrderApi(
          orderId,
        );

      console.log(
        '==============================================',
      );

      console.log(
        'CONFIRM ORDER API:',
        confirmApi,
      );

      const response =
        await fetch(
          confirmApi,
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
            'RAW CONFIRM RESPONSE:',
            responseText,
          );

          throw new Error(
            'Invalid response from payment confirmation server.',
          );
        }
      }

      console.log(
        'CONFIRM ORDER HTTP STATUS:',
        response.status,
      );

      console.log(
        'CONFIRM ORDER RESPONSE:',
        JSON.stringify(
          result,
          null,
          2,
        ),
      );

      console.log(
        '==============================================',
      );

      /* =============================================
       * Unauthorized
       * ============================================= */

      if (
        response.status ===
        401
      ) {
        setLoginPopupVisible(
          true,
        );

        throw new Error(
          'Your session has expired. Please login again.',
        );
      }

      /* =============================================
       * Validation
       * ============================================= */

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
            'Payment confirmation failed.',
        );
      }

      /* =============================================
       * Backend Error
       * ============================================= */

      if (
        !response.ok
      ) {
        throw new Error(
          result?.message ??
            result?.error ??
            'Payment was completed but the order could not be confirmed.',
        );
      }

      return result;
    };

  /* =======================================================
   * OPEN STRIPE PAYMENT SHEET
   * ======================================================= */

  const openStripePayment =
    async ({
      clientSecret,
      orderId,
      token,
    }) => {
      try {
        setPaymentProcessing(
          true,
        );

        console.log(
          '==============================================',
        );

        console.log(
          'INITIALIZING STRIPE PAYMENT SHEET',
        );

        console.log(
          'ORDER ID:',
          orderId,
        );

        console.log(
          'CLIENT SECRET AVAILABLE:',
          Boolean(
            clientSecret,
          ),
        );

        console.log(
          '==============================================',
        );

        /* =============================================
         * Initialize PaymentSheet
         * ============================================= */

        const {
          error:
            initError,
        } =
          await initPaymentSheet({
            merchantDisplayName:
              'KP Cloud Kitchen',

            paymentIntentClientSecret:
              clientSecret,

            allowsDelayedPaymentMethods:
              false,

            appearance: {
              shapes: {
                borderRadius:
                  12,
              },
            },
          });

        if (
          initError
        ) {
          console.log(
            'STRIPE INIT ERROR:',
            initError,
          );

          throw new Error(
            initError?.message ??
              'Unable to initialize payment.',
          );
        }

        /* =============================================
         * Open PaymentSheet
         * ============================================= */

        console.log(
          'OPENING STRIPE PAYMENT SHEET',
        );

        const {
          error:
            paymentSheetError,
        } =
          await presentPaymentSheet();

        /* =============================================
         * Stripe Error / Cancel
         * ============================================= */

        if (
          paymentSheetError
        ) {
          console.log(
            'STRIPE PAYMENT SHEET ERROR:',
            paymentSheetError,
          );

          const paymentCode =
            String(
              paymentSheetError
                ?.code ??
                '',
            ).toLowerCase();

          if (
            paymentCode ===
              'canceled' ||
            paymentCode ===
              'cancelled'
          ) {
            return {
              success:
                false,

              cancelled:
                true,
            };
          }

          throw new Error(
            paymentSheetError
              ?.message ??
              'Your card payment failed.',
          );
        }

        /* =============================================
         * Stripe Success
         * ============================================= */

        console.log(
          'STRIPE PAYMENT COMPLETE ✅',
        );

        /* =============================================
         * Confirm On Backend
         * ============================================= */

        const confirmation =
          await confirmOrderPayment({
            orderId,

            token,
          });

        console.log(
          'BACKEND PAYMENT CONFIRMED ✅',
        );

        return {
          success:
            true,

          orderId,

          confirmation,
        };
      } catch (
        error
      ) {
        console.log(
          'OPEN STRIPE PAYMENT ERROR:',
          error,
        );

        throw error;
      } finally {
        setPaymentProcessing(
          false,
        );
      }
    };

  /* =======================================================
   * PLACE ORDER / INITIATE STRIPE
   * ======================================================= */

  const handlePlaceOrder =
    async () => {
      if (
        placingOrder ||
        paymentProcessing
      ) {
        return;
      }

      /* =============================================
       * Empty Cart
       * ============================================= */

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
        /* =============================================
         * Authentication
         * ============================================= */

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

        /* =============================================
         * Build Items
         * ============================================= */

        const orderItems =
          cart.map(
            item => {
              const defaultItems =
                getDefaultTiffinItems(
                  item,
                );

              return {
                tiffin_id:
                  Number(
                    item
                      ?.tiffinId ??
                      item
                        ?.productId ??
                      item?.id,
                  ),

                quantity:
                  Number(
                    item
                      ?.quantity ??
                      1,
                  ),

                price:
                  Number(
                    item
                      ?.subtotal ??
                      item
                        ?.rawPrice ??
                      item
                        ?.basePrice ??
                      0,
                  ),

                default_items:
                  defaultItems,

                customizations:
                  item
                    ?.selections ??
                  [],

                extras:
                  item
                    ?.extras ??
                  [],
              };
            },
          );

        /* =============================================
         * Payload
         * ============================================= */

        const payload = {
          items:
            orderItems,

          order_notes:
            notes,

          notes,

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

          payment_method:
            'stripe',

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

        console.log(
          '==============================================',
        );

        console.log(
          'STRIPE ORDER INITIATE PAYLOAD:',
        );

        console.log(
          JSON.stringify(
            payload,
            null,
            2,
          ),
        );

        console.log(
          '==============================================',
        );

        /* =============================================
         * STEP 1: Initiate Order + PaymentIntent
         * ============================================= */

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
            'RAW ORDER RESPONSE:',
            responseText,
          );

          throw new Error(
            'Invalid response from order server.',
          );
        }

        /* =============================================
         * Actual Backend Response Debugging
         * ============================================= */

        console.log(
          '==============================================',
        );

        console.log(
          'ORDER INITIATE RESPONSE:',
        );

        console.log(
          maskSensitiveStripeData(
            result,
          ),
        );

        console.log(
          'HTTP STATUS:',
          response.status,
        );

        console.log(
          'SUCCESS:',
          result?.success,
        );

        console.log(
          'MESSAGE:',
          result?.message,
        );

        console.log(
          'ORDER ID FROM RESPONSE:',
          result?.order?.id,
        );

        console.log(
          'ORDER STATUS:',
          result?.order
            ?.status,
        );

        console.log(
          'PAYMENT INTENT ID:',
          result
            ?.payment_intent_id,
        );

        console.log(
          'HAS CLIENT SECRET:',
          Boolean(
            result
              ?.stripe_client_secret,
          ),
        );

        console.log(
          '==============================================',
        );

        /* =============================================
         * Unauthorized
         * ============================================= */

        if (
          response.status ===
          401
        ) {
          setLoginPopupVisible(
            true,
          );

          return;
        }

        /* =============================================
         * Validation
         * ============================================= */

        if (
          response.status ===
            422 &&
          result?.errors
        ) {
          const errors =
            Object.values(
              result.errors,
            ).flat();

          throw new Error(
            errors[0] ??
              result?.message ??
              'Order validation failed.',
          );
        }

        /* =============================================
         * Other HTTP Error
         * ============================================= */

        if (
          !response.ok
        ) {
          throw new Error(
            result?.message ??
              result?.error ??
              'Unable to initiate payment.',
          );
        }

        if (
          result?.success ===
          false
        ) {
          throw new Error(
            result?.message ??
              'Unable to initiate payment.',
          );
        }

        /* =============================================
         * ACTUAL BACKEND VALUES
         * ============================================= */

        const orderId =
          extractOrderId(
            result,
          );

        const clientSecret =
          extractStripeClientSecret(
            result,
          );

        const paymentIntentId =
          extractPaymentIntentId(
            result,
          );

        console.log(
          '==============================================',
        );

        console.log(
          'ORDER ID:',
          orderId,
        );

        console.log(
          'PAYMENT INTENT ID:',
          paymentIntentId,
        );

        console.log(
          'STRIPE CLIENT SECRET RECEIVED:',
          Boolean(
            clientSecret,
          ),
        );

        console.log(
          '==============================================',
        );

        /* =============================================
         * Validate Order ID
         * ============================================= */

        if (
          !orderId
        ) {
          throw new Error(
            'Order was created but the order ID was not returned by the server.',
          );
        }

        /* =============================================
         * Validate Client Secret
         * ============================================= */

        if (
          !clientSecret
        ) {
          throw new Error(
            'Stripe client secret was not returned by the server.',
          );
        }

        if (
          !clientSecret.startsWith(
            'pi_',
          ) ||
          !clientSecret.includes(
            '_secret_',
          )
        ) {
          throw new Error(
            'Invalid Stripe PaymentIntent client secret returned by the server.',
          );
        }

        /*
         * IMPORTANT:
         *
         * DO NOT clear cart here.
         *
         * Backend order is currently:
         *
         * Payment Pending
         */

        setPlacingOrder(
          false,
        );

        /* =============================================
         * STEP 2 + 3
         *
         * Stripe Payment +
         * Laravel Confirmation
         * ============================================= */

        const paymentResult =
          await openStripePayment({
            clientSecret,

            orderId,

            token,
          });

        /* =============================================
         * Customer Cancelled Payment
         * ============================================= */

        if (
          paymentResult
            ?.cancelled
        ) {
          console.log(
            'CUSTOMER CANCELLED STRIPE PAYMENT',
          );

          /*
           * Keep cart.
           */

          return;
        }

        if (
          !paymentResult
            ?.success
        ) {
          return;
        }

        /* =============================================
         * SUCCESS
         *
         * Stripe succeeded +
         * backend confirm succeeded.
         *
         * NOW clear the cart.
         * ============================================= */

        await AsyncStorage.removeItem(
          CART_STORAGE_KEY,
        );

        setCart([]);

        setNotes('');

        setSuccess(
          true,
        );
      } catch (
        error
      ) {
        console.log(
          '==============================================',
        );

        console.log(
          'ORDER / STRIPE ERROR:',
          error,
        );

        console.log(
          '==============================================',
        );

        Alert.alert(
          'Payment Failed',

          error?.message ??
            'Unable to process your payment.',
        );
      } finally {
        setPlacingOrder(
          false,
        );
      }
    };

  /* =======================================================
   * Render Cart Item
   * ======================================================= */

  const renderItem =
    ({
      item,
    }) => {
      const quantity =
        Number(
          item?.quantity ??
            1,
        );

      const price =
        Number(
          item?.subtotal ??
            item?.rawPrice ??
            item?.basePrice ??
            0,
        );

      const defaultItems =
        getDefaultTiffinItems(
          item,
        );

      const description =
        getTiffinDescription(
          item,
        );

      const category =
        getTiffinCategory(
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

      const isCustomized =
        item?.isCustomized ===
          true ||
        item?.selections
          ?.length >
          0 ||
        item?.extras
          ?.length >
          0;

      return (
        <View
          style={
            styles.productCard
          }
        >
          {/* ========================================= */}
          {/* Product Top */}
          {/* ========================================= */}

          <View
            style={
              styles.productTopSection
            }
          >
            {/* Product Image */}

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

            {/* Product Information */}

            <View
              style={
                styles.productInfo
              }
            >
              <View
                style={
                  styles.productTitleRow
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
                    price *
                    quantity
                  ).toFixed(
                    2,
                  )}
                </Text>
              </View>

              {/* Meta */}

              <View
                style={
                  styles.productMetaContainer
                }
              >
                {!!foodType && (
                  <View
                    style={
                      styles.productMetaBadge
                    }
                  >
                    <Text
                      style={
                        styles.productMetaText
                      }
                    >
                      {String(
                        foodType,
                      ).toUpperCase()}
                    </Text>
                  </View>
                )}

                {!!category && (
                  <View
                    style={
                      styles.productMetaBadge
                    }
                  >
                    <Text
                      style={
                        styles.productMetaText
                      }
                    >
                      {
                        category
                      }
                    </Text>
                  </View>
                )}

                {!!preparationTime && (
                  <View
                    style={
                      styles.productMetaBadge
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={
                        11
                      }
                      color="#A00B0F"
                    />

                    <Text
                      style={[
                        styles.productMetaText,

                        {
                          marginLeft:
                            3,
                        },
                      ]}
                    >
                      {
                        preparationTime
                      }
                    </Text>
                  </View>
                )}
              </View>

              {/* Description */}

              {!!description && (
                <Text
                  numberOfLines={
                    3
                  }
                  style={
                    styles.productDescription
                  }
                >
                  {
                    description
                  }
                </Text>
              )}

              {/* Customized */}

              {isCustomized && (
                <View
                  style={
                    styles.customizedBadge
                  }
                >
                  <Ionicons
                    name="options-outline"
                    size={
                      11
                    }
                    color="#A00B0F"
                  />

                  <Text
                    style={
                      styles.customizedBadgeText
                    }
                  >
                    Customized
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ========================================= */}
          {/* Default Items */}
          {/* ========================================= */}

          {defaultItems.length >
            0 && (
            <View
              style={
                styles.detailSection
              }
            >
              <Text
                style={
                  styles.detailSectionTitle
                }
              >
                Included in this Tiffin
              </Text>

              {defaultItems.map(
                (
                  defaultItem,
                  index,
                ) => (
                  <View
                    key={`${item.cartId}-default-${index}`}
                    style={
                      styles.defaultItemRow
                    }
                  >
                    <View
                      style={
                        styles.checkCircle
                      }
                    >
                      <Ionicons
                        name="checkmark"
                        size={
                          10
                        }
                        color="#FFFFFF"
                      />
                    </View>

                    <Text
                      style={
                        styles.defaultItemName
                      }
                    >
                      {
                        defaultItem.name
                      }
                    </Text>

                    {defaultItem.quantity !==
                      null &&
                    defaultItem.quantity !==
                      undefined ? (
                      <Text
                        style={
                          styles.defaultItemQuantity
                        }
                      >
                        ×{' '}
                        {
                          defaultItem.quantity
                        }
                      </Text>
                    ) : null}
                  </View>
                ),
              )}
            </View>
          )}

          {/* ========================================= */}
          {/* Customizations */}
          {/* ========================================= */}

          {!!item?.selections
            ?.length && (
            <View
              style={
                styles.detailSection
              }
            >
              <Text
                style={
                  styles.detailSectionTitle
                }
              >
                Your Customization
              </Text>

              {item.selections.map(
                (
                  selection,
                  index,
                ) => (
                  <View
                    key={`${item.cartId}-selection-${index}`}
                    style={
                      styles.customizationRow
                    }
                  >
                    <Text
                      style={
                        styles.customizationCategory
                      }
                    >
                      {selection?.category ??
                        'Item'}
                    </Text>

                    <Text
                      style={
                        styles.customizationValue
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

          {/* ========================================= */}
          {/* Extras */}
          {/* ========================================= */}

          {!!item?.extras
            ?.length && (
            <View
              style={
                styles.detailSection
              }
            >
              <Text
                style={
                  styles.detailSectionTitle
                }
              >
                Extra Items
              </Text>

              {item.extras.map(
                (
                  extra,
                  index,
                ) => {
                  const extraQuantity =
                    Number(
                      extra
                        ?.quantity ??
                        1,
                    );

                  const extraPrice =
                    Number(
                      extra
                        ?.price ??
                        0,
                    );

                  return (
                    <View
                      key={`${item.cartId}-extra-${index}`}
                      style={
                        styles.extraRow
                      }
                    >
                      <Text
                        style={
                          styles.extraPlus
                        }
                      >
                        +
                      </Text>

                      <Text
                        style={
                          styles.extraName
                        }
                      >
                        {extra?.name ??
                          'Extra Item'}
                      </Text>

                      <Text
                        style={
                          styles.extraQuantity
                        }
                      >
                        ×{' '}
                        {
                          extraQuantity
                        }
                      </Text>

                      {extraPrice >
                        0 && (
                        <Text
                          style={
                            styles.extraPrice
                          }
                        >
                          +$
                          {(
                            extraPrice *
                            extraQuantity
                          ).toFixed(
                            2,
                          )}
                        </Text>
                      )}
                    </View>
                  );
                },
              )}
            </View>
          )}

          {/* ========================================= */}
          {/* Quantity + Remove */}
          {/* ========================================= */}

          <View
            style={
              styles.productActionsSection
            }
          >
            <View
              style={
                styles.quantity
              }
            >
              <Pressable
                style={
                  styles.qtyButton
                }
                onPress={() =>
                  updateQuantity(
                    item.cartId,
                    -1,
                  )
                }
              >
                <Ionicons
                  name="remove"
                  size={
                    15
                  }
                  color="#A00B0F"
                />
              </Pressable>

              <Text
                style={
                  styles.qtyValue
                }
              >
                {
                  quantity
                }
              </Text>

              <Pressable
                style={
                  styles.qtyButton
                }
                onPress={() =>
                  updateQuantity(
                    item.cartId,
                    1,
                  )
                }
              >
                <Ionicons
                  name="add"
                  size={
                    15
                  }
                  color="#A00B0F"
                />
              </Pressable>
            </View>

            <Pressable
              style={
                styles.removeButton
              }
              onPress={() =>
                removeItem(
                  item,
                )
              }
            >
              <Ionicons
                name="trash-outline"
                size={
                  13
                }
                color="#D44D4D"
              />

              <Text
                style={
                  styles.removeText
                }
              >
                Remove
              </Text>
            </Pressable>
          </View>
        </View>
      );
    };

  /* =======================================================
   * Loading Screen
   * ======================================================= */

  if (
    loading
  ) {
    return (
      <SafeAreaView
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
          Loading your cart...
        </Text>
      </SafeAreaView>
    );
  }

  /* =======================================================
   * Render
   * ======================================================= */

  return (
    <>
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FFFFFF"
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
          {/* ========================================= */}
          {/* Header */}
          {/* ========================================= */}

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
                  styles.headerIcon
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

          {/* ========================================= */}
          {/* Empty Cart */}
          {/* ========================================= */}

          {cart.length ===
          0 ? (
            <View
              style={
                styles.empty
              }
            >
              <Ionicons
                name="cart-outline"
                size={
                  60
                }
                color="#C8BDC8"
              />

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
                Add a delicious tiffin to get started.
              </Text>

              <TouchableOpacity
                style={
                  styles.shopButton
                }
                activeOpacity={
                  0.85
                }
                onPress={() =>
                  navigation.navigate(
                    'MainTabs',
                  )
                }
              >
                <Text
                  style={
                    styles.shopButtonText
                  }
                >
                  Browse Tiffins
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={
                cart
              }
              keyExtractor={(
                item,
                index,
              ) =>
                String(
                  item.cartId ??
                    index,
                )
              }
              renderItem={
                renderItem
              }
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={{
                paddingHorizontal:
                  responsive.padding,

                paddingTop:
                  14,

                paddingBottom:
                  230,
              }}
              ListFooterComponent={
                <>
                  {/* ================================= */}
                  {/* Order Notes */}
                  {/* ================================= */}

                  <View
                    style={
                      styles.section
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
                      multiline
                      placeholder="Add any special instructions..."
                      placeholderTextColor="#AAA1AE"
                      style={
                        styles.notes
                      }
                    />
                  </View>

                  {/* ================================= */}
                  {/* Delivery Address */}
                  {/* ================================= */}

                  <Pressable
                    style={
                      styles.section
                    }
                    onPress={
                      async () => {
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

                        navigation.navigate(
                          'AddressList',
                        );
                      }
                    }
                  >
                    <View
                      style={
                        styles.sectionHeader
                      }
                    >
                      <Text
                        style={
                          styles.sectionTitleNoMargin
                        }
                      >
                        Delivery Address
                      </Text>

                      <Text
                        style={
                          styles.change
                        }
                      >
                        Change
                      </Text>
                    </View>

                    <Text
                      style={
                        styles.address
                      }
                    >
                      {
                        location
                      }
                    </Text>
                  </Pressable>

                  {/* ================================= */}
                  {/* Bill Summary */}
                  {/* ================================= */}

                  <View
                    style={
                      styles.section
                    }
                  >
                    <Text
                      style={
                        styles.sectionTitle
                      }
                    >
                      Bill Summary
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
                        shipping >
                        0
                          ? `$${shipping.toFixed(
                              2,
                            )}`
                          : 'FREE'
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
                        Total Amount
                      </Text>

                      <Text
                        style={
                          styles.total
                        }
                      >
                        $
                        {
                          grandTotal.toFixed(
                            2,
                          )
                        }
                      </Text>
                    </View>
                  </View>

                  {/* ================================= */}
                  {/* Stripe Information */}
                  {/* ================================= */}

                  <View
                    style={
                      styles.paymentInfoCard
                    }
                  >
                    <View
                      style={
                        styles.paymentInfoIcon
                      }
                    >
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={
                          20
                        }
                        color="#27905B"
                      />
                    </View>

                    <View
                      style={
                        styles.paymentInfoContent
                      }
                    >
                      <Text
                        style={
                          styles.paymentInfoTitle
                        }
                      >
                        Secure Card Payment
                      </Text>

                      <Text
                        style={
                          styles.paymentInfoText
                        }
                      >
                        Your card details are securely handled by Stripe and are never stored by KP Cloud Kitchen.
                      </Text>
                    </View>
                  </View>
                </>
              }
            />
          )}

          {/* ========================================= */}
          {/* Bottom Payment Button */}
          {/* ========================================= */}

          {cart.length >
            0 && (
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
                  styles.bottomTotalRow
                }
              >
                <View>
                  <Text
                    style={
                      styles.bottomTotalLabel
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
                    {
                      grandTotal.toFixed(
                        2,
                      )
                    }
                  </Text>
                </View>

                <Text
                  style={
                    styles.itemCountText
                  }
                >
                  {cart.reduce(
                    (
                      total,
                      item,
                    ) =>
                      total +
                      Number(
                        item
                          ?.quantity ??
                          1,
                      ),

                    0,
                  )}{' '}
                  item(s)
                </Text>
              </View>

              <TouchableOpacity
                disabled={
                  placingOrder ||
                  paymentProcessing
                }
                activeOpacity={
                  0.85
                }
                onPress={
                  handlePlaceOrder
                }
                style={[
                  styles.orderButton,

                  (placingOrder ||
                    paymentProcessing) &&
                    styles.disabledButton,
                ]}
              >
                {placingOrder ||
                paymentProcessing ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.orderButtonText
                      }
                    >
                      {paymentProcessing
                        ? 'Processing Payment...'
                        : 'Preparing Payment...'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="card-outline"
                      size={
                        19
                      }
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.orderButtonText
                      }
                    >
                      Pay & Place Order
                    </Text>

                    <Ionicons
                      name="arrow-forward"
                      size={
                        18
                      }
                      color="#FFFFFF"
                    />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* ================================================= */}
      {/* LOGIN REQUIRED POPUP */}
      {/* ================================================= */}

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
        <Pressable
          style={
            styles.loginOverlay
          }
          onPress={
            closeLoginPopup
          }
        >
          <Pressable
            style={
              styles.loginPopupCard
            }
            onPress={() => {}}
          >
            <View
              style={
                styles.loginPopupIconOuter
              }
            >
              <View
                style={
                  styles.loginPopupIconInner
                }
              >
                <Ionicons
                  name="person-outline"
                  size={
                    29
                  }
                  color="#A00B0F"
                />
              </View>
            </View>

            <Text
              style={
                styles.loginPopupTitle
              }
            >
              Login Required
            </Text>

            <Text
              style={
                styles.loginPopupDescription
              }
            >
              Please login to your account before placing your order.
            </Text>

            <View
              style={
                styles.cartSafeBox
              }
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={
                  18
                }
                color="#27905B"
              />

              <Text
                style={
                  styles.cartSafeText
                }
              >
                Your cart items will remain saved while you login.
              </Text>
            </View>

            <View
              style={
                styles.loginPopupButtons
              }
            >
              <TouchableOpacity
                activeOpacity={
                  0.8
                }
                onPress={
                  closeLoginPopup
                }
                style={
                  styles.cancelLoginButton
                }
              >
                <Text
                  style={
                    styles.cancelLoginText
                  }
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={
                  0.85
                }
                onPress={
                  handleLoginFromPopup
                }
                style={
                  styles.loginButton
                }
              >
                <Ionicons
                  name="log-in-outline"
                  size={
                    17
                  }
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.loginButtonText
                  }
                >
                  Login
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ================================================= */}
      {/* PAYMENT SUCCESS POPUP */}
      {/* ================================================= */}

      <Modal
        visible={
          success
        }
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View
          style={
            styles.overlay
          }
        >
          <View
            style={
              styles.successCard
            }
          >
            <View
              style={
                styles.successCircle
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
                styles.successTitle
              }
            >
              Payment Successful!
            </Text>

            <Text
              style={
                styles.successText
              }
            >
              Your payment has been confirmed and your order has been placed successfully.
            </Text>

            <View
              style={
                styles.paymentSuccessBadge
              }
            >
              <Ionicons
                name="card-outline"
                size={
                  16
                }
                color="#27905B"
              />

              <Text
                style={
                  styles.paymentSuccessBadgeText
                }
              >
                Paid securely with Stripe
              </Text>
            </View>

            <TouchableOpacity
              style={
                styles.doneButton
              }
              activeOpacity={
                0.85
              }
              onPress={() => {
                setSuccess(
                  false,
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
              }}
            >
              <Text
                style={
                  styles.doneText
                }
              >
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
 * Bill Row
 * ========================================================= */

const BillRow = ({
  label,
  value,
}) => {
  return (
    <View
      style={
        styles.billRow
      }
    >
      <Text
        style={
          styles.billLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.billValue
        }
      >
        {value}
      </Text>
    </View>
  );
};

export default Order;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles =
  StyleSheet.create({
    /* =====================================================
     * Screen
     * ===================================================== */

    safeArea: {
      flex: 1,
      backgroundColor:
        '#F8F6FA',
    },

    loading: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#F8F6FA',
    },

    loadingText: {
      color:
        '#817782',
      fontSize:
        10,
      marginTop:
        10,
    },

    screen: {
      flex:
        1,
      alignSelf:
        'center',
    },

    /* =====================================================
     * Header
     * ===================================================== */

    header: {
      minHeight:
        65,

      backgroundColor:
        '#FFFFFF',

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#ECE8F0',
    },

    backButton: {
      width:
        38,

      height:
        38,

      borderRadius:
        20,

      backgroundColor:
        '#FFF6F2',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    headerIcon: {
      width:
        19,

      height:
        19,
    },

    headerContent: {
      flex:
        1,

      marginLeft:
        10,
    },

    headerTitle: {
      color:
        '#241D2B',

      fontSize:
        16,

      fontWeight:
        '900',
    },

    headerLocation: {
      color:
        '#7D7483',

      fontSize:
        9,

      marginTop:
        2,
    },

    /* =====================================================
     * Product
     * ===================================================== */

    productCard: {
      backgroundColor:
        '#FFFFFF',

      borderRadius:
        16,

      borderWidth:
        1,

      borderColor:
        '#ECE8F0',

      padding:
        12,

      marginBottom:
        14,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          3,
      },

      shadowOpacity:
        0.05,

      shadowRadius:
        8,

      elevation:
        2,
    },

    productTopSection: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',
    },

    productImage: {
      width:
        95,

      height:
        105,

      borderRadius:
        12,

      backgroundColor:
        '#F1EDF2',
    },

    productInfo: {
      flex:
        1,

      paddingLeft:
        12,
    },

    productTitleRow: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      justifyContent:
        'space-between',
    },

    productName: {
      flex:
        1,

      color:
        '#241D2B',

      fontSize:
        13,

      lineHeight:
        18,

      fontWeight:
        '900',

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

    productMetaContainer: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      marginTop:
        7,
    },

    productMetaBadge: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF1F2',

      borderRadius:
        20,

      paddingHorizontal:
        7,

      paddingVertical:
        4,

      marginRight:
        5,

      marginBottom:
        5,
    },

    productMetaText: {
      color:
        '#A00B0F',

      fontSize:
        7,

      fontWeight:
        '800',
    },

    productDescription: {
      color:
        '#766D7B',

      fontSize:
        8.5,

      lineHeight:
        13,

      marginTop:
        6,
    },

    customizedBadge: {
      alignSelf:
        'flex-start',

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FBEAEC',

      borderRadius:
        20,

      paddingHorizontal:
        7,

      paddingVertical:
        4,

      marginTop:
        6,
    },

    customizedBadgeText: {
      color:
        '#A00B0F',

      fontSize:
        7,

      fontWeight:
        '800',

      marginLeft:
        3,
    },

    /* =====================================================
     * Details
     * ===================================================== */

    detailSection: {
      borderTopWidth:
        1,

      borderTopColor:
        '#F0EBF2',

      marginTop:
        12,

      paddingTop:
        11,
    },

    detailSectionTitle: {
      color:
        '#302735',

      fontSize:
        10,

      fontWeight:
        '900',

      marginBottom:
        8,
    },

    defaultItemRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      minHeight:
        27,
    },

    checkCircle: {
      width:
        17,

      height:
        17,

      borderRadius:
        9,

      backgroundColor:
        '#27905B',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        7,
    },

    defaultItemName: {
      flex:
        1,

      color:
        '#645B68',

      fontSize:
        8.5,

      fontWeight:
        '600',
    },

    defaultItemQuantity: {
      color:
        '#A00B0F',

      fontSize:
        8,

      fontWeight:
        '800',
    },

    customizationRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      minHeight:
        28,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        '#EEE9F0',
    },

    customizationCategory: {
      color:
        '#817782',

      fontSize:
        8.5,
    },

    customizationValue: {
      color:
        '#332A37',

      fontSize:
        8.5,

      fontWeight:
        '800',
    },

    extraRow: {
      minHeight:
        29,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    extraPlus: {
      color:
        '#A00B0F',

      fontSize:
        15,

      fontWeight:
        '900',

      marginRight:
        7,
    },

    extraName: {
      flex:
        1,

      color:
        '#605663',

      fontSize:
        8.5,
    },

    extraQuantity: {
      color:
        '#877D89',

      fontSize:
        8,
    },

    extraPrice: {
      color:
        '#A00B0F',

      fontSize:
        8,

      fontWeight:
        '800',

      marginLeft:
        8,
    },

    /* =====================================================
     * Quantity / Remove
     * ===================================================== */

    productActionsSection: {
      borderTopWidth:
        1,

      borderTopColor:
        '#EEE9F0',

      marginTop:
        12,

      paddingTop:
        11,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    quantity: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF5F5',

      borderWidth:
        1,

      borderColor:
        '#EECFD1',

      borderRadius:
        10,

      overflow:
        'hidden',
    },

    qtyButton: {
      width:
        34,

      height:
        34,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    qtyValue: {
      minWidth:
        30,

      color:
        '#302735',

      fontSize:
        10,

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
        9,

      paddingHorizontal:
        11,
    },

    removeText: {
      color:
        '#D44D4D',

      fontSize:
        8,

      fontWeight:
        '800',

      marginLeft:
        4,
    },

    /* =====================================================
     * Sections
     * ===================================================== */

    section: {
      backgroundColor:
        '#FFFFFF',

      borderRadius:
        15,

      borderWidth:
        1,

      borderColor:
        '#ECE8F0',

      padding:
        13,

      marginBottom:
        12,
    },

    sectionHeader: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',

      marginBottom:
        10,
    },

    sectionTitle: {
      color:
        '#2A222F',

      fontSize:
        12,

      fontWeight:
        '900',

      marginBottom:
        10,
    },

    sectionTitleNoMargin: {
      color:
        '#2A222F',

      fontSize:
        12,

      fontWeight:
        '900',
    },

    notes: {
      minHeight:
        80,

      borderWidth:
        1,

      borderColor:
        '#ECE8F0',

      borderRadius:
        11,

      padding:
        10,

      color:
        '#302734',

      fontSize:
        10,

      textAlignVertical:
        'top',
    },

    change: {
      color:
        '#A00B0F',

      fontSize:
        9,

      fontWeight:
        '800',
    },

    address: {
      color:
        '#716875',

      fontSize:
        10,

      lineHeight:
        16,
    },

    /* =====================================================
     * Bill
     * ===================================================== */

    billRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      marginBottom:
        9,
    },

    billLabel: {
      color:
        '#746B79',

      fontSize:
        10,
    },

    billValue: {
      color:
        '#2E2633',

      fontSize:
        10,

      fontWeight:
        '800',
    },

    divider: {
      height:
        1,

      backgroundColor:
        '#E5E0E8',

      marginVertical:
        7,
    },

    totalRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',
    },

    totalLabel: {
      color:
        '#211A25',

      fontSize:
        12,

      fontWeight:
        '900',
    },

    total: {
      color:
        '#A00B0F',

      fontSize:
        16,

      fontWeight:
        '900',
    },

    /* =====================================================
     * Payment Info
     * ===================================================== */

    paymentInfoCard: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#F2FAF5',

      borderWidth:
        1,

      borderColor:
        '#DAEFDF',

      borderRadius:
        13,

      padding:
        11,

      marginBottom:
        15,
    },

    paymentInfoIcon: {
      width:
        38,

      height:
        38,

      borderRadius:
        11,

      backgroundColor:
        '#E0F3E6',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        10,
    },

    paymentInfoContent: {
      flex:
        1,
    },

    paymentInfoTitle: {
      color:
        '#294C35',

      fontSize:
        9.5,

      fontWeight:
        '900',
    },

    paymentInfoText: {
      color:
        '#607568',

      fontSize:
        7.5,

      lineHeight:
        12,

      marginTop:
        3,
    },

    /* =====================================================
     * Bottom
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

      backgroundColor:
        '#FFFFFF',

      paddingTop:
        9,

      paddingBottom:
        13,

      borderTopWidth:
        1,

      borderTopColor:
        '#ECE8F0',

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          -4,
      },

      shadowOpacity:
        0.06,

      shadowRadius:
        8,

      elevation:
        10,
    },

    bottomTotalRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom:
        8,
    },

    bottomTotalLabel: {
      color:
        '#8B818D',

      fontSize:
        8,
    },

    bottomTotal: {
      color:
        '#A00B0F',

      fontSize:
        16,

      fontWeight:
        '900',

      marginTop:
        1,
    },

    itemCountText: {
      color:
        '#8B818D',

      fontSize:
        8,

      fontWeight:
        '700',
    },

    orderButton: {
      minHeight:
        52,

      backgroundColor:
        '#A00B0F',

      borderRadius:
        13,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      columnGap:
        8,
    },

    disabledButton: {
      opacity:
        0.6,
    },

    orderButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        12,

      fontWeight:
        '900',
    },

    /* =====================================================
     * Empty Cart
     * ===================================================== */

    empty: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        25,
    },

    emptyTitle: {
      color:
        '#302734',

      fontSize:
        17,

      fontWeight:
        '900',

      marginTop:
        15,
    },

    emptyText: {
      color:
        '#887F8C',

      fontSize:
        10,

      marginTop:
        5,

      textAlign:
        'center',
    },

    shopButton: {
      backgroundColor:
        '#A00B0F',

      paddingHorizontal:
        22,

      paddingVertical:
        13,

      borderRadius:
        12,

      marginTop:
        18,
    },

    shopButtonText: {
      color:
        '#FFFFFF',

      fontWeight:
        '800',
    },

    /* =====================================================
     * Login Popup
     * ===================================================== */

    loginOverlay: {
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

    loginPopupCard: {
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
        18,
    },

    loginPopupIconOuter: {
      width:
        82,

      height:
        82,

      borderRadius:
        41,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF1F2',

      marginBottom:
        15,
    },

    loginPopupIconInner: {
      width:
        58,

      height:
        58,

      borderRadius:
        29,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FBE0E2',

      borderWidth:
        1,

      borderColor:
        '#F3C9CB',
    },

    loginPopupTitle: {
      color:
        '#241D2B',

      fontSize:
        20,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    loginPopupDescription: {
      maxWidth:
        290,

      color:
        '#756B72',

      fontSize:
        10.5,

      lineHeight:
        17,

      textAlign:
        'center',

      marginTop:
        7,
    },

    cartSafeBox: {
      width:
        '100%',

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#F2FAF5',

      borderWidth:
        1,

      borderColor:
        '#D9EFDF',

      borderRadius:
        11,

      padding:
        10,

      marginTop:
        17,
    },

    cartSafeText: {
      flex:
        1,

      color:
        '#52715D',

      fontSize:
        8.5,

      lineHeight:
        13,

      fontWeight:
        '700',

      marginLeft:
        8,
    },

    loginPopupButtons: {
      width:
        '100%',

      flexDirection:
        'row',

      marginTop:
        20,
    },

    cancelLoginButton: {
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

      borderWidth:
        1,

      borderColor:
        '#E7DEE1',

      borderRadius:
        12,

      marginRight:
        5,
    },

    cancelLoginText: {
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

    loginButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        10,

      fontWeight:
        '900',

      marginLeft:
        6,
    },

    /* =====================================================
     * Success Popup
     * ===================================================== */

    overlay: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(0,0,0,.55)',

      paddingHorizontal:
        25,
    },

    successCard: {
      width:
        '100%',

      maxWidth:
        370,

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        24,

      padding:
        25,

      alignItems:
        'center',
    },

    successCircle: {
      width:
        75,

      height:
        75,

      borderRadius:
        40,

      backgroundColor:
        '#26975B',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    successTitle: {
      color:
        '#241D2B',

      fontSize:
        18,

      fontWeight:
        '900',

      marginTop:
        17,

      textAlign:
        'center',
    },

    successText: {
      color:
        '#7B727F',

      fontSize:
        10,

      lineHeight:
        16,

      textAlign:
        'center',

      marginTop:
        7,
    },

    paymentSuccessBadge: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#EFF9F2',

      borderRadius:
        20,

      paddingHorizontal:
        11,

      paddingVertical:
        7,

      marginTop:
        14,
    },

    paymentSuccessBadgeText: {
      color:
        '#36704B',

      fontSize:
        8.5,

      fontWeight:
        '800',

      marginLeft:
        5,
    },

    doneButton: {
      width:
        '100%',

      minHeight:
        46,

      backgroundColor:
        '#A00B0F',

      borderRadius:
        12,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginTop:
        20,
    },

    doneText: {
      color:
        '#FFFFFF',

      fontWeight:
        '900',
    },
  });