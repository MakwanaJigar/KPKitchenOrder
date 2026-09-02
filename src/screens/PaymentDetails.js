import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
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

import Ionicons from 'react-native-vector-icons/Ionicons';

import {
  PlatformPay,
  usePlatformPay,
  useStripe,
} from '@stripe/stripe-react-native';

/* =========================================================
 * CONFIG
 * ========================================================= */

const BUSINESS_NAME =
  'KP Cloud Kitchen';

const DEFAULT_CURRENCY =
  'AUD';

const MERCHANT_COUNTRY =
  'AU';

/* =========================================================
 * LOCAL STORAGE
 *
 * Order.js should append every successfully created order
 * to this storage key.
 * ========================================================= */

const WEEKLY_ORDERS_STORAGE_KEY =
  'kp_customer_weekly_orders';

/* =========================================================
 * WEEKLY BILL PAYMENT APIs
 *
 * IMPORTANT:
 * Payment is now only against generated weekly invoices.
 * Individual order payments are not used here.
 * ========================================================= */

const getCreateBillPaymentIntentApi =
  billId =>
    `https://replete-software.com/projects/kp_admin/api/customer/weekly-bills/${billId}/create-payment-intent`;

const getConfirmBillPaymentApi =
  billId =>
    `https://replete-software.com/projects/kp_admin/api/customer/weekly-bills/${billId}/confirm-payment`;

/* =========================================================
 * MONEY
 * ========================================================= */

const parseMoney =
  value => {
    const number =
      Number(
        String(
          value ?? 0,
        ).replace(
          /[^0-9.-]/g,
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
 * GET ORDER TOTAL
 * ========================================================= */

const getOrderTotal =
  order => {
    return parseMoney(
      order?.total_amount ??
        order?.totalAmount ??
        order?.grand_total ??
        order?.grandTotal ??
        order?.total ??
        order?.amount ??
        order?.order_total ??
        order?.orderTotal ??
        0,
    );
  };

/* =========================================================
 * GET ORDER DATE
 * ========================================================= */

const getOrderDate =
  order => {
    const rawDate =
      order?.created_at ??
      order?.createdAt ??
      order?.order_date ??
      order?.orderDate ??
      order?.placed_at ??
      order?.placedAt ??
      order?.date ??
      null;

    if (!rawDate) {
      return null;
    }

    const date =
      new Date(
        rawDate,
      );

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return null;
    }

    return date;
  };

/* =========================================================
 * CURRENT BILLING CYCLE
 *
 * Cycle:
 *
 * Tuesday → Monday
 *
 * Orders are normally placed Tuesday → Sunday.
 * Monday is invoice generation/payment day.
 * ========================================================= */

const getCurrentBillingCycle =
  () => {
    const now =
      new Date();

    /*
     * JavaScript:
     *
     * Sunday    = 0
     * Monday    = 1
     * Tuesday   = 2
     * ...
     */

    const day =
      now.getDay();

    const daysSinceTuesday =
      (
        day -
        2 +
        7
      ) %
      7;

    const start =
      new Date(
        now,
      );

    start.setDate(
      now.getDate() -
        daysSinceTuesday,
    );

    start.setHours(
      0,
      0,
      0,
      0,
    );

    return {
      start,

      now,
    };
  };

/* =========================================================
 * FORMAT DATE
 * ========================================================= */

const formatDate =
  date => {
    if (!date) {
      return '';
    }

    return date.toLocaleDateString(
      'en-AU',
      {
        day:
          '2-digit',

        month:
          'short',

        year:
          'numeric',
      },
    );
  };

/* =========================================================
 * PAYMENT DETAILS
 * ========================================================= */

const PaymentDetails = ({
  navigation,
  route,
}) => {
  const {
    width,
  } =
    useWindowDimensions();

  /* =======================================================
   * ROUTE DATA
   *
   * WeeklyInvoice page should send:
   *
   * billId
   * billNumber
   * balanceAmount / totalAmount
   * invoiceGenerated
   * currency
   * ======================================================= */

  const billId =
    route?.params
      ?.billId ??
    null;

  const billNumber =
    route?.params
      ?.billNumber ??
    null;

  const routeInvoiceGenerated =
    route?.params
      ?.invoiceGenerated;

  const serverBillAmount =
    parseMoney(
      route?.params
        ?.balanceAmount ??
      route?.params
        ?.totalAmount ??
      0,
    );

  const currency =
    String(
      route?.params
        ?.currency ??
      DEFAULT_CURRENCY,
    ).toUpperCase();

  /* =======================================================
   * AUTHORITATIVE INVOICE STATUS
   *
   * A Monday date by itself does NOT allow payment.
   *
   * billId must exist.
   * ======================================================= */

  const invoiceGenerated =
    Boolean(
      billId,
    ) &&
    routeInvoiceGenerated !==
      false;

  /* =======================================================
   * STRIPE
   * ======================================================= */

  const {
    initPaymentSheet,
    presentPaymentSheet,
  } =
    useStripe();

  const {
    isPlatformPaySupported,
    confirmPlatformPayPayment,
  } =
    usePlatformPay();

  /* =======================================================
   * STATE
   * ======================================================= */

  const [
    weeklyOrders,
    setWeeklyOrders,
  ] =
    useState([]);

  const [
    loadingOrders,
    setLoadingOrders,
  ] =
    useState(true);

  const [
    processingMethod,
    setProcessingMethod,
  ] =
    useState(null);

  const [
    successVisible,
    setSuccessVisible,
  ] =
    useState(false);

  const [
    successfulMethod,
    setSuccessfulMethod,
  ] =
    useState('');

  /* =======================================================
   * CUSTOM POPUP
   * ======================================================= */

  const [
    popupVisible,
    setPopupVisible,
  ] =
    useState(false);

  const [
    popupData,
    setPopupData,
  ] =
    useState({
      type:
        'info',

      title:
        '',

      message:
        '',

      primaryText:
        'OK',

      secondaryText:
        null,

      onPrimary:
        null,

      onSecondary:
        null,
    });

  /* =======================================================
   * RESPONSIVE
   * ======================================================= */

  const responsive =
    useMemo(
      () => {
        const isTablet =
          width >= 768;

        return {
          contentWidth:
            isTablet
              ? Math.min(
                  width - 80,
                  720,
                )
              : width,

          padding:
            isTablet
              ? 28
              : 14,
        };
      },
      [
        width,
      ],
    );

  /* =======================================================
   * CURRENT DAY
   * ======================================================= */

  const today =
    new Date();

  const currentDay =
    today.getDay();

  const isMonday =
    currentDay === 1;

  const isSunday =
    currentDay === 0;

  const isTuesdayToSunday =
    currentDay === 0 ||
    (
      currentDay >= 2 &&
      currentDay <= 6
    );

  /* =======================================================
   * BILLING CYCLE
   * ======================================================= */

  const billingCycle =
    useMemo(
      () =>
        getCurrentBillingCycle(),
      [],
    );

  /* =======================================================
   * POPUP
   * ======================================================= */

  const showPopup =
    ({
      type =
        'info',

      title,

      message,

      primaryText =
        'OK',

      secondaryText =
        null,

      onPrimary =
        null,

      onSecondary =
        null,
    }) => {
      setPopupData({
        type,

        title,

        message,

        primaryText,

        secondaryText,

        onPrimary,

        onSecondary,
      });

      setPopupVisible(
        true,
      );
    };

  const closePopup =
    () => {
      setPopupVisible(
        false,
      );
    };

  const handlePopupPrimary =
    () => {
      const callback =
        popupData
          ?.onPrimary;

      setPopupVisible(
        false,
      );

      if (
        typeof callback ===
        'function'
      ) {
        setTimeout(
          () =>
            callback(),
          100,
        );
      }
    };

  const handlePopupSecondary =
    () => {
      const callback =
        popupData
          ?.onSecondary;

      setPopupVisible(
        false,
      );

      if (
        typeof callback ===
        'function'
      ) {
        setTimeout(
          () =>
            callback(),
          100,
        );
      }
    };

  /* =======================================================
   * LOAD CURRENT WEEK ORDERS
   *
   * This screen reloads this data every time it gets focus.
   *
   * Therefore:
   *
   * Place new order
   *     ↓
   * Order.js saves weekly order
   *     ↓
   * Open this page
   *     ↓
   * Amount immediately reflects new order
   * ======================================================= */

  const loadWeeklyOrders =
    async () => {
      try {
        setLoadingOrders(
          true,
        );

        const stored =
          await AsyncStorage.getItem(
            WEEKLY_ORDERS_STORAGE_KEY,
          );

        if (!stored) {
          setWeeklyOrders([]);

          return;
        }

        const parsed =
          JSON.parse(
            stored,
          );

        const orders =
          Array.isArray(
            parsed,
          )
            ? parsed
            : [];

        /*
         * Only use orders belonging to current
         * Tuesday → Monday billing cycle.
         *
         * If an older locally stored order has no date,
         * keep it because its cycle cannot be determined.
         */

        const currentCycleOrders =
          orders.filter(
            order => {
              const orderDate =
                getOrderDate(
                  order,
                );

              if (!orderDate) {
                return true;
              }

              return (
                orderDate >=
                  billingCycle.start &&
                orderDate <=
                  billingCycle.now
              );
            },
          );

        setWeeklyOrders(
          currentCycleOrders,
        );
      } catch (error) {
        console.log(
          'LOAD WEEKLY ORDERS ERROR:',
          error,
        );

        setWeeklyOrders([]);
      } finally {
        setLoadingOrders(
          false,
        );
      }
    };

  /* =======================================================
   * RELOAD ON FOCUS
   * ======================================================= */

  useFocusEffect(
    useCallback(
      () => {
        loadWeeklyOrders();
      },
      [],
    ),
  );

  /* =======================================================
   * CURRENT WEEK ORDER TOTAL
   * ======================================================= */

  const currentOrdersTotal =
    useMemo(
      () => {
        return weeklyOrders.reduce(
          (
            total,
            order,
          ) =>
            total +
            getOrderTotal(
              order,
            ),
          0,
        );
      },
      [
        weeklyOrders,
      ],
    );

  /* =======================================================
   * CURRENT WEEK ORDER COUNT
   * ======================================================= */

  const currentOrderCount =
    weeklyOrders.length;

  /* =======================================================
   * DISPLAY AMOUNT
   *
   * Before invoice:
   * show accumulated order amount.
   *
   * After invoice:
   * use server invoice amount.
   *
   * If server amount is not supplied, use local accrued
   * amount as visual fallback.
   * ======================================================= */

  const invoiceAmount =
    invoiceGenerated &&
    serverBillAmount > 0
      ? serverBillAmount
      : currentOrdersTotal;

  /* =======================================================
   * PAYMENT ALLOWED
   *
   * CRITICAL:
   *
   * Must have generated invoice/billId.
   * ======================================================= */

  const paymentAllowed =
    invoiceGenerated &&
    Boolean(
      billId,
    ) &&
    invoiceAmount > 0;

  const isProcessing =
    Boolean(
      processingMethod,
    );

  /* =======================================================
   * STATUS MESSAGE
   * ======================================================= */

  const billingStatus =
    useMemo(
      () => {
        if (
          invoiceGenerated
        ) {
          return {
            title:
              'Invoice Ready',

            text:
              'Your Monday invoice has been generated. You can now pay the outstanding weekly balance.',

            icon:
              'document-text-outline',

            type:
              'ready',
          };
        }

        if (
          isMonday
        ) {
          return {
            title:
              'Invoice Generation Pending',

            text:
              'Today is invoice day. Payment will become available once the Monday invoice has been generated by the server.',

            icon:
              'time-outline',

            type:
              'waiting',
          };
        }

        return {
          title:
            'Weekly Total Building',

          text:
            'You can continue placing orders Tuesday through Sunday. Your running total is shown here, but payment stays locked until Monday’s invoice is generated.',

          icon:
            'calendar-outline',

          type:
            'building',
        };
      },
      [
        invoiceGenerated,
        isMonday,
      ],
    );

  /* =======================================================
   * VALIDATE PAYMENT
   * ======================================================= */

  const validatePaymentData =
    () => {
      /*
       * No bill = absolutely no payment.
       */

      if (
        !invoiceGenerated ||
        !billId
      ) {
        showPopup({
          type:
            'warning',

          title:
            'Invoice Not Generated',

          message:
            isMonday
              ? 'Your weekly invoice has not been generated yet. Payment will unlock automatically after the invoice is available.'
              : 'Payment is not available before the Monday weekly invoice is generated. You can continue placing orders and viewing your running weekly total.',

          primaryText:
            'OK',
        });

        return false;
      }

      if (
        !invoiceAmount ||
        invoiceAmount <= 0
      ) {
        showPopup({
          type:
            'warning',

          title:
            'Nothing to Pay',

          message:
            'There is currently no outstanding amount on this weekly invoice.',
        });

        return false;
      }

      return true;
    };

  /* =======================================================
   * CREATE WEEKLY BILL PAYMENT INTENT
   * ======================================================= */

  const createStripePaymentIntent =
    async () => {
      if (
        !validatePaymentData()
      ) {
        throw new Error(
          'Weekly invoice is not ready for payment.',
        );
      }

      const token =
        await AsyncStorage.getItem(
          'token',
        );

      if (!token) {
        throw new Error(
          'Your login session has expired. Please login again.',
        );
      }

      const api =
        getCreateBillPaymentIntentApi(
          billId,
        );

      console.log(
        'CREATE WEEKLY BILL PAYMENT INTENT:',
        api,
      );

      console.log(
        'BILL ID:',
        billId,
      );

      console.log(
        'BILL AMOUNT:',
        invoiceAmount,
      );

      const response =
        await fetch(
          api,
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
              JSON.stringify({
                bill_id:
                  billId,

                payable_type:
                  'weekly_bill',

                amount:
                  Number(
                    invoiceAmount.toFixed(
                      2,
                    ),
                  ),

                currency:
                  currency.toLowerCase(),
              }),
          },
        );

      const responseText =
        await response.text();

      let result =
        {};

      if (responseText) {
        try {
          result =
            JSON.parse(
              responseText,
            );
        } catch (error) {
          console.log(
            'RAW PAYMENT RESPONSE:',
            responseText,
          );

          throw new Error(
            'Invalid payment server response.',
          );
        }
      }

      if (
        response.status ===
        401
      ) {
        throw new Error(
          'Your login session has expired.',
        );
      }

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
            'Unable to prepare payment.',
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.message ??
            result?.error ??
            'Unable to prepare payment.',
        );
      }

      const clientSecret =
        result
          ?.stripe_client_secret ??
        result
          ?.client_secret ??
        result?.data
          ?.stripe_client_secret ??
        result?.data
          ?.client_secret ??
        null;

      const paymentIntentId =
        result
          ?.payment_intent_id ??
        result?.data
          ?.payment_intent_id ??
        result
          ?.payment_intent
          ?.id ??
        null;

      if (
        !clientSecret ||
        typeof clientSecret !==
          'string'
      ) {
        throw new Error(
          'Stripe client secret was not returned by the server.',
        );
      }

      return {
        clientSecret,

        paymentIntentId,
      };
    };

  /* =======================================================
   * CONFIRM WEEKLY BILL PAYMENT
   * ======================================================= */

  const confirmPayment =
    async ({
      paymentIntentId,

      paymentMethod,
    }) => {
      const token =
        await AsyncStorage.getItem(
          'token',
        );

      if (!token) {
        throw new Error(
          'Your session has expired. Please login again.',
        );
      }

      const api =
        getConfirmBillPaymentApi(
          billId,
        );

      const response =
        await fetch(
          api,
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
              JSON.stringify({
                payment_intent_id:
                  paymentIntentId,

                payment_method:
                  paymentMethod,

                bill_id:
                  billId,
              }),
          },
        );

      const responseText =
        await response.text();

      let result =
        {};

      if (responseText) {
        try {
          result =
            JSON.parse(
              responseText,
            );
        } catch (error) {
          throw new Error(
            'Invalid payment confirmation response.',
          );
        }
      }

      if (
        response.status ===
        401
      ) {
        throw new Error(
          'Your session has expired.',
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.message ??
            result?.error ??
            'Payment could not be verified.',
        );
      }

      if (
        result?.success ===
        false
      ) {
        throw new Error(
          result?.message ??
            'Payment verification failed.',
        );
      }

      return result;
    };

  /* =======================================================
   * COMPLETE PAYMENT
   * ======================================================= */

  const completePayment =
    async paymentMethod => {
      /*
       * Weekly order history is cleared locally only
       * after successful weekly bill payment.
       *
       * This starts a fresh local running balance.
       */

      await AsyncStorage.removeItem(
        WEEKLY_ORDERS_STORAGE_KEY,
      );

      setWeeklyOrders([]);

      setSuccessfulMethod(
        paymentMethod,
      );

      setSuccessVisible(
        true,
      );
    };

  /* =======================================================
   * CARD PAYMENT
   * ======================================================= */

  const handleCardPayment =
    async () => {
      if (
        isProcessing ||
        !validatePaymentData()
      ) {
        return;
      }

      try {
        setProcessingMethod(
          'card',
        );

        const paymentData =
          await createStripePaymentIntent();

        const {
          error:
            initError,
        } =
          await initPaymentSheet({
            merchantDisplayName:
              BUSINESS_NAME,

            paymentIntentClientSecret:
              paymentData.clientSecret,

            allowsDelayedPaymentMethods:
              false,

            appearance: {
              shapes: {
                borderRadius:
                  12,
              },
            },
          });

        if (initError) {
          throw new Error(
            initError?.message ??
              'Unable to initialize card payment.',
          );
        }

        const {
          error:
            paymentError,
        } =
          await presentPaymentSheet();

        if (paymentError) {
          const code =
            String(
              paymentError?.code ??
                '',
            ).toLowerCase();

          if (
            code ===
              'canceled' ||
            code ===
              'cancelled'
          ) {
            return;
          }

          throw new Error(
            paymentError?.message ??
              'Card payment failed.',
          );
        }

        await confirmPayment({
          paymentIntentId:
            paymentData
              .paymentIntentId,

          paymentMethod:
            'stripe',
        });

        await completePayment(
          'Card',
        );
      } catch (error) {
        console.log(
          'CARD PAYMENT ERROR:',
          error,
        );

        showPopup({
          type:
            'error',

          title:
            'Card Payment Failed',

          message:
            error?.message ??
            'Unable to process your card payment.',
        });
      } finally {
        setProcessingMethod(
          null,
        );
      }
    };

  /* =======================================================
   * GOOGLE PAY
   * ======================================================= */

  const handleGooglePay =
    async () => {
      if (
        isProcessing ||
        !validatePaymentData()
      ) {
        return;
      }

      if (
        Platform.OS !==
        'android'
      ) {
        showPopup({
          type:
            'info',

          title:
            'Google Pay',

          message:
            'Google Pay is available from the Android version of this application.',
        });

        return;
      }

      try {
        setProcessingMethod(
          'google',
        );

        const supported =
          await isPlatformPaySupported({
            googlePay: {
              testEnv:
                __DEV__,
            },
          });

        if (!supported) {
          throw new Error(
            'Google Pay is not available on this device.',
          );
        }

        const paymentData =
          await createStripePaymentIntent();

        const {
          error,
        } =
          await confirmPlatformPayPayment(
            paymentData.clientSecret,
            {
              googlePay: {
                testEnv:
                  __DEV__,

                merchantName:
                  BUSINESS_NAME,

                merchantCountryCode:
                  MERCHANT_COUNTRY,

                currencyCode:
                  currency,

                billingAddressConfig: {
                  format:
                    PlatformPay
                      .BillingAddressFormat
                      .Full,

                  isPhoneNumberRequired:
                    false,

                  isRequired:
                    false,
                },
              },
            },
          );

        if (error) {
          const code =
            String(
              error?.code ??
                '',
            ).toLowerCase();

          if (
            code ===
              'canceled' ||
            code ===
              'cancelled'
          ) {
            return;
          }

          throw new Error(
            error?.message ??
              'Google Pay payment failed.',
          );
        }

        await confirmPayment({
          paymentIntentId:
            paymentData
              .paymentIntentId,

          paymentMethod:
            'google_pay',
        });

        await completePayment(
          'Google Pay',
        );
      } catch (error) {
        console.log(
          'GOOGLE PAY ERROR:',
          error,
        );

        showPopup({
          type:
            'error',

          title:
            'Google Pay',

          message:
            error?.message ??
            'Unable to process Google Pay.',
        });
      } finally {
        setProcessingMethod(
          null,
        );
      }
    };

  /* =======================================================
   * APPLE PAY
   * ======================================================= */

  const handleApplePay =
    async () => {
      if (
        isProcessing ||
        !validatePaymentData()
      ) {
        return;
      }

      if (
        Platform.OS !==
        'ios'
      ) {
        showPopup({
          type:
            'info',

          title:
            'Apple Pay',

          message:
            'Apple Pay is available from the iOS version of this application.',
        });

        return;
      }

      try {
        setProcessingMethod(
          'apple',
        );

        const supported =
          await isPlatformPaySupported();

        if (!supported) {
          throw new Error(
            'Apple Pay is not available on this device.',
          );
        }

        const paymentData =
          await createStripePaymentIntent();

        const {
          error,
        } =
          await confirmPlatformPayPayment(
            paymentData.clientSecret,
            {
              applePay: {
                merchantCountryCode:
                  MERCHANT_COUNTRY,

                currencyCode:
                  currency,

                cartItems: [
                  {
                    label:
                      `Weekly Invoice ${
                        billNumber ??
                        billId
                      }`,

                    amount:
                      invoiceAmount.toFixed(
                        2,
                      ),

                    paymentType:
                      PlatformPay
                        .PaymentType
                        .Immediate,
                  },
                ],
              },
            },
          );

        if (error) {
          const code =
            String(
              error?.code ??
                '',
            ).toLowerCase();

          if (
            code ===
              'canceled' ||
            code ===
              'cancelled'
          ) {
            return;
          }

          throw new Error(
            error?.message ??
              'Apple Pay payment failed.',
          );
        }

        await confirmPayment({
          paymentIntentId:
            paymentData
              .paymentIntentId,

          paymentMethod:
            'apple_pay',
        });

        await completePayment(
          'Apple Pay',
        );
      } catch (error) {
        console.log(
          'APPLE PAY ERROR:',
          error,
        );

        showPopup({
          type:
            'error',

          title:
            'Apple Pay',

          message:
            error?.message ??
            'Unable to process Apple Pay.',
        });
      } finally {
        setProcessingMethod(
          null,
        );
      }
    };

  /* =======================================================
   * PAYMENT METHODS
   * ======================================================= */

  const paymentMethods = [
    {
      id:
        'card',

      title:
        'Pay with Card',

      subtitle:
        'Visa, Mastercard and supported cards',

      image:
        require('../assets/login-icons/card-pay.png'),

      onPress:
        handleCardPayment,
    },

    {
      id:
        'google',

      title:
        'Google Pay',

      subtitle:
        'Pay securely using Google Pay',

      image:
        require('../assets/login-icons/google-pay.png'),

      onPress:
        handleGooglePay,
    },

    {
      id:
        'apple',

      title:
        'Apple Pay',

      subtitle:
        'Pay securely through Apple Pay',

      image:
        require('../assets/login-icons/apple-pay.png'),

      onPress:
        handleApplePay,
    },
  ];

  /* =======================================================
   * PAYMENT DONE
   * ======================================================= */

  const handleDone =
    () => {
      setSuccessVisible(
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
    };

  /* =======================================================
   * POPUP ICON
   * ======================================================= */

  const getPopupIcon =
    () => {
      switch (
        popupData.type
      ) {
        case 'error':
          return {
            icon:
              'close-circle-outline',

            color:
              '#C83D43',

            background:
              '#FDEBEC',
          };

        case 'warning':
          return {
            icon:
              'warning-outline',

            color:
              '#B87300',

            background:
              '#FFF4DD',
          };

        case 'success':
          return {
            icon:
              'checkmark-circle-outline',

            color:
              '#258A51',

            background:
              '#E8F6ED',
          };

        default:
          return {
            icon:
              'information-circle-outline',

            color:
              '#A00B0F',

            background:
              '#FFF0F0',
          };
      }
    };

  const popupIcon =
    getPopupIcon();

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
                responsive
                  .contentWidth,
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
                styles.headerText
              }
            >
              <Text
                style={
                  styles.headerEyebrow
                }
              >
                WEEKLY BILLING
              </Text>

              <Text
                style={
                  styles.headerTitle
                }
              >
                Payment Details
              </Text>
            </View>

            <View
              style={
                styles.headerSpacer
              }
            />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
            contentContainerStyle={[
              styles.scrollContent,

              {
                paddingHorizontal:
                  responsive.padding,
              },
            ]}
          >
            {/* ================================================= */}
            {/* WEEKLY TOTAL */}
            {/* ================================================= */}

            <View
              style={
                styles.orderSummary
              }
            >
              <View
                style={
                  styles.orderSummaryTop
                }
              >
                <View>
                  <Text
                    style={
                      styles.summaryLabel
                    }
                  >
                    CURRENT WEEK
                  </Text>

                  <Text
                    style={
                      styles.billingPeriod
                    }
                  >
                    {formatDate(
                      billingCycle.start,
                    )}{' '}
                    – Today
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,

                    invoiceGenerated
                      ? styles.readyBadge
                      : styles.pendingBadge,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,

                      invoiceGenerated
                        ? styles.readyDot
                        : styles.pendingDot,
                    ]}
                  />

                  <Text
                    style={[
                      styles.statusBadgeText,

                      invoiceGenerated
                        ? styles.readyText
                        : styles.pendingText,
                    ]}
                  >
                    {invoiceGenerated
                      ? 'Invoice Ready'
                      : 'Building Total'}
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.summaryDivider
                }
              />

              {/* ORDER COUNT */}

              <SummaryRow
                label="Orders This Cycle"
                value={`${currentOrderCount}`}
              />

              {/* ACCRUED AMOUNT */}

              <SummaryRow
                label="Orders Total"
                value={
                  loadingOrders
                    ? 'Loading...'
                    : `${currency} ${currentOrdersTotal.toFixed(
                        2,
                      )}`
                }
              />

              {invoiceGenerated &&
                serverBillAmount >
                  0 && (
                  <>
                    <View
                      style={
                        styles.summaryDivider
                      }
                    />

                    <SummaryRow
                      label="Invoice Number"
                      value={
                        billNumber ??
                        `#${billId}`
                      }
                    />
                  </>
                )}

              <View
                style={
                  styles.summaryDivider
                }
              />

              <View
                style={
                  styles.totalRow
                }
              >
                <View
                  style={{
                    flex:
                      1,
                  }}
                >
                  <Text
                    style={
                      styles.totalLabel
                    }
                  >
                    {invoiceGenerated
                      ? 'Amount Due'
                      : 'Running Weekly Total'}
                  </Text>

                  <Text
                    style={
                      styles.balanceNote
                    }
                  >
                    {invoiceGenerated
                      ? 'Your Monday invoice is ready for payment.'
                      : 'For viewing only. Payment unlocks after Monday invoice generation.'}
                  </Text>
                </View>

                <Text
                  style={
                    styles.totalAmount
                  }
                >
                  {currency}{' '}
                  {invoiceAmount.toFixed(
                    2,
                  )}
                </Text>
              </View>
            </View>

            {/* ================================================= */}
            {/* BILLING STATUS */}
            {/* ================================================= */}

            <View
              style={[
                styles.billingStatusCard,

                invoiceGenerated &&
                  styles.billingStatusReady,
              ]}
            >
              <View
                style={[
                  styles.billingStatusIcon,

                  invoiceGenerated &&
                    styles.billingStatusIconReady,
                ]}
              >
                <Image
                                source={require('../assets/login-icons/invoice.png')}
                                style={
                                  styles.inputImageIcon
                                }
                                resizeMode="cover"
                              />
                {/* <Ionicons
                  name={
                    billingStatus.icon
                  }
                  size={
                    22
                  }
                  color={
                    invoiceGenerated
                      ? '#278850'
                      : '#A00B0F'
                  }
                /> */}
              </View>

              <View
                style={
                  styles.billingStatusContent
                }
              >
                <Text
                  style={[
                    styles.billingStatusTitle,

                    invoiceGenerated &&
                      styles.billingStatusTitleReady,
                  ]}
                >
                  {
                    billingStatus.title
                  }
                </Text>

                <Text
                  style={
                    styles.billingStatusText
                  }
                >
                  {
                    billingStatus.text
                  }
                </Text>
              </View>
            </View>

            {/* ================================================= */}
            {/* WEEKLY ORDERS */}
            {/* ================================================= */}

            <View
              style={
                styles.ordersSection
              }
            >
              <View
                style={
                  styles.sectionHeadingRow
                }
              >
                <View>
                  <Text
                    style={
                      styles.sectionEyebrow
                    }
                  >
                    THIS BILLING CYCLE
                  </Text>

                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    Your Orders
                  </Text>
                </View>

                <View
                  style={
                    styles.orderCountBadge
                  }
                >
                  <Text
                    style={
                      styles.orderCountText
                    }
                  >
                    {
                      currentOrderCount
                    }
                  </Text>
                </View>
              </View>

              {loadingOrders ? (
                <View
                  style={
                    styles.ordersLoading
                  }
                >
                  <ActivityIndicator
                    size="small"
                    color="#A00B0F"
                  />

                  <Text
                    style={
                      styles.ordersLoadingText
                    }
                  >
                    Updating weekly total...
                  </Text>
                </View>
              ) : weeklyOrders.length >
                0 ? (
                <View
                  style={
                    styles.ordersCard
                  }
                >
                  {weeklyOrders.map(
                    (
                      order,
                      index,
                    ) => {
                      const id =
                        order?.orderId ??
                        order?.order_id ??
                        order?.id ??
                        index + 1;

                      const date =
                        getOrderDate(
                          order,
                        );

                      const total =
                        getOrderTotal(
                          order,
                        );

                      return (
                        <View
                          key={`weekly-order-${id}-${index}`}
                          style={[
                            styles.orderRow,

                            index ===
                              weeklyOrders.length -
                                1 &&
                              styles.lastOrderRow,
                          ]}
                        >
                          <View
                            style={
                              styles.orderIcon
                            }
                          >
                            <Image
                source={require('../assets/login-icons/spoon-and-fork-crossed.png')}
                style={
                  styles.inputImageIcon
                }
                resizeMode="cover"
              />
                          </View>

                          <View
                            style={
                              styles.orderRowContent
                            }
                          >
                            <Text
                              style={
                                styles.orderRowTitle
                              }
                            >
                              Order #
                              {
                                id
                              }
                            </Text>

                            <Text
                              style={
                                styles.orderRowDate
                              }
                            >
                              {date
                                ? formatDate(
                                    date,
                                  )
                                : 'Current billing cycle'}
                            </Text>
                          </View>

                          <Text
                            style={
                              styles.orderRowAmount
                            }
                          >
                            {currency}{' '}
                            {total.toFixed(
                              2,
                            )}
                          </Text>
                        </View>
                      );
                    },
                  )}
                </View>
              ) : (
                <View
                  style={
                    styles.noOrdersCard
                  }
                >
                  <Ionicons
                    name="restaurant-outline"
                    size={
                      28
                    }
                    color="#B9AEB2"
                  />

                  <Text
                    style={
                      styles.noOrdersTitle
                    }
                  >
                    No orders yet
                  </Text>

                  <Text
                    style={
                      styles.noOrdersText
                    }
                  >
                    Orders placed during this billing cycle will appear here automatically.
                  </Text>
                </View>
              )}
            </View>

            {/* ================================================= */}
            {/* PAYMENT LOCKED */}
            {/* ================================================= */}

            {!paymentAllowed && (
              <View
                style={
                  styles.paymentLockedCard
                }
              >
                <View
                  style={
                    styles.lockIcon
                  }
                >
                  <Image
                source={require('../assets/login-icons/wallet.png')}
                style={
                  styles.inputImageIcon
                }
                resizeMode="cover"
              />
                </View>

                <Text
                  style={
                    styles.paymentLockedTitle
                  }
                >
                  Payment Not Available Yet
                </Text>

                <Text
                  style={
                    styles.paymentLockedText
                  }
                >
                  {isMonday
                    ? 'Payment will become available once your Monday invoice is generated.'
                    : 'You cannot pay individual orders. Keep ordering as needed; all order amounts will be combined into your Monday invoice.'}
                </Text>

                <View
                  style={
                    styles.lockedSchedule
                  }
                >
                  <ScheduleStep
                    number="1"
                    title="Tuesday – Sunday"
                    description="Place as many tiffin orders as needed."
                  />

                  <ScheduleStep
                    number="2"
                    title="Running Total"
                    description="Every successful order increases your weekly total."
                  />

                  <ScheduleStep
                    number="3"
                    title="Monday"
                    description="Weekly invoice is generated and payment becomes available."
                    last
                  />
                </View>
              </View>
            )}

            {/* ================================================= */}
            {/* PAYMENT METHODS
             *
             * RENDER ONLY AFTER ACTUAL INVOICE EXISTS.
             * ================================================= */}

            {paymentAllowed && (
              <>
                <View
                  style={
                    styles.methodHeading
                  }
                >
                  <Text
                    style={
                      styles.methodTitle
                    }
                  >
                    Choose Payment Method
                  </Text>

                  <Text
                    style={
                      styles.methodSubtitle
                    }
                  >
                    Your weekly invoice has been generated.
                    Select how you would like to pay the outstanding balance.
                  </Text>
                </View>

                <View
                  style={
                    styles.methodContainer
                  }
                >
                  {paymentMethods.map(
                    method => {
                      const methodLoading =
                        processingMethod ===
                        method.id;

                      return (
                        <TouchableOpacity
                          key={
                            method.id
                          }
                          disabled={
                            isProcessing
                          }
                          activeOpacity={
                            0.85
                          }
                          style={[
                            styles.paymentMethod,

                            isProcessing &&
                              !methodLoading &&
                              styles.disabledMethod,
                          ]}
                          onPress={
                            method.onPress
                          }
                        >
                          <View
                            style={
                              styles.methodIcon
                            }
                          >
                            {methodLoading ? (
                              <ActivityIndicator
                                size="small"
                                color="#A00B0F"
                              />
                            ) : (
                              <Image
                                source={
                                  method.image
                                }
                                style={
                                  styles.paymentLogo
                                }
                                resizeMode="contain"
                              />
                            )}
                          </View>

                          <View
                            style={
                              styles.methodContent
                            }
                          >
                            <Text
                              style={
                                styles.methodName
                              }
                            >
                              {
                                method.title
                              }
                            </Text>

                            <Text
                              style={
                                styles.methodDescription
                              }
                            >
                              {
                                method.subtitle
                              }
                            </Text>
                          </View>

                          <Image
                            source={require('../assets/login-icons/next.png')}
                            style={
                              styles.nextIcon
                            }
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      );
                    },
                  )}
                </View>

                <View
                  style={
                    styles.invoiceInfoBox
                  }
                >

                  <View
                    style={
                      styles.invoiceInfoContent
                    }
                  >
                    <Text
                      style={
                        styles.invoiceInfoTitle
                      }
                    >
                      Invoice Generated
                    </Text>

                    <Text
                      style={
                        styles.invoiceInfoText
                      }
                    >
                      Payment is being made against weekly invoice{' '}
                      {billNumber ??
                        `#${billId}`}.
                      Individual tiffin orders are not charged separately.
                    </Text>
                  </View>
                </View>
              </>
            )}

            <View
              style={{
                height:
                  50,
              }}
            />
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* ================================================= */}
      {/* CUSTOM POPUP */}
      {/* ================================================= */}

      <Modal
        visible={
          popupVisible
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={
          closePopup
        }
      >
        <View
          style={
            styles.popupOverlay
          }
        >
          <View
            style={
              styles.popupCard
            }
          >
            <View
              style={[
                styles.popupIconOuter,

                {
                  backgroundColor:
                    popupIcon
                      .background,
                },
              ]}
            >
              <Ionicons
                name={
                  popupIcon.icon
                }
                size={
                  36
                }
                color={
                  popupIcon.color
                }
              />
            </View>

            <Text
              style={
                styles.popupTitle
              }
            >
              {
                popupData.title
              }
            </Text>

            <Text
              style={
                styles.popupMessage
              }
            >
              {
                popupData.message
              }
            </Text>

            <View
              style={
                styles.popupButtonRow
              }
            >
              {!!popupData
                .secondaryText && (
                <TouchableOpacity
                  activeOpacity={
                    0.8
                  }
                  style={
                    styles.popupSecondaryButton
                  }
                  onPress={
                    handlePopupSecondary
                  }
                >
                  <Text
                    style={
                      styles.popupSecondaryText
                    }
                  >
                    {
                      popupData
                        .secondaryText
                    }
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={
                  0.85
                }
                style={[
                  styles.popupPrimaryButton,

                  !popupData
                    .secondaryText && {
                    marginLeft:
                      0,
                  },
                ]}
                onPress={
                  handlePopupPrimary
                }
              >
                <Text
                  style={
                    styles.popupPrimaryText
                  }
                >
                  {
                    popupData
                      .primaryText
                  }
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================= */}
      {/* PAYMENT SUCCESS */}
      {/* ================================================= */}

      <Modal
        visible={
          successVisible
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View
          style={
            styles.successOverlay
          }
        >
          <View
            style={
              styles.successCard
            }
          >
            <View
              style={
                styles.successCircleOuter
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
                    42
                  }
                  color="#FFFFFF"
                />
              </View>
            </View>

            <Text
              style={
                styles.successTitle
              }
            >
              Weekly Bill Paid!
            </Text>

            <Text
              style={
                styles.successText
              }
            >
              Your Monday weekly invoice has been paid successfully.
              Your current outstanding balance is now cleared.
            </Text>

            <View
              style={
                styles.successBadge
              }
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={
                  17
                }
                color="#278850"
              />

              <Text
                style={
                  styles.successBadgeText
                }
              >
                Paid with{' '}
                {
                  successfulMethod
                }
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={
                0.85
              }
              style={
                styles.doneButton
              }
              onPress={
                handleDone
              }
            >
              <Text
                style={
                  styles.doneText
                }
              >
                Back to Home
              </Text>

              <Ionicons
                name="arrow-forward"
                size={
                  18
                }
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

/* =========================================================
 * SUMMARY ROW
 * ========================================================= */

const SummaryRow = ({
  label,
  value,
}) => {
  return (
    <View
      style={
        styles.summaryRow
      }
    >
      <Text
        style={
          styles.summaryRowLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.summaryRowValue
        }
      >
        {value}
      </Text>
    </View>
  );
};

/* =========================================================
 * SCHEDULE STEP
 * ========================================================= */

const ScheduleStep = ({
  number,
  title,
  description,
  last = false,
}) => {
  return (
    <View
      style={
        styles.scheduleStep
      }
    >
      <View
        style={
          styles.scheduleLeft
        }
      >
        <View
          style={
            styles.scheduleNumber
          }
        >
          <Text
            style={
              styles.scheduleNumberText
            }
          >
            {
              number
            }
          </Text>
        </View>

        {!last && (
          <View
            style={
              styles.scheduleLine
            }
          />
        )}
      </View>

      <View
        style={
          styles.scheduleContent
        }
      >
        <Text
          style={
            styles.scheduleTitle
          }
        >
          {
            title
          }
        </Text>

        <Text
          style={
            styles.scheduleDescription
          }
        >
          {
            description
          }
        </Text>
      </View>
    </View>
  );
};

export default PaymentDetails;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles =
  StyleSheet.create({
    safeArea: {
      flex:
        1,

      backgroundColor:
        '#F5F0ED',
    },

    screen: {
      flex:
        1,

      alignSelf:
        'center',

      backgroundColor:
        '#FFF9F6',
    },

    scrollContent: {
      paddingTop:
        8,

      paddingBottom:
        40,
    },
    inputImageIcon: {
      width:
        20,

      height:
        20,
    },

    /* =====================================================
     * HEADER
     * ===================================================== */

    header: {
      minHeight:
        72,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF9F6',
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

      tintColor:
        '#A00B0F',
    },

    headerText: {
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
        22,

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
     * SUMMARY CARD
     * ===================================================== */

    orderSummary: {
      backgroundColor:
        '#A00B0F',

      borderRadius:
        20,

      padding:
        18,

      marginBottom:
        15,

      overflow:
        'hidden',
    },

    orderSummaryTop: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    summaryLabel: {
      color:
        '#DAB9BA',

      fontSize:
        7,

      fontWeight:
        '900',

      letterSpacing:
        1,
    },

    billingPeriod: {
      color:
        '#FFFFFF',

      fontSize:
        12,

      fontWeight:
        '900',

      marginTop:
        4,
    },

    summaryDivider: {
      height:
        1,

      backgroundColor:
        'rgba(255,255,255,.15)',

      marginVertical:
        13,
    },

    summaryRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',

      marginBottom:
        9,
    },

    summaryRowLabel: {
      color:
        '#E0C7C7',

      fontSize:
        8.5,
    },

    summaryRowValue: {
      color:
        '#FFFFFF',

      fontSize:
        9,

      fontWeight:
        '900',
    },

    totalRow: {
      flexDirection:
        'row',

      alignItems:
        'flex-end',

      justifyContent:
        'space-between',
    },

    totalLabel: {
      color:
        '#FFFFFF',

      fontSize:
        10,

      fontWeight:
        '900',
    },

    balanceNote: {
      maxWidth:
        210,

      color:
        '#D2AEAF',

      fontSize:
        7,

      lineHeight:
        11,

      marginTop:
        4,
    },

    totalAmount: {
      color:
        '#FFFFFF',

      fontSize:
        20,

      fontWeight:
        '900',

      marginLeft:
        10,
    },

    /* =====================================================
     * STATUS BADGES
     * ===================================================== */

    statusBadge: {
      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        20,

      paddingHorizontal:
        9,

      paddingVertical:
        6,
    },

    pendingBadge: {
      backgroundColor:
        'rgba(255,255,255,.12)',
    },

    readyBadge: {
      backgroundColor:
        '#E8F6ED',
    },

    statusDot: {
      width:
        7,

      height:
        7,

      borderRadius:
        4,

      marginRight:
        5,
    },

    pendingDot: {
      backgroundColor:
        '#F2B85B',
    },

    readyDot: {
      backgroundColor:
        '#278850',
    },

    statusBadgeText: {
      fontSize:
        7.5,

      fontWeight:
        '900',
    },

    pendingText: {
      color:
        '#F9D79F',
    },

    readyText: {
      color:
        '#278850',
    },

    /* =====================================================
     * BILLING STATUS
     * ===================================================== */

    billingStatusCard: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      backgroundColor:
        '#FFF2F2',

      borderWidth:
        1,

      borderColor:
        '#F2DADB',

      borderRadius:
        16,

      padding:
        13,

      marginBottom:
        20,
    },

    billingStatusReady: {
      backgroundColor:
        '#F2FAF5',

      borderColor:
        '#DCEFE2',
    },

    billingStatusIcon: {
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
        '#FFE5E6',

      marginRight:
        11,
    },

    billingStatusIconReady: {
      backgroundColor:
        '#E1F4E7',
    },

    billingStatusContent: {
      flex:
        1,
    },

    billingStatusTitle: {
      color:
        '#7A282C',

      fontSize:
        10,

      fontWeight:
        '900',
    },

    billingStatusTitleReady: {
      color:
        '#2F6D43',
    },

    billingStatusText: {
      color:
        '#826C6D',

      fontSize:
        8,

      lineHeight:
        13,

      marginTop:
        4,
    },

    /* =====================================================
     * ORDERS
     * ===================================================== */

    ordersSection: {
      marginBottom:
        20,
    },

    sectionHeadingRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom:
        10,
    },

    sectionEyebrow: {
      color:
        '#A00B0F',

      fontSize:
        7,

      fontWeight:
        '900',

      letterSpacing:
        0.8,
    },

    sectionTitle: {
      color:
        '#281E1A',

      fontSize:
        16,

      fontWeight:
        '900',

      marginTop:
        2,
    },

    orderCountBadge: {
      minWidth:
        32,

      height:
        32,

      borderRadius:
        16,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0F0',
    },

    orderCountText: {
      color:
        '#A00B0F',

      fontSize:
        10,

      fontWeight:
        '900',
    },

    ordersCard: {
      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EEE5E0',

      borderRadius:
        15,

      paddingHorizontal:
        12,
    },

    orderRow: {
      minHeight:
        64,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#F2EBE7',
    },

    lastOrderRow: {
      borderBottomWidth:
        0,
    },

    orderIcon: {
      width:
        36,

      height:
        36,

      borderRadius:
        11,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0F0',

      marginRight:
        10,
    },

    orderRowContent: {
      flex:
        1,
    },

    orderRowTitle: {
      color:
        '#342722',

      fontSize:
        9.5,

      fontWeight:
        '900',
    },

    orderRowDate: {
      color:
        '#9B8B84',

      fontSize:
        7.5,

      marginTop:
        3,
    },

    orderRowAmount: {
      color:
        '#A00B0F',

      fontSize:
        10,

      fontWeight:
        '900',
    },

    ordersLoading: {
      minHeight:
        85,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        14,

      borderWidth:
        1,

      borderColor:
        '#EEE5E0',
    },

    ordersLoadingText: {
      color:
        '#8D817C',

      fontSize:
        8,

      marginTop:
        7,
    },

    noOrdersCard: {
      minHeight:
        130,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        15,

      borderWidth:
        1,

      borderColor:
        '#EEE5E0',

      paddingHorizontal:
        20,
    },

    noOrdersTitle: {
      color:
        '#4A3C36',

      fontSize:
        10,

      fontWeight:
        '900',

      marginTop:
        8,
    },

    noOrdersText: {
      maxWidth:
        260,

      color:
        '#998B85',

      fontSize:
        7.5,

      lineHeight:
        12,

      textAlign:
        'center',

      marginTop:
        4,
    },

    /* =====================================================
     * PAYMENT LOCKED
     * ===================================================== */

    paymentLockedCard: {
      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#F0E4DF',

      borderRadius:
        18,

      padding:
        16,

      alignItems:
        'center',
    },

    lockIcon: {
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
        '#FFF0F0',
    },

    paymentLockedTitle: {
      color:
        '#30231E',

      fontSize:
        14,

      fontWeight:
        '900',

      marginTop:
        10,
    },

    paymentLockedText: {
      maxWidth:
        310,

      color:
        '#887A74',

      fontSize:
        8.5,

      lineHeight:
        14,

      textAlign:
        'center',

      marginTop:
        5,
    },

    lockedSchedule: {
      width:
        '100%',

      marginTop:
        18,

      backgroundColor:
        '#FAF7F5',

      borderRadius:
        14,

      padding:
        12,
    },

    scheduleStep: {
      flexDirection:
        'row',

      minHeight:
        60,
    },

    scheduleLeft: {
      width:
        31,

      alignItems:
        'center',
    },

    scheduleNumber: {
      width:
        27,

      height:
        27,

      borderRadius:
        14,

      backgroundColor:
        '#A00B0F',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    scheduleNumberText: {
      color:
        '#FFFFFF',

      fontSize:
        9,

      fontWeight:
        '900',
    },

    scheduleLine: {
      width:
        1,

      flex:
        1,

      backgroundColor:
        '#E6D5D3',

      marginVertical:
        3,
    },

    scheduleContent: {
      flex:
        1,

      paddingLeft:
        9,

      paddingBottom:
        12,
    },

    scheduleTitle: {
      color:
        '#3E302B',

      fontSize:
        9.5,

      fontWeight:
        '900',
    },

    scheduleDescription: {
      color:
        '#93847E',

      fontSize:
        7.5,

      lineHeight:
        12,

      marginTop:
        3,
    },

    /* =====================================================
     * PAYMENT METHODS
     * ===================================================== */

    methodHeading: {
      marginTop:
        2,

      marginBottom:
        12,
    },

    methodTitle: {
      color:
        '#2A1F1B',

      fontSize:
        17,

      fontWeight:
        '900',
    },

    methodSubtitle: {
      color:
        '#91817A',

      fontSize:
        8.5,

      lineHeight:
        13,

      marginTop:
        4,
    },

    methodContainer: {
      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EFE5E0',

      borderRadius:
        18,

      overflow:
        'hidden',
    },

    paymentMethod: {
      minHeight:
        76,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        12,

      borderBottomWidth:
        1,

      borderBottomColor:
        '#F2EAE6',
    },

    disabledMethod: {
      opacity:
        0.45,
    },

    methodIcon: {
      width:
        48,

      height:
        48,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FAF8F8',

      borderWidth:
        1,

      borderColor:
        '#F1EBE8',

      marginRight:
        12,
    },

    paymentLogo: {
      width:
        35,

      height:
        35,
    },

    methodContent: {
      flex:
        1,

      paddingRight:
        10,
    },

    methodName: {
      color:
        '#30231E',

      fontSize:
        11,

      fontWeight:
        '900',
    },

    methodDescription: {
      color:
        '#94847D',

      fontSize:
        7.5,

      lineHeight:
        12,

      marginTop:
        3,
    },

    nextIcon: {
      width:
        16,

      height:
        16,
    },

    /* =====================================================
     * INVOICE INFO
     * ===================================================== */

    invoiceInfoBox: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      backgroundColor:
        '#F2FAF5',

      borderWidth:
        1,

      borderColor:
        '#DCEFE2',

      borderRadius:
        14,

      padding:
        12,

      marginTop:
        12,
    },

    invoiceInfoContent: {
      flex:
        1,

      marginLeft:
        9,
    },

    invoiceInfoTitle: {
      color:
        '#2F6D43',

      fontSize:
        9,

      fontWeight:
        '900',
    },

    invoiceInfoText: {
      color:
        '#607366',

      fontSize:
        7.5,

      lineHeight:
        12,

      marginTop:
        3,
    },

    /* =====================================================
     * POPUP
     * ===================================================== */

    popupOverlay: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(20,15,18,0.64)',

      paddingHorizontal:
        22,
    },

    popupCard: {
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
        26,

      paddingBottom:
        20,
    },

    popupIconOuter: {
      width:
        78,

      height:
        78,

      borderRadius:
        39,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    popupTitle: {
      color:
        '#2A2027',

      fontSize:
        19,

      fontWeight:
        '900',

      textAlign:
        'center',

      marginTop:
        14,
    },

    popupMessage: {
      color:
        '#776D72',

      fontSize:
        10,

      lineHeight:
        17,

      textAlign:
        'center',

      marginTop:
        7,
    },

    popupButtonRow: {
      width:
        '100%',

      flexDirection:
        'row',

      marginTop:
        20,
    },

    popupSecondaryButton: {
      flex:
        1,

      minHeight:
        48,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        12,

      borderWidth:
        1,

      borderColor:
        '#E7DEE1',

      backgroundColor:
        '#F8F5F6',

      marginRight:
        5,
    },

    popupSecondaryText: {
      color:
        '#6D6268',

      fontSize:
        10,

      fontWeight:
        '900',
    },

    popupPrimaryButton: {
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

    popupPrimaryText: {
      color:
        '#FFFFFF',

      fontSize:
        10,

      fontWeight:
        '900',
    },

    /* =====================================================
     * SUCCESS
     * ===================================================== */

    successOverlay: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(20,15,18,0.66)',

      paddingHorizontal:
        22,
    },

    successCard: {
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
        28,

      paddingBottom:
        22,
    },

    successCircleOuter: {
      width:
        90,

      height:
        90,

      borderRadius:
        45,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#E8F7ED',
    },

    successCircle: {
      width:
        64,

      height:
        64,

      borderRadius:
        32,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#278850',
    },

    successTitle: {
      color:
        '#2C2327',

      fontSize:
        20,

      fontWeight:
        '900',

      marginTop:
        16,
    },

    successText: {
      maxWidth:
        300,

      color:
        '#786E73',

      fontSize:
        9.5,

      lineHeight:
        16,

      textAlign:
        'center',

      marginTop:
        6,
    },

    successBadge: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#F2FAF5',

      borderRadius:
        20,

      paddingHorizontal:
        11,

      paddingVertical:
        7,

      marginTop:
        15,
    },

    successBadgeText: {
      color:
        '#427254',

      fontSize:
        8,

      fontWeight:
        '800',

      marginLeft:
        5,
    },

    doneButton: {
      width:
        '100%',

      minHeight:
        51,

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
    },

    doneText: {
      color:
        '#FFFFFF',

      fontSize:
        10.5,

      fontWeight:
        '900',

      marginRight:
        7,
    },
  });