import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import Ionicons from 'react-native-vector-icons/Ionicons';

/* =========================================================
 * STORAGE
 * ========================================================= */

const WEEKLY_ORDERS_STORAGE_KEY =
  'kp_customer_weekly_orders';

/* =========================================================
 * BACKEND NOTE
 *
 * Weekly orders API and weekly payment API have not
 * been provided yet.
 *
 * This screen currently supports:
 *
 * 1. route.params.orders
 * 2. AsyncStorage cached orders
 *
 * Once your backend APIs are ready, connect them inside:
 *
 * fetchOrders()
 * handlePayLastWeek()
 * ========================================================= */

/* =========================================================
 * DATE HELPERS
 * ========================================================= */

const startOfDay = date => {
  const result =
    new Date(date);

  result.setHours(
    0,
    0,
    0,
    0,
  );

  return result;
};

/* =========================================================
 * Get Monday of Current Week
 * ========================================================= */

const getMonday = date => {
  const current =
    startOfDay(
      date,
    );

  const day =
    current.getDay();

  const difference =
    day === 0
      ? -6
      : 1 - day;

  current.setDate(
    current.getDate() +
      difference,
  );

  return current;
};

/* =========================================================
 * LAST WEEK RANGE
 *
 * Example:
 *
 * Today:
 * Tuesday 25 Aug 2026
 *
 * Last week:
 *
 * Monday 17 Aug
 *      ↓
 * Monday 24 Aug
 *
 * Start inclusive
 * End exclusive
 * ========================================================= */

const getLastWeekRange = () => {
  const currentMonday =
    getMonday(
      new Date(),
    );

  const previousMonday =
    new Date(
      currentMonday,
    );

  previousMonday.setDate(
    currentMonday.getDate() -
      7,
  );

  return {
    start:
      previousMonday,

    end:
      currentMonday,
  };
};

/* =========================================================
 * Date Formatting
 * ========================================================= */

const formatDate = date => {
  if (
    !date
  ) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat(
      'en-US',
      {
        day:
          '2-digit',

        month:
          'short',

        year:
          'numeric',
      },
    ).format(
      new Date(
        date,
      ),
    );
  } catch (
    error
  ) {
    return '';
  }
};

const formatShortDate = date => {
  if (
    !date
  ) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat(
      'en-US',
      {
        day:
          '2-digit',

        month:
          'short',
      },
    ).format(
      new Date(
        date,
      ),
    );
  } catch (
    error
  ) {
    return '';
  }
};

/* =========================================================
 * ORDER DATE
 * ========================================================= */

const getOrderDate = order => {
  const rawDate =
    order?.date ??
    order?.order_date ??
    order?.ordered_at ??
    order?.created_at ??
    order?.createdAt ??
    null;

  if (
    !rawDate
  ) {
    return null;
  }

  const parsedDate =
    new Date(
      rawDate,
    );

  if (
    Number.isNaN(
      parsedDate.getTime(),
    )
  ) {
    return null;
  }

  return parsedDate;
};

/* =========================================================
 * ORDER ID
 * ========================================================= */

const getOrderId = order =>
  order?.id ??
  order?.order_id ??
  order?.orderId ??
  '';

/* =========================================================
 * ORDER NAME
 * ========================================================= */

const getOrderName = order =>
  order?.tiffin ??
  order?.tiffin_name ??
  order?.name ??
  order?.product_name ??
  'Tiffin Order';

/* =========================================================
 * ORDER QUANTITY
 * ========================================================= */

const getOrderQuantity = order => {
  const quantity =
    Number(
      order?.quantity ??
        order?.qty ??
        1,
    );

  return Number.isFinite(
    quantity,
  )
    ? quantity
    : 1;
};

/* =========================================================
 * ORDER TOTAL
 * ========================================================= */

const getOrderAmount = order => {
  const amount =
    Number(
      order?.amount ??
        order?.total_amount ??
        order?.total ??
        order?.grand_total ??
        order?.price ??
        0,
    );

  return Number.isFinite(
    amount,
  )
    ? amount
    : 0;
};

/* =========================================================
 * PAYMENT STATUS
 * ========================================================= */

const getPaymentStatus = order =>
  order?.payment_status ??
  order?.paymentStatus ??
  order?.status ??
  'Pending';

/* =========================================================
 * CHECK IF PAID
 * ========================================================= */

const isOrderPaid = order => {
  const status =
    String(
      getPaymentStatus(
        order,
      ),
    )
      .trim()
      .toLowerCase();

  return (
    status ===
      'paid' ||
    status ===
      'payment completed' ||
    status ===
      'payment complete' ||
    status ===
      'completed'
  );
};

/* =========================================================
 * SORT ORDERS NEWEST FIRST
 * ========================================================= */

const sortOrdersNewestFirst = orders => {
  return [
    ...orders,
  ].sort(
    (
      first,
      second,
    ) => {
      const firstDate =
        getOrderDate(
          first,
        );

      const secondDate =
        getOrderDate(
          second,
        );

      if (
        !firstDate &&
        !secondDate
      ) {
        return 0;
      }

      if (
        !firstDate
      ) {
        return 1;
      }

      if (
        !secondDate
      ) {
        return -1;
      }

      return (
        secondDate.getTime() -
        firstDate.getTime()
      );
    },
  );
};

/* =========================================================
 * Weekly Invoice Screen
 * ========================================================= */

const WeeklyInvoice = ({
  navigation,
  route,
}) => {
  const {
    width,
  } =
    useWindowDimensions();

  /* =======================================================
   * Orders
   * ======================================================= */

  const [
    orders,
    setOrders,
  ] =
    useState([]);

  /* =======================================================
   * Loading
   * ======================================================= */

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  /* =======================================================
   * Payment
   * ======================================================= */

  const [
    paymentLoading,
    setPaymentLoading,
  ] =
    useState(false);

  /* =======================================================
   * Error
   * ======================================================= */

  const [
    error,
    setError,
  ] =
    useState(null);

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
   * Last Week
   * ======================================================= */

  const lastWeekRange =
    useMemo(
      () =>
        getLastWeekRange(),
      [],
    );

  /* =======================================================
   * FETCH ORDERS
   * ======================================================= */

  const fetchOrders =
    async (
      showLoader =
        true,
    ) => {
      try {
        if (
          showLoader
        ) {
          setLoading(
            true,
          );
        }

        setError(
          null,
        );

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
          Alert.alert(
            'Login Required',
            'Please login to view your weekly invoice.',
          );

          navigation.navigate(
            'Login',
            {
              redirectTo:
                'WeeklyInvoice',
            },
          );

          return;
        }

        /* =============================================
         * OPTION 1:
         * Orders passed through navigation
         * ============================================= */

        const navigationOrders =
          route?.params
            ?.orders;

        if (
          Array.isArray(
            navigationOrders,
          )
        ) {
          setOrders(
            navigationOrders,
          );

          return;
        }

        /* =============================================
         * OPTION 2:
         * Cached Orders
         * ============================================= */

        const storedOrders =
          await AsyncStorage.getItem(
            WEEKLY_ORDERS_STORAGE_KEY,
          );

        if (
          storedOrders
        ) {
          const parsedOrders =
            JSON.parse(
              storedOrders,
            );

          if (
            Array.isArray(
              parsedOrders,
            )
          ) {
            setOrders(
              parsedOrders,
            );

            return;
          }
        }

        /* =============================================
         * BACKEND ORDERS API
         * =============================================
         *
         * When your backend provides an API for all
         * customer orders, connect it here.
         *
         * Example structure only:
         *
         * const response = await fetch(
         *   YOUR_ORDER_API,
         *   {
         *     method: 'GET',
         *
         *     headers: {
         *       Accept: 'application/json',
         *
         *       Authorization:
         *         `Bearer ${token}`,
         *     },
         *   },
         * );
         *
         * const result =
         *   await response.json();
         *
         * setOrders(
         *   result?.orders ??
         *   result?.data ??
         *   [],
         * );
         *
         * IMPORTANT:
         * No API endpoint is invented here.
         * ============================================= */

        setOrders([]);
      } catch (
        err
      ) {
        console.log(
          'WEEKLY INVOICE ERROR:',
          err,
        );

        setError(
          err?.message ??
            'Unable to load your orders.',
        );
      } finally {
        if (
          showLoader
        ) {
          setLoading(
            false,
          );
        }

        setRefreshing(
          false,
        );
      }
    };

  /* =======================================================
   * Load On Focus
   * ======================================================= */

  useFocusEffect(
    useCallback(
      () => {
        fetchOrders();
      },
      [
        route?.params
          ?.orders,
      ],
    ),
  );

  /* =======================================================
   * ALL ORDERS
   * ======================================================= */

  const allOrders =
    useMemo(
      () =>
        sortOrdersNewestFirst(
          orders,
        ),
      [
        orders,
      ],
    );

  /* =======================================================
   * LAST WEEK ORDERS
   *
   * Monday -> Monday
   * ======================================================= */

  const lastWeekOrders =
    useMemo(
      () => {
        const {
          start,
          end,
        } =
          lastWeekRange;

        return sortOrdersNewestFirst(
          orders.filter(
            order => {
              const orderDate =
                getOrderDate(
                  order,
                );

              if (
                !orderDate
              ) {
                return false;
              }

              return (
                orderDate >=
                  start &&
                orderDate <
                  end
              );
            },
          ),
        );
      },
      [
        orders,
        lastWeekRange,
      ],
    );

  /* =======================================================
   * LAST WEEK TOTAL
   * ======================================================= */

  const lastWeekTotal =
    useMemo(
      () =>
        lastWeekOrders.reduce(
          (
            total,
            order,
          ) =>
            total +
            getOrderAmount(
              order,
            ),
          0,
        ),
      [
        lastWeekOrders,
      ],
    );

  /* =======================================================
   * LAST WEEK PAID TOTAL
   * ======================================================= */

  const lastWeekPaidTotal =
    useMemo(
      () =>
        lastWeekOrders.reduce(
          (
            total,
            order,
          ) => {
            if (
              !isOrderPaid(
                order,
              )
            ) {
              return total;
            }

            return (
              total +
              getOrderAmount(
                order,
              )
            );
          },
          0,
        ),
      [
        lastWeekOrders,
      ],
    );

  /* =======================================================
   * LAST WEEK UNPAID
   * ======================================================= */

  const lastWeekUnpaidOrders =
    useMemo(
      () =>
        lastWeekOrders.filter(
          order =>
            !isOrderPaid(
              order,
            ),
        ),
      [
        lastWeekOrders,
      ],
    );

  /* =======================================================
   * AMOUNT DUE
   * ======================================================= */

  const lastWeekAmountDue =
    Math.max(
      0,
      lastWeekTotal -
        lastWeekPaidTotal,
    );

  /* =======================================================
   * Refresh
   * ======================================================= */

  const onRefresh =
    () => {
      setRefreshing(
        true,
      );

      fetchOrders(
        false,
      );
    };

  /* =======================================================
   * PAY LAST WEEK
   * ======================================================= */

  const handlePayLastWeek =
    async () => {
      if (
        paymentLoading
      ) {
        return;
      }

      if (
        lastWeekOrders.length ===
        0
      ) {
        Alert.alert(
          'No Orders',
          'There are no orders in last week’s invoice.',
        );

        return;
      }

      if (
        lastWeekUnpaidOrders.length ===
          0 ||
        lastWeekAmountDue <=
          0
      ) {
        Alert.alert(
          'Already Paid',
          'All orders from last week are already paid.',
        );

        return;
      }

      try {
        setPaymentLoading(
          true,
        );

        const token =
          await AsyncStorage.getItem(
            'token',
          );

        if (
          !token
        ) {
          Alert.alert(
            'Login Required',
            'Please login before making payment.',
          );

          navigation.navigate(
            'Login',
            {
              redirectTo:
                'WeeklyInvoice',
            },
          );

          return;
        }

        const orderIds =
          lastWeekUnpaidOrders.map(
            order =>
              getOrderId(
                order,
              ),
          );

        console.log(
          '==============================================',
        );

        console.log(
          'LAST WEEK PAYMENT',
        );

        console.log(
          'WEEK START:',
          lastWeekRange
            .start
            .toISOString(),
        );

        console.log(
          'WEEK END:',
          lastWeekRange
            .end
            .toISOString(),
        );

        console.log(
          'UNPAID ORDER IDS:',
          orderIds,
        );

        console.log(
          'AMOUNT DUE:',
          lastWeekAmountDue,
        );

        console.log(
          '==============================================',
        );

        /* =============================================
         * WEEKLY PAYMENT API REQUIRED
         *
         * When your backend provides it:
         *
         * Backend should receive last week's unpaid
         * order IDs and calculate the trusted amount
         * from DB.
         *
         * Do NOT create Stripe amount only from:
         *
         * lastWeekAmountDue
         *
         * because frontend amounts can be modified.
         *
         * Server should:
         *
         * 1. verify customer
         * 2. verify order IDs
         * 3. verify order date belongs to last week
         * 4. exclude already-paid orders
         * 5. calculate DB total
         * 6. create PaymentIntent
         * 7. return client_secret
         * 8. confirm weekly payment
         *
         * No weekly payment API was supplied, so no
         * fake endpoint is added here.
         * ============================================= */

        Alert.alert(
          'Weekly Payment',
          `Last week's amount due is $${lastWeekAmountDue.toFixed(
            2,
          )} for ${lastWeekUnpaidOrders.length} unpaid order(s).\n\nConnect your weekly payment API here to open Stripe PaymentSheet.`,
        );
      } catch (
        err
      ) {
        console.log(
          'LAST WEEK PAYMENT ERROR:',
          err,
        );

        Alert.alert(
          'Payment Error',
          err?.message ??
            'Unable to process weekly payment.',
        );
      } finally {
        setPaymentLoading(
          false,
        );
      }
    };

  /* =======================================================
   * RENDER ORDER CARD
   * ======================================================= */

  const renderOrderCard = (
    item,
    index,
    compact =
      false,
  ) => {
    const orderDate =
      getOrderDate(
        item,
      );

    const amount =
      getOrderAmount(
        item,
      );

    const quantity =
      getOrderQuantity(
        item,
      );

    const paid =
      isOrderPaid(
        item,
      );

    return (
      <View
        key={`${getOrderId(
          item,
        )}-${index}`}
        style={[
          styles.orderCard,

          compact &&
            styles.invoiceOrderCard,
        ]}
      >
        <View
          style={
            styles.orderTopRow
          }
        >
          <View
            style={
              styles.orderNumberContainer
            }
          >
            <Text
              style={
                styles.orderNumber
              }
            >
              {String(
                index +
                  1,
              ).padStart(
                2,
                '0',
              )}
            </Text>
          </View>

          <View
            style={
              styles.orderMain
            }
          >
            <Text
              numberOfLines={
                1
              }
              style={
                styles.orderTitle
              }
            >
              {getOrderName(
                item,
              )}
            </Text>

            <Text
              style={
                styles.orderDate
              }
            >
              {orderDate
                ? formatDate(
                    orderDate,
                  )
                : 'Date unavailable'}
            </Text>
          </View>

          <Text
            style={
              styles.orderAmount
            }
          >
            $
            {amount.toFixed(
              2,
            )}
          </Text>
        </View>

        <View
          style={
            styles.orderBottomRow
          }
        >
          <View
            style={
              styles.orderMeta
            }
          >
            <Text
              style={
                styles.orderMetaLabel
              }
            >
              Order
            </Text>

            <Text
              numberOfLines={
                1
              }
              style={
                styles.orderMetaValue
              }
            >
              {getOrderId(
                item,
              ) ||
                '—'}
            </Text>
          </View>

          <View
            style={
              styles.orderMeta
            }
          >
            <Text
              style={
                styles.orderMetaLabel
              }
            >
              Qty
            </Text>

            <Text
              style={
                styles.orderMetaValue
              }
            >
              {
                quantity
              }
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,

              paid
                ? styles.paidBadge
                : styles.pendingBadge,
            ]}
          >
            <View
              style={[
                styles.statusDot,

                paid
                  ? styles.paidDot
                  : styles.pendingDot,
              ]}
            />

            <Text
              style={[
                styles.statusText,

                paid
                  ? styles.paidText
                  : styles.pendingText,
              ]}
            >
              {paid
                ? 'Paid'
                : 'Payment Due'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  /* =======================================================
   * LAST WEEK INVOICE HEADER
   * ======================================================= */

  const renderInvoiceHeader =
    () => (
      <>
        {/* =================================================
         * LAST WEEK INVOICE
         * ================================================= */}

        <View
          style={
            styles.invoiceTitleRow
          }
        >
          <View>
            <Text
              style={
                styles.sectionEyebrow
              }
            >
              WEEKLY INVOICE
            </Text>

            <Text
              style={
                styles.sectionTitle
              }
            >
              Last Week's Orders
            </Text>
          </View>

          <View
            style={
              styles.lastWeekBadge
            }
          >
            <Text
              style={
                styles.lastWeekBadgeText
              }
            >
              LAST WEEK
            </Text>
          </View>
        </View>

        {/* =================================================
         * Date Range
         * ================================================= */}

        <View
          style={
            styles.dateRangeCard
          }
        >
          <View
            style={
              styles.dateIconContainer
            }
          >
            <Ionicons
              name="calendar-outline"
              size={
                19
              }
              color="#A00B0F"
            />
          </View>

          <View
            style={
              styles.dateRangeContent
            }
          >
            <Text
              style={
                styles.dateRangeLabel
              }
            >
              MONDAY TO MONDAY
            </Text>

            <Text
              style={
                styles.dateRangeValue
              }
            >
              {formatShortDate(
                lastWeekRange.start,
              )}
              {'  —  '}
              {formatShortDate(
                lastWeekRange.end,
              )}
            </Text>
          </View>

          <View
            style={
              styles.orderCountBadge
            }
          >
            <Text
              style={
                styles.orderCountNumber
              }
            >
              {
                lastWeekOrders.length
              }
            </Text>

            <Text
              style={
                styles.orderCountText
              }
            >
              ORDERS
            </Text>
          </View>
        </View>

        {/* =================================================
         * Last Week Orders
         * ================================================= */}

        {lastWeekOrders.length >
        0 ? (
          <View
            style={
              styles.invoiceOrdersContainer
            }
          >
            {lastWeekOrders.map(
              (
                item,
                index,
              ) =>
                renderOrderCard(
                  item,
                  index,
                  true,
                ),
            )}
          </View>
        ) : (
          <View
            style={
              styles.noLastWeekOrders
            }
          >
            <Ionicons
              name="receipt-outline"
              size={
                31
              }
              color="#A00B0F"
            />

            <Text
              style={
                styles.noLastWeekTitle
              }
            >
              No orders last week
            </Text>

            <Text
              style={
                styles.noLastWeekText
              }
            >
              There are no Monday-to-Monday orders available for last week's invoice.
            </Text>
          </View>
        )}

        {/* =================================================
         * TOTAL + PAY NOW
         *
         * Button is beside total amount.
         * ================================================= */}

        {lastWeekOrders.length >
          0 && (
          <View
            style={
              styles.invoiceTotalCard
            }
          >
            <View
              style={
                styles.invoiceTotalLeft
              }
            >
              <Text
                style={
                  styles.invoiceTotalLabel
                }
              >
                TOTAL AMOUNT
              </Text>

              <Text
                style={
                  styles.invoiceTotalAmount
                }
              >
                $
                {lastWeekAmountDue.toFixed(
                  2,
                )}
              </Text>

              <Text
                style={
                  styles.invoiceTotalSubtext
                }
              >
                {lastWeekUnpaidOrders.length >
                0
                  ? `${lastWeekUnpaidOrders.length} unpaid order${
                      lastWeekUnpaidOrders.length ===
                      1
                        ? ''
                        : 's'
                    }`
                  : 'All orders paid'}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={
                0.85
              }
              disabled={
                paymentLoading ||
                lastWeekAmountDue <=
                  0
              }
              onPress={
                handlePayLastWeek
              }
              style={[
                styles.payNowButton,

                (paymentLoading ||
                  lastWeekAmountDue <=
                    0) &&
                  styles.payNowButtonDisabled,
              ]}
            >
              {paymentLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#A00B0F"
                />
              ) : (
                <Ionicons
                  name={
                    lastWeekAmountDue >
                    0
                      ? 'card-outline'
                      : 'checkmark-circle-outline'
                  }
                  size={
                    18
                  }
                  color={
                    lastWeekAmountDue >
                    0
                      ? '#A00B0F'
                      : '#27905B'
                  }
                />
              )}

              <Text
                style={[
                  styles.payNowText,

                  lastWeekAmountDue <=
                    0 &&
                    styles.paidNowText,
                ]}
              >
                {paymentLoading
                  ? 'Please Wait'
                  : lastWeekAmountDue >
                    0
                  ? 'Pay Now'
                  : 'Paid'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* =================================================
         * Breakdown
         * ================================================= */}

        {lastWeekOrders.length >
          0 && (
          <View
            style={
              styles.breakdownCard
            }
          >
            <BreakdownItem
              label="Weekly Total"
              value={`$${lastWeekTotal.toFixed(
                2,
              )}`}
            />

            <BreakdownItem
              label="Already Paid"
              value={`$${lastWeekPaidTotal.toFixed(
                2,
              )}`}
              paid
            />

            <BreakdownItem
              label="Amount Due"
              value={`$${lastWeekAmountDue.toFixed(
                2,
              )}`}
              due
              noBorder
            />
          </View>
        )}

        {/* =================================================
         * ALL ORDERS HEADING
         * ================================================= */}

        <View
          style={
            styles.allOrdersHeader
          }
        >
          <View>
            <Text
              style={
                styles.sectionEyebrow
              }
            >
              ORDER HISTORY
            </Text>

            <Text
              style={
                styles.sectionTitle
              }
            >
              All Orders
            </Text>
          </View>

          <View
            style={
              styles.allOrderCountBadge
            }
          >
            <Text
              style={
                styles.allOrderCountText
              }
            >
              {allOrders.length}{' '}
              {allOrders.length ===
              1
                ? 'Order'
                : 'Orders'}
            </Text>
          </View>
        </View>
      </>
    );

  /* =======================================================
   * Loading
   * ======================================================= */

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
            styles.loadingContainer
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
            Loading weekly invoice...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* =======================================================
   * Main UI
   * ======================================================= */

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
        style={[
          styles.container,

          {
            width:
              responsive.width,
          },
        ]}
      >
        {/* =================================================
         * Header
         * ================================================= */}

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
              styles.headerTextContainer
            }
          >
            <Text
              style={
                styles.headerEyebrow
              }
            >
              BILLING
            </Text>

            <Text
              style={
                styles.headerTitle
              }
            >
              Weekly Invoice
            </Text>
          </View>

          <View
            style={
              styles.headerRightSpace
            }
          />
        </View>

        {/* =================================================
         * Error
         * ================================================= */}

        {!!error && (
          <View
            style={[
              styles.errorBox,

              {
                marginHorizontal:
                  responsive.padding,

                marginTop:
                  10,
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={
                18
              }
              color="#A00B0F"
            />

            <Text
              style={
                styles.errorText
              }
            >
              {
                error
              }
            </Text>
          </View>
        )}

        {/* =================================================
         * All Content
         * ================================================= */}

        <FlatList
          data={
            allOrders
          }
          keyExtractor={(
            item,
            index,
          ) =>
            String(
              getOrderId(
                item,
              ) ||
                index,
            )
          }
          renderItem={({
            item,
            index,
          }) =>
            renderOrderCard(
              item,
              index,
            )
          }
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                onRefresh
              }
              tintColor="#A00B0F"
            />
          }
          contentContainerStyle={{
            paddingHorizontal:
              responsive.padding,

            paddingTop:
              14,

            paddingBottom:
              60,
          }}
          ListHeaderComponent={
            renderInvoiceHeader
          }
          ListEmptyComponent={
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
                <Ionicons
                  name="receipt-outline"
                  size={
                    34
                  }
                  color="#A00B0F"
                />
              </View>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No orders available
              </Text>

              <Text
                style={
                  styles.emptySubtitle
                }
              >
                Your completed and previous orders will appear here.
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
};

/* =========================================================
 * BREAKDOWN ITEM
 * ========================================================= */

const BreakdownItem = ({
  label,
  value,
  paid =
    false,
  due =
    false,
  noBorder =
    false,
}) => {
  return (
    <View
      style={[
        styles.breakdownRow,

        noBorder &&
          styles.breakdownRowNoBorder,
      ]}
    >
      <Text
        style={
          styles.breakdownLabel
        }
      >
        {label}
      </Text>

      <Text
        style={[
          styles.breakdownValue,

          paid &&
            styles.breakdownPaidValue,

          due &&
            styles.breakdownDueValue,
        ]}
      >
        {value}
      </Text>
    </View>
  );
};

export default WeeklyInvoice;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles =
  StyleSheet.create({
    /* =====================================================
     * Screen
     * ===================================================== */

    safeArea: {
      flex:
        1,

      backgroundColor:
        '#F5F0ED',
    },

    container: {
      flex:
        1,

      alignSelf:
        'center',

      backgroundColor:
        '#FFF9F6',
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
    },

    loadingText: {
      marginTop:
        12,

      color:
        '#8B7770',

      fontSize:
        11,

      fontWeight:
        '600',
    },

    /* =====================================================
     * Header
     * ===================================================== */

    header: {
      minHeight:
        70,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF9F6',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#EFE5E0',
    },

    backButton: {
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
        13,
    },

    backIcon: {
      width:
        18,

      height:
        18,
    },

    headerTextContainer: {
      flex:
        1,

      marginLeft:
        12,
    },

    headerEyebrow: {
      color:
        '#A84B20',

      fontSize:
        8,

      fontWeight:
        '800',

      letterSpacing:
        1,
    },

    headerTitle: {
      color:
        '#231815',

      fontSize:
        20,

      fontWeight:
        '900',

      marginTop:
        1,
    },

    headerRightSpace: {
      width:
        40,
    },

    /* =====================================================
     * Section Heading
     * ===================================================== */

    invoiceTitleRow: {
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
        '#A84B20',

      fontSize:
        7.5,

      fontWeight:
        '900',

      letterSpacing:
        0.8,

      marginBottom:
        3,
    },

    sectionTitle: {
      color:
        '#2A1D19',

      fontSize:
        17,

      fontWeight:
        '900',
    },

    lastWeekBadge: {
      backgroundColor:
        '#FBE4D8',

      borderRadius:
        15,

      paddingHorizontal:
        9,

      paddingVertical:
        6,
    },

    lastWeekBadgeText: {
      color:
        '#A00B0F',

      fontSize:
        7,

      fontWeight:
        '900',

      letterSpacing:
        0.5,
    },

    /* =====================================================
     * Date Range
     * ===================================================== */

    dateRangeCard: {
      minHeight:
        68,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EFE4DE',

      borderRadius:
        15,

      padding:
        11,

      marginBottom:
        12,
    },

    dateIconContainer: {
      width:
        42,

      height:
        42,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0E8',

      borderRadius:
        12,

      marginRight:
        11,
    },

    dateRangeContent: {
      flex:
        1,
    },

    dateRangeLabel: {
      color:
        '#9A8780',

      fontSize:
        7,

      fontWeight:
        '800',

      letterSpacing:
        0.6,
    },

    dateRangeValue: {
      color:
        '#32241E',

      fontSize:
        12,

      fontWeight:
        '900',

      marginTop:
        4,
    },

    orderCountBadge: {
      minWidth:
        48,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF7F3',

      borderRadius:
        11,

      paddingHorizontal:
        8,

      paddingVertical:
        7,
    },

    orderCountNumber: {
      color:
        '#A00B0F',

      fontSize:
        13,

      fontWeight:
        '900',
    },

    orderCountText: {
      color:
        '#9A8780',

      fontSize:
        6,

      fontWeight:
        '800',

      marginTop:
        2,
    },

    /* =====================================================
     * Last Week Order Container
     * ===================================================== */

    invoiceOrdersContainer: {
      marginBottom:
        2,
    },

    invoiceOrderCard: {
      backgroundColor:
        '#FFFDFB',
    },

    /* =====================================================
     * No Last Week Orders
     * ===================================================== */

    noLastWeekOrders: {
      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EFE4DE',

      borderRadius:
        15,

      padding:
        22,

      marginBottom:
        12,
    },

    noLastWeekTitle: {
      color:
        '#30231E',

      fontSize:
        12,

      fontWeight:
        '900',

      marginTop:
        8,
    },

    noLastWeekText: {
      maxWidth:
        280,

      color:
        '#95827B',

      fontSize:
        8,

      lineHeight:
        13,

      textAlign:
        'center',

      marginTop:
        5,
    },

    /* =====================================================
     * TOTAL + PAY NOW
     * ===================================================== */

    invoiceTotalCard: {
      minHeight:
        92,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      backgroundColor:
        '#A00B0F',

      borderRadius:
        17,

      padding:
        15,

      marginTop:
        4,

      marginBottom:
        10,

      shadowColor:
        '#A00B0F',

      shadowOffset: {
        width:
          0,

        height:
          5,
      },

      shadowOpacity:
        0.15,

      shadowRadius:
        9,

      elevation:
        4,
    },

    invoiceTotalLeft: {
      flex:
        1,

      paddingRight:
        10,
    },

    invoiceTotalLabel: {
      color:
        'rgba(255,255,255,0.72)',

      fontSize:
        7,

      fontWeight:
        '800',

      letterSpacing:
        0.8,
    },

    invoiceTotalAmount: {
      color:
        '#FFFFFF',

      fontSize:
        25,

      fontWeight:
        '900',

      marginTop:
        2,
    },

    invoiceTotalSubtext: {
      color:
        'rgba(255,255,255,0.68)',

      fontSize:
        7.5,

      marginTop:
        2,
    },

    payNowButton: {
      minWidth:
        112,

      height:
        48,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        13,

      paddingHorizontal:
        13,
    },

    payNowButtonDisabled: {
      opacity:
        0.85,
    },

    payNowText: {
      color:
        '#A00B0F',

      fontSize:
        10,

      fontWeight:
        '900',

      marginLeft:
        6,
    },

    paidNowText: {
      color:
        '#27905B',
    },

    /* =====================================================
     * Breakdown
     * ===================================================== */

    breakdownCard: {
      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EFE4DE',

      borderRadius:
        14,

      paddingHorizontal:
        12,

      marginBottom:
        23,
    },

    breakdownRow: {
      minHeight:
        43,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#F2EAE6',
    },

    breakdownRowNoBorder: {
      borderBottomWidth:
        0,
    },

    breakdownLabel: {
      color:
        '#88766F',

      fontSize:
        9,
    },

    breakdownValue: {
      color:
        '#362822',

      fontSize:
        10,

      fontWeight:
        '900',
    },

    breakdownPaidValue: {
      color:
        '#27905B',
    },

    breakdownDueValue: {
      color:
        '#A00B0F',

      fontSize:
        12,
    },

    /* =====================================================
     * All Orders Header
     * ===================================================== */

    allOrdersHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom:
        11,

      marginTop:
        1,
    },

    allOrderCountBadge: {
      backgroundColor:
        '#FFF0E8',

      borderRadius:
        14,

      paddingHorizontal:
        9,

      paddingVertical:
        6,
    },

    allOrderCountText: {
      color:
        '#A00B0F',

      fontSize:
        7.5,

      fontWeight:
        '800',
    },

    /* =====================================================
     * Order Card
     * ===================================================== */

    orderCard: {
      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#EFE4DE',

      borderRadius:
        15,

      padding:
        12,

      marginBottom:
        10,

      shadowColor:
        '#503328',

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
        1,
    },

    orderTopRow: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    orderNumberContainer: {
      width:
        39,

      height:
        39,

      borderRadius:
        11,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0E8',

      marginRight:
        10,
    },

    orderNumber: {
      color:
        '#A00B0F',

      fontSize:
        11,

      fontWeight:
        '900',
    },

    orderMain: {
      flex:
        1,

      paddingRight:
        8,
    },

    orderTitle: {
      color:
        '#30231E',

      fontSize:
        11,

      fontWeight:
        '900',
    },

    orderDate: {
      color:
        '#94817A',

      fontSize:
        8,

      marginTop:
        3,
    },

    orderAmount: {
      color:
        '#A00B0F',

      fontSize:
        14,

      fontWeight:
        '900',
    },

    orderBottomRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      borderTopWidth:
        1,

      borderTopColor:
        '#F1E9E5',

      paddingTop:
        9,

      marginTop:
        10,
    },

    orderMeta: {
      maxWidth:
        120,

      marginRight:
        18,
    },

    orderMetaLabel: {
      color:
        '#9A8982',

      fontSize:
        7,
    },

    orderMetaValue: {
      color:
        '#4B3B35',

      fontSize:
        8,

      fontWeight:
        '800',

      marginTop:
        2,
    },

    statusBadge: {
      marginLeft:
        'auto',

      minHeight:
        27,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        9,

      borderRadius:
        15,
    },

    paidBadge: {
      backgroundColor:
        '#EDF8F1',
    },

    pendingBadge: {
      backgroundColor:
        '#FFF1E9',
    },

    statusDot: {
      width:
        6,

      height:
        6,

      borderRadius:
        3,

      marginRight:
        5,
    },

    paidDot: {
      backgroundColor:
        '#27905B',
    },

    pendingDot: {
      backgroundColor:
        '#C06A2A',
    },

    statusText: {
      fontSize:
        7.5,

      fontWeight:
        '800',
    },

    paidText: {
      color:
        '#27905B',
    },

    pendingText: {
      color:
        '#A95C26',
    },

    /* =====================================================
     * Empty
     * ===================================================== */

    emptyContainer: {
      alignItems:
        'center',

      paddingTop:
        30,

      paddingBottom:
        40,

      paddingHorizontal:
        30,
    },

    emptyIcon: {
      width:
        72,

      height:
        72,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        36,

      backgroundColor:
        '#FFF0E8',
    },

    emptyTitle: {
      color:
        '#2D201B',

      fontSize:
        15,

      fontWeight:
        '900',

      marginTop:
        14,
    },

    emptySubtitle: {
      color:
        '#95827B',

      fontSize:
        9,

      lineHeight:
        15,

      textAlign:
        'center',

      marginTop:
        6,
    },

    /* =====================================================
     * Error
     * ===================================================== */

    errorBox: {
      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF0F0',

      borderWidth:
        1,

      borderColor:
        '#F0CCCC',

      borderRadius:
        12,

      padding:
        10,
    },

    errorText: {
      flex:
        1,

      color:
        '#A00B0F',

      fontSize:
        8.5,

      lineHeight:
        13,

      marginLeft:
        7,
    },
  });