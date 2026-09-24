import React, { useCallback, useMemo, useState } from 'react';

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

import { SafeAreaView } from 'react-native-safe-area-context';

import { useFocusEffect } from '@react-navigation/native';

import Ionicons from 'react-native-vector-icons/Ionicons';

import AsyncStorage from '@react-native-async-storage/async-storage';

/* =========================================================
 * API
 * ========================================================= */

const ORDERS_API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/orders';

/* =========================================================
 * HELPERS
 * ========================================================= */

const toSafeNumber = value => {
  const number = Number(String(value ?? 0).replace(/[^0-9.-]/g, ''));

  return Number.isFinite(number) ? number : 0;
};

const formatPrice = value => `$${toSafeNumber(value).toFixed(2)}`;

/* =========================================================
 * DATE
 * ========================================================= */

const formatOrderDate = value => {
  if (!value) {
    return '';
  }

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (error) {
    return String(value);
  }
};

const formatOrderTime = value => {
  if (!value) {
    return '';
  }

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    return '';
  }
};

/* =========================================================
 * STATUS
 * ========================================================= */

const normalizeStatus = value => {
  if (!value) {
    return 'Processing';
  }

  const status = String(value).trim().toLowerCase();

  if (status === 'delivered' || status === 'completed') {
    return 'Delivered';
  }

  if (status === 'cancelled' || status === 'canceled') {
    return 'Cancelled';
  }

  if (
    status === 'processing' ||
    status === 'pending' ||
    status === 'confirmed' ||
    status === 'preparing'
  ) {
    return 'Processing';
  }

  if (status === 'out_for_delivery' || status === 'out for delivery') {
    return 'Out for Delivery';
  }

  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
};

/* =========================================================
 * CUSTOM TIFFIN CHECK
 * ========================================================= */

const isCustomOrderItem = item => {
  if (!item) {
    return false;
  }

  if (
    item?.is_custom === true ||
    item?.is_custom === 1 ||
    item?.is_custom === '1' ||
    item?.is_custom_box === true ||
    item?.is_custom_box === 1 ||
    item?.is_custom_box === '1' ||
    item?.is_custom_tiffin === true ||
    item?.custom_tiffin === true ||
    item?.type === 'custom_tiffin' ||
    item?.order_item_type === 'custom_tiffin'
  ) {
    return true;
  }

  const possibleCustomItems = [
    item?.custom_items,
    item?.custom_box_items,
    item?.customItems,
    item?.customBoxItems,
  ];

  return possibleCustomItems.some(
    value => Array.isArray(value) && value.length > 0,
  );
};

/* =========================================================
 * GET CUSTOM ITEMS
 * ========================================================= */

const getCustomItems = item => {
  const candidates = [
    item?.custom_items,

    item?.custom_box_items,

    item?.customItems,

    item?.customBoxItems,

    item?.selected_items,

    item?.selectedItems,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate;
    }
  }

  return [];
};

/* =========================================================
 * NORMALIZE CUSTOM DISH
 * ========================================================= */

const normalizeCustomDish = (dish, index) => {
  if (!dish) {
    return null;
  }

  const nested = dish?.item ?? dish?.addon ?? dish?.adon ?? dish?.product ?? {};

  const quantity = Math.max(1, Number(dish?.quantity ?? dish?.qty ?? 1) || 1);

  const price = toSafeNumber(
    dish?.price ?? dish?.unit_price ?? dish?.rawPrice ?? nested?.price ?? 0,
  );

  let total = toSafeNumber(
    dish?.total ?? dish?.subtotal ?? dish?.line_total ?? dish?.total_price ?? 0,
  );

  if (total <= 0) {
    total = price * quantity;
  }

  const name =
    dish?.name ??
    dish?.item_name ??
    dish?.adon_name ??
    dish?.addon_name ??
    nested?.name ??
    `Item ${index + 1}`;

  return {
    id: String(
      dish?.item_id ??
        dish?.itemId ??
        dish?.id ??
        nested?.id ??
        `custom-${index}`,
    ),

    item_id: dish?.item_id ?? dish?.itemId ?? nested?.id ?? dish?.id ?? null,

    name,

    quantity,

    price: Number(price.toFixed(2)),

    total: Number(total.toFixed(2)),
  };
};

/* =========================================================
 * NORMALIZE ORDER ITEM
 * ========================================================= */

const normalizeOrderItem = (orderItem, itemIndex, parentOrder) => {
  const custom = isCustomOrderItem(orderItem);

  const customItems = custom
    ? getCustomItems(orderItem).map(normalizeCustomDish).filter(Boolean)
    : [];

  const quantity = Math.max(
    1,
    Number(orderItem?.quantity ?? orderItem?.qty ?? 1) || 1,
  );

  const unitPrice = toSafeNumber(
    orderItem?.unit_price ?? orderItem?.price ?? orderItem?.base_price ?? 0,
  );

  let total = toSafeNumber(
    orderItem?.total ?? orderItem?.line_total ?? orderItem?.total_price ?? 0,
  );

  /*
   * Custom orders often have:
   *
   * parent price = 0
   * custom_items contain actual prices
   */

  if (custom && total <= 0) {
    const selectedTotal = customItems.reduce(
      (sum, selectedItem) => sum + selectedItem.total,
      0,
    );

    total = selectedTotal * quantity;
  }

  if (!custom && total <= 0) {
    total = unitPrice * quantity;
  }

  return {
    ...orderItem,

    id: String(
      orderItem?.id ??
        orderItem?.tiffin_id ??
        `${parentOrder?.id ?? 'order'}-${itemIndex}`,
    ),

    name:
      orderItem?.name ??
      orderItem?.tiffin_name ??
      orderItem?.product_name ??
      orderItem?.tiffin?.name ??
      orderItem?.product?.name ??
      (custom ? 'Custom Tiffin' : 'Tiffin'),

    quantity,

    unitPrice,

    total: Number(total.toFixed(2)),

    isCustom: custom,

    customItems,
  };
};

/* =========================================================
 * NORMALIZE ORDER
 * ========================================================= */

const normalizeOrder = (item, index) => {
  /* =====================================================
   * ORDER ITEMS
   * ===================================================== */

  const rawItems =
    item?.items ?? item?.order_items ?? item?.orderItems ?? item?.details ?? [];

  let orderItems = [];

  if (Array.isArray(rawItems)) {
    orderItems = rawItems
      .map((orderItem, itemIndex) =>
        normalizeOrderItem(orderItem, itemIndex, item),
      )
      .filter(Boolean);
  }

  /* =====================================================
   * DIRECT TIFFIN FALLBACK
   * ===================================================== */

  if (orderItems.length === 0 && item?.tiffin) {
    const directItem = {
      ...item,

      ...item.tiffin,

      id: item?.tiffin?.id ?? item?.id ?? index,

      tiffin_id: item?.tiffin?.id ?? item?.tiffin_id,

      name: item?.tiffin?.name ?? item?.tiffin_name ?? item?.name ?? 'Tiffin',

      quantity: item?.quantity ?? 1,

      custom_items:
        item?.custom_items ??
        item?.custom_box_items ??
        item?.selected_items ??
        [],

      is_custom: item?.is_custom,

      is_custom_box: item?.is_custom_box,

      type: item?.type,
    };

    orderItems = [normalizeOrderItem(directItem, 0, item)];
  }

  /* =====================================================
   * CUSTOM ITEMS AT ORDER LEVEL
   * ===================================================== */

  if (orderItems.length === 0) {
    const orderLevelCustomItems = getCustomItems(item);

    if (orderLevelCustomItems.length > 0) {
      orderItems = [
        normalizeOrderItem(
          {
            ...item,

            id: item?.tiffin_id ?? item?.id ?? index,

            tiffin_id: item?.tiffin_id ?? item?.tiffin?.id,

            name:
              item?.tiffin_name ??
              item?.tiffin?.name ??
              item?.name ??
              'Custom Tiffin',

            type: 'custom_tiffin',

            is_custom: true,

            custom_items: orderLevelCustomItems,
          },
          0,
          item,
        ),
      ];
    }
  }

  /* =====================================================
   * FINAL FALLBACK
   * ===================================================== */

  if (orderItems.length === 0) {
    orderItems = [
      {
        id: `${item?.id ?? index}-default`,

        name: item?.tiffin_name ?? item?.name ?? 'Tiffin Order',

        quantity: Math.max(1, Number(item?.quantity ?? 1) || 1),

        unitPrice: toSafeNumber(item?.price ?? item?.unit_price ?? 0),

        total: toSafeNumber(
          item?.subtotal ?? item?.total_amount ?? item?.grand_total ?? 0,
        ),

        isCustom: false,

        customItems: [],
      },
    ];
  }

  /* =====================================================
   * NORMAL SELECTIONS
   *
   * Do not use selected_items here because custom orders
   * use selected_items for custom dishes.
   * ===================================================== */

  const rawSelections =
    item?.selections ??
    item?.customizations ??
    item?.customization ??
    item?.options ??
    [];

  let selections = [];

  if (Array.isArray(rawSelections)) {
    selections = rawSelections
      .map(selection => {
        if (typeof selection === 'string') {
          return selection;
        }

        if (typeof selection === 'number') {
          return String(selection);
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

  /* =====================================================
   * PRICES
   * ===================================================== */

  let subtotal = toSafeNumber(
    item?.subtotal ??
      item?.sub_total ??
      item?.food_subtotal ??
      item?.amount ??
      0,
  );

  if (subtotal <= 0) {
    subtotal = orderItems.reduce(
      (total, orderItem) => total + toSafeNumber(orderItem.total),
      0,
    );
  }

  const shippingCharge = toSafeNumber(
    item?.shipping_charge ??
      item?.shippingCharge ??
      item?.delivery_charge ??
      item?.delivery_fee ??
      item?.shipping ??
      0,
  );

  let total = toSafeNumber(
    item?.total ??
      item?.total_amount ??
      item?.grand_total ??
      item?.final_total ??
      0,
  );

  if (total <= 0) {
    total = subtotal + shippingCharge;
  }

  /* =====================================================
   * DATE
   * ===================================================== */

  const dateValue = item?.created_at ?? item?.order_date ?? item?.date ?? null;

  return {
    ...item,

    id: String(item?.id ?? item?.order_id ?? index),

    orderNumber:
      item?.order_number ??
      item?.order_no ??
      item?.order_id ??
      item?.invoice_number ??
      item?.id ??
      index + 1,

    date: formatOrderDate(dateValue),

    time: item?.order_time ?? item?.time ?? formatOrderTime(dateValue),

    status: normalizeStatus(item?.status ?? item?.order_status),

    items: orderItems,

    selections,

    subtotal: Number(subtotal.toFixed(2)),

    shippingCharge: Number(shippingCharge.toFixed(2)),

    total: Number(total.toFixed(2)),

    hasCustomTiffin: orderItems.some(orderItem => orderItem.isCustom),
  };
};

/* =========================================================
 * COMPONENT
 * ========================================================= */

const PreviousOrders = ({ navigation }) => {
  const { width } = useWindowDimensions();

  /* =======================================================
   * STATE
   * ======================================================= */

  const [orders, setOrders] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState(null);

  /* =======================================================
   * RESPONSIVE
   * ======================================================= */

  const responsive = useMemo(() => {
    const isTablet = width >= 768;

    return {
      isTablet,

      contentWidth: isTablet ? Math.min(width - 80, 720) : width,

      horizontalPadding: isTablet ? 28 : 16,
    };
  }, [width]);

  /* =======================================================
   * FETCH ORDERS
   * ======================================================= */

  const fetchOrders = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const token = await AsyncStorage.getItem('token');

      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }

      console.log('======================================');

      console.log('PREVIOUS ORDERS REQUEST');

      console.log('URL:', ORDERS_API_URL);

      console.log('======================================');

      const response = await fetch(`${ORDERS_API_URL}?_=${Date.now()}`, {
        method: 'GET',

        headers: {
          Accept: 'application/json',

          'Content-Type': 'application/json',

          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();

      console.log('ORDERS STATUS:', response.status);

      console.log('RAW ORDERS RESPONSE:', responseText);

      let result = {};

      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch (jsonError) {
        console.log('JSON PARSE ERROR:', jsonError);

        throw new Error('The server returned an invalid response.');
      }

      if (response.status === 401) {
        throw new Error(
          result?.message ?? 'Unable to authenticate your account.',
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.message ??
            result?.error ??
            `Unable to load orders. Status: ${response.status}`,
        );
      }

      /* =============================================
       * EXTRACT ARRAY
       * ============================================= */

      let apiOrders = [];

      if (Array.isArray(result)) {
        apiOrders = result;
      } else if (Array.isArray(result?.data)) {
        apiOrders = result.data;
      } else if (Array.isArray(result?.orders)) {
        apiOrders = result.orders;
      } else if (Array.isArray(result?.data?.orders)) {
        apiOrders = result.data.orders;
      } else if (Array.isArray(result?.data?.data)) {
        apiOrders = result.data.data;
      } else if (Array.isArray(result?.orders?.data)) {
        apiOrders = result.orders.data;
      }

      const finalOrders = apiOrders.map((order, index) =>
        normalizeOrder(order, index),
      );

      console.log('======================================');

      console.log('NORMALIZED ORDERS:', JSON.stringify(finalOrders, null, 2));

      console.log('TOTAL ORDERS:', finalOrders.length);

      console.log('======================================');

      setOrders(finalOrders);
    } catch (err) {
      console.log('PREVIOUS ORDERS ERROR:', err);

      setError(err?.message ?? 'Unable to load your previous orders.');
    } finally {
      setLoading(false);

      setRefreshing(false);
    }
  }, []);

  /* =======================================================
   * REFRESH PAGE WHEN OPENED
   * ======================================================= */

  useFocusEffect(
    useCallback(() => {
      fetchOrders();

      return () => {};
    }, [fetchOrders]),
  );

  /* =======================================================
   * STATUS UI
   * ======================================================= */

  const getStatusStyle = status => {
    switch (status) {
      case 'Delivered':
        return {
          container: styles.statusDelivered,

          text: styles.statusDeliveredText,

          icon: 'checkmark-circle',

          iconColor: '#2F7D32',
        };

      case 'Cancelled':
        return {
          container: styles.statusCancelled,

          text: styles.statusCancelledText,

          icon: 'close-circle',

          iconColor: '#A00B0F',
        };

      case 'Out for Delivery':
        return {
          container: styles.statusProcessing,

          text: styles.statusProcessingText,

          icon: 'car-outline',

          iconColor: '#A96B11',
        };

      case 'Processing':
        return {
          container: styles.statusProcessing,

          text: styles.statusProcessingText,

          icon: 'time-outline',

          iconColor: '#A96B11',
        };

      default:
        return {
          container: styles.statusDefault,

          text: styles.statusDefaultText,

          icon: 'ellipse',

          iconColor: '#76665E',
        };
    }
  };

  /* =======================================================
   * CUSTOM DISH ROW
   * ======================================================= */

  const renderCustomDish = (customItem, customIndex) => {
    return (
      <View
        key={`${customItem.id}-${customIndex}`}
        style={styles.customDishRow}
      >
        <View style={styles.customDishBullet} />

        <View style={styles.customDishInfo}>
          <Text style={styles.customDishName}>{customItem.name}</Text>

          <Text style={styles.customDishUnitPrice}>
            {formatPrice(customItem.price)} each
          </Text>
        </View>

        <Text style={styles.customDishQty}>×{customItem.quantity}</Text>

        <Text style={styles.customDishPrice}>
          {formatPrice(customItem.total)}
        </Text>
      </View>
    );
  };

  /* =======================================================
   * ORDER CARD
   * ======================================================= */

  const renderOrder = ({ item }) => {
    const statusStyle = getStatusStyle(item.status);

    return (
      <View style={styles.orderCard}>
        {/* =============================================
              HEADER
          ============================================= */}

        <View style={styles.orderHeader}>
          <View style={styles.orderNumberContainer}>
            <View style={styles.orderIcon}>
              <Ionicons name="receipt-outline" size={20} color="#A00B0F" />
            </View>

            <View>
              <Text style={styles.orderNumberLabel}>Order</Text>

              <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
            </View>
          </View>

          <View style={[styles.statusBadge, statusStyle.container]}>
            <Ionicons
              name={statusStyle.icon}
              size={12}
              color={statusStyle.iconColor}
            />

            <Text style={[styles.statusText, statusStyle.text]}>
              {item.status}
            </Text>
          </View>
        </View>

        {/* =============================================
              DATE
          ============================================= */}

        {(item.date || item.time) && (
          <View style={styles.dateRow}>
            {!!item.date && (
              <>
                <Ionicons name="calendar-outline" size={13} color="#89756B" />

                <Text style={styles.dateText}>{item.date}</Text>
              </>
            )}

            {!!item.date && !!item.time && <View style={styles.dateDot} />}

            {!!item.time && (
              <>
                <Ionicons name="time-outline" size={13} color="#89756B" />

                <Text style={styles.dateText}>{item.time}</Text>
              </>
            )}
          </View>
        )}

        <View style={styles.divider} />

        {/* =============================================
              ORDER ITEMS
          ============================================= */}

        <Text style={styles.smallHeading}>ORDER ITEMS</Text>

        {Array.isArray(item.items) &&
          item.items.map((orderItem, orderItemIndex) => (
            <View
              key={`${orderItem.id}-${orderItemIndex}`}
              style={styles.orderItemContainer}
            >
              <View style={styles.itemRow}>
                <View style={styles.itemBullet} />

                <View style={styles.itemNameContainer}>
                  <View style={styles.itemNameRow}>
                    <Text style={styles.itemName}>{orderItem.name}</Text>

                    {orderItem.isCustom && (
                      <View style={styles.customBadge}>
                        <Text style={styles.customBadgeText}>CUSTOM BUILT</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={styles.itemQuantity}>×{orderItem.quantity}</Text>
              </View>

              {/* =====================================
                      CUSTOM TIFFIN SELECTED ITEMS
                  ===================================== */}

              {orderItem.isCustom &&
                Array.isArray(orderItem.customItems) &&
                orderItem.customItems.length > 0 && (
                  <View style={styles.customItemsBox}>
                    <Text style={styles.customItemsHeading}>
                      ITEMS IN YOUR CUSTOM TIFFIN
                    </Text>

                    {orderItem.customItems.map(renderCustomDish)}
                  </View>
                )}
            </View>
          ))}

        {/* =============================================
              NORMAL CUSTOMIZATION CHIPS
          ============================================= */}

        {Array.isArray(item.selections) && item.selections.length > 0 && (
          <View style={styles.selectionContainer}>
            {item.selections.map((selection, index) => (
              <View
                key={`${item.id}-selection-${index}`}
                style={styles.selectionChip}
              >
                <Text style={styles.selectionChipText}>
                  {String(selection)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        {/* =============================================
              PRICING
          ============================================= */}

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Food Subtotal</Text>

          <Text style={styles.priceValue}>{formatPrice(item.subtotal)}</Text>
        </View>

        <View style={styles.priceRow}>
          <View style={styles.shippingLabelContainer}>
            <Ionicons name="car-outline" size={13} color="#76635A" />

            <Text style={styles.priceLabel}>Shipping</Text>
          </View>

          <Text
            style={[
              styles.priceValue,

              Number(item.shippingCharge) === 0 && styles.freeShipping,
            ]}
          >
            {Number(item.shippingCharge) === 0
              ? 'FREE'
              : formatPrice(item.shippingCharge)}
          </Text>
        </View>

        <View style={styles.totalDivider} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Paid</Text>

          <Text style={styles.totalValue}>{formatPrice(item.total)}</Text>
        </View>
      </View>
    );
  };

  /* =======================================================
   * EMPTY STATE
   * ======================================================= */

  const renderEmptyState = () => {
    if (loading) {
      return null;
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons
            name={error ? 'alert-circle-outline' : 'receipt-outline'}
            size={42}
            color="#A00B0F"
          />
        </View>

        <Text style={styles.emptyTitle}>
          {error ? 'Unable to Load Orders' : 'No Previous Orders'}
        </Text>

        <Text style={styles.emptyDescription}>
          {error
            ? error
            : 'Your previous tiffin orders will appear here once you place an order.'}
        </Text>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.orderNowButton}
          onPress={() =>
            error ? fetchOrders() : navigation.navigate('MainTabs')
          }
        >
          <Text style={styles.orderNowButtonText}>
            {error ? 'Try Again' : 'Order a Tiffin'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  /* =======================================================
   * LOADING
   * ======================================================= */

  if (loading && orders.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFDFB" />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A00B0F" />

          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* =======================================================
   * UI
   * ======================================================= */

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFDFB" />

      <View
        style={[
          styles.screenContainer,

          {
            width: responsive.contentWidth,
          },
        ]}
      >
        {/* =============================================
            HEADER
        ============================================= */}

        <View
          style={[
            styles.header,

            {
              paddingHorizontal: responsive.horizontalPadding,
            },
          ]}
        >
          <Pressable
            hitSlop={12}
            style={styles.headerIconButton}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.replace('MainTabs');
              }
            }}
          >
            <Image
              source={require('../assets/login-icons/back.png')}
              style={styles.headerImage}
              resizeMode="contain"
            />
          </Pressable>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Previous Orders</Text>

            <Text style={styles.headerSubtitle}>Your order history</Text>
          </View>

          <View style={styles.headerIconPlaceholder} />
        </View>

        {/* =============================================
            ORDERS
        ============================================= */}

        <FlatList
          data={orders}
          keyExtractor={(item, index) =>
            item?.id ? String(item.id) : String(index)
          }
          renderItem={renderOrder}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOrders(true)}
              tintColor="#A00B0F"
              colors={['#A00B0F']}
            />
          }
          contentContainerStyle={[
            styles.listContent,

            {
              paddingHorizontal: responsive.horizontalPadding,
            },

            orders.length === 0 && styles.emptyListContent,
          ]}
          ListHeaderComponent={
            orders.length > 0 ? (
              <View style={styles.pageIntro}>
                <Text style={styles.pageIntroTitle}>Your Orders</Text>

                <Text style={styles.pageIntroDescription}>
                  Review your previous fixed and customised tiffin orders.
                </Text>

                <View style={styles.orderCountBadge}>
                  <Ionicons name="receipt-outline" size={14} color="#A00B0F" />

                  <Text style={styles.orderCountText}>
                    {orders.length}{' '}
                    {orders.length === 1 ? 'previous order' : 'previous orders'}
                  </Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={renderEmptyState}
        />
      </View>
    </SafeAreaView>
  );
};

export default PreviousOrders;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,

    backgroundColor: '#F6F2EE',
  },

  screenContainer: {
    flex: 1,

    alignSelf: 'center',

    backgroundColor: '#FFFDFB',
  },

  /* =====================================================
   * LOADING
   * ===================================================== */

  loadingContainer: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 30,
  },

  loadingText: {
    color: '#806C62',

    fontSize: 11,

    fontWeight: '600',

    marginTop: 12,
  },

  /* =====================================================
   * HEADER
   * ===================================================== */

  header: {
    minHeight: 66,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    backgroundColor: '#FFFDFB',

    borderBottomWidth: 1,

    borderBottomColor: '#EEE8E3',
  },

  headerIconButton: {
    width: 38,

    height: 38,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF8F2',

    borderRadius: 19,
  },

  headerIconPlaceholder: {
    width: 38,

    height: 38,
  },

  headerImage: {
    width: 20,

    height: 20,

    resizeMode: 'contain',
  },

  headerTitleContainer: {
    flex: 1,

    alignItems: 'center',

    paddingHorizontal: 12,
  },

  headerTitle: {
    color: '#A00B0F',

    fontSize: 18,

    fontWeight: '800',

    textAlign: 'center',
  },

  headerSubtitle: {
    color: '#8A746A',

    fontSize: 9,

    fontWeight: '600',

    marginTop: 2,
  },

  /* =====================================================
   * LIST
   * ===================================================== */

  listContent: {
    paddingTop: 18,

    paddingBottom: 35,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  /* =====================================================
   * INTRO
   * ===================================================== */

  pageIntro: {
    marginBottom: 18,
  },

  pageIntroTitle: {
    color: '#211713',

    fontSize: 21,

    fontWeight: '900',
  },

  pageIntroDescription: {
    color: '#806C62',

    fontSize: 11,

    lineHeight: 17,

    marginTop: 5,

    maxWidth: 520,
  },

  orderCountBadge: {
    alignSelf: 'flex-start',

    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#FFF3EA',

    borderRadius: 20,

    paddingHorizontal: 10,

    paddingVertical: 6,

    marginTop: 10,
  },

  orderCountText: {
    color: '#A00B0F',

    fontSize: 9,

    fontWeight: '800',

    marginLeft: 5,
  },

  /* =====================================================
   * ORDER CARD
   * ===================================================== */

  orderCard: {
    width: '100%',

    backgroundColor: '#FFFFFF',

    borderWidth: 1,

    borderColor: '#EFE7E2',

    borderRadius: 18,

    padding: 14,

    marginBottom: 14,

    shadowColor: '#5B3A2A',

    shadowOffset: {
      width: 0,

      height: 3,
    },

    shadowOpacity: 0.055,

    shadowRadius: 8,

    elevation: 2,
  },

  orderHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',
  },

  orderNumberContainer: {
    flex: 1,

    flexDirection: 'row',

    alignItems: 'center',

    paddingRight: 10,
  },

  orderIcon: {
    width: 42,

    height: 42,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF3E8',

    borderRadius: 12,

    marginRight: 10,
  },

  orderNumberLabel: {
    color: '#97857B',

    fontSize: 8,

    fontWeight: '700',

    textTransform: 'uppercase',
  },

  orderNumber: {
    color: '#241A15',

    fontSize: 13,

    fontWeight: '900',

    marginTop: 2,
  },

  /* =====================================================
   * STATUS
   * ===================================================== */

  statusBadge: {
    flexDirection: 'row',

    alignItems: 'center',

    borderRadius: 20,

    paddingHorizontal: 9,

    paddingVertical: 6,
  },

  statusText: {
    fontSize: 8,

    fontWeight: '800',

    marginLeft: 4,
  },

  statusDelivered: {
    backgroundColor: '#EDF7EE',
  },

  statusDeliveredText: {
    color: '#2F7D32',
  },

  statusCancelled: {
    backgroundColor: '#FFF0ED',
  },

  statusCancelledText: {
    color: '#A00B0F',
  },

  statusProcessing: {
    backgroundColor: '#FFF7E8',
  },

  statusProcessingText: {
    color: '#A96B11',
  },

  statusDefault: {
    backgroundColor: '#F3EFEC',
  },

  statusDefaultText: {
    color: '#76665E',
  },

  /* =====================================================
   * DATE
   * ===================================================== */

  dateRow: {
    flexDirection: 'row',

    alignItems: 'center',

    marginTop: 11,
  },

  dateText: {
    color: '#89756B',

    fontSize: 8.5,

    fontWeight: '600',

    marginLeft: 4,
  },

  dateDot: {
    width: 3,

    height: 3,

    borderRadius: 2,

    backgroundColor: '#C7BAB3',

    marginHorizontal: 8,
  },

  /* =====================================================
   * DIVIDERS
   * ===================================================== */

  divider: {
    height: 1,

    backgroundColor: '#EFE8E3',

    marginVertical: 12,
  },

  totalDivider: {
    height: 1,

    backgroundColor: '#E5D9D2',

    marginVertical: 9,
  },

  /* =====================================================
   * ITEMS
   * ===================================================== */

  smallHeading: {
    color: '#A00B0F',

    fontSize: 8,

    fontWeight: '900',

    letterSpacing: 0.5,

    marginBottom: 7,
  },

  orderItemContainer: {
    marginBottom: 10,
  },

  itemRow: {
    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 5,
  },

  itemBullet: {
    width: 5,

    height: 5,

    borderRadius: 3,

    backgroundColor: '#A00B0F',

    marginRight: 7,
  },

  itemNameContainer: {
    flex: 1,

    minWidth: 0,
  },

  itemNameRow: {
    flexDirection: 'row',

    flexWrap: 'wrap',

    alignItems: 'center',
  },

  itemName: {
    color: '#352821',

    fontSize: 10,

    fontWeight: '700',
  },

  itemQuantity: {
    color: '#8D796E',

    fontSize: 9,

    fontWeight: '700',

    marginLeft: 8,
  },

  customBadge: {
    backgroundColor: '#FFF0E2',

    borderRadius: 8,

    paddingHorizontal: 6,

    paddingVertical: 3,

    marginLeft: 7,
  },

  customBadgeText: {
    color: '#A00B0F',

    fontSize: 6.5,

    fontWeight: '900',
  },

  /* =====================================================
   * CUSTOM ITEMS
   * ===================================================== */

  customItemsBox: {
    marginTop: 8,

    marginLeft: 12,

    backgroundColor: '#FFF9F2',

    borderWidth: 1,

    borderColor: '#EEE2D3',

    borderRadius: 12,

    padding: 10,
  },

  customItemsHeading: {
    color: '#95663B',

    fontSize: 7,

    fontWeight: '900',

    letterSpacing: 0.5,

    marginBottom: 8,
  },

  customDishRow: {
    minHeight: 34,

    flexDirection: 'row',

    alignItems: 'center',

    borderBottomWidth: 1,

    borderBottomColor: '#F2E9DF',

    paddingVertical: 5,
  },

  customDishBullet: {
    width: 5,

    height: 5,

    borderRadius: 3,

    backgroundColor: '#A00B0F',

    marginRight: 7,
  },

  customDishInfo: {
    flex: 1,

    minWidth: 0,
  },

  customDishName: {
    color: '#493226',

    fontSize: 9,

    fontWeight: '800',
  },

  customDishUnitPrice: {
    color: '#9A887D',

    fontSize: 7,

    marginTop: 2,
  },

  customDishQty: {
    color: '#8D796E',

    fontSize: 8,

    marginHorizontal: 8,
  },

  customDishPrice: {
    minWidth: 48,

    color: '#A00B0F',

    fontSize: 8.5,

    fontWeight: '900',

    textAlign: 'right',
  },

  /* =====================================================
   * SELECTIONS
   * ===================================================== */

  selectionContainer: {
    flexDirection: 'row',

    flexWrap: 'wrap',

    marginTop: 7,
  },

  selectionChip: {
    backgroundColor: '#FAF4F0',

    borderWidth: 1,

    borderColor: '#EEE1D9',

    borderRadius: 12,

    paddingHorizontal: 8,

    paddingVertical: 5,

    marginRight: 5,

    marginBottom: 5,
  },

  selectionChipText: {
    color: '#725D52',

    fontSize: 7.5,

    fontWeight: '600',
  },

  /* =====================================================
   * PRICE
   * ===================================================== */

  priceRow: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginBottom: 7,
  },

  priceLabel: {
    color: '#76635A',

    fontSize: 9,

    fontWeight: '600',
  },

  priceValue: {
    color: '#2B211C',

    fontSize: 9,

    fontWeight: '800',
  },

  shippingLabelContainer: {
    flexDirection: 'row',

    alignItems: 'center',
  },

  freeShipping: {
    color: '#2F7D32',

    fontWeight: '900',
  },

  totalRow: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',
  },

  totalLabel: {
    color: '#2A1E18',

    fontSize: 11,

    fontWeight: '900',
  },

  totalValue: {
    color: '#A00B0F',

    fontSize: 16,

    fontWeight: '900',
  },

  /* =====================================================
   * EMPTY
   * ===================================================== */

  emptyContainer: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 30,

    paddingBottom: 70,
  },

  emptyIconContainer: {
    width: 86,

    height: 86,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF3EA',

    borderRadius: 43,

    marginBottom: 16,
  },

  emptyTitle: {
    color: '#211713',

    fontSize: 18,

    fontWeight: '900',

    textAlign: 'center',
  },

  emptyDescription: {
    maxWidth: 320,

    color: '#826F65',

    fontSize: 10,

    lineHeight: 16,

    textAlign: 'center',

    marginTop: 7,
  },

  orderNowButton: {
    minWidth: 160,

    minHeight: 46,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#A00B0F',

    borderRadius: 12,

    paddingHorizontal: 22,

    marginTop: 18,
  },

  orderNowButtonText: {
    color: '#FFFFFF',

    fontSize: 11,

    fontWeight: '800',
  },
});
