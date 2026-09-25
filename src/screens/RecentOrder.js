import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
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

import { SafeAreaView } from 'react-native-safe-area-context';

import { useFocusEffect } from '@react-navigation/native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import Ionicons from 'react-native-vector-icons/Ionicons';

/* =========================================================
 * API
 * ========================================================= */

const BASE_URL = 'https://replete-software.com/projects/kp_admin';

const RECENT_ORDERS_API = `${BASE_URL}/api/customer/orders`;

/*
 * IMPORTANT:
 *
 * Change only this function if your Laravel
 * cancellation endpoint is different.
 */

const getCancelOrderApi = orderId =>
  `${BASE_URL}/api/customer/orders/${orderId}/cancel`;

/* =========================================================
 * Status
 * ========================================================= */

const normalizeStatus = value =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

/* =========================================================
 * Cancellable Statuses
 * ========================================================= */

const CANCELLABLE_STATUSES = ['pending', 'placed', 'confirmed', 'order_placed'];

/* =========================================================
 * Recent Orders
 * ========================================================= */

const RecentOrder = ({ navigation }) => {
  const { width } = useWindowDimensions();

  /* =======================================================
   * State
   * ======================================================= */

  const [orders, setOrders] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState(null);

  /* =======================================================
   * Cancel Popup
   * ======================================================= */

  const [cancelPopupVisible, setCancelPopupVisible] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState(null);

  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  /* =======================================================
   * Success Popup
   * ======================================================= */

  const [successPopupVisible, setSuccessPopupVisible] = useState(false);

  /* =======================================================
   * Responsive
   * ======================================================= */

  const responsive = useMemo(
    () => ({
      contentWidth: width >= 768 ? Math.min(width - 80, 760) : width,

      horizontalPadding: width >= 768 ? 28 : 14,
    }),
    [width],
  );

  /* =======================================================
   * Parse Price
   * ======================================================= */

  const parsePrice = value => {
    const parsed = Number(String(value ?? 0).replace(/[^\d.-]/g, ''));

    return Number.isFinite(parsed) ? parsed : 0;
  };

  /* =======================================================
   * Extract Order Array
   * ======================================================= */

  const extractOrders = result => {
    if (Array.isArray(result)) {
      return result;
    }

    if (Array.isArray(result?.data)) {
      return result.data;
    }

    if (Array.isArray(result?.orders)) {
      return result.orders;
    }

    if (Array.isArray(result?.data?.orders)) {
      return result.data.orders;
    }

    /*
     * Laravel paginator:
     *
     * {
     *   data: {
     *     data: [...]
     *   }
     * }
     */

    if (Array.isArray(result?.data?.data)) {
      return result.data.data;
    }

    if (Array.isArray(result?.orders?.data)) {
      return result.orders.data;
    }

    return [];
  };

  /* =======================================================
   * Normalize Customization
   * ======================================================= */

  const normalizeCustomizations = value => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item, index) => {
        if (typeof item === 'string') {
          return {
            id: `custom-${index}`,

            category: '',

            name: item,
          };
        }

        if (!item || typeof item !== 'object') {
          return null;
        }

        return {
          ...item,

          id: item?.id ?? `custom-${index}`,

          category: item?.category ?? item?.group_name ?? item?.group ?? '',

          name:
            item?.name ??
            item?.item_name ??
            item?.option_name ??
            item?.title ??
            '',
        };
      })
      .filter(item => item && item.name);
  };

  /* =======================================================
   * Normalize Extras
   * ======================================================= */

  const normalizeExtras = value => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item, index) => {
        if (typeof item === 'string') {
          return {
            id: `extra-${index}`,

            name: item,

            quantity: 1,

            price: 0,
          };
        }

        if (!item || typeof item !== 'object') {
          return null;
        }

        return {
          ...item,

          id: item?.id ?? `extra-${index}`,

          name: item?.name ?? item?.item_name ?? item?.title ?? 'Extra Item',

          quantity: Number(item?.quantity ?? item?.qty ?? 1),

          price: parsePrice(item?.price ?? 0),
        };
      })
      .filter(Boolean);
  };

  /* =======================================================
   * Normalize Order Item
   * ======================================================= */

  const normalizeOrderItem = (item, index) => {
    const tiffin = item?.tiffin ?? item?.product ?? item?.menu ?? {};

    const image =
      item?.image ??
      item?.image_url ??
      tiffin?.image ??
      tiffin?.image_url ??
      null;

    let imageUrl = image;

    if (image && !String(image).startsWith('http')) {
      imageUrl = `${BASE_URL}/${String(image).replace(/^\/+/, '')}`;
    }

    return {
      ...item,

      id: item?.id ?? `item-${index}`,

      tiffinId: item?.tiffin_id ?? item?.tiffinId ?? tiffin?.id ?? null,

      name:
        item?.tiffin_name ??
        item?.name ??
        tiffin?.name ??
        tiffin?.tiffin_name ??
        'Tiffin',

      image: imageUrl,

      quantity: Number(item?.quantity ?? item?.qty ?? 1),

      price: parsePrice(item?.price ?? item?.subtotal ?? tiffin?.price ?? 0),

      customizations: normalizeCustomizations(
        item?.customizations ?? item?.selections ?? [],
      ),

      extras: normalizeExtras(item?.extras ?? []),
    };
  };

  /* =======================================================
   * Normalize Order
   * ======================================================= */

  const normalizeOrder = (order, index) => {
    let orderItems =
      order?.items ?? order?.order_items ?? order?.orderItems ?? [];

    if (!Array.isArray(orderItems)) {
      orderItems = [];
    }

    /*
     * Some APIs return a single tiffin directly
     * on the order rather than an items array.
     */

    if (orderItems.length === 0 && (order?.tiffin_id || order?.tiffin)) {
      orderItems = [
        {
          ...order,

          id: `single-${order?.id ?? index}`,
        },
      ];
    }

    const status = normalizeStatus(
      order?.status ?? order?.order_status ?? 'pending',
    );

    return {
      ...order,

      id: String(order?.id ?? order?.order_id ?? `order-${index}`),

      orderNumber:
        order?.order_number ??
        order?.order_no ??
        order?.invoice_number ??
        order?.id ??
        index + 1,

      status,

      createdAt:
        order?.created_at ?? order?.createdAt ?? order?.order_date ?? null,

      total: parsePrice(
        order?.total_amount ?? order?.grand_total ?? order?.total ?? 0,
      ),

      subtotal: parsePrice(order?.subtotal ?? 0),

      deliveryFee: parsePrice(
        order?.delivery_fee ?? order?.shipping_charge ?? 0,
      ),

      address:
        order?.delivery_address ??
        order?.address ??
        order?.delivery_location ??
        '',

      notes: order?.order_notes ?? order?.notes ?? '',

      items: orderItems.map(normalizeOrderItem),
    };
  };

  /* =======================================================
   * Fetch Orders
   * ======================================================= */

  const fetchOrders = async (options = {}) => {
    const { isRefresh = false } = options;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      /* =============================================
       * Token
       * ============================================= */

      const token = await AsyncStorage.getItem('token');

      if (!token) {
        setOrders([]);

        setError('Please login to view your recent orders.');

        return;
      }

      /* =============================================
       * API
       * ============================================= */

      const response = await fetch(RECENT_ORDERS_API, {
        method: 'GET',

        headers: {
          Accept: 'application/json',

          'Content-Type': 'application/json',

          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();

      let result;

      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.log('RECENT ORDER RAW RESPONSE:', responseText);

        throw new Error('Server returned an invalid response.');
      }

      console.log('RECENT ORDER RESPONSE:', JSON.stringify(result, null, 2));

      /* =============================================
       * Authentication Error
       * ============================================= */

      if (response.status === 401 || response.status === 403) {
        setOrders([]);

        setError('Please login to view your recent orders.');

        return;
      }

      if (!response.ok) {
        throw new Error(
          result?.message ?? result?.error ?? 'Unable to load recent orders.',
        );
      }

      /* =============================================
       * Normalize
       * ============================================= */

      const rawOrders = extractOrders(result);

      let normalizedOrders = rawOrders.map(normalizeOrder);

      /* =============================================
       * Latest First
       * ============================================= */

      normalizedOrders.sort((first, second) => {
        const firstTime = first?.createdAt
          ? new Date(first.createdAt).getTime()
          : 0;

        const secondTime = second?.createdAt
          ? new Date(second.createdAt).getTime()
          : 0;

        return secondTime - firstTime;
      });

      setOrders(normalizedOrders);
    } catch (apiError) {
      console.log('RECENT ORDER ERROR:', apiError);

      setError(apiError?.message ?? 'Unable to load your orders.');
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
   * Refresh On Focus
   * ======================================================= */

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, []),
  );

  /* =======================================================
   * Format Date
   * ======================================================= */

  const formatDate = value => {
    if (!value) {
      return '';
    }

    try {
      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return String(value);
      }

      return date.toLocaleString('en-AU', {
        day: '2-digit',

        month: 'short',

        year: 'numeric',

        hour: 'numeric',

        minute: '2-digit',
      });
    } catch (error) {
      return '';
    }
  };

  /* =======================================================
   * Status Text
   * ======================================================= */

  const getStatusText = status => {
    switch (normalizeStatus(status)) {
      case 'pending':
        return 'Pending';

      case 'placed':
      case 'order_placed':
        return 'Order Placed';

      case 'confirmed':
        return 'Confirmed';

      case 'preparing':
      case 'processing':
        return 'Preparing';

      case 'ready':
        return 'Ready';

      case 'out_for_delivery':
        return 'Out for Delivery';

      case 'delivered':
      case 'completed':
        return 'Delivered';

      case 'cancelled':
      case 'canceled':
        return 'Cancelled';

      default:
        return String(status ?? 'Pending').replace(/_/g, ' ');
    }
  };

  /* =======================================================
   * Status Style
   * ======================================================= */

  const getStatusStyle = status => {
    const value = normalizeStatus(status);

    if (value === 'delivered' || value === 'completed') {
      return {
        backgroundColor: '#EAF7EF',

        color: '#24804B',
      };
    }

    if (value === 'cancelled' || value === 'canceled') {
      return {
        backgroundColor: '#FCECEC',

        color: '#CB4343',
      };
    }

    if (value === 'preparing' || value === 'processing') {
      return {
        backgroundColor: '#FFF3E5',

        color: '#B76A19',
      };
    }

    if (value === 'ready' || value === 'out_for_delivery') {
      return {
        backgroundColor: '#EBF1FC',

        color: '#426DAA',
      };
    }

    return {
      backgroundColor: '#FBEAEC',

      color: '#A00B0F',
    };
  };

  /* =======================================================
   * Can Cancel
   * ======================================================= */

  const canCancelOrder = order => {
    return CANCELLABLE_STATUSES.includes(normalizeStatus(order?.status));
  };

  /* =======================================================
   * Ask Cancel Order
   * ======================================================= */

  const handleCancelPress = order => {
    if (!order || !canCancelOrder(order)) {
      return;
    }

    setSelectedOrder(order);

    setCancelPopupVisible(true);
  };

  /* =======================================================
   * Close Cancel Popup
   * ======================================================= */

  const closeCancelPopup = () => {
    if (cancellingOrderId) {
      return;
    }

    setCancelPopupVisible(false);

    setSelectedOrder(null);
  };

  /* =======================================================
   * Confirm Cancel Order
   * ======================================================= */

  const confirmCancelOrder = async () => {
    if (!selectedOrder || cancellingOrderId) {
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        setCancelPopupVisible(false);

        navigation.navigate('Login', {
          redirectTo: 'RecentOrder',
        });

        return;
      }

      const orderId = selectedOrder.id;

      setCancellingOrderId(orderId);

      /* =============================================
       * Cancel API
       * ============================================= */

      const response = await fetch(getCancelOrderApi(orderId), {
        method: 'POST',

        headers: {
          Accept: 'application/json',

          'Content-Type': 'application/json',

          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();

      let result = {};

      if (responseText) {
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          console.log('CANCEL ORDER RAW RESPONSE:', responseText);
        }
      }

      console.log('CANCEL ORDER RESPONSE:', result);

      if (response.status === 401) {
        setCancelPopupVisible(false);

        navigation.navigate('Login', {
          redirectTo: 'RecentOrder',
        });

        return;
      }

      if (response.status === 422 && result?.errors) {
        const validationErrors = Object.values(result.errors).flat();

        throw new Error(
          validationErrors[0] ??
            result?.message ??
            'This order cannot be cancelled.',
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.message ?? result?.error ?? 'Unable to cancel this order.',
        );
      }

      /* =============================================
       * Update Current UI Immediately
       * ============================================= */

      setOrders(current =>
        current.map(order =>
          String(order.id) === String(orderId)
            ? {
                ...order,

                status: 'cancelled',
              }
            : order,
        ),
      );

      setCancelPopupVisible(false);

      setSelectedOrder(null);

      setSuccessPopupVisible(true);

      /*
       * Also reload from the server so the
       * frontend stays synchronized.
       */

      fetchOrders();
    } catch (cancelError) {
      console.log('CANCEL ORDER ERROR:', cancelError);

      /*
       * Keep popup open and display a small
       * server error through the existing state.
       */

      setCancelPopupVisible(false);

      setSelectedOrder(null);

      setError(cancelError?.message ?? 'Unable to cancel this order.');
    } finally {
      setCancellingOrderId(null);
    }
  };

  /* =======================================================
   * Back
   * ======================================================= */

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();

      return;
    }

    navigation.navigate('MainTabs');
  };

  /* =======================================================
   * Render Order Item
   * ======================================================= */

  const renderTiffin = (item, orderId) => {
    const itemTotal = Number(item.price ?? 0) * Number(item.quantity ?? 1);

    return (
      <View key={`${orderId}-${item.id}`} style={styles.tiffinCard}>
        {/* Image */}

        {item.image ? (
          <Image
            source={{
              uri: item.image,
            }}
            style={styles.tiffinImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.tiffinImage, styles.noImage]}>
            {/* <Ionicons name="restaurant-outline" size={23} color="#A00B0F" /> */}
          </View>
        )}

        {/* Content */}

        <View style={styles.tiffinContent}>
          <View style={styles.tiffinTitleRow}>
            <Text numberOfLines={2} style={styles.tiffinName}>
              {item.name}
            </Text>

            <Text style={styles.tiffinPrice}>${itemTotal.toFixed(2)}</Text>
          </View>

          <Text style={styles.tiffinQuantity}>Quantity: {item.quantity}</Text>

          {/* Customizations */}

          {!!item.customizations?.length && (
            <View style={styles.itemDetailsBox}>
              <Text style={styles.itemDetailsHeading}>Customizations</Text>

              {item.customizations.map((custom, index) => (
                <Text
                  key={`${item.id}-custom-${custom.id ?? index}`}
                  style={styles.itemDetailText}
                >
                  {custom.category ? `${custom.category}: ` : ''}

                  {custom.name}
                </Text>
              ))}
            </View>
          )}

          {/* Extras */}

          {!!item.extras?.length && (
            <View style={styles.itemDetailsBox}>
              <Text style={styles.itemDetailsHeading}>Extras</Text>

              {item.extras.map((extra, index) => (
                <Text
                  key={`${item.id}-extra-${extra.id ?? index}`}
                  style={styles.itemDetailText}
                >
                  + {extra.name} × {extra.quantity}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  /* =======================================================
   * Render Order
   * ======================================================= */

  const renderOrder = ({ item }) => {
    const statusStyle = getStatusStyle(item.status);

    const cancellable = canCancelOrder(item);

    const isCancelling = String(cancellingOrderId) === String(item.id);

    return (
      <View style={styles.orderCard}>
        {/* ========================================= */}
        {/* Header */}
        {/* ========================================= */}

        <View style={styles.orderHeader}>
          <View style={styles.orderNumberContainer}>
            <Text style={styles.orderLabel}>ORDER</Text>

            <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
          </View>

          <View
            style={[
              styles.statusBadge,

              {
                backgroundColor: statusStyle.backgroundColor,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,

                {
                  color: statusStyle.color,
                },
              ]}
            >
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        {/* Date */}

        {!!item.createdAt && (
          <View style={styles.orderDateRow}>
            {/* <Ionicons name="time-outline" size={13} color="#948B97" /> */}

            <Text style={styles.orderDate}>{formatDate(item.createdAt)}</Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* ========================================= */}
        {/* Tiffins */}
        {/* ========================================= */}

        <Text style={styles.sectionTitle}>Tiffins</Text>

        {item.items.length > 0 ? (
          item.items.map(tiffin => renderTiffin(tiffin, item.id))
        ) : (
          <Text style={styles.noItemText}>
            Order item details are unavailable.
          </Text>
        )}

        {/* ========================================= */}
        {/* Delivery Address */}
        {/* ========================================= */}

        {!!item.address && (
          <View style={styles.infoSection}>
            <View style={styles.infoHeader}>
              {/* <Ionicons name="location-outline" size={15} color="#A00B0F" /> */}

              <Text style={styles.infoTitle}>Delivery Address</Text>
            </View>

            <Text style={styles.infoText}>
              {typeof item.address === 'string'
                ? item.address
                : JSON.stringify(item.address)}
            </Text>
          </View>
        )}

        {/* Notes */}

        {!!item.notes && (
          <View style={styles.infoSection}>
            <View style={styles.infoHeader}>
              {/* <Ionicons
                name="document-text-outline"
                size={15}
                color="#A00B0F"
              /> */}

              <Text style={styles.infoTitle}>Order Notes</Text>
            </View>

            <Text style={styles.infoText}>{item.notes}</Text>
          </View>
        )}

        {/* ========================================= */}
        {/* Bill */}
        {/* ========================================= */}

        <View style={styles.billSection}>
          {item.subtotal > 0 && (
            <BillRow label="Subtotal" value={`$${item.subtotal.toFixed(2)}`} />
          )}

          <BillRow
            label="Delivery"
            value={
              item.deliveryFee > 0 ? `$${item.deliveryFee.toFixed(2)}` : 'FREE'
            }
          />

          <View style={styles.billDivider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>

            <Text style={styles.totalValue}>${item.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* ========================================= */}
        {/* Cancel */}
        {/* ========================================= */}

        {cancellable && (
          <TouchableOpacity
            disabled={isCancelling}
            activeOpacity={0.85}
            onPress={() => handleCancelPress(item)}
            style={[
              styles.cancelOrderButton,

              isCancelling && styles.disabledButton,
            ]}
          >
            {/* <Ionicons name="close-circle-outline" size={17} color="#D04444" /> */}

            <Text style={styles.cancelOrderText}>Cancel Order</Text>
          </TouchableOpacity>
        )}

        {!cancellable &&
          normalizeStatus(item.status) !== 'cancelled' &&
          normalizeStatus(item.status) !== 'canceled' && (
            <View style={styles.cannotCancelBox}>
              {/* <Ionicons
                name="information-circle-outline"
                size={15}
                color="#8E848F"
              /> */}

              <Text style={styles.cannotCancelText}>
                This order can no longer be cancelled.
              </Text>
            </View>
          )}
      </View>
    );
  };

  /* =======================================================
   * Loading
   * ======================================================= */

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF8FD" />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A00B0F" />

          <Text style={styles.loadingTitle}>Loading Recent Orders</Text>

          <Text style={styles.loadingText}>Please wait...</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* =======================================================
   * UI
   * ======================================================= */

  return (
    <>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF8FD" />

        <View
          style={[
            styles.screen,

            {
              width: responsive.contentWidth,
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
                paddingHorizontal: responsive.horizontalPadding,
              },
            ]}
          >
            <Pressable
              hitSlop={10}
              style={styles.backButton}
              onPress={handleBack}
            >
              {/* <Ionicons name="chevron-back" size={22} color="#A00B0F" /> */}
            </Pressable>

            <View style={styles.headerContent}>
              <Text style={styles.headerEyebrow}>MY ORDERS</Text>

              <Text style={styles.headerTitle}>Recent Orders</Text>
            </View>
          </View>

          {/* ========================================= */}
          {/* Error */}
          {/* ========================================= */}

          {!!error && orders.length === 0 ? (
            <View style={styles.emptyContainer}>
              {/* <View style={styles.emptyIconCircle}>
                <Ionicons name="receipt-outline" size={34} color="#A00B0F" />
              </View> */}

              <Text style={styles.emptyTitle}>Unable to Show Orders</Text>

              <Text style={styles.emptyDescription}>{error}</Text>

              {error.toLowerCase().includes('login') ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate('Login', {
                      redirectTo: 'RecentOrder',
                    })
                  }
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>LOGIN</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => fetchOrders()}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>TRY AGAIN</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={orders}
              renderItem={renderOrder}
              keyExtractor={item => String(item.id)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.listContent,

                {
                  paddingHorizontal: responsive.horizontalPadding,
                },

                orders.length === 0 && styles.emptyList,
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() =>
                    fetchOrders({
                      isRefresh: true,
                    })
                  }
                  colors={['#A00B0F']}
                  tintColor="#A00B0F"
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  {/* <View style={styles.emptyIconCircle}>
                    <Ionicons
                      name="receipt-outline"
                      size={34}
                      color="#A00B0F"
                    />
                  </View> */}

                  <Text style={styles.emptyTitle}>No Recent Orders</Text>

                  <Text style={styles.emptyDescription}>
                    Your recent tiffin orders will appear here.
                  </Text>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('MainTabs')}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>BROWSE TIFFINS</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}
        </View>
      </SafeAreaView>

      {/* ================================================= */}
      {/* CANCEL ORDER CONFIRMATION POPUP */}
      {/* ================================================= */}

      <Modal
        visible={cancelPopupVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeCancelPopup}
      >
        <Pressable style={styles.modalOverlay} onPress={closeCancelPopup}>
          <Pressable style={styles.cancelPopup} onPress={() => {}}>
            {/* Icon */}

            <View style={styles.cancelIconOuter}>
              {/* <View style={styles.cancelIconInner}>
                <Ionicons name="close" size={29} color="#FFFFFF" />
              </View> */}
            </View>

            {/* Heading */}

            <Text style={styles.cancelPopupTitle}>Cancel Order?</Text>

            <Text style={styles.cancelPopupDescription}>
              Are you sure you want to cancel order #
              {selectedOrder?.orderNumber}?
            </Text>

            <View style={styles.warningBox}>
              {/* <Ionicons
                name="information-circle-outline"
                size={18}
                color="#B46B22"
              /> */}

              <Text style={styles.warningText}>
                Once cancelled, this order cannot be restored.
              </Text>
            </View>

            {/* Buttons */}

            <View style={styles.popupButtons}>
              <TouchableOpacity
                disabled={Boolean(cancellingOrderId)}
                activeOpacity={0.8}
                onPress={closeCancelPopup}
                style={styles.keepOrderButton}
              >
                <Text style={styles.keepOrderText}>Keep Order</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={Boolean(cancellingOrderId)}
                activeOpacity={0.85}
                onPress={confirmCancelOrder}
                style={[
                  styles.confirmCancelButton,

                  Boolean(cancellingOrderId) && styles.disabledButton,
                ]}
              >
                {cancellingOrderId ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    {/* <Ionicons
                      name="close-circle-outline"
                      size={17}
                      color="#FFFFFF"
                    /> */}

                    <Text style={styles.confirmCancelText}>Cancel Order</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ================================================= */}
      {/* SUCCESS POPUP */}
      {/* ================================================= */}

      <Modal
        visible={successPopupVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSuccessPopupVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSuccessPopupVisible(false)}
        >
          <Pressable style={styles.successPopup} onPress={() => {}}>
            <View style={styles.successIconOuter}>
              {/* <View style={styles.successIconInner}>
                <Ionicons name="checkmark" size={29} color="#FFFFFF" />
              </View> */}
            </View>

            <Text style={styles.successTitle}>Order Cancelled</Text>

            <Text style={styles.successDescription}>
              Your order has been cancelled successfully.
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSuccessPopupVisible(false)}
              style={styles.doneButton}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

/* =========================================================
 * Bill Row
 * ========================================================= */

const BillRow = ({ label, value }) => (
  <View style={styles.billRow}>
    <Text style={styles.billLabel}>{label}</Text>

    <Text style={styles.billValue}>{value}</Text>
  </View>
);

export default RecentOrder;

/* =========================================================
 * Styles
 * ========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,

    backgroundColor: '#F8F6FA',
  },

  screen: {
    flex: 1,

    alignSelf: 'center',

    backgroundColor: '#F8F6FA',
  },

  /* =====================================================
   * Header
   * ===================================================== */

  header: {
    minHeight: 74,

    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#FFFFFF',

    borderBottomWidth: 1,

    borderBottomColor: '#ECE8F0',
  },

  backButton: {
    width: 40,

    height: 40,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF1F2',

    borderRadius: 12,

    borderWidth: 1,

    borderColor: '#F2D8DA',
  },

  headerContent: {
    flex: 1,

    marginLeft: 12,
  },

  headerEyebrow: {
    color: '#A00B0F',

    fontSize: 8,

    fontWeight: '900',

    letterSpacing: 0.8,
  },

  headerTitle: {
    color: '#211A25',

    fontSize: 18,

    fontWeight: '900',

    marginTop: 2,
  },

  /* =====================================================
   * List
   * ===================================================== */

  listContent: {
    paddingTop: 14,

    paddingBottom: 100,
  },

  emptyList: {
    flexGrow: 1,
  },

  /* =====================================================
   * Order Card
   * ===================================================== */

  orderCard: {
    backgroundColor: '#FFFFFF',

    borderRadius: 18,

    borderWidth: 1,

    borderColor: '#ECE8F0',

    padding: 14,

    marginBottom: 14,

    shadowColor: '#473D4B',

    shadowOffset: {
      width: 0,

      height: 4,
    },

    shadowOpacity: 0.05,

    shadowRadius: 10,

    elevation: 2,
  },

  orderHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',
  },

  orderNumberContainer: {
    flex: 1,
  },

  orderLabel: {
    color: '#9D949F',

    fontSize: 7,

    fontWeight: '800',

    letterSpacing: 0.7,
  },

  orderNumber: {
    color: '#211A25',

    fontSize: 16,

    fontWeight: '900',

    marginTop: 2,
  },

  statusBadge: {
    minHeight: 29,

    alignItems: 'center',

    justifyContent: 'center',

    borderRadius: 20,

    paddingHorizontal: 10,

    paddingVertical: 5,
  },

  statusText: {
    fontSize: 8,

    fontWeight: '900',

    textTransform: 'capitalize',
  },

  orderDateRow: {
    flexDirection: 'row',

    alignItems: 'center',

    marginTop: 9,
  },

  orderDate: {
    color: '#948B97',

    fontSize: 8.5,

    marginLeft: 5,
  },

  divider: {
    height: 1,

    backgroundColor: '#EEEAF0',

    marginVertical: 13,
  },

  sectionTitle: {
    color: '#2A222F',

    fontSize: 11,

    fontWeight: '900',

    marginBottom: 9,
  },

  /* =====================================================
   * Tiffin
   * ===================================================== */

  tiffinCard: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    backgroundColor: '#FBF9FC',

    borderWidth: 1,

    borderColor: '#F0EBF2',

    borderRadius: 13,

    padding: 9,

    marginBottom: 8,
  },

  tiffinImage: {
    width: 68,

    height: 72,

    borderRadius: 10,

    backgroundColor: '#F0EBF2',
  },

  noImage: {
    alignItems: 'center',

    justifyContent: 'center',
  },

  tiffinContent: {
    flex: 1,

    paddingLeft: 10,
  },

  tiffinTitleRow: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    justifyContent: 'space-between',
  },

  tiffinName: {
    flex: 1,

    color: '#2A222F',

    fontSize: 10.5,

    lineHeight: 15,

    fontWeight: '900',

    paddingRight: 8,
  },

  tiffinPrice: {
    color: '#A00B0F',

    fontSize: 10,

    fontWeight: '900',
  },

  tiffinQuantity: {
    color: '#837985',

    fontSize: 8,

    fontWeight: '700',

    marginTop: 4,
  },

  itemDetailsBox: {
    marginTop: 7,

    paddingTop: 6,

    borderTopWidth: StyleSheet.hairlineWidth,

    borderTopColor: '#E8E1EA',
  },

  itemDetailsHeading: {
    color: '#A00B0F',

    fontSize: 7.5,

    fontWeight: '900',

    marginBottom: 3,
  },

  itemDetailText: {
    color: '#776D79',

    fontSize: 7.5,

    lineHeight: 12,

    marginBottom: 2,
  },

  noItemText: {
    color: '#8C838F',

    fontSize: 9,

    lineHeight: 15,
  },

  /* =====================================================
   * Order Information
   * ===================================================== */

  infoSection: {
    backgroundColor: '#FBF9FC',

    borderWidth: 1,

    borderColor: '#EFEAF1',

    borderRadius: 12,

    padding: 10,

    marginTop: 9,
  },

  infoHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 5,
  },

  infoTitle: {
    color: '#332A36',

    fontSize: 9,

    fontWeight: '900',

    marginLeft: 5,
  },

  infoText: {
    color: '#756B78',

    fontSize: 8.5,

    lineHeight: 14,
  },

  /* =====================================================
   * Bill
   * ===================================================== */

  billSection: {
    backgroundColor: '#FFF9F9',

    borderWidth: 1,

    borderColor: '#F0E1E2',

    borderRadius: 12,

    padding: 11,

    marginTop: 10,
  },

  billRow: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginBottom: 7,
  },

  billLabel: {
    color: '#7B717D',

    fontSize: 8.5,
  },

  billValue: {
    color: '#39303C',

    fontSize: 8.5,

    fontWeight: '800',
  },

  billDivider: {
    height: 1,

    backgroundColor: '#EBDCDD',

    marginVertical: 5,
  },

  totalRow: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',
  },

  totalLabel: {
    color: '#251D29',

    fontSize: 10,

    fontWeight: '900',
  },

  totalValue: {
    color: '#A00B0F',

    fontSize: 14,

    fontWeight: '900',
  },

  /* =====================================================
   * Cancel
   * ===================================================== */

  cancelOrderButton: {
    minHeight: 44,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF4F4',

    borderWidth: 1,

    borderColor: '#F0CECE',

    borderRadius: 11,

    marginTop: 11,
  },

  cancelOrderText: {
    color: '#D04444',

    fontSize: 9,

    fontWeight: '900',

    marginLeft: 6,
  },

  cannotCancelBox: {
    minHeight: 40,

    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#F8F6F9',

    borderRadius: 10,

    paddingHorizontal: 10,

    marginTop: 10,
  },

  cannotCancelText: {
    flex: 1,

    color: '#8E848F',

    fontSize: 8,

    lineHeight: 12,

    marginLeft: 6,
  },

  disabledButton: {
    opacity: 0.6,
  },

  /* =====================================================
   * Loading + Empty
   * ===================================================== */

  loadingContainer: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 30,
  },

  loadingTitle: {
    color: '#211A25',

    fontSize: 15,

    fontWeight: '900',

    marginTop: 14,
  },

  loadingText: {
    color: '#918794',

    fontSize: 9,

    marginTop: 5,
  },

  emptyContainer: {
    flex: 1,

    minHeight: 450,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 30,
  },

  emptyIconCircle: {
    width: 78,

    height: 78,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FBEAEC',

    borderRadius: 39,
  },

  emptyTitle: {
    color: '#211A25',

    fontSize: 17,

    fontWeight: '900',

    marginTop: 16,

    textAlign: 'center',
  },

  emptyDescription: {
    maxWidth: 300,

    color: '#8C838F',

    fontSize: 10,

    lineHeight: 16,

    textAlign: 'center',

    marginTop: 6,
  },

  primaryButton: {
    minWidth: 145,

    minHeight: 45,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#A00B0F',

    borderRadius: 11,

    paddingHorizontal: 20,

    marginTop: 18,
  },

  primaryButtonText: {
    color: '#FFFFFF',

    fontSize: 9,

    fontWeight: '900',
  },

  /* =====================================================
   * Modal
   * ===================================================== */

  modalOverlay: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: 'rgba(23,16,20,0.62)',

    paddingHorizontal: 22,
  },

  cancelPopup: {
    width: '100%',

    maxWidth: 380,

    alignItems: 'center',

    backgroundColor: '#FFFFFF',

    borderRadius: 24,

    paddingHorizontal: 22,

    paddingTop: 27,

    paddingBottom: 20,

    elevation: 18,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,

      height: 10,
    },

    shadowOpacity: 0.22,

    shadowRadius: 18,
  },

  cancelIconOuter: {
    width: 82,

    height: 82,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF0F0',

    borderRadius: 41,

    marginBottom: 15,
  },

  cancelIconInner: {
    width: 56,

    height: 56,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#D84A4A',

    borderRadius: 28,
  },

  cancelPopupTitle: {
    color: '#251D29',

    fontSize: 20,

    fontWeight: '900',

    textAlign: 'center',
  },

  cancelPopupDescription: {
    maxWidth: 285,

    color: '#766C78',

    fontSize: 10,

    lineHeight: 16,

    textAlign: 'center',

    marginTop: 7,
  },

  warningBox: {
    width: '100%',

    minHeight: 50,

    flexDirection: 'row',

    alignItems: 'center',

    backgroundColor: '#FFF8EE',

    borderWidth: 1,

    borderColor: '#F3E1C6',

    borderRadius: 11,

    padding: 10,

    marginTop: 17,
  },

  warningText: {
    flex: 1,

    color: '#82633D',

    fontSize: 8,

    lineHeight: 13,

    fontWeight: '700',

    marginLeft: 7,
  },

  popupButtons: {
    width: '100%',

    flexDirection: 'row',

    marginTop: 20,
  },

  keepOrderButton: {
    flex: 1,

    minHeight: 48,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#F7F4F6',

    borderWidth: 1,

    borderColor: '#E7E0E8',

    borderRadius: 12,

    marginRight: 5,
  },

  keepOrderText: {
    color: '#665D68',

    fontSize: 9,

    fontWeight: '900',
  },

  confirmCancelButton: {
    flex: 1,

    minHeight: 48,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#D44444',

    borderRadius: 12,

    marginLeft: 5,
  },

  confirmCancelText: {
    color: '#FFFFFF',

    fontSize: 9,

    fontWeight: '900',

    marginLeft: 5,
  },

  /* =====================================================
   * Success
   * ===================================================== */

  successPopup: {
    width: '100%',

    maxWidth: 370,

    alignItems: 'center',

    backgroundColor: '#FFFFFF',

    borderRadius: 24,

    padding: 24,
  },

  successIconOuter: {
    width: 80,

    height: 80,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#EDF8F1',

    borderRadius: 40,
  },

  successIconInner: {
    width: 55,

    height: 55,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#289557',

    borderRadius: 28,
  },

  successTitle: {
    color: '#251D29',

    fontSize: 18,

    fontWeight: '900',

    textAlign: 'center',

    marginTop: 15,
  },

  successDescription: {
    color: '#7A707C',

    fontSize: 10,

    lineHeight: 16,

    textAlign: 'center',

    marginTop: 7,
  },

  doneButton: {
    width: '100%',

    minHeight: 47,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#A00B0F',

    borderRadius: 12,

    marginTop: 19,
  },

  doneText: {
    color: '#FFFFFF',

    fontSize: 10,

    fontWeight: '900',
  },
});
