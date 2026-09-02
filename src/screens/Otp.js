import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Image,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import axios from 'axios';

/* =========================================================
 * API
 * ========================================================= */

const VERIFY_OTP_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/verify-otp';

const RESEND_OTP_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/forget-password';

/* =========================================================
 * RESET STORAGE
 * ========================================================= */

const RESET_EMAIL_STORAGE_KEY =
  'kp_reset_password_email';

const RESET_OTP_STORAGE_KEY =
  'kp_reset_password_otp';

const RESET_TOKEN_STORAGE_KEY =
  'kp_reset_password_token';

/* =========================================================
 * CONFIG
 * ========================================================= */

const OTP_LENGTH =
  6;

const RESEND_TIME =
  60;

/* =========================================================
 * OTP SCREEN
 * ========================================================= */

const Otp = ({
  navigation,
  route,
}) => {
  const {
    width,
    height,
  } =
    useWindowDimensions();

  /* =======================================================
   * EMAIL
   *
   * Do not depend only on navigation params.
   * ======================================================= */

  const routeEmail =
    route?.params?.email ??
    '';

  const [
    email,
    setEmail,
  ] =
    useState(
      routeEmail,
    );

  const [
    loadingEmail,
    setLoadingEmail,
  ] =
    useState(true);

  /* =======================================================
   * OTP
   * ======================================================= */

  const [
    otp,
    setOtp,
  ] =
    useState(
      Array.from(
        {
          length:
            OTP_LENGTH,
        },

        () =>
          '',
      ),
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    resending,
    setResending,
  ] =
    useState(false);

  const [
    remainingSeconds,
    setRemainingSeconds,
  ] =
    useState(
      RESEND_TIME,
    );

  const inputRefs =
    useRef([]);

  /* =======================================================
   * RESPONSIVE
   * ======================================================= */

  const isSmallScreen =
    width <= 360;

  const isTablet =
    width >= 768;

  const isShortScreen =
    height <= 700;

  const containerWidth =
    isTablet
      ? 500
      : width - 32;

  const otpBoxSize =
    useMemo(
      () => {
        if (
          isSmallScreen
        ) {
          return 41;
        }

        if (
          isTablet
        ) {
          return 55;
        }

        return 47;
      },
      [
        isSmallScreen,
        isTablet,
      ],
    );

  const otpGap =
    isSmallScreen
      ? 5
      : 8;

  /* =======================================================
   * RESTORE EMAIL
   *
   * CRITICAL:
   * If route params are lost, recover the email sent
   * from ForgotPassword.
   * ======================================================= */

  useEffect(
    () => {
      const loadEmail =
        async () => {
          try {
            setLoadingEmail(
              true,
            );

            if (
              routeEmail &&
              String(
                routeEmail,
              ).trim()
            ) {
              const cleanRouteEmail =
                String(
                  routeEmail,
                )
                  .trim()
                  .toLowerCase();

              setEmail(
                cleanRouteEmail,
              );

              await AsyncStorage.setItem(
                RESET_EMAIL_STORAGE_KEY,
                cleanRouteEmail,
              );

              return;
            }

            const storedEmail =
              await AsyncStorage.getItem(
                RESET_EMAIL_STORAGE_KEY,
              );

            if (
              storedEmail
            ) {
              setEmail(
                storedEmail
                  .trim()
                  .toLowerCase(),
              );
            }
          } catch (
            error
          ) {
            console.log(
              'OTP LOAD EMAIL ERROR:',
              error,
            );
          } finally {
            setLoadingEmail(
              false,
            );
          }
        };

      loadEmail();
    },
    [
      routeEmail,
    ],
  );

  /* =======================================================
   * TIMER
   * ======================================================= */

  useEffect(
    () => {
      if (
        remainingSeconds <=
        0
      ) {
        return undefined;
      }

      const timer =
        setInterval(
          () => {
            setRemainingSeconds(
              previousSeconds =>
                previousSeconds >
                0
                  ? previousSeconds -
                    1
                  : 0,
            );
          },
          1000,
        );

      return () =>
        clearInterval(
          timer,
        );
    },
    [
      remainingSeconds,
    ],
  );

  /* =======================================================
   * AUTO FOCUS
   * ======================================================= */

  useEffect(
    () => {
      const focusTimer =
        setTimeout(
          () => {
            inputRefs
              .current[0]
              ?.focus();
          },
          400,
        );

      return () =>
        clearTimeout(
          focusTimer,
        );
    },
    [],
  );

  /* =======================================================
   * TIMER FORMAT
   * ======================================================= */

  const formattedTimer =
    useMemo(
      () => {
        const minutes =
          Math.floor(
            remainingSeconds /
              60,
          );

        const seconds =
          remainingSeconds %
          60;

        return `${String(
          minutes,
        ).padStart(
          2,
          '0',
        )}:${String(
          seconds,
        ).padStart(
          2,
          '0',
        )}`;
      },
      [
        remainingSeconds,
      ],
    );

  /* =======================================================
   * MASK EMAIL
   * ======================================================= */

  const maskedEmail =
    useMemo(
      () => {
        if (
          !email ||
          !email.includes(
            '@',
          )
        ) {
          return (
            email ||
            'your registered email address'
          );
        }

        const [
          username,
          domain,
        ] =
          email.split(
            '@',
          );

        if (
          username.length <=
          2
        ) {
          return `${username.charAt(
            0,
          )}***@${domain}`;
        }

        return `${username.slice(
          0,
          2,
        )}${'*'.repeat(
          Math.max(
            3,
            username.length -
              2,
          ),
        )}@${domain}`;
      },
      [
        email,
      ],
    );

  /* =======================================================
   * API ERROR
   * ======================================================= */

  const getApiErrorMessage =
    error => {
      if (
        !error?.response
      ) {
        if (
          error?.code ===
          'ECONNABORTED'
        ) {
          return 'The request timed out. Please try again.';
        }

        return 'Unable to connect to the server. Please check your internet connection.';
      }

      const responseData =
        error.response.data;

      if (
        responseData?.errors
      ) {
        const validationMessages =
          Object.values(
            responseData.errors,
          )
            .flat()
            .filter(
              Boolean,
            );

        if (
          validationMessages.length >
          0
        ) {
          return validationMessages.join(
            '\n',
          );
        }
      }

      if (
        error.response.status ===
        404
      ) {
        return (
          responseData?.message ||
          'The verification request was not found. Please request a new code.'
        );
      }

      if (
        error.response.status ===
        422
      ) {
        return (
          responseData?.message ||
          'The verification code is invalid or has expired.'
        );
      }

      if (
        error.response.status ===
        429
      ) {
        return (
          responseData?.message ||
          'Too many attempts. Please wait before trying again.'
        );
      }

      return (
        responseData?.message ||
        responseData?.error ||
        'Unable to verify the code. Please try again.'
      );
    };

  /* =======================================================
   * OTP CHANGE
   * ======================================================= */

  const handleOtpChange =
    (
      value,
      index,
    ) => {
      const cleanValue =
        value.replace(
          /[^0-9]/g,
          '',
        );

      if (
        cleanValue.length >
        1
      ) {
        handleOtpPaste(
          cleanValue,
        );

        return;
      }

      const updatedOtp =
        [
          ...otp,
        ];

      updatedOtp[
        index
      ] =
        cleanValue;

      setOtp(
        updatedOtp,
      );

      if (
        cleanValue &&
        index <
          OTP_LENGTH -
            1
      ) {
        inputRefs
          .current[
            index + 1
          ]
          ?.focus();
      }
    };

  /* =======================================================
   * OTP PASTE
   * ======================================================= */

  const handleOtpPaste =
    value => {
      const cleanValue =
        value
          .replace(
            /[^0-9]/g,
            '',
          )
          .slice(
            0,
            OTP_LENGTH,
          );

      const updatedOtp =
        Array.from(
          {
            length:
              OTP_LENGTH,
          },

          (
            _,
            index,
          ) =>
            cleanValue[
              index
            ] ||
            '',
        );

      setOtp(
        updatedOtp,
      );

      const nextEmptyIndex =
        updatedOtp.findIndex(
          digit =>
            !digit,
        );

      if (
        nextEmptyIndex ===
        -1
      ) {
        inputRefs
          .current[
            OTP_LENGTH -
              1
          ]
          ?.focus();
      } else {
        inputRefs
          .current[
            nextEmptyIndex
          ]
          ?.focus();
      }
    };

  /* =======================================================
   * BACKSPACE
   * ======================================================= */

  const handleKeyPress =
    (
      event,
      index,
    ) => {
      if (
        event.nativeEvent
          .key ===
          'Backspace' &&
        !otp[index] &&
        index > 0
      ) {
        const updatedOtp =
          [
            ...otp,
          ];

        updatedOtp[
          index - 1
        ] =
          '';

        setOtp(
          updatedOtp,
        );

        inputRefs
          .current[
            index - 1
          ]
          ?.focus();
      }
    };

  /* =======================================================
   * VERIFY OTP
   *
   * CRITICAL FIX:
   * This function MUST run when Verify Code is pressed.
   * ======================================================= */

  const handleVerifyOtp =
    async () => {
      const verificationCode =
        otp.join(
          '',
        );

      const cleanEmail =
        String(
          email ??
            '',
        )
          .trim()
          .toLowerCase();

      /* =============================================
       * EMAIL
       * ============================================= */

      if (
        !cleanEmail
      ) {
        Alert.alert(
          'Email Missing',
          'Your email address is missing. Please return to Forgot Password and request a new verification code.',
        );

        return;
      }

      /* =============================================
       * OTP
       * ============================================= */

      if (
        verificationCode.length !==
        OTP_LENGTH
      ) {
        Alert.alert(
          'Incomplete Code',
          `Please enter the complete ${OTP_LENGTH}-digit verification code.`,
        );

        return;
      }

      try {
        setLoading(
          true,
        );

        console.log(
          '=====================================',
        );

        console.log(
          'VERIFY OTP API',
        );

        console.log(
          'EMAIL:',
          cleanEmail,
        );

        console.log(
          'OTP:',
          verificationCode,
        );

        console.log(
          '=====================================',
        );

        /* =============================================
         * VERIFY API
         * ============================================= */

        const response =
          await axios.post(
            VERIFY_OTP_API_URL,

            {
              email:
                cleanEmail,

              otp:
                verificationCode,
            },

            {
              headers: {
                Accept:
                  'application/json',

                'Content-Type':
                  'application/json',
              },

              timeout:
                20000,
            },
          );

        console.log(
          'VERIFY OTP STATUS:',
          response.status,
        );

        console.log(
          'VERIFY OTP RESPONSE:',
          JSON.stringify(
            response.data,
            null,
            2,
          ),
        );

        /* =============================================
         * LOGICAL FAILURE
         * ============================================= */

        if (
          response.data?.status ===
            false ||
          response.data?.success ===
            false
        ) {
          Alert.alert(
            'Verification Failed',

            response.data?.message ||
            'The verification code is invalid or expired.',
          );

          return;
        }

        /* =============================================
         * RESET TOKEN
         * ============================================= */

        const resetToken =
          response.data?.reset_token ||
          response.data?.token ||
          response.data?.data
            ?.reset_token ||
          response.data?.data
            ?.token ||
          '';

        /* =============================================
         * CRITICAL:
         *
         * Store everything needed by ResetPassword.
         * ============================================= */

        await AsyncStorage.setItem(
          RESET_EMAIL_STORAGE_KEY,
          cleanEmail,
        );

        await AsyncStorage.setItem(
          RESET_OTP_STORAGE_KEY,
          verificationCode,
        );

        if (
          resetToken
        ) {
          await AsyncStorage.setItem(
            RESET_TOKEN_STORAGE_KEY,
            String(
              resetToken,
            ),
          );
        } else {
          await AsyncStorage.removeItem(
            RESET_TOKEN_STORAGE_KEY,
          );
        }

        console.log(
          'RESET SESSION STORED',
        );

        console.log(
          'EMAIL:',
          cleanEmail,
        );

        console.log(
          'OTP:',
          verificationCode,
        );

        console.log(
          'RESET TOKEN:',
          resetToken
            ? 'AVAILABLE'
            : 'NOT RETURNED',
        );

        /* =============================================
         * SUCCESS
         * ============================================= */

        const successMessage =
          response.data?.message ||
          'Your verification code has been confirmed successfully.';

        Alert.alert(
          'Code Verified',

          successMessage,

          [
            {
              text:
                'Continue',

              onPress: () => {
                /*
                 * CRITICAL:
                 *
                 * Email + OTP + token are explicitly
                 * passed to ResetPassword.
                 */

                navigation?.replace(
                  'ResetPassword',

                  {
                    email:
                      cleanEmail,

                    otp:
                      verificationCode,

                    resetToken:
                      resetToken,
                  },
                );
              },
            },
          ],

          {
            cancelable:
              false,
          },
        );
      } catch (
        error
      ) {
        console.log(
          'Verify OTP error:',
          {
            message:
              error?.message,

            status:
              error?.response?.status,

            response:
              error?.response?.data,
          },
        );

        const errorMessage =
          axios.isAxiosError(
            error,
          )
            ? getApiErrorMessage(
                error,
              )
            : 'An unexpected error occurred. Please try again.';

        Alert.alert(
          'Verification Failed',
          errorMessage,
        );
      } finally {
        setLoading(
          false,
        );
      }
    };

  /* =======================================================
   * RESEND OTP
   * ======================================================= */

  const handleResendOtp =
    async () => {
      if (
        remainingSeconds >
          0 ||
        resending ||
        loading
      ) {
        return;
      }

      const cleanEmail =
        String(
          email ??
            '',
        )
          .trim()
          .toLowerCase();

      if (
        !cleanEmail
      ) {
        Alert.alert(
          'Email Missing',
          'Your email address is missing. Please return to the forgot password screen.',
        );

        return;
      }

      try {
        setResending(
          true,
        );

        const response =
          await axios.post(
            RESEND_OTP_API_URL,

            {
              email:
                cleanEmail,
            },

            {
              headers: {
                Accept:
                  'application/json',

                'Content-Type':
                  'application/json',
              },

              timeout:
                20000,
            },
          );

        console.log(
          'RESEND OTP RESPONSE:',
          JSON.stringify(
            response.data,
            null,
            2,
          ),
        );

        if (
          response.data?.status ===
            false ||
          response.data?.success ===
            false
        ) {
          Alert.alert(
            'Resend Failed',

            response.data?.message ||
            'Unable to resend the verification code.',
          );

          return;
        }

        /* =============================================
         * Preserve email
         * ============================================= */

        await AsyncStorage.setItem(
          RESET_EMAIL_STORAGE_KEY,
          cleanEmail,
        );

        /*
         * Remove old verified OTP/token because
         * a new OTP has been issued.
         */

        await AsyncStorage.multiRemove(
          [
            RESET_OTP_STORAGE_KEY,
            RESET_TOKEN_STORAGE_KEY,
          ],
        );

        setOtp(
          Array.from(
            {
              length:
                OTP_LENGTH,
            },

            () =>
              '',
          ),
        );

        setRemainingSeconds(
          RESEND_TIME,
        );

        inputRefs
          .current[0]
          ?.focus();

        Alert.alert(
          'Code Sent',

          response.data?.message ||
          'A new verification code has been sent to your email address.',
        );
      } catch (
        error
      ) {
        console.log(
          'Resend OTP error:',
          {
            message:
              error?.message,

            status:
              error?.response?.status,

            response:
              error?.response?.data,
          },
        );

        const errorMessage =
          axios.isAxiosError(
            error,
          )
            ? getApiErrorMessage(
                error,
              )
            : 'An unexpected error occurred. Please try again.';

        Alert.alert(
          'Resend Failed',
          errorMessage,
        );
      } finally {
        setResending(
          false,
        );
      }
    };

  /* =======================================================
   * BACK
   * ======================================================= */

  const handleBack =
    () => {
      if (
        !loading &&
        !resending
      ) {
        navigation?.goBack();
      }
    };

  /* =======================================================
   * CHANGE EMAIL
   * ======================================================= */

  const handleChangeEmail =
    async () => {
      if (
        loading ||
        resending
      ) {
        return;
      }

      try {
        /*
         * User wants to change account/email,
         * so clear old reset session.
         */

        await AsyncStorage.multiRemove(
          [
            RESET_EMAIL_STORAGE_KEY,
            RESET_OTP_STORAGE_KEY,
            RESET_TOKEN_STORAGE_KEY,
          ],
        );
      } catch (
        error
      ) {
        console.log(
          'CLEAR RESET SESSION ERROR:',
          error,
        );
      }

      navigation?.goBack();
    };

  /* =======================================================
   * LOADING EMAIL
   * ======================================================= */

  if (
    loadingEmail
  ) {
    return (
      <SafeAreaView
        style={
          styles.screen
        }
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FFF8F4"
        />

        <View
          style={
            styles.screenLoader
          }
        >
          <ActivityIndicator
            size="large"
            color="#A00B0F"
          />

          <Text
            style={
              styles.screenLoaderText
            }
          >
            Preparing verification...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* =======================================================
   * UI
   * ======================================================= */

  return (
    <SafeAreaView
      style={
        styles.screen
      }
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFF8F4"
      />

      <KeyboardAvoidingView
        style={
          styles.keyboardContainer
        }
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,

            isShortScreen &&
              styles.scrollContentShort,
          ]}
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.card,

              {
                width:
                  containerWidth,
              },

              isSmallScreen &&
                styles.cardSmall,

              isShortScreen &&
                styles.cardShort,
            ]}
          >
            {/* ================================================= */}
            {/* BACK */}
            {/* ================================================= */}

            <Pressable
              disabled={
                loading ||
                resending
              }
              hitSlop={
                10
              }
              onPress={
                handleBack
              }
              style={({
                pressed,
              }) => [
                styles.backButton,

                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.backArrow
                }
              >
                ‹
              </Text>

              <Text
                style={
                  styles.backText
                }
              >
                Back
              </Text>
            </Pressable>

            {/* ================================================= */}
            {/* LOGO */}
            {/* ================================================= */}

            <Image
              source={require('../assets/logo.png')}
              style={[
                styles.logo,

                isSmallScreen &&
                  styles.logoSmall,

                isShortScreen &&
                  styles.logoShort,
              ]}
              resizeMode="contain"
            />

            {/* ================================================= */}
            {/* VERIFICATION ICON */}
            {/* ================================================= */}

            <View
              style={
                styles.verificationIconCircle
              }
            >
              <View
                style={
                  styles.envelopeContainer
                }
              >
                <View
                  style={
                    styles.envelopeBody
                  }
                />

                <View
                  style={
                    styles.envelopeFlapLeft
                  }
                />

                <View
                  style={
                    styles.envelopeFlapRight
                  }
                />

                <View
                  style={
                    styles.codeBadge
                  }
                >
                  <Text
                    style={
                      styles.codeBadgeText
                    }
                  >
                    6
                  </Text>
                </View>
              </View>
            </View>

            {/* ================================================= */}
            {/* TITLE */}
            {/* ================================================= */}

            <Text
              style={[
                styles.title,

                isSmallScreen &&
                  styles.titleSmall,
              ]}
            >
              Verify Your Email
            </Text>

            <Text
              style={[
                styles.subtitle,

                isSmallScreen &&
                  styles.subtitleSmall,
              ]}
            >
              We sent a {OTP_LENGTH}-digit verification code to
            </Text>

            <Text
              numberOfLines={
                2
              }
              style={
                styles.emailText
              }
            >
              {maskedEmail}
            </Text>

            <Pressable
              disabled={
                loading ||
                resending
              }
              hitSlop={
                8
              }
              onPress={
                handleChangeEmail
              }
            >
              <Text
                style={
                  styles.changeEmailText
                }
              >
                Change email address
              </Text>
            </Pressable>

            {/* ================================================= */}
            {/* OTP INPUTS */}
            {/* ================================================= */}

            <View
              style={[
                styles.otpContainer,

                {
                  columnGap:
                    otpGap,
                },
              ]}
            >
              {otp.map(
                (
                  digit,
                  index,
                ) => (
                  <TextInput
                    key={`otp-${index}`}
                    ref={reference => {
                      inputRefs.current[
                        index
                      ] =
                        reference;
                    }}
                    value={
                      digit
                    }
                    onChangeText={value =>
                      handleOtpChange(
                        value,
                        index,
                      )
                    }
                    onKeyPress={event =>
                      handleKeyPress(
                        event,
                        index,
                      )
                    }
                    keyboardType="number-pad"
                    maxLength={
                      index ===
                      0
                        ? OTP_LENGTH
                        : 1
                    }
                    selectTextOnFocus
                    editable={
                      !loading &&
                      !resending
                    }
                    textContentType={
                      index ===
                      0
                        ? 'oneTimeCode'
                        : 'none'
                    }
                    autoComplete={
                      index ===
                      0
                        ? 'sms-otp'
                        : 'off'
                    }
                    style={[
                      styles.otpInput,

                      {
                        width:
                          otpBoxSize,

                        height:
                          otpBoxSize +
                          7,
                      },

                      digit &&
                        styles.otpInputFilled,

                      isSmallScreen &&
                        styles.otpInputSmall,
                    ]}
                  />
                ),
              )}
            </View>

            <Text
              style={
                styles.codeHint
              }
            >
              Enter the verification code received in your email.
            </Text>

            {/* ================================================= */}
            {/* VERIFY BUTTON */}
            {/* ================================================= */}

            <TouchableOpacity
              activeOpacity={
                0.85
              }
              disabled={
                loading ||
                resending ||
                !email
              }
              style={[
                styles.verifyButton,

                (
                  loading ||
                  resending ||
                  !email
                ) &&
                  styles.verifyButtonDisabled,
              ]}

              /*
               * ============================================
               * THIS IS THE MAIN BUG FIX.
               *
               * OLD WRONG CODE:
               *
               * onPress={() =>
               *   navigation.replace('ResetPassword')
               * }
               *
               * NEW:
               * Actually verify OTP first.
               * ============================================
               */

              onPress={
                handleVerifyOtp
              }
            >
              {loading ? (
                <View
                  style={
                    styles.loadingContainer
                  }
                >
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.loadingText
                    }
                  >
                    Verifying...
                  </Text>
                </View>
              ) : (
                <>
                  <Text
                    style={
                      styles.verifyButtonText
                    }
                  >
                    Verify Code
                  </Text>

                  <Text
                    style={
                      styles.verifyArrow
                    }
                  >
                    →
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* ================================================= */}
            {/* RESEND */}
            {/* ================================================= */}

            <View
              style={
                styles.resendContainer
              }
            >
              <Text
                style={
                  styles.resendQuestion
                }
              >
                Didn&apos;t receive the code?{' '}
              </Text>

              {remainingSeconds >
              0 ? (
                <Text
                  style={
                    styles.timerText
                  }
                >
                  Resend in {formattedTimer}
                </Text>
              ) : (
                <Pressable
                  disabled={
                    resending ||
                    loading
                  }
                  hitSlop={
                    8
                  }
                  onPress={
                    handleResendOtp
                  }
                >
                  {resending ? (
                    <View
                      style={
                        styles.resendingContainer
                      }
                    >
                      <ActivityIndicator
                        size="small"
                        color="#A00B0F"
                      />

                      <Text
                        style={
                          styles.resendingText
                        }
                      >
                        Sending...
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={
                        styles.resendButtonText
                      }
                    >
                      Resend Code
                    </Text>
                  )}
                </Pressable>
              )}
            </View>

            {/* ================================================= */}
            {/* HELP */}
            {/* ================================================= */}

            <View
              style={
                styles.helpCard
              }
            >
              <View
                style={
                  styles.helpIconCircle
                }
              >
                <Text
                  style={
                    styles.helpIcon
                  }
                >
                  i
                </Text>
              </View>

              <Text
                style={
                  styles.helpText
                }
              >
                The verification code will expire shortly. Never share this code with anyone.
              </Text>
            </View>

            {/* ================================================= */}
            {/* FOOTER */}
            {/* ================================================= */}

            <View
              style={
                styles.footerContainer
              }
            >
              <Pressable
                disabled={
                  loading ||
                  resending
                }
              >
                <Text
                  style={
                    styles.footerText
                  }
                >
                  Privacy Policy
                </Text>
              </Pressable>

              <View
                style={
                  styles.footerSeparator
                }
              />

              <Pressable
                disabled={
                  loading ||
                  resending
                }
              >
                <Text
                  style={
                    styles.footerText
                  }
                >
                  Terms of Service
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Otp;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles =
  StyleSheet.create({
    screen: {
      flex:
        1,

      backgroundColor:
        '#FFF8F4',
    },

    keyboardContainer: {
      flex:
        1,
    },

    screenLoader: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    screenLoaderText: {
      color:
        '#766863',

      fontSize:
        11,

      fontWeight:
        '700',

      marginTop:
        10,
    },

    scrollContent: {
      flexGrow:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        16,

      paddingTop:
        24,

      paddingBottom:
        24,
    },

    scrollContentShort: {
      justifyContent:
        'flex-start',

      paddingTop:
        16,
    },

    card: {
      maxWidth:
        500,

      paddingHorizontal:
        22,

      paddingTop:
        18,

      paddingBottom:
        20,

      borderRadius:
        24,

      backgroundColor:
        '#FFFFFF',

      shadowColor:
        '#7D6B63',

      shadowOffset: {
        width:
          0,

        height:
          6,
      },

      shadowOpacity:
        0.14,

      shadowRadius:
        16,

      elevation:
        6,
    },

    cardSmall: {
      paddingHorizontal:
        15,

      borderRadius:
        20,
    },

    cardShort: {
      paddingTop:
        14,

      paddingBottom:
        17,
    },

    pressed: {
      opacity:
        0.65,
    },

    backButton: {
      alignSelf:
        'flex-start',

      minHeight:
        38,

      paddingRight:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    backArrow: {
      marginTop:
        -3,

      color:
        '#A00B0F',

      fontSize:
        32,

      lineHeight:
        34,

      fontWeight:
        '400',
    },

    backText: {
      marginLeft:
        3,

      color:
        '#A00B0F',

      fontSize:
        12,

      fontWeight:
        '700',
    },

    logo: {
      width:
        115,

      height:
        115,

      alignSelf:
        'center',

      marginTop:
        -5,

      marginBottom:
        6,
    },

    logoSmall: {
      width:
        100,

      height:
        100,
    },

    logoShort: {
      width:
        85,

      height:
        85,

      marginBottom:
        3,
    },

    verificationIconCircle: {
      width:
        65,

      height:
        65,

      alignSelf:
        'center',

      marginBottom:
        16,

      borderRadius:
        33,

      backgroundColor:
        '#FFF1F1',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    envelopeContainer: {
      position:
        'relative',

      width:
        31,

      height:
        25,
    },

    envelopeBody: {
      position:
        'absolute',

      left:
        0,

      right:
        0,

      bottom:
        0,

      height:
        21,

      borderWidth:
        2,

      borderColor:
        '#A00B0F',

      borderRadius:
        4,
    },

    envelopeFlapLeft: {
      position:
        'absolute',

      top:
        4,

      left:
        3,

      width:
        18,

      height:
        2,

      backgroundColor:
        '#A00B0F',

      transform: [
        {
          rotate:
            '34deg',
        },
      ],
    },

    envelopeFlapRight: {
      position:
        'absolute',

      top:
        4,

      right:
        3,

      width:
        18,

      height:
        2,

      backgroundColor:
        '#A00B0F',

      transform: [
        {
          rotate:
            '-34deg',
        },
      ],
    },

    codeBadge: {
      position:
        'absolute',

      top:
        -9,

      right:
        -9,

      width:
        20,

      height:
        20,

      borderWidth:
        2,

      borderColor:
        '#FFFFFF',

      borderRadius:
        10,

      backgroundColor:
        '#A00B0F',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    codeBadgeText: {
      color:
        '#FFFFFF',

      fontSize:
        9,

      fontWeight:
        '800',
    },

    title: {
      color:
        '#111111',

      fontSize:
        27,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    titleSmall: {
      fontSize:
        24,
    },

    subtitle: {
      marginTop:
        7,

      color:
        '#777777',

      fontSize:
        13,

      lineHeight:
        19,

      textAlign:
        'center',
    },

    subtitleSmall: {
      fontSize:
        12,

      lineHeight:
        18,
    },

    emailText: {
      maxWidth:
        '90%',

      alignSelf:
        'center',

      marginTop:
        4,

      color:
        '#252525',

      fontSize:
        13,

      lineHeight:
        18,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    changeEmailText: {
      marginTop:
        7,

      color:
        '#A00B0F',

      fontSize:
        10.5,

      fontWeight:
        '700',

      textAlign:
        'center',
    },

    otpContainer: {
      width:
        '100%',

      marginTop:
        28,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    otpInput: {
      paddingVertical:
        0,

      borderWidth:
        1.5,

      borderColor:
        '#E1E1E1',

      borderRadius:
        12,

      backgroundColor:
        '#F2F2F2',

      color:
        '#191919',

      fontSize:
        21,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    otpInputSmall: {
      borderRadius:
        10,

      fontSize:
        18,
    },

    otpInputFilled: {
      borderColor:
        '#A00B0F',

      backgroundColor:
        '#FFF8F7',
    },

    codeHint: {
      marginTop:
        12,

      color:
        '#8B8B8B',

      fontSize:
        10.5,

      lineHeight:
        15,

      textAlign:
        'center',
    },

    verifyButton: {
      width:
        '100%',

      minHeight:
        54,

      marginTop:
        25,

      paddingHorizontal:
        14,

      borderRadius:
        13,

      backgroundColor:
        '#A00B0F',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      shadowColor:
        '#A00B0F',

      shadowOffset: {
        width:
          0,

        height:
          5,
      },

      shadowOpacity:
        0.28,

      shadowRadius:
        10,

      elevation:
        5,
    },

    verifyButtonDisabled: {
      opacity:
        0.55,
    },

    verifyButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        15,

      fontWeight:
        '800',
    },

    verifyArrow: {
      marginLeft:
        8,

      color:
        '#FFFFFF',

      fontSize:
        20,

      fontWeight:
        '700',
    },

    loadingContainer: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    loadingText: {
      marginLeft:
        10,

      color:
        '#FFFFFF',

      fontSize:
        14,

      fontWeight:
        '700',
    },

    resendContainer: {
      marginTop:
        25,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      flexWrap:
        'wrap',
    },

    resendQuestion: {
      color:
        '#555555',

      fontSize:
        12,
    },

    timerText: {
      color:
        '#777777',

      fontSize:
        12,

      fontWeight:
        '700',
    },

    resendButtonText: {
      color:
        '#A00B0F',

      fontSize:
        12,

      fontWeight:
        '800',
    },

    resendingContainer: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    resendingText: {
      marginLeft:
        6,

      color:
        '#A00B0F',

      fontSize:
        12,

      fontWeight:
        '700',
    },

    helpCard: {
      width:
        '100%',

      marginTop:
        24,

      padding:
        13,

      borderWidth:
        1,

      borderColor:
        '#F0D6D4',

      borderRadius:
        12,

      backgroundColor:
        '#FFF8F7',

      flexDirection:
        'row',

      alignItems:
        'flex-start',
    },

    helpIconCircle: {
      width:
        24,

      height:
        24,

      marginRight:
        10,

      borderRadius:
        12,

      backgroundColor:
        '#A00B0F',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    helpIcon: {
      color:
        '#FFFFFF',

      fontSize:
        13,

      fontWeight:
        '800',
    },

    helpText: {
      flex:
        1,

      color:
        '#765E5D',

      fontSize:
        10.5,

      lineHeight:
        16,
    },

    footerContainer: {
      marginTop:
        26,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    footerText: {
      color:
        '#A0A0A0',

      fontSize:
        10,
    },

    footerSeparator: {
      width:
        1,

      height:
        11,

      marginHorizontal:
        10,

      backgroundColor:
        '#D0D0D0',
    },
  });