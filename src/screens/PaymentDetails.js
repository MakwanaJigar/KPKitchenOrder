import React, {
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Linking,
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

import AsyncStorage from '@react-native-async-storage/async-storage';

import Ionicons from 'react-native-vector-icons/Ionicons';

import {
  PlatformPay,
  usePlatformPay,
  useStripe,
} from '@stripe/stripe-react-native';

/* =========================================================
 * CONFIGURATION
 * ========================================================= */

const UPI_MERCHANT_VPA =
  'YOUR_UPI_ID@bank';

const UPI_MERCHANT_NAME =
  'KP Cloud Kitchen';

const UPI_MERCHANT_CODE =
  '5812';

const GOOGLE_PAY_MERCHANT_COUNTRY =
  'US';

/* =========================================================
 * STORAGE
 * ========================================================= */

const CART_STORAGE_KEY =
  'kp_customer_cart';

/* =========================================================
 * APIs
 * ========================================================= */

const getCreateOrderPaymentIntentApi =
  orderId =>
    `https://replete-software.com/projects/kp_admin/api/customer/orders/${orderId}/create-payment-intent`;

const getConfirmOrderApi =
  orderId =>
    `https://replete-software.com/projects/kp_admin/api/customer/orders/${orderId}/confirm`;

const getCreateBillPaymentIntentApi =
  billId =>
    `https://replete-software.com/projects/kp_admin/api/customer/weekly-bills/${billId}/create-payment-intent`;

const getConfirmBillPaymentApi =
  billId =>
    `https://replete-software.com/projects/kp_admin/api/customer/weekly-bills/${billId}/confirm-payment`;

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
   * ROUTE PARAMS
   * ======================================================= */

  const orderId =
    route?.params?.orderId ??
    null;

  const billId =
    route?.params?.billId ??
    null;

  const isWeeklyBill =
    Boolean(
      route?.params
        ?.isWeeklyBill,
    );

  const billNumber =
    route?.params
      ?.billNumber ??
    null;

  const totalAmount =
    Number(
      route?.params
        ?.totalAmount ??
        route?.params
          ?.balanceAmount ??
        0,
    );

  const subtotal =
    Number(
      route?.params
        ?.subtotal ??
        totalAmount,
    );

  const deliveryFee =
    Number(
      route?.params
        ?.deliveryFee ??
        0,
    );

  const currency =
    String(
      route?.params
        ?.currency ??
        'AUD',
    ).toUpperCase();

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
   * STATES
   * ======================================================= */

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

      /*
       * NEW
       *
       * If image exists,
       * popup will show image
       * instead of Ionicon.
       */

      image:
        null,

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
          width >=
          768;

        return {
          contentWidth:
            isTablet
              ? Math.min(
                  width -
                    80,
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

  const isProcessing =
    Boolean(
      processingMethod,
    );

  /* =======================================================
   * CUSTOM POPUP HELPER
   * ======================================================= */

  const showPopup =
    ({
      type =
        'info',

      title,

      message,

      image =
        null,

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

        image,

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
   * VALIDATE PAYMENT DATA
   * ======================================================= */

  const validatePaymentData =
    () => {
      if (
        !orderId &&
        !billId
      ) {
        showPopup({
          type:
            'error',

          title:
            'Payment Reference Missing',

          message:
            'The order or weekly bill reference was not supplied. Please return and try again.',

          /*
           * NEW IMAGE
           */

          image:
            require('../assets/login-icons/wallet.png'),

          primaryText:
            'Go Back',

          onPrimary:
            () => {
              navigation.goBack();
            },
        });

        return false;
      }

      if (
        !totalAmount ||
        totalAmount <=
          0
      ) {
        showPopup({
          type:
            'error',

          title:
            'Invalid Amount',

          message:
            'There is no valid outstanding amount available for this payment.',
        });

        return false;
      }

      return true;
    };

  /* =======================================================
   * CREATE STRIPE PAYMENT INTENT
   * ======================================================= */

  const createStripePaymentIntent =
    async () => {
      if (
        !validatePaymentData()
      ) {
        throw new Error(
          'Invalid payment data.',
        );
      }

      const token =
        await AsyncStorage.getItem(
          'token',
        );

      if (
        !token
      ) {
        throw new Error(
          'Your login session has expired. Please login again.',
        );
      }

      const api =
        isWeeklyBill
          ? getCreateBillPaymentIntentApi(
              billId,
            )
          : getCreateOrderPaymentIntentApi(
              orderId,
            );

      console.log(
        '==============================================',
      );

      console.log(
        'CREATE PAYMENT INTENT API:',
        api,
      );

      console.log(
        'PAYMENT TYPE:',
        isWeeklyBill
          ? 'WEEKLY BILL'
          : 'ORDER',
      );

      console.log(
        'AMOUNT:',
        totalAmount,
      );

      console.log(
        '==============================================',
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
                order_id:
                  orderId,

                bill_id:
                  billId,

                payable_type:
                  isWeeklyBill
                    ? 'weekly_bill'
                    : 'order',

                amount:
                  Number(
                    totalAmount.toFixed(
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
            'RAW PAYMENT RESPONSE:',
            responseText,
          );

          throw new Error(
            'Invalid payment server response.',
          );
        }
      }

      console.log(
        'PAYMENT INTENT STATUS:',
        response.status,
      );

      console.log(
        'PAYMENT INTENT RESULT:',
        result,
      );

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

      if (
        !response.ok
      ) {
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

      const intentId =
        result
          ?.payment_intent_id ??
        result?.data
          ?.payment_intent_id ??
        result
          ?.payment_intent
          ?.id ??
        null;

      if (
        !clientSecret
      ) {
        throw new Error(
          'Stripe client secret was not returned by the server.',
        );
      }

      if (
        typeof clientSecret !==
        'string'
      ) {
        throw new Error(
          'Invalid Stripe client secret.',
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
          'Invalid Stripe PaymentIntent client secret.',
        );
      }

      return {
        clientSecret,

        paymentIntentId:
          intentId,
      };
    };

  /* =======================================================
   * CONFIRM PAYMENT
   * ======================================================= */

  const confirmPayment =
    async ({
      currentPaymentIntentId,

      paymentMethod,
    }) => {
      const token =
        await AsyncStorage.getItem(
          'token',
        );

      if (
        !token
      ) {
        throw new Error(
          'Your session has expired. Please login again.',
        );
      }

      const api =
        isWeeklyBill
          ? getConfirmBillPaymentApi(
              billId,
            )
          : getConfirmOrderApi(
              orderId,
            );

      console.log(
        'CONFIRM PAYMENT API:',
        api,
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
                  currentPaymentIntentId,

                payment_method:
                  paymentMethod,

                bill_id:
                  billId,

                order_id:
                  orderId,
              }),
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

      if (
        !response.ok
      ) {
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
      if (
        !isWeeklyBill
      ) {
        await AsyncStorage.removeItem(
          CART_STORAGE_KEY,
        );
      }

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
        isProcessing
      ) {
        return;
      }

      if (
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
              'KP Cloud Kitchen',

            paymentIntentClientSecret:
              paymentData
                .clientSecret,

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

        if (
          paymentError
        ) {
          const code =
            String(
              paymentError
                ?.code ??
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
          currentPaymentIntentId:
            paymentData
              .paymentIntentId,

          paymentMethod:
            'stripe',
        });

        await completePayment(
          'Card',
        );
      } catch (
        error
      ) {
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
        isProcessing
      ) {
        return;
      }

      if (
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

        if (
          !supported
        ) {
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
            paymentData
              .clientSecret,

            {
              googlePay: {
                testEnv:
                  __DEV__,

                merchantName:
                  'KP Cloud Kitchen',

                merchantCountryCode:
                  GOOGLE_PAY_MERCHANT_COUNTRY,

                currencyCode:
                  currency,

                billingAddressConfig:
                  {
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

        if (
          error
        ) {
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
          currentPaymentIntentId:
            paymentData
              .paymentIntentId,

          paymentMethod:
            'google_pay',
        });

        await completePayment(
          'Google Pay',
        );
      } catch (
        error
      ) {
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
   * UPI VALIDATION
   * ======================================================= */

  const validateUpiPayment =
    () => {
      if (
        !validatePaymentData()
      ) {
        return false;
      }

      if (
        currency !==
        'INR'
      ) {
        showPopup({
          type:
            'warning',

          title:
            'UPI Not Available',

          message:
            `PhonePe, CRED and UPI require an INR transaction. This bill is currently in ${currency}.`,
        });

        return false;
      }

      if (
        UPI_MERCHANT_VPA.includes(
          'YOUR_UPI_ID',
        )
      ) {
        showPopup({
          type:
            'warning',

          title:
            'UPI Setup Required',

          message:
            'Please configure your verified merchant UPI ID before using PhonePe, CRED or other UPI applications.',
        });

        return false;
      }

      return true;
    };

  /* =======================================================
   * BUILD UPI
   * ======================================================= */

  const buildUpiQuery =
    () => {
      const transactionRef =
        `${
          isWeeklyBill
            ? `BILL-${billId}`
            : `ORDER-${orderId}`
        }-${Date.now()}`;

      return [
        `pa=${encodeURIComponent(
          UPI_MERCHANT_VPA,
        )}`,

        `pn=${encodeURIComponent(
          UPI_MERCHANT_NAME,
        )}`,

        `mc=${encodeURIComponent(
          UPI_MERCHANT_CODE,
        )}`,

        `tr=${encodeURIComponent(
          transactionRef,
        )}`,

        `tn=${encodeURIComponent(
          isWeeklyBill
            ? `Weekly bill ${
                billNumber ??
                billId
              }`
            : `Order ${orderId}`,
        )}`,

        `am=${encodeURIComponent(
          totalAmount.toFixed(
            2,
          ),
        )}`,

        'cu=INR',
      ].join(
        '&',
      );
    };

  /* =======================================================
   * GENERIC UPI
   * ======================================================= */

  const openGenericUpi =
    async () => {
      const url =
        `upi://pay?${buildUpiQuery()}`;

      await Linking.openURL(
        url,
      );
    };

  /* =======================================================
   * OPEN SPECIFIC UPI APP
   * ======================================================= */

  const openAndroidUpiApp =
    async ({
      packageName,
    }) => {
      const query =
        buildUpiQuery();

      const intentUrl =
        `intent://pay?${query}` +
        `#Intent;scheme=upi;package=${packageName};end`;

      try {
        await Linking.openURL(
          intentUrl,
        );

        return true;
      } catch (
        error
      ) {
        console.log(
          'DIRECT UPI ERROR:',
          error,
        );

        return false;
      }
    };

  /* =======================================================
   * APPLE PAY BUTTON
   *
   * NOTE:
   * Your current code is using
   * the old PhonePe Android UPI handler here.
   * ======================================================= */

  const handleApplePay =
    async () => {
      if (
        isProcessing ||
        !validateUpiPayment()
      ) {
        return;
      }

      try {
        setProcessingMethod(
          'phonepe',
        );

        let opened =
          false;

        if (
          Platform.OS ===
          'android'
        ) {
          opened =
            await openAndroidUpiApp({
              packageName:
                'com.phonepe.app',
            });
        }

        if (
          !opened
        ) {
          showPopup({
            type:
              'info',

            title:
              'Open UPI App',

            message:
              'PhonePe could not be opened directly. Would you like to choose another installed UPI application?',

            primaryText:
              'Continue',

            secondaryText:
              'Cancel',

            onPrimary:
              async () => {
                try {
                  await openGenericUpi();
                } catch (
                  error
                ) {
                  showPopup({
                    type:
                      'error',

                    title:
                      'PhonePe',

                    message:
                      'No compatible UPI application was found.',
                  });
                }
              },
          });

          return;
        }

        showPopup({
          type:
            'info',

          title:
            'Complete Payment',

          message:
            'PhonePe has been opened. Complete the payment there. Your outstanding balance will remain until the server verifies the transaction.',
        });
      } catch (
        error
      ) {
        showPopup({
          type:
            'error',

          title:
            'PhonePe',

          message:
            error?.message ??
            'Unable to open PhonePe.',
        });
      } finally {
        setProcessingMethod(
          null,
        );
      }
    };

  /* =======================================================
   * CRED
   * ======================================================= */

  const handleCred =
    async () => {
      if (
        isProcessing ||
        !validateUpiPayment()
      ) {
        return;
      }

      try {
        setProcessingMethod(
          'cred',
        );

        let opened =
          false;

        if (
          Platform.OS ===
          'android'
        ) {
          opened =
            await openAndroidUpiApp({
              packageName:
                'com.dreamplug.androidapp',
            });
        }

        if (
          !opened
        ) {
          showPopup({
            type:
              'info',

            title:
              'Open UPI App',

            message:
              'CRED could not be opened directly. Would you like to choose another installed UPI application?',

            primaryText:
              'Continue',

            secondaryText:
              'Cancel',

            onPrimary:
              async () => {
                try {
                  await openGenericUpi();
                } catch (
                  error
                ) {
                  showPopup({
                    type:
                      'error',

                    title:
                      'CRED',

                    message:
                      'No compatible UPI application was found.',
                  });
                }
              },
          });

          return;
        }

        showPopup({
          type:
            'info',

          title:
            'Complete Payment',

          message:
            'CRED has been opened. Complete the payment there. Your outstanding amount remains until payment is verified.',
        });
      } catch (
        error
      ) {
        showPopup({
          type:
            'error',

          title:
            'CRED',

          message:
            error?.message ??
            'Unable to open CRED.',
        });
      } finally {
        setProcessingMethod(
          null,
        );
      }
    };

  /* =======================================================
   * OTHER UPI
   * ======================================================= */

  const handleOtherUpi =
    async () => {
      if (
        isProcessing ||
        !validateUpiPayment()
      ) {
        return;
      }

      try {
        setProcessingMethod(
          'upi',
        );

        await openGenericUpi();

        showPopup({
          type:
            'info',

          title:
            'UPI App Opened',

          message:
            'Complete your payment in the selected UPI app. The outstanding balance remains until your backend verifies payment.',
        });
      } catch (
        error
      ) {
        showPopup({
          type:
            'error',

          title:
            'UPI Payment',

          message:
            error?.message ??
            'No compatible UPI application was found.',
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

  const paymentMethods =
    [
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
          'ApplePay',

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
   * DONE
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
        }>

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
          ]}>

          {/* HEADER */}

          <View
            style={[
              styles.header,

              {
                paddingHorizontal:
                  responsive
                    .padding,
              },
            ]}>

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
                styles.headerText
              }>

              <Text
                style={
                  styles.headerEyebrow
                }>
                {isWeeklyBill
                  ? 'WEEKLY BILL'
                  : 'PAYMENT'}
              </Text>

              <Text
                style={
                  styles.headerTitle
                }>
                {isWeeklyBill
                  ? 'Pay Weekly Bill'
                  : 'Payment Method'}
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
                  responsive
                    .padding,
              },
            ]}>

            {/* AMOUNT SUMMARY */}

            <View
              style={
                styles.orderSummary
              }>

              <View
                style={
                  styles.orderSummaryTop
                }>

                <View>

                  <Text
                    style={
                      styles.summaryLabel
                    }>
                    {isWeeklyBill
                      ? 'WEEKLY BILL'
                      : 'ORDER'}
                  </Text>

                  <Text
                    style={
                      styles.orderNumber
                    }>
                    {isWeeklyBill
                      ? billNumber ??
                        `#${billId ?? 'N/A'}`
                      : orderId ??
                        'N/A'}
                  </Text>

                </View>

                <View
                  style={
                    styles.pendingBadge
                  }>

                  <View
                    style={
                      styles.pendingDot
                    }
                  />

                  <Text
                    style={
                      styles.pendingText
                    }>
                    Payment Pending
                  </Text>

                </View>

              </View>

              <View
                style={
                  styles.summaryDivider
                }
              />

              {!isWeeklyBill && (
                <>
                  <SummaryRow
                    label="Subtotal"
                    value={`${currency} ${subtotal.toFixed(
                      2,
                    )}`}
                  />

                  <SummaryRow
                    label="Delivery Fee"
                    value={
                      deliveryFee ===
                      0
                        ? 'FREE'
                        : `${currency} ${deliveryFee.toFixed(
                            2,
                          )}`
                    }
                  />

                  <View
                    style={
                      styles.summaryDivider
                    }
                  />
                </>
              )}

              <View
                style={
                  styles.totalRow
                }>

                <View>

                  <Text
                    style={
                      styles.totalLabel
                    }>
                    {isWeeklyBill
                      ? 'Outstanding Balance'
                      : 'Amount to Pay'}
                  </Text>

                  {isWeeklyBill && (
                    <Text
                      style={
                        styles.balanceNote
                      }>
                      Balance remains until payment is verified
                    </Text>
                  )}

                </View>

                <Text
                  style={
                    styles.totalAmount
                  }>
                  {currency}{' '}
                  {totalAmount.toFixed(
                    2,
                  )}
                </Text>

              </View>

            </View>

            {/* HEADING */}

            <View
              style={
                styles.methodHeading
              }>

              <Text
                style={
                  styles.methodTitle
                }>
                Choose Payment Method
              </Text>

              <Text
                style={
                  styles.methodSubtitle
                }>
                Select how you would like
                to pay the outstanding amount.
              </Text>

            </View>

            {/* PAYMENT METHODS */}

            <View
              style={
                styles.methodContainer
              }>

              {paymentMethods.map(
                method => {
                  const loading =
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
                          !loading &&
                          styles.disabledMethod,
                      ]}
                      onPress={
                        method.onPress
                      }>

                      <View
                        style={
                          styles.methodIcon
                        }>

                        {loading ? (
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
                        }>

                        <Text
                          style={
                            styles.methodName
                          }>
                          {
                            method.title
                          }
                        </Text>

                        <Text
                          style={
                            styles.methodDescription
                          }>
                          {
                            method.subtitle
                          }
                        </Text>

                      </View>

                      <Image
                        source={require('../assets/login-icons/next.png')}
                        style={
                          styles.quantityIcon
                        }
                        resizeMode="contain"
                      />

                    </TouchableOpacity>
                  );
                },
              )}

            </View>

            {/* WEEKLY BILL */}

            {isWeeklyBill && (
              <View
                style={
                  styles.billInfoBox
                }>

                <Ionicons
                  name="calendar-outline"
                  size={
                    19
                  }
                  color="#A00B0F"
                />

                <View
                  style={
                    styles.billInfoContent
                  }>

                  <Text
                    style={
                      styles.billInfoTitle
                    }>
                    Weekly Billing
                  </Text>

                  <Text
                    style={
                      styles.billInfoText
                    }>
                    Weekly bills are generated every Saturday.
                    Outstanding bills must be cleared by Monday
                    to continue placing new tiffin orders.
                  </Text>

                </View>

              </View>
            )}

            <View
              style={{
                height:
                  40,
              }}
            />

          </ScrollView>

        </View>

      </SafeAreaView>

      {/* ===================================================== */}
      {/* CUSTOM POPUP */}
      {/* ===================================================== */}

      <Modal
        visible={
          popupVisible
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={
          closePopup
        }>

        <View
          style={
            styles.popupOverlay
          }>

          <View
            style={
              styles.popupCard
            }>

            {/* ============================================= */}
            {/* IMAGE OR ICON */}
            {/* ============================================= */}

            {popupData.image ? (
              <View
                style={
                  styles.popupImageOuter
                }>

                <Image
                  source={
                    popupData.image
                  }
                  style={
                    styles.popupImage
                  }
                  resizeMode="contain"
                />

              </View>
            ) : (
              <View
                style={[
                  styles.popupIconOuter,

                  {
                    backgroundColor:
                      popupIcon
                        .background,
                  },
                ]}>

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
            )}

            <Text
              style={
                styles.popupTitle
              }>
              {popupData.title}
            </Text>

            <Text
              style={
                styles.popupMessage
              }>
              {popupData.message}
            </Text>

            <View
              style={
                styles.popupButtonRow
              }>

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
                  }>

                  <Text
                    style={
                      styles.popupSecondaryText
                    }>
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
                }>

                <Text
                  style={
                    styles.popupPrimaryText
                  }>
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

      {/* ===================================================== */}
      {/* SUCCESS MODAL */}
      {/* ===================================================== */}

      <Modal
        visible={
          successVisible
        }
        transparent
        animationType="fade"
        statusBarTranslucent>

        <View
          style={
            styles.overlay
          }>

          <View
            style={
              styles.successCard
            }>

            <View
              style={
                styles.successCircle
              }>

              <Ionicons
                name="checkmark"
                size={
                  42
                }
                color="#FFFFFF"
              />

            </View>

            <Text
              style={
                styles.successTitle
              }>
              Payment Successful!
            </Text>

            <Text
              style={
                styles.successText
              }>
              {isWeeklyBill
                ? 'Your weekly outstanding bill has been paid successfully. You can continue ordering tiffins.'
                : 'Your payment has been verified successfully.'}
            </Text>

            <View
              style={
                styles.successBadge
              }>

              <Ionicons
                name="shield-checkmark-outline"
                size={
                  16
                }
                color="#278850"
              />

              <Text
                style={
                  styles.successBadgeText
                }>
                Paid with{' '}
                {successfulMethod}
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
              }>

              <Text
                style={
                  styles.doneText
                }>
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
      }>

      <Text
        style={
          styles.summaryRowLabel
        }>
        {label}
      </Text>

      <Text
        style={
          styles.summaryRowValue
        }>
        {value}
      </Text>

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
     * SUMMARY
     * ===================================================== */

    orderSummary: {
      backgroundColor:
        '#A00B0F',

      borderRadius:
        20,

      padding:
        18,

      marginBottom:
        20,

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
        '#B9A9A1',

      fontSize:
        7,

      fontWeight:
        '800',

      letterSpacing:
        1,
    },

    orderNumber: {
      color:
        '#FFFFFF',

      fontSize:
        13,

      fontWeight:
        '900',

      marginTop:
        4,
    },

    pendingBadge: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        'rgba(255,255,255,.1)',

      borderRadius:
        20,

      paddingHorizontal:
        9,

      paddingVertical:
        6,
    },

    pendingDot: {
      width:
        7,

      height:
        7,

      borderRadius:
        4,

      backgroundColor:
        '#F2B85B',

      marginRight:
        5,
    },

    pendingText: {
      color:
        '#F9D79F',

      fontSize:
        7.5,

      fontWeight:
        '800',
    },

    summaryDivider: {
      height:
        1,

      backgroundColor:
        'rgba(255,255,255,.12)',

      marginVertical:
        14,
    },

    summaryRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',

      marginBottom:
        8,
    },

    summaryRowLabel: {
      color:
        '#C8B9B2',

      fontSize:
        8,
    },

    summaryRowValue: {
      color:
        '#FFFFFF',

      fontSize:
        8.5,

      fontWeight:
        '800',
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
        '#D6C9C3',

      fontSize:
        9,

      fontWeight:
        '800',
    },

    balanceNote: {
      color:
        '#A89991',

      fontSize:
        6.8,

      marginTop:
        4,
    },

    totalAmount: {
      color:
        '#FFFFFF',

      fontSize:
        21,

      fontWeight:
        '900',
    },

    /* =====================================================
     * PAYMENT HEADING
     * ===================================================== */

    methodHeading: {
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

    /* =====================================================
     * PAYMENT METHODS
     * ===================================================== */

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

    quantityIcon: {
      width:
        16,

      height:
        16,
    },

    /* =====================================================
     * WEEKLY BILL
     * ===================================================== */

    billInfoBox: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      backgroundColor:
        '#FFF2F2',

      borderWidth:
        1,

      borderColor:
        '#F3DADB',

      borderRadius:
        14,

      padding:
        12,

      marginTop:
        12,
    },

    billInfoContent: {
      flex:
        1,

      marginLeft:
        9,
    },

    billInfoTitle: {
      color:
        '#6D2528',

      fontSize:
        9,

      fontWeight:
        '900',
    },

    billInfoText: {
      color:
        '#86696B',

      fontSize:
        7.5,

      lineHeight:
        12,

      marginTop:
        3,
    },

    /* =====================================================
     * CUSTOM POPUP
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

    /* DEFAULT POPUP ICON */

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

    /* NEW CUSTOM POPUP IMAGE */

    popupImageOuter: {
      width:
        110,

      height:
        110,

      borderRadius:
        55,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF3F3',

      borderWidth:
        1,

      borderColor:
        '#F5DDDE',
    },

    popupImage: {
      width:
        78,

      height:
        78,
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
        '#71666C',

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

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        24,

      padding:
        25,
    },

    successCircle: {
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

      backgroundColor:
        '#26975B',
    },

    successTitle: {
      color:
        '#241D2B',

      fontSize:
        19,

      fontWeight:
        '900',

      textAlign:
        'center',

      marginTop:
        17,
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

    successBadge: {
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

    successBadgeText: {
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
        20,
    },

    doneText: {
      color:
        '#FFFFFF',

      fontSize:
        11,

      fontWeight:
        '900',
    },
  });