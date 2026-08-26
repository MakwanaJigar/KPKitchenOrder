import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  Image,
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

import Ionicons from 'react-native-vector-icons/Ionicons';

import AsyncStorage from '@react-native-async-storage/async-storage';

/* =========================================================
 * Orders API
 * ========================================================= */

const ORDERS_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/orders';

/* =========================================================
 * Component
 * ========================================================= */

const PreviousOrders = ({
  navigation,
}) => {
  const {width} =
    useWindowDimensions();

  /* =======================================================
   * State
   * ======================================================= */

  const [orders, setOrders] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState(null);

  /* =======================================================
   * Responsive
   * ======================================================= */

  const responsive =
    useMemo(() => {
      const isTablet =
        width >= 768;

      return {
        isTablet,

        contentWidth:
          isTablet
            ? Math.min(
                width - 80,
                720,
              )
            : width,

        horizontalPadding:
          isTablet
            ? 28
            : 16,
      };
    }, [width]);

  /* =======================================================
   * Currency
   * ======================================================= */

  const formatPrice =
    value => {
      const number =
        Number(value ?? 0);

      if (
        Number.isNaN(number)
      ) {
        return '$0.00';
      }

      return `$${number.toFixed(2)}`;
    };

  /* =======================================================
   * Format Date
   * ======================================================= */

  const formatOrderDate =
    value => {
      if (!value) {
        return '';
      }

      try {
        const date =
          new Date(value);

        if (
          Number.isNaN(
            date.getTime(),
          )
        ) {
          return String(value);
        }

        return date.toLocaleDateString(
          'en-AU',
          {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          },
        );
      } catch (e) {
        return String(value);
      }
    };

  /* =======================================================
   * Format Time
   * ======================================================= */

  const formatOrderTime =
    value => {
      if (!value) {
        return '';
      }

      try {
        const date =
          new Date(value);

        if (
          Number.isNaN(
            date.getTime(),
          )
        ) {
          return '';
        }

        return date.toLocaleTimeString(
          'en-AU',
          {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          },
        );
      } catch (e) {
        return '';
      }
    };

  /* =======================================================
   * Normalize Status
   * ======================================================= */

  const normalizeStatus =
    value => {
      if (!value) {
        return 'Processing';
      }

      const status =
        String(value)
          .trim()
          .toLowerCase();

      if (
        status ===
          'delivered' ||
        status ===
          'completed'
      ) {
        return 'Delivered';
      }

      if (
        status ===
          'cancelled' ||
        status ===
          'canceled'
      ) {
        return 'Cancelled';
      }

      if (
        status ===
          'processing' ||
        status ===
          'pending' ||
        status ===
          'confirmed' ||
        status ===
          'preparing'
      ) {
        return 'Processing';
      }

      if (
        status ===
          'out_for_delivery' ||
        status ===
          'out for delivery'
      ) {
        return 'Out for Delivery';
      }

      return (
        String(value)
          .charAt(0)
          .toUpperCase() +
        String(value).slice(1)
      );
    };

  /* =======================================================
   * Normalize Order Data
   * ======================================================= */

  const normalizeOrder =
    (
      item,
      index,
    ) => {
      /* ---------------------------------------------------
       * Items
       * --------------------------------------------------- */

      const rawItems =
        item?.items ??
        item?.order_items ??
        item?.orderItems ??
        item?.details ??
        [];

      let orderItems = [];

      if (
        Array.isArray(rawItems)
      ) {
        orderItems =
          rawItems.map(
            (
              orderItem,
              itemIndex,
            ) => ({
              id: String(
                orderItem?.id ??
                  `${item?.id ?? index}-${itemIndex}`,
              ),

              name:
                orderItem?.name ??
                orderItem?.tiffin_name ??
                orderItem?.product_name ??
                orderItem?.tiffin?.name ??
                orderItem?.product?.name ??
                'Tiffin',

              quantity:
                Number(
                  orderItem?.quantity ??
                    orderItem?.qty ??
                    1,
                ) || 1,
            }),
          );
      }

      /*
       * API may return direct tiffin.
       */

      if (
        orderItems.length ===
          0 &&
        item?.tiffin
      ) {
        orderItems = [
          {
            id: String(
              item?.tiffin?.id ??
                item?.id ??
                index,
            ),

            name:
              item?.tiffin?.name ??
              'Tiffin',

            quantity:
              Number(
                item?.quantity ??
                  1,
              ) || 1,
          },
        ];
      }

      /*
       * Final fallback
       */

      if (
        orderItems.length ===
        0
      ) {
        orderItems = [
          {
            id:
              `${item?.id ?? index}-default`,

            name:
              item?.tiffin_name ??
              item?.name ??
              'Tiffin Order',

            quantity:
              Number(
                item?.quantity ??
                  1,
              ) || 1,
          },
        ];
      }

      /* ---------------------------------------------------
       * Selections / Customizations
       * --------------------------------------------------- */

      let selections = [];

      const rawSelections =
        item?.selections ??
        item?.selected_items ??
        item?.customizations ??
        item?.customization ??
        item?.options ??
        [];

      if (
        Array.isArray(
          rawSelections,
        )
      ) {
        selections =
          rawSelections
            .map(selection => {
              if (
                typeof selection ===
                'string'
              ) {
                return selection;
              }

              if (
                typeof selection ===
                  'number'
              ) {
                return String(
                  selection,
                );
              }

              return (
                selection?.name ??
                selection?.option_name ??
                selection?.value ??
                selection?.title ??
                selection?.label ??
                null
              );
            })
            .filter(Boolean);
      }

      /* ---------------------------------------------------
       * Price
       * --------------------------------------------------- */

      const subtotal =
        Number(
          item?.subtotal ??
            item?.sub_total ??
            item?.food_subtotal ??
            item?.amount ??
            0,
        ) || 0;

      const shippingCharge =
        Number(
          item?.shipping_charge ??
            item?.shippingCharge ??
            item?.delivery_charge ??
            item?.delivery_fee ??
            0,
        ) || 0;

      let total =
        Number(
          item?.total ??
            item?.total_amount ??
            item?.grand_total ??
            item?.final_total ??
            0,
        ) || 0;

      if (!total) {
        total =
          subtotal +
          shippingCharge;
      }

      /* ---------------------------------------------------
       * Date + Time
       * --------------------------------------------------- */

      const dateValue =
        item?.created_at ??
        item?.order_date ??
        item?.date ??
        null;

      /* ---------------------------------------------------
       * Final structure for existing UI
       * --------------------------------------------------- */

      return {
        ...item,

        id: String(
          item?.id ??
            index,
        ),

        orderNumber:
          item?.order_number ??
          item?.order_no ??
          item?.order_id ??
          item?.invoice_number ??
          item?.id ??
          index + 1,

        date:
          formatOrderDate(
            dateValue,
          ),

        time:
          item?.order_time ??
          item?.time ??
          formatOrderTime(
            dateValue,
          ),

        status:
          normalizeStatus(
            item?.status ??
              item?.order_status,
          ),

        items:
          orderItems,

        selections,

        subtotal,

        shippingCharge,

        total,
      };
    };

  /* =======================================================
   * Fetch Orders API
   * ======================================================= */

  const fetchOrders =
    async (
      isRefresh = false,
    ) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        /* -------------------------------------------------
         * Read login token
         * ------------------------------------------------- */

        const token =
          await AsyncStorage.getItem(
            'token',
          );

        console.log(
          '======================================',
        );

        console.log(
          'PREVIOUS ORDERS REQUEST',
        );

        console.log(
          'URL:',
          ORDERS_API_URL,
        );

        console.log(
          'TOKEN:',
          token,
        );

        console.log(
          '======================================',
        );

        if (!token) {
          throw new Error(
            'Authentication token not found. Please login again.',
          );
        }

        /* -------------------------------------------------
         * API
         * ------------------------------------------------- */

        const response =
          await fetch(
            ORDERS_API_URL,
            {
              method: 'GET',

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

        console.log(
          'ORDERS STATUS:',
          response.status,
        );

        const responseText =
          await response.text();

        console.log(
          '======================================',
        );

        console.log(
          'RAW ORDERS RESPONSE:',
        );

        console.log(
          responseText,
        );

        console.log(
          '======================================',
        );

        let result;

        try {
          result =
            JSON.parse(
              responseText,
            );
        } catch (jsonError) {
          console.log(
            'JSON PARSE ERROR:',
            jsonError,
          );

          throw new Error(
            'The server returned an invalid response.',
          );
        }

        console.log(
          'PARSED ORDERS:',
          JSON.stringify(
            result,
            null,
            2,
          ),
        );

        /* -------------------------------------------------
         * Unauthorized
         * ------------------------------------------------- */

        if (
          response.status ===
          401
        ) {
          /*
           * Do NOT remove token automatically.
           * User requested logout only through
           * manual logout.
           */

          throw new Error(
            result?.message ||
              'Unable to authenticate your account.',
          );
        }

        /* -------------------------------------------------
         * Server Error
         * ------------------------------------------------- */

        if (!response.ok) {
          throw new Error(
            result?.message ||
              result?.error ||
              `Unable to load orders. Status: ${response.status}`,
          );
        }

        /* -------------------------------------------------
         * Extract array from common Laravel responses
         * ------------------------------------------------- */

        let apiOrders = [];

        /*
         * [...]
         */

        if (
          Array.isArray(result)
        ) {
          apiOrders =
            result;
        }

        /*
         * {
         *   data: [...]
         * }
         */

        else if (
          Array.isArray(
            result?.data,
          )
        ) {
          apiOrders =
            result.data;
        }

        /*
         * {
         *   orders: [...]
         * }
         */

        else if (
          Array.isArray(
            result?.orders,
          )
        ) {
          apiOrders =
            result.orders;
        }

        /*
         * {
         *   data: {
         *      orders: [...]
         *   }
         * }
         */

        else if (
          Array.isArray(
            result?.data
              ?.orders,
          )
        ) {
          apiOrders =
            result.data.orders;
        }

        /*
         * Laravel pagination:
         *
         * {
         *    data: {
         *       data: [...]
         *    }
         * }
         */

        else if (
          Array.isArray(
            result?.data
              ?.data,
          )
        ) {
          apiOrders =
            result.data.data;
        }

        /*
         * {
         *    orders: {
         *       data: [...]
         *    }
         * }
         */

        else if (
          Array.isArray(
            result?.orders
              ?.data,
          )
        ) {
          apiOrders =
            result.orders.data;
        }

        /* -------------------------------------------------
         * Normalize data
         * ------------------------------------------------- */

        const finalOrders =
          apiOrders.map(
            (
              order,
              index,
            ) =>
              normalizeOrder(
                order,
                index,
              ),
          );

        console.log(
          '======================================',
        );

        console.log(
          'FINAL ORDERS:',
          finalOrders,
        );

        console.log(
          'TOTAL ORDERS:',
          finalOrders.length,
        );

        console.log(
          '======================================',
        );

        setOrders(
          finalOrders,
        );
      } catch (err) {
        console.log(
          '======================================',
        );

        console.log(
          'ORDERS API ERROR:',
        );

        console.log(err);

        console.log(
          '======================================',
        );

        setError(
          err?.message ||
            'Unable to load your previous orders.',
        );
      } finally {
        setLoading(false);

        setRefreshing(false);
      }
    };

  /* =======================================================
   * Initial Load
   * ======================================================= */

  useEffect(() => {
    fetchOrders();
  }, []);

  /* =======================================================
   * Status UI
   * ======================================================= */

  const getStatusStyle =
    status => {
      switch (status) {
        case 'Delivered':
          return {
            container:
              styles.statusDelivered,

            text:
              styles.statusDeliveredText,

            icon:
              'checkmark-circle',

            iconColor:
              '#2F7D32',
          };

        case 'Cancelled':
          return {
            container:
              styles.statusCancelled,

            text:
              styles.statusCancelledText,

            icon:
              'close-circle',

            iconColor:
              '#C84336',
          };

        case 'Processing':
          return {
            container:
              styles.statusProcessing,

            text:
              styles.statusProcessingText,

            icon:
              'time',

            iconColor:
              '#A96B11',
          };

        case 'Out for Delivery':
          return {
            container:
              styles.statusProcessing,

            text:
              styles.statusProcessingText,

            icon:
              'car-outline',

            iconColor:
              '#A96B11',
          };

        default:
          return {
            container:
              styles.statusDefault,

            text:
              styles.statusDefaultText,

            icon:
              'ellipse',

            iconColor:
              '#76665E',
          };
      }
    };

  /* =======================================================
   * View Details
   * ======================================================= */

  const handleViewDetails =
    order => {
      console.log(
        'View order:',
        order,
      );

      /*
       * Enable this after creating
       * OrderDetails screen.
       */

      // navigation.navigate(
      //   'OrderDetails',
      //   {
      //     order,
      //   },
      // );
    };

  /* =======================================================
   * Reorder
   * ======================================================= */

  const handleReorder =
    order => {
      console.log(
        'Reorder:',
        order,
      );

      navigation.navigate(
        'CustomizeTiffin',
        {
          previousOrder:
            order,
        },
      );
    };

  /* =======================================================
   * Order Card
   * ======================================================= */

  const renderOrder = ({
    item,
  }) => {
    const statusStyle =
      getStatusStyle(
        item.status,
      );

    return (
      <View
        style={
          styles.orderCard
        }>

        {/* ================================================= */}
        {/* Order Header */}
        {/* ================================================= */}

        <View
          style={
            styles.orderHeader
          }>

          <View
            style={
              styles.orderNumberContainer
            }>

            <View
              style={
                styles.orderIcon
              }>

              <Ionicons
                name="receipt-outline"
                size={20}
                color="#A00B0F"
              />

            </View>

            <View>

              <Text
                style={
                  styles.orderNumberLabel
                }>
                Order
              </Text>

              <Text
                style={
                  styles.orderNumber
                }>
                #{item.orderNumber}
              </Text>

            </View>

          </View>

          {/* Status */}

          <View
            style={[
              styles.statusBadge,

              statusStyle.container,
            ]}>

            <Ionicons
              name={
                statusStyle.icon
              }
              size={12}
              color={
                statusStyle.iconColor
              }
            />

            <Text
              style={[
                styles.statusText,

                statusStyle.text,
              ]}>
              {item.status}
            </Text>

          </View>

        </View>

        {/* ================================================= */}
        {/* Date */}
        {/* ================================================= */}

        {(item.date ||
          item.time) && (
          <View
            style={
              styles.dateRow
            }>

            {!!item.date && (
              <>
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color="#89756B"
                />

                <Text
                  style={
                    styles.dateText
                  }>
                  {item.date}
                </Text>
              </>
            )}

            {!!item.date &&
              !!item.time && (
                <View
                  style={
                    styles.dateDot
                  }
                />
              )}

            {!!item.time && (
              <>
                <Ionicons
                  name="time-outline"
                  size={13}
                  color="#89756B"
                />

                <Text
                  style={
                    styles.dateText
                  }>
                  {item.time}
                </Text>
              </>
            )}

          </View>
        )}

        <View
          style={
            styles.divider
          }
        />

        {/* ================================================= */}
        {/* Order Items */}
        {/* ================================================= */}

        <Text
          style={
            styles.smallHeading
          }>
          ORDER ITEMS
        </Text>

        {Array.isArray(
          item.items,
        ) &&
          item.items.map(
            orderItem => (
              <View
                key={
                  orderItem.id
                }
                style={
                  styles.itemRow
                }>

                <View
                  style={
                    styles.itemBullet
                  }
                />

                <Text
                  style={
                    styles.itemName
                  }>
                  {
                    orderItem.name
                  }
                </Text>

                <Text
                  style={
                    styles.itemQuantity
                  }>
                  ×
                  {
                    orderItem.quantity
                  }
                </Text>

              </View>
            ),
          )}

        {/* ================================================= */}
        {/* Selection Chips */}
        {/* ================================================= */}

        {Array.isArray(
          item.selections,
        ) &&
          item.selections.length >
            0 && (
            <View
              style={
                styles.selectionContainer
              }>

              {item.selections.map(
                (
                  selection,
                  index,
                ) => (
                  <View
                    key={`${item.id}-${index}`}
                    style={
                      styles.selectionChip
                    }>

                    <Text
                      style={
                        styles.selectionChipText
                      }>
                      {String(
                        selection,
                      )}
                    </Text>

                  </View>
                ),
              )}

            </View>
          )}

        <View
          style={
            styles.divider
          }
        />

        {/* ================================================= */}
        {/* Pricing */}
        {/* ================================================= */}

        <View
          style={
            styles.priceRow
          }>

          <Text
            style={
              styles.priceLabel
            }>
            Food Subtotal
          </Text>

          <Text
            style={
              styles.priceValue
            }>
            {formatPrice(
              item.subtotal,
            )}
          </Text>

        </View>

        <View
          style={
            styles.priceRow
          }>

          <View
            style={
              styles.shippingLabelContainer
            }>

            <Ionicons
              name="car-outline"
              size={13}
              color="#76635A"
            />

            <Text
              style={
                styles.priceLabel
              }>
              Shipping
            </Text>

          </View>

          <Text
            style={[
              styles.priceValue,

              Number(
                item.shippingCharge,
              ) === 0 &&
                styles.freeShipping,
            ]}>

            {Number(
              item.shippingCharge,
            ) === 0
              ? 'FREE'
              : formatPrice(
                  item.shippingCharge,
                )}

          </Text>

        </View>

        <View
          style={
            styles.totalDivider
          }
        />

        <View
          style={
            styles.totalRow
          }>

          <Text
            style={
              styles.totalLabel
            }>
            Total Paid
          </Text>

          <Text
            style={
              styles.totalValue
            }>
            {formatPrice(
              item.total,
            )}
          </Text>

        </View>

        {/* ================================================= */}
        {/* Action Buttons */}
        {/* ================================================= */}

        <View
          style={
            styles.actionContainer
          }>

          <TouchableOpacity
            activeOpacity={
              0.8
            }
            style={
              styles.detailsButton
            }
            onPress={() =>
              handleViewDetails(
                item,
              )
            }>

            <Ionicons
              name="eye-outline"
              size={16}
              color="#A00B0F"
            />

            <Text
              style={
                styles.detailsButtonText
              }>
              View Details
            </Text>

          </TouchableOpacity>

          {item.status !==
            'Cancelled' && (
            <TouchableOpacity
              activeOpacity={
                0.85
              }
              style={
                styles.reorderButton
              }
              onPress={() =>
                handleReorder(
                  item,
                )
              }>

              <Ionicons
                name="repeat-outline"
                size={16}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.reorderButtonText
                }>
                Reorder
              </Text>

            </TouchableOpacity>
          )}

        </View>

      </View>
    );
  };

  /* =======================================================
   * Empty / Error State
   * ======================================================= */

  const renderEmptyState =
    () => {
      if (loading) {
        return null;
      }

      return (
        <View
          style={
            styles.emptyContainer
          }>

          <View
            style={
              styles.emptyIconContainer
            }>

            <Ionicons
              name={
                error
                  ? 'alert-circle-outline'
                  : 'receipt-outline'
              }
              size={42}
              color="#A00B0F"
            />

          </View>

          <Text
            style={
              styles.emptyTitle
            }>

            {error
              ? 'Unable to Load Orders'
              : 'No Previous Orders'}

          </Text>

          <Text
            style={
              styles.emptyDescription
            }>

            {error
              ? error
              : 'Your previous tiffin orders will appear here once you place an order.'}

          </Text>

          {error ? (
            <TouchableOpacity
              activeOpacity={
                0.85
              }
              style={
                styles.orderNowButton
              }
              onPress={() =>
                fetchOrders()
              }>

              <Text
                style={
                  styles.orderNowButtonText
                }>
                Try Again
              </Text>

            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={
                0.85
              }
              style={
                styles.orderNowButton
              }
              onPress={() =>
                navigation.navigate(
                  'MainTabs',
                )
              }>

              <Text
                style={
                  styles.orderNowButtonText
                }>
                Order a Tiffin
              </Text>

            </TouchableOpacity>
          )}

        </View>
      );
    };

  /* =======================================================
   * Initial Loading
   * ======================================================= */

  if (
    loading &&
    orders.length === 0
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }>

        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FFFDFB"
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
              styles.loadingText
            }>
            Loading your orders...
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
        styles.safeArea
      }>

      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFDFB"
      />

      <View
        style={[
          styles.screenContainer,

          {
            width:
              responsive.contentWidth,
          },
        ]}>

        {/* ================================================= */}
        {/* Header */}
        {/* ================================================= */}

        <View
          style={[
            styles.header,

            {
              paddingHorizontal:
                responsive.horizontalPadding,
            },
          ]}>

          <Pressable
            hitSlop={12}
            style={
              styles.headerIconButton
            }
            onPress={() => {
              if (
                navigation.canGoBack()
              ) {
                navigation.goBack();
              } else {
                navigation.replace(
                  'MainTabs',
                );
              }
            }}>

            <Image
              source={require('../assets/login-icons/back.png')}
              style={
                styles.headerImage
              }
              resizeMode="contain"
            />

          </Pressable>

          <View
            style={
              styles.headerTitleContainer
            }>

            <Text
              style={
                styles.headerTitle
              }>
              Previous Orders
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }>
              Your order history
            </Text>

          </View>

          <Pressable
            hitSlop={12}
            style={
              styles.headerIconButton
            }
            onPress={() =>
              navigation.navigate?.(
                'Notification',
              )
            }>

            <Image
              source={require('../assets/login-icons/notification.png')}
              style={
                styles.headerImage
              }
              resizeMode="contain"
            />

            <View
              style={
                styles.notificationDot
              }
            />

          </Pressable>

        </View>

        {/* ================================================= */}
        {/* Orders List */}
        {/* ================================================= */}

        <FlatList
          data={
            orders
          }

          keyExtractor={(
            item,
            index,
          ) =>
            item?.id
              ? String(
                  item.id,
                )
              : String(index)
          }

          renderItem={
            renderOrder
          }

          showsVerticalScrollIndicator={
            false
          }

          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={() =>
                fetchOrders(
                  true,
                )
              }
              tintColor="#A00B0F"
              colors={[
                '#A00B0F',
              ]}
            />
          }

          contentContainerStyle={[
            styles.listContent,

            {
              paddingHorizontal:
                responsive.horizontalPadding,
            },

            orders.length ===
              0 &&
              styles.emptyListContent,
          ]}

          ListHeaderComponent={
            orders.length >
            0 ? (
              <View
                style={
                  styles.pageIntro
                }>

                <Text
                  style={
                    styles.pageIntroTitle
                  }>
                  Your Orders
                </Text>

                <Text
                  style={
                    styles.pageIntroDescription
                  }>
                  Review previous
                  orders or quickly
                  reorder your
                  favourite tiffin.
                </Text>

                <View
                  style={
                    styles.orderCountBadge
                  }>

                  <Ionicons
                    name="receipt-outline"
                    size={14}
                    color="#A00B0F"
                  />

                  <Text
                    style={
                      styles.orderCountText
                    }>

                    {orders.length}{' '}

                    {orders.length ===
                    1
                      ? 'previous order'
                      : 'previous orders'}

                  </Text>

                </View>

              </View>
            ) : null
          }

          ListEmptyComponent={
            renderEmptyState
          }
        />

      </View>

    </SafeAreaView>
  );
};

export default PreviousOrders;

/* =========================================================
 * Styles
 * ========================================================= */

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,

      backgroundColor:
        '#F6F2EE',
    },

    screenContainer: {
      flex: 1,

      alignSelf:
        'center',

      backgroundColor:
        '#FFFDFB',
    },

    /* =====================================================
     * Loading
     * ===================================================== */

    loadingContainer: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal: 30,
    },

    loadingText: {
      color:
        '#806C62',

      fontSize: 11,

      fontWeight:
        '600',

      marginTop: 12,
    },

    /* =====================================================
     * Header
     * ===================================================== */

    header: {
      minHeight: 66,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      backgroundColor:
        '#FFFDFB',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#EEE8E3',
    },

    headerIconButton: {
      width: 38,

      height: 38,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF8F2',

      borderRadius: 19,
    },

    headerImage: {
      width: 20,

      height: 20,

      resizeMode:
        'contain',
    },

    notificationDot: {
      position:
        'absolute',

      top: 8,

      right: 8,

      width: 5,

      height: 5,

      backgroundColor:
        '#E14F29',

      borderRadius: 3,
    },

    headerTitleContainer: {
      flex: 1,

      alignItems:
        'center',

      paddingHorizontal:
        12,
    },

    headerTitle: {
      color:
        '#A00B0F',

      fontSize: 18,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    headerSubtitle: {
      color:
        '#8A746A',

      fontSize: 9,

      fontWeight:
        '600',

      marginTop: 2,
    },

    /* =====================================================
     * List
     * ===================================================== */

    listContent: {
      paddingTop: 18,

      paddingBottom:
        35,
    },

    emptyListContent: {
      flexGrow: 1,
    },

    /* =====================================================
     * Intro
     * ===================================================== */

    pageIntro: {
      marginBottom: 18,
    },

    pageIntroTitle: {
      color:
        '#211713',

      fontSize: 21,

      fontWeight:
        '900',
    },

    pageIntroDescription: {
      color:
        '#806C62',

      fontSize: 11,

      lineHeight: 17,

      marginTop: 5,

      maxWidth: 520,
    },

    orderCountBadge: {
      alignSelf:
        'flex-start',

      flexDirection:
        'row',

      alignItems:
        'center',

      backgroundColor:
        '#FFF3EA',

      borderRadius: 20,

      paddingHorizontal:
        10,

      paddingVertical: 6,

      marginTop: 10,
    },

    orderCountText: {
      color:
        '#A00B0F',

      fontSize: 9,

      fontWeight:
        '800',

      marginLeft: 5,
    },

    /* =====================================================
     * Order Card
     * ===================================================== */

    orderCard: {
      width: '100%',

      backgroundColor:
        '#FFFFFF',

      borderWidth: 1,

      borderColor:
        '#EFE7E2',

      borderRadius: 18,

      padding: 14,

      marginBottom: 14,

      shadowColor:
        '#5B3A2A',

      shadowOffset: {
        width: 0,

        height: 3,
      },

      shadowOpacity:
        0.055,

      shadowRadius: 8,

      elevation: 2,
    },

    /* =====================================================
     * Order Header
     * ===================================================== */

    orderHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    orderNumberContainer: {
      flex: 1,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingRight: 10,
    },

    orderIcon: {
      width: 42,

      height: 42,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF3E8',

      borderRadius: 12,

      marginRight: 10,
    },

    orderNumberLabel: {
      color:
        '#97857B',

      fontSize: 8,

      fontWeight:
        '700',

      textTransform:
        'uppercase',
    },

    orderNumber: {
      color:
        '#241A15',

      fontSize: 13,

      fontWeight:
        '900',

      marginTop: 2,
    },

    /* =====================================================
     * Status
     * ===================================================== */

    statusBadge: {
      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius: 20,

      paddingHorizontal:
        9,

      paddingVertical: 6,
    },

    statusText: {
      fontSize: 8,

      fontWeight:
        '800',

      marginLeft: 4,
    },

    statusDelivered: {
      backgroundColor:
        '#EDF7EE',
    },

    statusDeliveredText: {
      color:
        '#2F7D32',
    },

    statusCancelled: {
      backgroundColor:
        '#FFF0ED',
    },

    statusCancelledText: {
      color:
        '#C84336',
    },

    statusProcessing: {
      backgroundColor:
        '#FFF7E8',
    },

    statusProcessingText: {
      color:
        '#A96B11',
    },

    statusDefault: {
      backgroundColor:
        '#F3EFEC',
    },

    statusDefaultText: {
      color:
        '#76665E',
    },

    /* =====================================================
     * Date
     * ===================================================== */

    dateRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      marginTop: 11,
    },

    dateText: {
      color:
        '#89756B',

      fontSize: 8.5,

      fontWeight:
        '600',

      marginLeft: 4,
    },

    dateDot: {
      width: 3,

      height: 3,

      borderRadius: 2,

      backgroundColor:
        '#C7BAB3',

      marginHorizontal:
        8,
    },

    /* =====================================================
     * Divider
     * ===================================================== */

    divider: {
      height: 1,

      backgroundColor:
        '#EFE8E3',

      marginVertical:
        12,
    },

    totalDivider: {
      height: 1,

      backgroundColor:
        '#E5D9D2',

      marginVertical:
        9,
    },

    /* =====================================================
     * Items
     * ===================================================== */

    smallHeading: {
      color:
        '#A00B0F',

      fontSize: 8,

      fontWeight:
        '900',

      letterSpacing:
        0.5,

      marginBottom: 7,
    },

    itemRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      marginBottom: 5,
    },

    itemBullet: {
      width: 5,

      height: 5,

      borderRadius:
        3,

      backgroundColor:
        '#A00B0F',

      marginRight: 7,
    },

    itemName: {
      flex: 1,

      color:
        '#352821',

      fontSize: 10,

      fontWeight:
        '700',
    },

    itemQuantity: {
      color:
        '#8D796E',

      fontSize: 9,

      fontWeight:
        '700',
    },

    /* =====================================================
     * Selections
     * ===================================================== */

    selectionContainer: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      marginTop: 7,
    },

    selectionChip: {
      backgroundColor:
        '#FAF4F0',

      borderWidth: 1,

      borderColor:
        '#EEE1D9',

      borderRadius: 12,

      paddingHorizontal:
        8,

      paddingVertical: 5,

      marginRight: 5,

      marginBottom: 5,
    },

    selectionChipText: {
      color:
        '#725D52',

      fontSize: 7.5,

      fontWeight:
        '600',
    },

    /* =====================================================
     * Pricing
     * ===================================================== */

    priceRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom: 7,
    },

    priceLabel: {
      color:
        '#76635A',

      fontSize: 9,

      fontWeight:
        '600',
    },

    priceValue: {
      color:
        '#2B211C',

      fontSize: 9,

      fontWeight:
        '800',
    },

    shippingLabelContainer: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 5,
    },

    freeShipping: {
      color:
        '#2F7D32',

      fontWeight:
        '900',
    },

    totalRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    totalLabel: {
      color:
        '#2A1E18',

      fontSize: 11,

      fontWeight:
        '900',
    },

    totalValue: {
      color:
        '#A00B0F',

      fontSize: 16,

      fontWeight:
        '900',
    },

    /* =====================================================
     * Buttons
     * ===================================================== */

    actionContainer: {
      flexDirection:
        'row',

      marginTop: 14,

      gap: 9,
    },

    detailsButton: {
      flex: 1,

      minHeight: 44,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF9F5',

      borderWidth: 1,

      borderColor:
        '#E8CBC0',

      borderRadius: 12,
    },

    detailsButtonText: {
      color:
        '#A00B0F',

      fontSize: 10,

      fontWeight:
        '800',

      marginLeft: 6,
    },

    reorderButton: {
      flex: 1,

      minHeight: 44,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#A00B0F',

      borderRadius: 12,

      shadowColor:
        '#A00B0F',

      shadowOffset: {
        width: 0,

        height: 4,
      },

      shadowOpacity:
        0.17,

      shadowRadius: 6,

      elevation: 3,
    },

    reorderButtonText: {
      color:
        '#FFFFFF',

      fontSize: 10,

      fontWeight:
        '800',

      marginLeft: 6,
    },

    /* =====================================================
     * Empty
     * ===================================================== */

    emptyContainer: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        30,

      paddingBottom:
        70,
    },

    emptyIconContainer: {
      width: 86,

      height: 86,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF3EA',

      borderRadius: 43,

      marginBottom: 16,
    },

    emptyTitle: {
      color:
        '#211713',

      fontSize: 18,

      fontWeight:
        '900',

      textAlign:
        'center',
    },

    emptyDescription: {
      maxWidth: 320,

      color:
        '#826F65',

      fontSize: 10,

      lineHeight: 16,

      textAlign:
        'center',

      marginTop: 7,
    },

    orderNowButton: {
      minWidth: 160,

      minHeight: 46,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#A00B0F',

      borderRadius: 12,

      paddingHorizontal:
        22,

      marginTop: 18,
    },

    orderNowButtonText: {
      color:
        '#FFFFFF',

      fontSize: 11,

      fontWeight:
        '800',
    },
  });