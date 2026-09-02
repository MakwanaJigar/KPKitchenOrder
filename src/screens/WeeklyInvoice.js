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

import AsyncStorage from '@react-native-async-storage/async-storage';

import Ionicons from 'react-native-vector-icons/Ionicons';

/* =========================================================
 * STORAGE
 * ========================================================= */

const WEEKLY_ORDERS_STORAGE_KEY =
  'kp_customer_weekly_orders';

/* =========================================================
 * FILTER OPTIONS
 * ========================================================= */

const FILTER_OPTIONS = [
  {
    id: 'all',
    title: 'All Invoices',
    subtitle: 'Show every available invoice',
  },
  {
    id: 'last_week',
    title: 'Last Week',
    subtitle: 'Only previous week invoices',
  },
  {
    id: 'paid',
    title: 'Paid',
    subtitle: 'Show completed payments',
  },
  {
    id: 'due',
    title: 'Payment Due',
    subtitle: 'Show unpaid invoices',
  },
];

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

const getMonday = date => {
  const current =
    startOfDay(date);

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

const formatDate = date => {
  if (!date) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat(
      'en-US',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      },
    ).format(
      new Date(date),
    );
  } catch (error) {
    return '';
  }
};

const formatShortDate = date => {
  if (!date) {
    return '';
  }

  try {
    return new Intl.DateTimeFormat(
      'en-US',
      {
        day: '2-digit',
        month: 'short',
      },
    ).format(
      new Date(date),
    );
  } catch (error) {
    return '';
  }
};

/* =========================================================
 * ORDER HELPERS
 * ========================================================= */

const getOrderDate = order => {
  const rawDate =
    order?.date ??
    order?.order_date ??
    order?.ordered_at ??
    order?.created_at ??
    order?.createdAt ??
    null;

  if (!rawDate) {
    return null;
  }

  const parsedDate =
    new Date(rawDate);

  if (
    Number.isNaN(
      parsedDate.getTime(),
    )
  ) {
    return null;
  }

  return parsedDate;
};

const getOrderId = order =>
  order?.id ??
  order?.order_id ??
  order?.orderId ??
  '';

const getInvoiceNumber = (
  order,
  index,
) => {
  const invoiceNumber =
    order?.invoice_number ??
    order?.invoice_no ??
    order?.invoiceNumber ??
    order?.order_number ??
    order?.order_no ??
    getOrderId(order);

  if (
    invoiceNumber !== null &&
    invoiceNumber !== undefined &&
    invoiceNumber !== ''
  ) {
    const value =
      String(invoiceNumber);

    return value.startsWith('#')
      ? value
      : `#${value}`;
  }

  return `#INV-${String(
    index + 1,
  ).padStart(
    3,
    '0',
  )}`;
};

const getOrderName = order =>
  order?.tiffin ??
  order?.tiffin_name ??
  order?.name ??
  order?.product_name ??
  'Tiffin Order';

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

const getPaymentStatus = order =>
  order?.payment_status ??
  order?.paymentStatus ??
  order?.status ??
  'Pending';

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
    status === 'paid' ||
    status ===
      'payment completed' ||
    status ===
      'payment complete' ||
    status ===
      'completed' ||
    status ===
      'success'
  );
};

const sortOrdersNewestFirst =
  orders => {
    return [...orders].sort(
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

        if (!firstDate) {
          return 1;
        }

        if (!secondDate) {
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
 * SCREEN
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
   * STATE
   * ======================================================= */

  const [
    orders,
    setOrders,
  ] =
    useState([]);

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

  const [
    paymentLoading,
    setPaymentLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState(null);

  const [
    filterModalVisible,
    setFilterModalVisible,
  ] =
    useState(false);

  const [
    selectedFilter,
    setSelectedFilter,
  ] =
    useState('all');

  /* =======================================================
   * RESPONSIVE
   * ======================================================= */

  const responsive =
    useMemo(
      () => ({
        width:
          width >= 768
            ? Math.min(
                width,
                720,
              )
            : width,

        padding:
          width >= 768
            ? 24
            : width <= 360
              ? 12
              : 16,
      }),
      [width],
    );

  /* =======================================================
   * WEEK
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
        if (showLoader) {
          setLoading(true);
        }

        setError(null);

        const token =
          await AsyncStorage.getItem(
            'token',
          );

        if (!token) {
          Alert.alert(
            'Login Required',
            'Please login to view your invoices.',
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

        /* NAVIGATION ORDERS */

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

        /* CACHED ORDERS */

        const storedOrders =
          await AsyncStorage.getItem(
            WEEKLY_ORDERS_STORAGE_KEY,
          );

        if (storedOrders) {
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

        /*
         * Add your real invoice API here
         * when backend endpoint is available.
         */

        setOrders([]);
      } catch (err) {
        console.log(
          'WEEKLY INVOICE ERROR:',
          err,
        );

        setError(
          err?.message ??
            'Unable to load your invoices.',
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }

        setRefreshing(false);
      }
    };

  /* =======================================================
   * SCREEN FOCUS
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
   * ORDER GROUPS
   * ======================================================= */

  const allOrders =
    useMemo(
      () =>
        sortOrdersNewestFirst(
          orders,
        ),
      [orders],
    );

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

              if (!orderDate) {
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

  const paidOrders =
    useMemo(
      () =>
        allOrders.filter(
          isOrderPaid,
        ),
      [allOrders],
    );

  const dueOrders =
    useMemo(
      () =>
        allOrders.filter(
          order =>
            !isOrderPaid(
              order,
            ),
        ),
      [allOrders],
    );

  /* =======================================================
   * FILTER DATA
   * ======================================================= */

  const filteredOrders =
    useMemo(
      () => {
        switch (
          selectedFilter
        ) {
          case 'last_week':
            return lastWeekOrders;

          case 'paid':
            return paidOrders;

          case 'due':
            return dueOrders;

          case 'all':
          default:
            return allOrders;
        }
      },
      [
        selectedFilter,
        allOrders,
        lastWeekOrders,
        paidOrders,
        dueOrders,
      ],
    );

  const selectedFilterData =
    useMemo(
      () =>
        FILTER_OPTIONS.find(
          item =>
            item.id ===
            selectedFilter,
        ) ??
        FILTER_OPTIONS[0],
      [selectedFilter],
    );

  /* =======================================================
   * TOTALS
   * ======================================================= */

  const totalInvoiceAmount =
    useMemo(
      () =>
        allOrders.reduce(
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
      [allOrders],
    );

  const totalPaidAmount =
    useMemo(
      () =>
        paidOrders.reduce(
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
      [paidOrders],
    );

  const totalDueAmount =
    useMemo(
      () =>
        dueOrders.reduce(
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
      [dueOrders],
    );

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
      [lastWeekOrders],
    );

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
      [lastWeekOrders],
    );

  const lastWeekUnpaidOrders =
    useMemo(
      () =>
        lastWeekOrders.filter(
          order =>
            !isOrderPaid(
              order,
            ),
        ),
      [lastWeekOrders],
    );

  const lastWeekAmountDue =
    Math.max(
      0,
      lastWeekTotal -
        lastWeekPaidTotal,
    );

  /* =======================================================
   * REFRESH
   * ======================================================= */

  const onRefresh =
    () => {
      setRefreshing(true);

      fetchOrders(false);
    };

  /* =======================================================
   * FILTER
   * ======================================================= */

  const handleFilterSelect =
    filterId => {
      setSelectedFilter(
        filterId,
      );

      setFilterModalVisible(
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
          'No Invoice',
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
          'Last week’s invoice is already fully paid.',
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

        if (!token) {
          Alert.alert(
            'Login Required',
            'Please login before making payment.',
          );

          navigation.navigate(
            'Login',
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
          'LAST WEEK UNPAID ORDER IDS:',
          orderIds,
        );

        console.log(
          'LAST WEEK AMOUNT DUE:',
          lastWeekAmountDue,
        );

        Alert.alert(
          'Weekly Payment',
          `Amount due: $${lastWeekAmountDue.toFixed(
            2,
          )}\n\n${lastWeekUnpaidOrders.length} unpaid order(s).`,
        );
      } catch (err) {
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
   * INVOICE CARD
   * ======================================================= */

  const renderInvoiceCard =
    ({
      item,
      index,
    }) => {
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

      const invoiceNumber =
        getInvoiceNumber(
          item,
          index,
        );

      return (
        <View
          style={
            styles.invoiceCard
          }
        >
          <View
            style={
              styles.invoiceCardTop
            }
          >
            <View
              style={
                styles.invoiceIcon
              }
            >
              <Image
                source={require('../assets/login-icons/invoice.png')}
                style={
                  styles.invoiceCardIconImage
                }
                resizeMode="contain"
              />
            </View>

            <View
              style={
                styles.invoiceMain
              }
            >
              <Text
                style={
                  styles.invoiceSmallLabel
                }
              >
                INVOICE
              </Text>

              <Text
                numberOfLines={1}
                style={
                  styles.invoiceNumber
                }
              >
                {invoiceNumber}
              </Text>

              <Text
                numberOfLines={1}
                style={
                  styles.invoiceProductName
                }
              >
                {getOrderName(
                  item,
                )}
              </Text>
            </View>

            <View
              style={
                styles.invoiceAmountArea
              }
            >
              <Text
                style={
                  styles.invoiceAmountLabel
                }
              >
                AMOUNT
              </Text>

              <Text
                style={
                  styles.invoiceAmount
                }
              >
                $
                {amount.toFixed(
                  2,
                )}
              </Text>
            </View>
          </View>

          <View
            style={
              styles.invoiceDivider
            }
          />

          <View
            style={
              styles.invoiceMetaRow
            }
          >
            <View
              style={
                styles.invoiceMetaItem
              }
            >
              <View
                style={
                  styles.invoiceMetaIcon
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color="#697386"
                />
              </View>

              <View
                style={
                  styles.invoiceMetaContent
                }
              >
                <Text
                  style={
                    styles.invoiceMetaLabel
                  }
                >
                  DATE
                </Text>

                <Text
                  numberOfLines={1}
                  style={
                    styles.invoiceMetaValue
                  }
                >
                  {orderDate
                    ? formatDate(
                        orderDate,
                      )
                    : 'Unavailable'}
                </Text>
              </View>
            </View>

            <View
              style={
                styles.invoiceMetaItem
              }
            >
              <View
                style={
                  styles.invoiceMetaIcon
                }
              >
                <Ionicons
                  name="restaurant-outline"
                  size={16}
                  color="#697386"
                />
              </View>

              <View
                style={
                  styles.invoiceMetaContent
                }
              >
                <Text
                  style={
                    styles.invoiceMetaLabel
                  }
                >
                  QUANTITY
                </Text>

                <Text
                  style={
                    styles.invoiceMetaValue
                  }
                >
                  {quantity}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={
              styles.invoiceBottomRow
            }
          >
            <View
              style={[
                styles.statusBadge,

                paid
                  ? styles.paidBadge
                  : styles.dueBadge,
              ]}
            >
              <View
                style={[
                  styles.statusDot,

                  paid
                    ? styles.paidDot
                    : styles.dueDot,
                ]}
              />

              <Text
                style={[
                  styles.statusText,

                  paid
                    ? styles.paidText
                    : styles.dueText,
                ]}
              >
                {paid
                  ? 'Paid'
                  : 'Payment Due'}
              </Text>
            </View>

            <Text
              style={
                styles.orderIdText
              }
            >
              Order #
              {getOrderId(
                item,
              ) || '—'}
            </Text>
          </View>
        </View>
      );
    };

  /* =======================================================
   * LIST HEADER
   * ======================================================= */

  const renderListHeader =
    () => (
      <>
        {/* ================================================= */}
        {/* SUMMARY */}
        {/* ================================================= */}

        <View
          style={
            styles.summarySection
          }
        >
          <View
            style={
              styles.summaryTitleRow
            }
          >
            <View>
              <Text
                style={
                  styles.sectionEyebrow
                }
              >
                BILLING OVERVIEW
              </Text>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Invoice Summary
              </Text>
            </View>

            <View
              style={
                styles.totalInvoiceBadge
              }
            >
              <Text
                style={
                  styles.totalInvoiceBadgeNumber
                }
              >
                {allOrders.length}
              </Text>

              <Text
                style={
                  styles.totalInvoiceBadgeText
                }
              >
                INVOICES
              </Text>
            </View>
          </View>

          <View
            style={
              styles.summaryCards
            }
          >
            {/* TOTAL */}

            <View
              style={
                styles.summaryCard
              }
            >
              <View
                style={[
                  styles.summaryIcon,
                  styles.totalIcon,
                ]}
              >
                <Image
                  source={require('../assets/login-icons/doller-red.png')}
                  style={
                    styles.summaryImage
                  }
                  resizeMode="contain"
                />
              </View>

              <Text
                style={
                  styles.summaryLabel
                }
              >
                TOTAL
              </Text>

              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={
                  styles.summaryAmount
                }
              >
                $
                {totalInvoiceAmount.toFixed(
                  2,
                )}
              </Text>
            </View>

            {/* PAID */}

            <View
              style={
                styles.summaryCard
              }
            >
              <View
                style={[
                  styles.summaryIcon,
                  styles.paidSummaryIcon,
                ]}
              >
                <Image
                  source={require('../assets/login-icons/doller-green.png')}
                  style={
                    styles.summaryImage
                  }
                  resizeMode="contain"
                />
              </View>

              <Text
                style={
                  styles.summaryLabel
                }
              >
                PAID
              </Text>

              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.summaryAmount,
                  styles.paidSummaryAmount,
                ]}
              >
                $
                {totalPaidAmount.toFixed(
                  2,
                )}
              </Text>
            </View>

            {/* DUE */}

            <View
              style={
                styles.summaryCard
              }
            >
              <View
                style={[
                  styles.summaryIcon,
                  styles.dueSummaryIcon,
                ]}
              >
                <Image
                  source={require('../assets/login-icons/doller-orange.png')}
                  style={
                    styles.summaryImage
                  }
                  resizeMode="contain"
                />
              </View>

              <Text
                style={
                  styles.summaryLabel
                }
              >
                DUE
              </Text>

              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.summaryAmount,
                  styles.dueSummaryAmount,
                ]}
              >
                $
                {totalDueAmount.toFixed(
                  2,
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* ================================================= */}
        {/* LAST WEEK */}
        {/* ================================================= */}

        {lastWeekOrders.length >
          0 && (
          <View
            style={
              styles.lastWeekCard
            }
          >
            <View
              style={
                styles.lastWeekTop
              }
            >
              <View
                style={
                  styles.lastWeekCalendar
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={22}
                  color="#FFFFFF"
                />
              </View>

              <View
                style={
                  styles.lastWeekContent
                }
              >
                <Text
                  style={
                    styles.lastWeekLabel
                  }
                >
                  LAST WEEK INVOICE
                </Text>

                <Text
                  style={
                    styles.lastWeekDate
                  }
                >
                  {formatShortDate(
                    lastWeekRange.start,
                  )}
                  {' — '}
                  {formatShortDate(
                    lastWeekRange.end,
                  )}
                </Text>

                <Text
                  style={
                    styles.lastWeekOrderCount
                  }
                >
                  {lastWeekOrders.length}{' '}
                  {lastWeekOrders.length ===
                  1
                    ? 'order'
                    : 'orders'}
                </Text>
              </View>

              <View
                style={
                  styles.lastWeekAmountArea
                }
              >
                <Text
                  style={
                    styles.lastWeekAmountLabel
                  }
                >
                  DUE
                </Text>

                <Text
                  style={
                    styles.lastWeekAmount
                  }
                >
                  $
                  {lastWeekAmountDue.toFixed(
                    2,
                  )}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={
                paymentLoading ||
                lastWeekAmountDue <=
                  0
              }
              onPress={
                handlePayLastWeek
              }
              style={[
                styles.payLastWeekButton,

                (paymentLoading ||
                  lastWeekAmountDue <=
                    0) &&
                  styles.payLastWeekButtonDisabled,
              ]}
            >
              {paymentLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#A9090D"
                />
              ) : (
                <Ionicons
                  name={
                    lastWeekAmountDue >
                    0
                      ? 'card-outline'
                      : 'checkmark-circle-outline'
                  }
                  size={18}
                  color={
                    lastWeekAmountDue >
                    0
                      ? '#A9090D'
                      : '#23834B'
                  }
                />
              )}

              <Text
                style={[
                  styles.payLastWeekText,

                  lastWeekAmountDue <=
                    0 &&
                    styles.paidLastWeekText,
                ]}
              >
                {paymentLoading
                  ? 'Please Wait'
                  : lastWeekAmountDue >
                      0
                    ? 'Pay Last Week Invoice'
                    : 'Last Week Paid'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ================================================= */}
        {/* INVOICE HISTORY */}
        {/* ================================================= */}

        <View
          style={
            styles.invoiceListHeader
          }
        >
          <View
            style={
              styles.invoiceListTitleArea
            }
          >
            <Text
              style={
                styles.sectionEyebrow
              }
            >
              INVOICE HISTORY
            </Text>

            <Text
              style={
                styles.sectionTitle
              }
            >
              Your Invoices
            </Text>

            <Text
              style={
                styles.invoiceListSubtitle
              }
            >
              {filteredOrders.length}{' '}
              {filteredOrders.length ===
              1
                ? 'invoice'
                : 'invoices'}{' '}
              found
            </Text>
          </View>

          <Pressable
            onPress={() =>
              setFilterModalVisible(
                true,
              )
            }
            style={({
              pressed,
            }) => [
              styles.filterButton,

              pressed &&
                styles.filterButtonPressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={
                styles.filterButtonText
              }
            >
              {selectedFilterData.title}
            </Text>

            <Text
              style={
                styles.filterArrow
              }
            >
              ▾
            </Text>
          </Pressable>
        </View>

        {selectedFilter !==
          'all' && (
          <View
            style={
              styles.activeFilterRow
            }
          >
            <View
              style={
                styles.activeFilterChip
              }
            >
              <Text
                style={
                  styles.activeFilterText
                }
              >
                {selectedFilterData.title}
              </Text>

              <Pressable
                hitSlop={10}
                onPress={() =>
                  setSelectedFilter(
                    'all',
                  )
                }
              >
                <Text
                  style={
                    styles.activeFilterClose
                  }
                >
                  ×
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </>
    );

  /* =======================================================
   * LOADING
   * ======================================================= */

  if (loading) {
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
          backgroundColor="#FFF9F6"
        />

        {/* HEADER */}

        <View
          style={
            styles.header
          }
        >
          <Pressable
            hitSlop={10}
            onPress={() =>
              navigation.goBack()
            }
            style={({
              pressed,
            }) => [
              styles.backButton,

              pressed &&
                styles.backButtonPressed,
            ]}
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
              styles.headerTextArea
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
              Weekly Invoices
            </Text>
          </View>
        </View>

        <View
          style={
            styles.loadingContainer
          }
        >
          <View
            style={
              styles.loadingIcon
            }
          >
            <ActivityIndicator
              size="large"
              color="#A9090D"
            />
          </View>

          <Text
            style={
              styles.loadingTitle
            }
          >
            Loading Invoices
          </Text>

          <Text
            style={
              styles.loadingText
            }
          >
            Retrieving your billing
            history...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* =======================================================
   * MAIN UI
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
        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <View
          style={
            styles.header
          }
        >
          <Pressable
            hitSlop={10}
            onPress={() =>
              navigation.goBack()
            }
            style={({
              pressed,
            }) => [
              styles.backButton,

              pressed &&
                styles.backButtonPressed,
            ]}
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
              styles.headerTextArea
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
              numberOfLines={1}
              style={
                styles.headerTitle
              }
            >
              Weekly Invoices
            </Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {!!error && (
          <View
            style={[
              styles.errorBox,

              {
                marginHorizontal:
                  responsive.padding,
              },
            ]}
          >
            <View
              style={
                styles.errorIcon
              }
            >
              <Text
                style={
                  styles.errorIconText
                }
              >
                !
              </Text>
            </View>

            <Text
              style={
                styles.errorText
              }
            >
              {error}
            </Text>
          </View>
        )}

        {/* ================================================= */}
        {/* LIST */}
        {/* ================================================= */}

        <FlatList
          style={
            styles.flatList
          }
          data={
            filteredOrders
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
          renderItem={
            renderInvoiceCard
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
              tintColor="#A9090D"
              colors={[
                '#A9090D',
              ]}
            />
          }
          contentContainerStyle={{
            paddingHorizontal:
              responsive.padding,

            paddingTop:
              18,

            paddingBottom:
              70,

            flexGrow: 1,
          }}
          ListHeaderComponent={
            renderListHeader
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
                <Image
                  source={require('../assets/login-icons/invoice.png')}
                  style={
                    styles.emptyInvoiceIcon
                  }
                  resizeMode="contain"
                />
              </View>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No Invoices Found
              </Text>

              <Text
                style={
                  styles.emptySubtitle
                }
              >
                No invoices match the
                selected filter.
              </Text>

              {selectedFilter !==
                'all' && (
                <Pressable
                  onPress={() =>
                    setSelectedFilter(
                      'all',
                    )
                  }
                  style={
                    styles.clearFilterButton
                  }
                >
                  <Text
                    style={
                      styles.clearFilterButtonText
                    }
                  >
                    Show All Invoices
                  </Text>
                </Pressable>
              )}
            </View>
          }
        />
      </View>

      {/* ================================================= */}
      {/* FILTER MODAL */}
      {/* ================================================= */}

      <Modal
        visible={
          filterModalVisible
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() =>
          setFilterModalVisible(
            false,
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <Pressable
            style={
              StyleSheet.absoluteFillObject
            }
            onPress={() =>
              setFilterModalVisible(
                false,
              )
            }
          />

          <SafeAreaView
            style={
              styles.modalSafeArea
            }
            edges={[
              'bottom',
              'left',
              'right',
            ]}
          >
            <View
              style={
                styles.filterModal
              }
            >
              <View
                style={
                  styles.modalHandle
                }
              />

              {/* FILTER TITLE */}

              <View
                style={
                  styles.filterModalHeader
                }
              >
                <Text
                  style={
                    styles.filterModalTitle
                  }
                >
                  Filter Invoices
                </Text>

                <Text
                  style={
                    styles.filterModalSubtitle
                  }
                >
                  Choose which invoices
                  you want to see
                </Text>
              </View>

              {/* FILTER OPTIONS - NO ICONS */}

              <View
                style={
                  styles.filterOptions
                }
              >
                {FILTER_OPTIONS.map(
                  item => {
                    const active =
                      selectedFilter ===
                      item.id;

                    return (
                      <Pressable
                        key={
                          item.id
                        }
                        onPress={() =>
                          handleFilterSelect(
                            item.id,
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.filterOption,

                          active &&
                            styles.activeFilterOption,

                          pressed &&
                            styles.filterOptionPressed,
                        ]}
                      >
                        <View
                          style={
                            styles.filterOptionTextArea
                          }
                        >
                          <Text
                            style={[
                              styles.filterOptionTitle,

                              active &&
                                styles.activeFilterOptionTitle,
                            ]}
                          >
                            {item.title}
                          </Text>

                          <Text
                            style={[
                              styles.filterOptionSubtitle,

                              active &&
                                styles.activeFilterOptionSubtitle,
                            ]}
                          >
                            {item.subtitle}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.radioOuter,

                            active &&
                              styles.activeRadioOuter,
                          ]}
                        >
                          {active && (
                            <View
                              style={
                                styles.radioInner
                              }
                            />
                          )}
                        </View>
                      </Pressable>
                    );
                  },
                )}
              </View>

              <Pressable
                onPress={() =>
                  setFilterModalVisible(
                    false,
                  )
                }
                style={
                  styles.closeFilterButton
                }
              >
                <Text
                  style={
                    styles.closeFilterText
                  }
                >
                  Close
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default WeeklyInvoice;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles =
  StyleSheet.create({
    /* =====================================================
     * SAFE AREA
     * ===================================================== */

    safeArea: {
      flex: 1,

      backgroundColor:
        '#FFF9F6',
    },

    container: {
      flex: 1,

      alignSelf:
        'center',

      backgroundColor:
        '#F6F7F9',
    },

    flatList: {
      flex: 1,

      backgroundColor:
        '#F6F7F9',
    },

    /* =====================================================
     * HEADER
     * ===================================================== */

    header: {
      minHeight: 86,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF9F6',

      paddingHorizontal: 16,

      paddingVertical: 12,

      borderBottomWidth: 1,

      borderBottomColor:
        '#F0E7E3',
    },

    backButton: {
      width: 48,

      height: 48,

      borderRadius: 15,

      backgroundColor:
        '#FFFFFF',

      borderWidth: 1,

      borderColor:
        '#EADFD9',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight: 14,

      elevation: 1,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 1,
      },

      shadowOpacity: 0.04,

      shadowRadius: 3,
    },

    backButtonPressed: {
      opacity: 0.65,

      transform: [
        {
          scale: 0.96,
        },
      ],
    },

    backIcon: {
      width: 20,

      height: 20,

      tintColor:
        '#A9090D',
    },

    headerTextArea: {
      flex: 1,

      justifyContent:
        'center',

      minWidth: 0,
    },

    headerEyebrow: {
      color:
        '#A94C2B',

      fontSize: 9,

      fontWeight:
        '900',

      letterSpacing: 1,

      marginBottom: 4,
    },

    headerTitle: {
      color:
        '#211816',

      fontSize: 23,

      lineHeight: 28,

      fontWeight:
        '900',
    },

    /* =====================================================
     * LOADING
     * ===================================================== */

    loadingContainer: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F6F7F9',

      paddingHorizontal: 30,
    },

    loadingIcon: {
      width: 82,

      height: 82,

      borderRadius: 41,

      backgroundColor:
        '#FFFFFF',

      alignItems:
        'center',

      justifyContent:
        'center',

      elevation: 5,
    },

    loadingTitle: {
      color:
        '#17191D',

      fontSize: 20,

      fontWeight:
        '900',

      marginTop: 18,
    },

    loadingText: {
      color:
        '#7D8490',

      fontSize: 12,

      textAlign:
        'center',

      marginTop: 6,
    },

    /* =====================================================
     * ERROR
     * ===================================================== */

    errorBox: {
      minHeight: 52,

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF9F6',

      borderWidth: 1,

      borderColor:
        '#F0CCCC',

      borderRadius: 12,

      padding: 11,

      marginTop: 13,
    },

    errorIcon: {
      width: 27,

      height: 27,

      borderRadius: 14,

      backgroundColor:
        '#A9090D',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    errorIconText: {
      color:
        '#FFFFFF',

      fontSize: 15,

      fontWeight:
        '900',
    },

    errorText: {
      flex: 1,

      color:
        '#A00B0F',

      fontSize: 10,

      lineHeight: 15,

      marginLeft: 8,
    },

    /* =====================================================
     * SUMMARY
     * ===================================================== */

    summarySection: {
      marginBottom: 20,
      // backgroundColor:'#FFF9F6',
    },

    summaryTitleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom: 12,
    },

    sectionEyebrow: {
      color:
        '#A9090D',

      fontSize: 8,

      fontWeight:
        '900',

      letterSpacing: 0.9,

      marginBottom: 3,
    },

    sectionTitle: {
      color:
        '#17191D',

      fontSize: 18,

      fontWeight:
        '900',
    },

    totalInvoiceBadge: {
      minWidth: 58,

      backgroundColor:
        '#FFF0F1',

      borderRadius: 13,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal: 9,

      paddingVertical: 7,
    },

    totalInvoiceBadgeNumber: {
      color:
        '#A9090D',

      fontSize: 16,

      fontWeight:
        '900',
    },

    totalInvoiceBadgeText: {
      color:
        '#9B6063',

      fontSize: 7,

      fontWeight:
        '900',

      marginTop: 1,
    },

    summaryCards: {
      flexDirection:
        'row',

      columnGap: 8,
    },

    summaryCard: {
      flex: 1,

      minWidth: 0,

      minHeight: 112,

      backgroundColor:
        '#FFFFFF',

      borderRadius: 15,

      borderWidth: 1,

      borderColor:
        '#E9EBEE',

      padding: 11,

      elevation: 2,
    },

    summaryIcon: {
      width: 36,

      height: 36,

      borderRadius: 11,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginBottom: 11,
    },

    totalIcon: {
      backgroundColor:
        '#FFF0F1',
    },

    paidSummaryIcon: {
      backgroundColor:
        '#EAF8EF',
    },

    dueSummaryIcon: {
      backgroundColor:
        '#FFF4E5',
    },

    summaryImage: {
      width: 18,

      height: 18,
    },

    summaryLabel: {
      color:
        '#9298A1',

      fontSize: 7,

      fontWeight:
        '900',

      letterSpacing: 0.6,
    },

    summaryAmount: {
      color:
        '#17191D',

      fontSize: 14,

      fontWeight:
        '900',

      marginTop: 4,
    },

    paidSummaryAmount: {
      color:
        '#23834B',
    },

    dueSummaryAmount: {
      color:
        '#AD6814',
    },

    /* =====================================================
     * LAST WEEK CARD
     * ===================================================== */

    lastWeekCard: {
      backgroundColor:
        '#A9090D',

      borderRadius: 17,

      padding: 14,

      marginBottom: 22,

      elevation: 4,
    },

    lastWeekTop: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    lastWeekCalendar: {
      width: 47,

      height: 47,

      borderRadius: 14,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(255,255,255,0.15)',

      marginRight: 11,
    },

    lastWeekContent: {
      flex: 1,

      minWidth: 0,
    },

    lastWeekLabel: {
      color:
        '#F4C454',

      fontSize: 8,

      fontWeight:
        '900',

      letterSpacing: 0.7,
    },

    lastWeekDate: {
      color:
        '#FFFFFF',

      fontSize: 13,

      fontWeight:
        '900',

      marginTop: 3,
    },

    lastWeekOrderCount: {
      color:
        'rgba(255,255,255,0.7)',

      fontSize: 9,

      marginTop: 3,
    },

    lastWeekAmountArea: {
      alignItems:
        'flex-end',

      marginLeft: 10,
    },

    lastWeekAmountLabel: {
      color:
        'rgba(255,255,255,0.63)',

      fontSize: 7,

      fontWeight:
        '900',
    },

    lastWeekAmount: {
      color:
        '#FFFFFF',

      fontSize: 19,

      fontWeight:
        '900',

      marginTop: 3,
    },

    payLastWeekButton: {
      height: 47,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderRadius: 12,

      marginTop: 13,
    },

    payLastWeekButtonDisabled: {
      opacity: 0.88,
    },

    payLastWeekText: {
      color:
        '#A9090D',

      fontSize: 11,

      fontWeight:
        '900',

      marginLeft: 7,
    },

    paidLastWeekText: {
      color:
        '#23834B',
    },

    /* =====================================================
     * HISTORY HEADER
     * ===================================================== */

    invoiceListHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom: 12,
    },

    invoiceListTitleArea: {
      flex: 1,

      minWidth: 0,

      paddingRight: 10,
    },

    invoiceListSubtitle: {
      color:
        '#8A909A',

      fontSize: 9.5,

      marginTop: 3,
    },

    filterButton: {
      maxWidth: 160,

      minHeight: 42,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderWidth: 1,

      borderColor:
        '#E6D5D6',

      borderRadius: 12,

      paddingHorizontal: 12,

      elevation: 1,
    },

    filterButtonPressed: {
      opacity: 0.75,
    },

    filterButtonText: {
      flexShrink: 1,

      color:
        '#A9090D',

      fontSize: 10,

      fontWeight:
        '800',
    },

    filterArrow: {
      color:
        '#A9090D',

      fontSize: 13,

      fontWeight:
        '800',

      marginLeft: 7,
    },

    activeFilterRow: {
      marginBottom: 10,
    },

    activeFilterChip: {
      alignSelf:
        'flex-start',

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF0F1',

      borderRadius: 20,

      paddingLeft: 11,

      paddingRight: 7,

      paddingVertical: 6,
    },

    activeFilterText: {
      color:
        '#A9090D',

      fontSize: 9,

      fontWeight:
        '800',
    },

    activeFilterClose: {
      width: 22,

      height: 22,

      color:
        '#A9090D',

      fontSize: 17,

      lineHeight: 21,

      fontWeight:
        '900',

      textAlign:
        'center',

      marginLeft: 5,
    },

    /* =====================================================
     * INVOICE CARD
     * ===================================================== */

    invoiceCard: {
      backgroundColor:
        '#FFFFFF',

      borderWidth: 1,

      borderColor:
        '#E9EBEE',

      borderRadius: 16,

      padding: 14,

      marginBottom: 11,

      elevation: 2,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity: 0.045,

      shadowRadius: 5,
    },

    invoiceCardTop: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    invoiceIcon: {
      width: 47,

      height: 47,

      borderRadius: 14,

      backgroundColor:
        '#FFF0F1',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight: 11,
    },

    invoiceCardIconImage: {
      width: 21,

      height: 21,
    },

    invoiceMain: {
      flex: 1,

      minWidth: 0,

      paddingRight: 8,
    },

    invoiceSmallLabel: {
      color:
        '#999FA8',

      fontSize: 7,

      fontWeight:
        '900',

      letterSpacing: 0.6,
    },

    invoiceNumber: {
      color:
        '#17191D',

      fontSize: 15,

      fontWeight:
        '900',

      marginTop: 2,
    },

    invoiceProductName: {
      color:
        '#707887',

      fontSize: 9.5,

      marginTop: 3,
    },

    invoiceAmountArea: {
      alignItems:
        'flex-end',
    },

    invoiceAmountLabel: {
      color:
        '#999FA8',

      fontSize: 7,

      fontWeight:
        '900',
    },

    invoiceAmount: {
      color:
        '#A9090D',

      fontSize: 17,

      fontWeight:
        '900',

      marginTop: 3,
    },

    invoiceDivider: {
      height: 1,

      backgroundColor:
        '#F0F1F3',

      marginVertical: 12,
    },

    invoiceMetaRow: {
      flexDirection:
        'row',

      columnGap: 12,
    },

    invoiceMetaItem: {
      flex: 1,

      minWidth: 0,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    invoiceMetaContent: {
      flex: 1,

      minWidth: 0,
    },

    invoiceMetaIcon: {
      width: 32,

      height: 32,

      borderRadius: 9,

      backgroundColor:
        '#F5F6F8',

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight: 7,
    },

    invoiceMetaLabel: {
      color:
        '#989EA7',

      fontSize: 7,

      fontWeight:
        '900',
    },

    invoiceMetaValue: {
      color:
        '#4C5563',

      fontSize: 9.5,

      fontWeight:
        '700',

      marginTop: 2,
    },

    invoiceBottomRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginTop: 13,
    },

    statusBadge: {
      minHeight: 29,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius: 15,

      paddingHorizontal: 9,
    },

    paidBadge: {
      backgroundColor:
        '#EAF8EF',
    },

    dueBadge: {
      backgroundColor:
        '#FFF2E7',
    },

    statusDot: {
      width: 6,

      height: 6,

      borderRadius: 3,

      marginRight: 5,
    },

    paidDot: {
      backgroundColor:
        '#23834B',
    },

    dueDot: {
      backgroundColor:
        '#B36A12',
    },

    statusText: {
      fontSize: 8,

      fontWeight:
        '900',
    },

    paidText: {
      color:
        '#23834B',
    },

    dueText: {
      color:
        '#A85F0D',
    },

    orderIdText: {
      color:
        '#89909A',

      fontSize: 8.5,

      fontWeight:
        '700',
    },

    /* =====================================================
     * EMPTY
     * ===================================================== */

    emptyContainer: {
      flex: 1,

      minHeight: 280,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingVertical: 35,

      paddingHorizontal: 30,
    },

    emptyIcon: {
      width: 72,

      height: 72,

      borderRadius: 36,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0F1',
    },

    emptyInvoiceIcon: {
      width: 30,

      height: 30,
    },

    emptyTitle: {
      color:
        '#17191D',

      fontSize: 16,

      fontWeight:
        '900',

      marginTop: 14,
    },

    emptySubtitle: {
      color:
        '#858D98',

      fontSize: 10,

      lineHeight: 15,

      textAlign:
        'center',

      marginTop: 6,
    },

    clearFilterButton: {
      backgroundColor:
        '#A9090D',

      paddingHorizontal: 15,

      paddingVertical: 10,

      borderRadius: 10,

      marginTop: 14,
    },

    clearFilterButtonText: {
      color:
        '#FFFFFF',

      fontSize: 9,

      fontWeight:
        '900',
    },

    /* =====================================================
     * FILTER MODAL
     * ===================================================== */

    modalOverlay: {
      flex: 1,

      backgroundColor:
        'rgba(17,24,39,0.67)',

      justifyContent:
        'flex-end',
    },

    modalSafeArea: {
      backgroundColor:
        '#FFFFFF',
    },

    filterModal: {
      backgroundColor:
        '#FFFFFF',

      borderTopLeftRadius: 28,

      borderTopRightRadius: 28,

      paddingHorizontal: 18,

      paddingTop: 10,

      paddingBottom: 20,

      elevation: 20,
    },

    modalHandle: {
      width: 42,

      height: 4,

      borderRadius: 2,

      backgroundColor:
        '#D9DADD',

      alignSelf:
        'center',

      marginBottom: 19,
    },

    filterModalHeader: {
      marginBottom: 17,
    },

    filterModalTitle: {
      color:
        '#17191D',

      fontSize: 19,

      fontWeight:
        '900',
    },

    filterModalSubtitle: {
      color:
        '#818894',

      fontSize: 10,

      marginTop: 4,
    },

    filterOptions: {
      rowGap: 8,
    },

    /* FILTER ITEM - NO ICON */

    filterOption: {
      minHeight: 66,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderWidth: 1,

      borderColor:
        '#ECEEF1',

      backgroundColor:
        '#FFFFFF',

      borderRadius: 14,

      paddingHorizontal: 14,

      paddingVertical: 10,
    },

    activeFilterOption: {
      borderColor:
        '#DDAFB1',

      backgroundColor:
        '#FFF8F8',
    },

    filterOptionPressed: {
      opacity: 0.75,
    },

    filterOptionTextArea: {
      flex: 1,

      minWidth: 0,

      paddingRight: 12,
    },

    filterOptionTitle: {
      color:
        '#24272D',

      fontSize: 13,

      fontWeight:
        '900',
    },

    activeFilterOptionTitle: {
      color:
        '#A9090D',
    },

    filterOptionSubtitle: {
      color:
        '#888F99',

      fontSize: 9.5,

      marginTop: 4,
    },

    activeFilterOptionSubtitle: {
      color:
        '#916164',
    },

    radioOuter: {
      width: 21,

      height: 21,

      borderRadius: 11,

      borderWidth: 2,

      borderColor:
        '#D1D5DB',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    activeRadioOuter: {
      borderColor:
        '#A9090D',
    },

    radioInner: {
      width: 10,

      height: 10,

      borderRadius: 5,

      backgroundColor:
        '#A9090D',
    },

    closeFilterButton: {
      height: 48,

      backgroundColor:
        '#F1F2F4',

      borderRadius: 12,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginTop: 14,
    },

    closeFilterText: {
      color:
        '#555D69',

      fontSize: 11,

      fontWeight:
        '900',
    },
  });