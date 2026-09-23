import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useFocusEffect } from '@react-navigation/native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { io } from 'socket.io-client';

/* =========================================================
 * API
 * ========================================================= */

const NOTIFICATION_API =
  'https://replete-software.com/projects/kp_admin/api/customer/notifications';

/* =========================================================
 * SOCKET
 *
 * Replace with your real Socket.IO URL.
 * ========================================================= */

const SOCKET_URL = 'https://YOUR-SOCKET-SERVER-URL';

const SOCKET_NOTIFICATION_EVENT = 'customer:notification';

const SOCKET_ORDER_STATUS_EVENT = 'customer:order-status';

const SOCKET_WEEKLY_INVOICE_EVENT = 'customer:weekly-invoice';

/* =========================================================
 * SHARED NOTIFICATION STORAGE
 *
 * Home.js uses exactly the same keys.
 * ========================================================= */

const READ_NOTIFICATION_IDS_KEY = 'kp_read_notification_ids';

const DELETED_NOTIFICATION_IDS_KEY = 'kp_deleted_notification_ids';

const NOTIFICATION_UNREAD_COUNT_KEY = 'kp_unread_notification_count';

/* =========================================================
 * STORAGE HELPERS
 * ========================================================= */

const getStoredIdList = async key => {
  try {
    const stored = await AsyncStorage.getItem(key);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(value => String(value));
  } catch (error) {
    console.log(`READ ${key} ERROR:`, error);

    return [];
  }
};

const saveStoredIdList = async (key, ids) => {
  try {
    const uniqueIds = [...new Set(ids.map(value => String(value)))];

    await AsyncStorage.setItem(
      key,

      JSON.stringify(uniqueIds),
    );

    return uniqueIds;
  } catch (error) {
    console.log(`SAVE ${key} ERROR:`, error);

    return [];
  }
};

/* =========================================================
 * NOTIFICATION SCREEN
 * ========================================================= */

const Notifications = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState(null);

  const [socketConnected, setSocketConnected] = useState(false);

  const [selectedNotification, setSelectedNotification] = useState(null);

  const [detailPopupVisible, setDetailPopupVisible] = useState(false);

  const [incomingNotification, setIncomingNotification] = useState(null);

  const [incomingPopupVisible, setIncomingPopupVisible] = useState(false);

  const [markingAllRead, setMarkingAllRead] = useState(false);

  const [deletingAll, setDeletingAll] = useState(false);

  const [deleteAllPopupVisible, setDeleteAllPopupVisible] = useState(false);

  const socketRef = useRef(null);

  const incomingPopupTimerRef = useRef(null);

  const mountedRef = useRef(true);

  /* =======================================================
   * NORMALIZE
   * ======================================================= */

  const normalizeNotification = useCallback((item, index = 0) => {
    const rawData =
      item?.data && typeof item.data === 'object' ? item.data : {};

    const title =
      item?.title ??
      rawData?.title ??
      rawData?.subject ??
      rawData?.heading ??
      'Notification';

    const message =
      item?.message ??
      item?.body ??
      item?.description ??
      rawData?.message ??
      rawData?.body ??
      rawData?.description ??
      '';

    const createdAt =
      item?.created_at ??
      item?.createdAt ??
      rawData?.created_at ??
      rawData?.createdAt ??
      new Date().toISOString();

    const readAt =
      item?.read_at ??
      item?.readAt ??
      rawData?.read_at ??
      rawData?.readAt ??
      null;

    const isRead = Boolean(
      readAt ||
        item?.is_read === true ||
        item?.is_read === 1 ||
        item?.is_read === '1' ||
        item?.isRead === true ||
        rawData?.is_read === true ||
        rawData?.is_read === 1 ||
        rawData?.is_read === '1',
    );

    const notificationId =
      item?.id ??
      item?.notification_id ??
      rawData?.id ??
      rawData?.notification_id ??
      `socket-${Date.now()}-${index}`;

    return {
      ...item,

      id: String(notificationId),

      title: String(title),

      message: String(message),

      createdAt,

      readAt,

      isRead,

      data: rawData,
    };
  }, []);

  /* =======================================================
   * EXTRACT API ARRAY
   * ======================================================= */

  const extractNotificationArray = result => {
    if (Array.isArray(result)) {
      return result;
    }

    if (Array.isArray(result?.data)) {
      return result.data;
    }

    if (Array.isArray(result?.notifications)) {
      return result.notifications;
    }

    if (Array.isArray(result?.data?.notifications)) {
      return result.data.notifications;
    }

    if (Array.isArray(result?.data?.data)) {
      return result.data.data;
    }

    if (Array.isArray(result?.notifications?.data)) {
      return result.notifications.data;
    }

    if (Array.isArray(result?.data?.notifications?.data)) {
      return result.data.notifications.data;
    }

    return [];
  };

  /* =======================================================
   * INCOMING POPUP
   * ======================================================= */

  const showIncomingNotification = useCallback(notification => {
    if (!notification) {
      return;
    }

    if (incomingPopupTimerRef.current) {
      clearTimeout(incomingPopupTimerRef.current);
    }

    setIncomingNotification(notification);

    setIncomingPopupVisible(true);

    incomingPopupTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setIncomingPopupVisible(false);

        setIncomingNotification(null);
      }
    }, 5000);
  }, []);

  /* =======================================================
   * SOCKET NOTIFICATION
   * ======================================================= */

  const handleSocketNotification = useCallback(
    async rawNotification => {
      try {
        if (!rawNotification) {
          return;
        }

        const notification = normalizeNotification(rawNotification, 0);

        /*
         * Never bring back notification
         * deleted locally.
         */
        const deletedIds = await getStoredIdList(DELETED_NOTIFICATION_IDS_KEY);

        if (deletedIds.includes(String(notification.id))) {
          return;
        }

        const readIds = await getStoredIdList(READ_NOTIFICATION_IDS_KEY);

        const finalNotification = readIds.includes(String(notification.id))
          ? {
              ...notification,

              isRead: true,

              readAt: notification?.readAt ?? 'local-read',
            }
          : notification;

        setNotifications(current => {
          const exists = current.some(
            item => String(item.id) === String(finalNotification.id),
          );

          if (exists) {
            return current.map(item =>
              String(item.id) === String(finalNotification.id)
                ? {
                    ...item,

                    ...finalNotification,
                  }
                : item,
            );
          }

          return [finalNotification, ...current];
        });

        showIncomingNotification(finalNotification);
      } catch (socketError) {
        console.log('SOCKET NOTIFICATION ERROR:', socketError);
      }
    },
    [normalizeNotification, showIncomingNotification],
  );

  /* =======================================================
   * FETCH NOTIFICATIONS
   * ======================================================= */

  const fetchNotifications = useCallback(
    async (options = {}) => {
      const {
        isRefresh = false,

        silent = false,
      } = options;

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else if (!silent) {
          setLoading(true);
        }

        if (!silent) {
          setError(null);
        }

        const token = await AsyncStorage.getItem('token');

        if (!token) {
          setNotifications([]);

          await AsyncStorage.setItem(
            NOTIFICATION_UNREAD_COUNT_KEY,

            '0',
          );

          if (!silent) {
            setError('Please login to view your notifications.');
          }

          return;
        }

        const response = await fetch(
          `${NOTIFICATION_API}?_=${Date.now()}`,

          {
            method: 'GET',

            headers: {
              Accept: 'application/json',

              'Content-Type': 'application/json',

              Authorization: `Bearer ${token}`,

              'Cache-Control': 'no-cache',

              Pragma: 'no-cache',
            },
          },
        );

        const responseText = await response.text();

        let result = {};

        try {
          result = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
          throw new Error('Server returned an invalid response.');
        }

        if (!response.ok) {
          throw new Error(
            result?.message ||
              result?.error ||
              `Unable to fetch notifications. Status: ${response.status}`,
          );
        }

        const notificationData = extractNotificationArray(result);

        let normalized = notificationData.map((notification, index) =>
          normalizeNotification(notification, index),
        );

        /*
         * Shared local state.
         */
        const [storedReadIds, storedDeletedIds] = await Promise.all([
          getStoredIdList(READ_NOTIFICATION_IDS_KEY),

          getStoredIdList(DELETED_NOTIFICATION_IDS_KEY),
        ]);

        const readSet = new Set(storedReadIds.map(String));

        const deletedSet = new Set(storedDeletedIds.map(String));

        /*
         * Remove locally deleted.
         */
        normalized = normalized.filter(
          notification => !deletedSet.has(String(notification.id)),
        );

        /*
         * Apply locally read.
         */
        normalized = normalized.map(notification => {
          if (readSet.has(String(notification.id))) {
            return {
              ...notification,

              isRead: true,

              readAt: notification?.readAt ?? 'local-read',
            };
          }

          return notification;
        });

        /*
         * Latest first.
         */
        normalized.sort((first, second) => {
          const firstTime = first?.createdAt
            ? new Date(first.createdAt).getTime()
            : 0;

          const secondTime = second?.createdAt
            ? new Date(second.createdAt).getTime()
            : 0;

          return secondTime - firstTime;
        });

        setNotifications(normalized);

        /*
         * Save exactly what Home
         * should show.
         */
        const newUnreadCount = normalized.filter(item => !item.isRead).length;

        await AsyncStorage.setItem(
          NOTIFICATION_UNREAD_COUNT_KEY,

          String(newUnreadCount),
        );
      } catch (apiError) {
        console.log('NOTIFICATION FETCH ERROR:', apiError);

        if (!silent) {
          setError(apiError?.message || 'Unable to load notifications.');
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }

        setRefreshing(false);
      }
    },
    [normalizeNotification],
  );

  /* =======================================================
   * SOCKET
   * ======================================================= */

  const connectSocket = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        setSocketConnected(false);

        return;
      }

      if (socketRef.current) {
        socketRef.current.removeAllListeners();

        socketRef.current.disconnect();

        socketRef.current = null;
      }

      const socket = io(
        SOCKET_URL,

        {
          transports: ['websocket'],

          autoConnect: true,

          reconnection: true,

          reconnectionAttempts: Infinity,

          reconnectionDelay: 1000,

          reconnectionDelayMax: 5000,

          timeout: 10000,

          auth: {
            token,
          },

          extraHeaders: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      socketRef.current = socket;

      socket.on(
        'connect',

        () => {
          setSocketConnected(true);

          socket.emit('customer:subscribe');
        },
      );

      socket.on(
        'connect_error',

        socketError => {
          console.log('SOCKET CONNECTION ERROR:', socketError?.message);

          setSocketConnected(false);
        },
      );

      socket.on(
        'disconnect',

        () => {
          setSocketConnected(false);
        },
      );

      socket.io.on(
        'reconnect',

        () => {
          setSocketConnected(true);

          socket.emit('customer:subscribe');

          fetchNotifications({
            silent: true,
          });
        },
      );

      socket.on(
        SOCKET_NOTIFICATION_EVENT,

        data => {
          handleSocketNotification(data);
        },
      );

      socket.on(
        SOCKET_ORDER_STATUS_EVENT,

        data => {
          if (data?.title || data?.message || data?.body) {
            handleSocketNotification(data);
          } else {
            fetchNotifications({
              silent: true,
            });
          }
        },
      );

      socket.on(
        SOCKET_WEEKLY_INVOICE_EVENT,

        data => {
          if (data?.title || data?.message || data?.body) {
            handleSocketNotification(data);
          } else {
            fetchNotifications({
              silent: true,
            });
          }
        },
      );
    } catch (socketError) {
      console.log('CONNECT SOCKET ERROR:', socketError);

      setSocketConnected(false);
    }
  }, [fetchNotifications, handleSocketNotification]);

  /* =======================================================
   * INITIAL FETCH
   * ======================================================= */

  useEffect(() => {
    fetchNotifications({
      silent: false,
    });
  }, [fetchNotifications]);

  /* =======================================================
   * SOCKET LIFECYCLE
   * ======================================================= */

  useEffect(() => {
    mountedRef.current = true;

    connectSocket();

    return () => {
      mountedRef.current = false;

      if (incomingPopupTimerRef.current) {
        clearTimeout(incomingPopupTimerRef.current);

        incomingPopupTimerRef.current = null;
      }

      if (socketRef.current) {
        socketRef.current.removeAllListeners();

        socketRef.current.disconnect();

        socketRef.current = null;
      }
    };
  }, [connectSocket]);

  /* =======================================================
   * SCREEN FOCUS
   * ======================================================= */

  useFocusEffect(
    useCallback(() => {
      fetchNotifications({
        silent: true,
      });

      if (!socketRef.current?.connected) {
        connectSocket();
      }
    }, [connectSocket, fetchNotifications]),
  );

  /* =======================================================
   * DATE
   * ======================================================= */

  const formatDateTime = dateValue => {
    if (!dateValue) {
      return '';
    }

    try {
      const date = new Date(dateValue);

      if (Number.isNaN(date.getTime())) {
        return String(dateValue);
      }

      return date.toLocaleString(
        'en-AU',

        {
          day: '2-digit',

          month: 'short',

          year: 'numeric',

          hour: 'numeric',

          minute: '2-digit',
        },
      );
    } catch (dateError) {
      return '';
    }
  };

  /* =======================================================
   * UNREAD COUNT
   * ======================================================= */

  const unreadCount = useMemo(
    () => notifications.filter(item => !item.isRead).length,

    [notifications],
  );

  /* =======================================================
   * SYNC HOME BADGE
   *
   * Runs every time this page's unread count changes.
   * ======================================================= */

  useEffect(() => {
    const syncUnreadCount = async () => {
      try {
        await AsyncStorage.setItem(
          NOTIFICATION_UNREAD_COUNT_KEY,

          String(Math.max(0, unreadCount)),
        );
      } catch (countError) {
        console.log('SAVE UNREAD COUNT ERROR:', countError);
      }
    };

    syncUnreadCount();
  }, [unreadCount]);

  /* =======================================================
   * BACK
   * ======================================================= */

  const handleBack = async () => {
    /*
     * Explicitly save current count
     * before leaving the screen.
     */
    try {
      await AsyncStorage.setItem(
        NOTIFICATION_UNREAD_COUNT_KEY,

        String(Math.max(0, unreadCount)),
      );
    } catch (countError) {
      console.log('SYNC COUNT BEFORE BACK ERROR:', countError);
    }

    if (navigation.canGoBack()) {
      navigation.goBack();

      return;
    }

    navigation.navigate('MainTabs');
  };

  /* =======================================================
   * LOGIN
   * ======================================================= */

  const handleLogin = () => {
    navigation.navigate(
      'Login',

      {
        redirectTo: 'Notifications',
      },
    );
  };

  /* =======================================================
   * OPEN ONE NOTIFICATION
   * ======================================================= */

  const openNotification = async notification => {
    if (!notification) {
      return;
    }

    const updatedNotification = {
      ...notification,

      isRead: true,

      readAt: notification?.readAt ?? new Date().toISOString(),
    };

    setSelectedNotification(updatedNotification);

    setDetailPopupVisible(true);

    setNotifications(current =>
      current.map(item =>
        String(item.id) === String(notification.id)
          ? updatedNotification
          : item,
      ),
    );

    try {
      const storedReadIds = await getStoredIdList(READ_NOTIFICATION_IDS_KEY);

      const notificationId = String(notification.id);

      if (!storedReadIds.includes(notificationId)) {
        await saveStoredIdList(
          READ_NOTIFICATION_IDS_KEY,

          [...storedReadIds, notificationId],
        );
      }

      /*
       * Immediately update Home count.
       */
      const nextUnreadCount = Math.max(
        0,

        unreadCount - (notification.isRead ? 0 : 1),
      );

      await AsyncStorage.setItem(
        NOTIFICATION_UNREAD_COUNT_KEY,

        String(nextUnreadCount),
      );
    } catch (readError) {
      console.log('MARK NOTIFICATION READ ERROR:', readError);
    }
  };

  /* =======================================================
   * CLOSE DETAIL
   * ======================================================= */

  const closeDetailPopup = () => {
    setDetailPopupVisible(false);

    setSelectedNotification(null);
  };

  /* =======================================================
   * MARK ALL READ
   * ======================================================= */

  const handleMarkAllAsRead = async () => {
    if (markingAllRead || unreadCount === 0) {
      return;
    }

    try {
      setMarkingAllRead(true);

      const currentIds = notifications.map(notification =>
        String(notification.id),
      );

      const storedReadIds = await getStoredIdList(READ_NOTIFICATION_IDS_KEY);

      await saveStoredIdList(
        READ_NOTIFICATION_IDS_KEY,

        [...storedReadIds, ...currentIds],
      );

      /*
       * Critical:
       * Home badge becomes zero.
       */
      await AsyncStorage.setItem(
        NOTIFICATION_UNREAD_COUNT_KEY,

        '0',
      );

      const now = new Date().toISOString();

      setNotifications(current =>
        current.map(notification => ({
          ...notification,

          isRead: true,

          readAt: notification?.readAt ?? now,
        })),
      );

      setSelectedNotification(current =>
        current
          ? {
              ...current,

              isRead: true,

              readAt: current?.readAt ?? now,
            }
          : null,
      );
    } catch (markError) {
      console.log('MARK ALL READ ERROR:', markError);
    } finally {
      setMarkingAllRead(false);
    }
  };

  /* =======================================================
   * DELETE ALL PRESS
   * ======================================================= */

  const handleDeleteAllPress = () => {
    if (notifications.length === 0) {
      return;
    }

    setDeleteAllPopupVisible(true);
  };

  /* =======================================================
   * DELETE ALL
   * ======================================================= */

  const handleDeleteAll = async () => {
    if (deletingAll) {
      return;
    }

    try {
      setDeletingAll(true);

      const currentIds = notifications.map(notification =>
        String(notification.id),
      );

      /*
       * Store IDs as deleted.
       */
      const storedDeletedIds = await getStoredIdList(
        DELETED_NOTIFICATION_IDS_KEY,
      );

      await saveStoredIdList(
        DELETED_NOTIFICATION_IDS_KEY,

        [...storedDeletedIds, ...currentIds],
      );

      /*
       * Remove deleted IDs from
       * local read ID storage.
       */
      const storedReadIds = await getStoredIdList(READ_NOTIFICATION_IDS_KEY);

      const deletedSet = new Set(currentIds.map(String));

      const remainingReadIds = storedReadIds.filter(
        id => !deletedSet.has(String(id)),
      );

      await saveStoredIdList(
        READ_NOTIFICATION_IDS_KEY,

        remainingReadIds,
      );

      /*
       * THIS IS THE IMPORTANT FIX.
       *
       * Home gets 0 immediately.
       */
      await AsyncStorage.setItem(
        NOTIFICATION_UNREAD_COUNT_KEY,

        '0',
      );

      /*
       * Clear Notification UI.
       */
      setNotifications([]);

      setSelectedNotification(null);

      setDetailPopupVisible(false);

      setDeleteAllPopupVisible(false);

      setIncomingPopupVisible(false);

      setIncomingNotification(null);
    } catch (deleteError) {
      console.log('DELETE ALL ERROR:', deleteError);
    } finally {
      setDeletingAll(false);
    }
  };

  /* =======================================================
   * INCOMING ACTIONS
   * ======================================================= */

  const openIncomingNotification = () => {
    if (!incomingNotification) {
      return;
    }

    if (incomingPopupTimerRef.current) {
      clearTimeout(incomingPopupTimerRef.current);
    }

    setIncomingPopupVisible(false);

    openNotification(incomingNotification);

    setIncomingNotification(null);
  };

  const dismissIncomingPopup = () => {
    if (incomingPopupTimerRef.current) {
      clearTimeout(incomingPopupTimerRef.current);
    }

    setIncomingPopupVisible(false);

    setIncomingNotification(null);
  };

  /* =======================================================
   * RENDER NOTIFICATION
   * ======================================================= */

  const renderNotification = ({ item }) => (
    <Pressable
      onPress={() => openNotification(item)}
      style={({ pressed }) => [
        styles.notificationCard,

        !item.isRead && styles.unreadCard,

        pressed && styles.notificationCardPressed,
      ]}
    >
      <View
        style={[
          styles.iconContainer,

          !item.isRead && styles.unreadIconContainer,
        ]}
      >
        <Image
          source={require('../assets/login-icons/notification.png')}
          style={styles.notificationIcon}
          resizeMode="contain"
        />
      </View>

      <View style={styles.notificationContent}>
        <View style={styles.notificationTitleRow}>
          <Text numberOfLines={2} style={styles.notificationTitle}>
            {item.title}
          </Text>

          {!item.isRead && <View style={styles.unreadDot} />}
        </View>

        {!!item.message && (
          <Text numberOfLines={2} style={styles.notificationMessage}>
            {item.message}
          </Text>
        )}

        <View style={styles.notificationBottomRow}>
          {!!item.createdAt && (
            <Text style={styles.notificationTime}>
              {formatDateTime(item.createdAt)}
            </Text>
          )}

          <Text style={styles.readMoreText}>Read more</Text>
        </View>
      </View>
    </Pressable>
  );

  /* =======================================================
   * LOADING
   * ======================================================= */

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF8FD" />

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A00B0F" />

          <Text style={styles.loadingTitle}>Loading Notifications</Text>

          <Text style={styles.loadingDescription}>Please wait...</Text>
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

        {/* HEADER */}

        <View style={styles.header}>
          <Pressable
            hitSlop={10}
            onPress={handleBack}
            style={styles.backButton}
          >
            <Image
              source={require('../assets/login-icons/back.png')}
              style={styles.smallIcon}
              resizeMode="contain"
            />
          </Pressable>

          <View style={styles.headerTextContainer}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Notifications</Text>

              <View
                style={[
                  styles.socketStatus,

                  socketConnected
                    ? styles.socketConnected
                    : styles.socketDisconnected,
                ]}
              >
                <View
                  style={[
                    styles.socketDot,

                    socketConnected
                      ? styles.socketDotConnected
                      : styles.socketDotDisconnected,
                  ]}
                />

                <Text
                  style={[
                    styles.socketStatusText,

                    socketConnected
                      ? styles.socketConnectedText
                      : styles.socketDisconnectedText,
                  ]}
                >
                  {socketConnected ? 'LIVE' : 'OFFLINE'}
                </Text>
              </View>
            </View>

            <Text style={styles.headerSubtitle}>
              {unreadCount > 0
                ? `${unreadCount} unread notification${
                    unreadCount === 1 ? '' : 's'
                  }`
                : notifications.length > 0
                ? 'All notifications are read'
                : 'Stay updated with your orders'}
            </Text>
          </View>
        </View>

        {/* BULK ACTIONS */}

        {notifications.length > 0 && (
          <View style={styles.notificationActions}>
            {unreadCount > 0 && (
              <TouchableOpacity
                disabled={markingAllRead}
                activeOpacity={0.8}
                onPress={handleMarkAllAsRead}
                style={styles.markAllButton}
              >
                {markingAllRead ? (
                  <ActivityIndicator size="small" color="#A00B0F" />
                ) : (
                  <>
                    <Text style={styles.markAllIcon}>✓</Text>

                    <Text style={styles.markAllText}>Mark all as read</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              disabled={deletingAll}
              activeOpacity={0.8}
              onPress={handleDeleteAllPress}
              style={[
                styles.deleteAllButton,

                unreadCount === 0 && styles.deleteAllFullButton,
              ]}
            >
              <Text style={styles.deleteAllIcon}>×</Text>

              <Text style={styles.deleteAllText}>Delete all</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* LIST */}

        {!!error && notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Image
                source={require('../assets/login-icons/notification.png')}
                style={styles.emptyIcon}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.emptyTitle}>Notifications Unavailable</Text>

            <Text style={styles.emptyDescription}>{error}</Text>

            {error.toLowerCase().includes('login') ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleLogin}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>SIGN IN</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() =>
                  fetchNotifications({
                    silent: false,
                  })
                }
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>TRY AGAIN</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item, index) =>
              item?.id ? String(item.id) : String(index)
            }
            renderItem={renderNotification}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,

              notifications.length === 0 && styles.emptyListContent,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() =>
                  fetchNotifications({
                    isRefresh: true,
                  })
                }
                tintColor="#A00B0F"
                colors={['#A00B0F']}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <Image
                    source={require('../assets/login-icons/notification.png')}
                    style={styles.emptyIcon}
                    resizeMode="contain"
                  />
                </View>

                <Text style={styles.emptyTitle}>No Notifications</Text>

                <Text style={styles.emptyDescription}>
                  You don&apos;t have any notifications right now.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      {/* INCOMING */}

      <Modal
        visible={incomingPopupVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismissIncomingPopup}
      >
        <View pointerEvents="box-none" style={styles.incomingModalOverlay}>
          <Pressable
            onPress={openIncomingNotification}
            style={styles.incomingNotificationCard}
          >
            <View style={styles.incomingIconContainer}>
              <Image
                source={require('../assets/login-icons/notification.png')}
                style={styles.incomingIcon}
                resizeMode="contain"
              />
            </View>

            <View style={styles.incomingContent}>
              <View style={styles.incomingTopRow}>
                <Text style={styles.incomingAppName}>KP Cloud Kitchen</Text>

                <Text style={styles.incomingNow}>now</Text>
              </View>

              <Text numberOfLines={1} style={styles.incomingTitle}>
                {incomingNotification?.title}
              </Text>

              <Text numberOfLines={2} style={styles.incomingMessage}>
                {incomingNotification?.message}
              </Text>
            </View>

            <Pressable
              hitSlop={10}
              onPress={event => {
                event?.stopPropagation?.();

                dismissIncomingPopup();
              }}
              style={styles.incomingCloseButton}
            >
              <Text style={styles.incomingCloseText}>×</Text>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      {/* DELETE ALL */}

      <Modal
        visible={deleteAllPopupVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDeleteAllPopupVisible(false)}
      >
        <Pressable
          style={styles.deleteOverlay}
          onPress={() => setDeleteAllPopupVisible(false)}
        >
          <Pressable style={styles.deletePopupCard} onPress={() => {}}>
            <View style={styles.deletePopupIconOuter}>
              <View style={styles.deletePopupIconInner}>
                <Text style={styles.deletePopupIcon}>×</Text>
              </View>
            </View>

            <Text style={styles.deletePopupTitle}>
              Delete All Notifications?
            </Text>

            <Text style={styles.deletePopupDescription}>
              All current notifications will be removed from this device.
            </Text>

            <View style={styles.deletePopupButtons}>
              <TouchableOpacity
                disabled={deletingAll}
                activeOpacity={0.8}
                onPress={() => setDeleteAllPopupVisible(false)}
                style={styles.deleteCancelButton}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={deletingAll}
                activeOpacity={0.85}
                onPress={handleDeleteAll}
                style={[
                  styles.deleteConfirmButton,

                  deletingAll && styles.deleteButtonDisabled,
                ]}
              >
                {deletingAll ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteConfirmText}>Delete All</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* DETAIL */}

      <Modal
        visible={detailPopupVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeDetailPopup}
      >
        <Pressable style={styles.detailOverlay} onPress={closeDetailPopup}>
          <Pressable onPress={() => {}} style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <View style={styles.detailIconContainer}>
                <Image
                  source={require('../assets/login-icons/notification.png')}
                  style={styles.detailIcon}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.detailHeaderContent}>
                <Text style={styles.detailSmallTitle}>NOTIFICATION</Text>

                {!!selectedNotification?.createdAt && (
                  <Text style={styles.detailDate}>
                    {formatDateTime(selectedNotification.createdAt)}
                  </Text>
                )}
              </View>

              <Pressable
                hitSlop={10}
                onPress={closeDetailPopup}
                style={styles.detailCloseButton}
              >
                <Text style={styles.detailCloseText}>×</Text>
              </Pressable>
            </View>

            <View style={styles.detailDivider} />

            <Text style={styles.detailTitle}>
              {selectedNotification?.title}
            </Text>

            {!!selectedNotification?.message && (
              <Text style={styles.detailMessage}>
                {selectedNotification.message}
              </Text>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={closeDetailPopup}
              style={styles.detailDoneButton}
            >
              <Text style={styles.detailDoneText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

export default Notifications;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,

    backgroundColor: '#FAF8FD',
  },

  header: {
    minHeight: 76,

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 16,

    borderBottomWidth: 1,

    borderBottomColor: '#EEE9F2',

    backgroundColor: '#FAF8FD',
  },

  backButton: {
    width: 40,

    height: 40,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFFFFF',

    borderWidth: 1,

    borderColor: '#EEE9F2',

    borderRadius: 12,

    marginRight: 12,
  },

  smallIcon: {
    width: 20,

    height: 20,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitleRow: {
    flexDirection: 'row',

    alignItems: 'center',
  },

  headerTitle: {
    color: '#17121E',

    fontSize: 18,

    fontWeight: '900',
  },

  headerSubtitle: {
    color: '#97909E',

    fontSize: 10,

    lineHeight: 15,

    marginTop: 3,
  },

  socketStatus: {
    flexDirection: 'row',

    alignItems: 'center',

    borderRadius: 20,

    paddingHorizontal: 7,

    paddingVertical: 3,

    marginLeft: 9,
  },

  socketConnected: {
    backgroundColor: '#EAF7EE',
  },

  socketDisconnected: {
    backgroundColor: '#F7EFF0',
  },

  socketDot: {
    width: 5,

    height: 5,

    borderRadius: 3,

    marginRight: 4,
  },

  socketDotConnected: {
    backgroundColor: '#278850',
  },

  socketDotDisconnected: {
    backgroundColor: '#A9A0A4',
  },

  socketStatusText: {
    fontSize: 6.5,

    fontWeight: '900',

    letterSpacing: 0.4,
  },

  socketConnectedText: {
    color: '#278850',
  },

  socketDisconnectedText: {
    color: '#8B8085',
  },

  notificationActions: {
    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 16,

    paddingTop: 10,

    paddingBottom: 5,

    backgroundColor: '#FAF8FD',
  },

  markAllButton: {
    flex: 1,

    minHeight: 39,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF4F4',

    borderWidth: 1,

    borderColor: '#EECFD1',

    borderRadius: 11,

    marginRight: 5,

    paddingHorizontal: 10,
  },

  markAllIcon: {
    color: '#A00B0F',

    fontSize: 13,

    fontWeight: '900',

    marginRight: 6,
  },

  markAllText: {
    color: '#A00B0F',

    fontSize: 9,

    fontWeight: '900',
  },

  deleteAllButton: {
    flex: 1,

    minHeight: 39,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF2F2',

    borderWidth: 1,

    borderColor: '#F1D0D0',

    borderRadius: 11,

    marginLeft: 5,

    paddingHorizontal: 10,
  },

  deleteAllFullButton: {
    marginLeft: 0,
  },

  deleteAllIcon: {
    color: '#D34747',

    fontSize: 17,

    lineHeight: 17,

    fontWeight: '900',

    marginRight: 5,
  },

  deleteAllText: {
    color: '#D34747',

    fontSize: 9,

    fontWeight: '900',
  },

  listContent: {
    paddingHorizontal: 16,

    paddingTop: 14,

    paddingBottom: 120,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  notificationCard: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    backgroundColor: '#FFFFFF',

    borderWidth: 1,

    borderColor: '#EEE9F2',

    borderRadius: 17,

    padding: 14,

    marginBottom: 12,

    shadowColor: '#4A3B53',

    shadowOffset: {
      width: 0,

      height: 4,
    },

    shadowOpacity: 0.05,

    shadowRadius: 9,

    elevation: 2,
  },

  notificationCardPressed: {
    opacity: 0.8,

    transform: [
      {
        scale: 0.995,
      },
    ],
  },

  unreadCard: {
    borderColor: '#E9C9CA',

    backgroundColor: '#FFF9F9',
  },

  iconContainer: {
    width: 42,

    height: 42,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#F4EEF6',

    borderRadius: 13,

    marginRight: 12,
  },

  unreadIconContainer: {
    backgroundColor: '#FBEAEC',
  },

  notificationIcon: {
    width: 18,

    height: 18,

    tintColor: '#A00B0F',
  },

  notificationContent: {
    flex: 1,
  },

  notificationTitleRow: {
    flexDirection: 'row',

    alignItems: 'flex-start',
  },

  notificationTitle: {
    flex: 1,

    color: '#17121E',

    fontSize: 13,

    lineHeight: 18,

    fontWeight: '800',

    paddingRight: 8,
  },

  unreadDot: {
    width: 7,

    height: 7,

    backgroundColor: '#A00B0F',

    borderRadius: 4,

    marginTop: 5,
  },

  notificationMessage: {
    color: '#6F6773',

    fontSize: 10.5,

    lineHeight: 16,

    marginTop: 5,
  },

  notificationBottomRow: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginTop: 8,
  },

  notificationTime: {
    flex: 1,

    color: '#AAA1AE',

    fontSize: 8.5,

    fontWeight: '600',

    paddingRight: 8,
  },

  readMoreText: {
    color: '#A00B0F',

    fontSize: 8.5,

    fontWeight: '800',
  },

  loadingContainer: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 30,
  },

  loadingTitle: {
    color: '#17121E',

    fontSize: 16,

    fontWeight: '800',

    marginTop: 15,
  },

  loadingDescription: {
    color: '#97909E',

    fontSize: 11,

    marginTop: 6,
  },

  emptyContainer: {
    flex: 1,

    minHeight: 420,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 30,
  },

  emptyIconContainer: {
    width: 75,

    height: 75,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#F5EDF6',

    borderRadius: 38,
  },

  emptyIcon: {
    width: 30,

    height: 30,

    opacity: 0.55,

    tintColor: '#A00B0F',
  },

  emptyTitle: {
    color: '#17121E',

    fontSize: 17,

    fontWeight: '900',

    textAlign: 'center',

    marginTop: 17,
  },

  emptyDescription: {
    maxWidth: 300,

    color: '#8D8592',

    fontSize: 11,

    lineHeight: 17,

    textAlign: 'center',

    marginTop: 7,
  },

  primaryButton: {
    minWidth: 130,

    minHeight: 45,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#A00B0F',

    borderRadius: 11,

    paddingHorizontal: 22,

    marginTop: 20,
  },

  primaryButtonText: {
    color: '#FFFFFF',

    fontSize: 10,

    fontWeight: '800',

    letterSpacing: 0.4,
  },

  incomingModalOverlay: {
    flex: 1,

    justifyContent: 'flex-start',

    paddingTop: 48,

    paddingHorizontal: 12,

    backgroundColor: 'transparent',
  },

  incomingNotificationCard: {
    width: '100%',

    minHeight: 92,

    flexDirection: 'row',

    alignItems: 'flex-start',

    backgroundColor: '#FFFFFF',

    borderRadius: 18,

    padding: 12,

    borderWidth: 1,

    borderColor: '#EEE7EB',

    shadowColor: '#000000',

    shadowOffset: {
      width: 0,

      height: 8,
    },

    shadowOpacity: 0.2,

    shadowRadius: 14,

    elevation: 15,
  },

  incomingIconContainer: {
    width: 42,

    height: 42,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#F9E9EA',

    borderRadius: 12,

    marginRight: 10,
  },

  incomingIcon: {
    width: 20,

    height: 20,

    tintColor: '#A00B0F',
  },

  incomingContent: {
    flex: 1,

    minWidth: 0,

    paddingRight: 8,
  },

  incomingTopRow: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginBottom: 3,
  },

  incomingAppName: {
    color: '#7C7278',

    fontSize: 8,

    fontWeight: '800',

    textTransform: 'uppercase',

    letterSpacing: 0.5,
  },

  incomingNow: {
    color: '#AAA0A5',

    fontSize: 8,
  },

  incomingTitle: {
    color: '#21191D',

    fontSize: 12,

    lineHeight: 17,

    fontWeight: '900',
  },

  incomingMessage: {
    color: '#70666C',

    fontSize: 9.5,

    lineHeight: 14,

    marginTop: 2,
  },

  incomingCloseButton: {
    width: 28,

    height: 28,

    alignItems: 'center',

    justifyContent: 'center',
  },

  incomingCloseText: {
    color: '#92888D',

    fontSize: 21,

    lineHeight: 22,
  },

  deleteOverlay: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: 'rgba(22, 16, 20, 0.62)',

    paddingHorizontal: 22,
  },

  deletePopupCard: {
    width: '100%',

    maxWidth: 370,

    backgroundColor: '#FFFFFF',

    borderRadius: 24,

    alignItems: 'center',

    paddingHorizontal: 21,

    paddingTop: 26,

    paddingBottom: 20,

    elevation: 16,
  },

  deletePopupIconOuter: {
    width: 78,

    height: 78,

    borderRadius: 39,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FFF1F1',

    marginBottom: 15,
  },

  deletePopupIconInner: {
    width: 54,

    height: 54,

    borderRadius: 27,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#D94B4B',
  },

  deletePopupIcon: {
    color: '#FFFFFF',

    fontSize: 31,

    lineHeight: 32,

    fontWeight: '500',
  },

  deletePopupTitle: {
    color: '#21191D',

    fontSize: 18,

    fontWeight: '900',

    textAlign: 'center',
  },

  deletePopupDescription: {
    maxWidth: 285,

    color: '#7A7075',

    fontSize: 10,

    lineHeight: 16,

    textAlign: 'center',

    marginTop: 7,
  },

  deletePopupButtons: {
    width: '100%',

    flexDirection: 'row',

    marginTop: 20,
  },

  deleteCancelButton: {
    flex: 1,

    minHeight: 47,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#F7F4F5',

    borderWidth: 1,

    borderColor: '#E6DEE1',

    borderRadius: 12,

    marginRight: 5,
  },

  deleteCancelText: {
    color: '#70656B',

    fontSize: 10,

    fontWeight: '900',
  },

  deleteConfirmButton: {
    flex: 1,

    minHeight: 47,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#D34747',

    borderRadius: 12,

    marginLeft: 5,
  },

  deleteConfirmText: {
    color: '#FFFFFF',

    fontSize: 10,

    fontWeight: '900',
  },

  deleteButtonDisabled: {
    opacity: 0.6,
  },

  detailOverlay: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: 'rgba(22, 16, 20, 0.60)',

    paddingHorizontal: 20,
  },

  detailCard: {
    width: '100%',

    maxWidth: 390,

    maxHeight: '75%',

    backgroundColor: '#FFFFFF',

    borderRadius: 24,

    padding: 20,

    elevation: 18,
  },

  detailHeader: {
    flexDirection: 'row',

    alignItems: 'center',
  },

  detailIconContainer: {
    width: 46,

    height: 46,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#FAE9EA',

    borderRadius: 14,

    marginRight: 11,
  },

  detailIcon: {
    width: 21,

    height: 21,

    tintColor: '#A00B0F',
  },

  detailHeaderContent: {
    flex: 1,
  },

  detailSmallTitle: {
    color: '#A00B0F',

    fontSize: 8,

    fontWeight: '900',

    letterSpacing: 0.7,
  },

  detailDate: {
    color: '#94898F',

    fontSize: 8.5,

    lineHeight: 13,

    marginTop: 3,
  },

  detailCloseButton: {
    width: 34,

    height: 34,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#F7F4F5',

    borderRadius: 10,
  },

  detailCloseText: {
    color: '#756B70',

    fontSize: 23,

    lineHeight: 25,
  },

  detailDivider: {
    width: '100%',

    height: 1,

    backgroundColor: '#EEE8EA',

    marginVertical: 17,
  },

  detailTitle: {
    color: '#21191D',

    fontSize: 18,

    lineHeight: 25,

    fontWeight: '900',
  },

  detailMessage: {
    color: '#655B61',

    fontSize: 12,

    lineHeight: 20,

    marginTop: 10,
  },

  detailDoneButton: {
    width: '100%',

    minHeight: 48,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: '#A00B0F',

    borderRadius: 12,

    marginTop: 22,
  },

  detailDoneText: {
    color: '#FFFFFF',

    fontSize: 11,

    fontWeight: '900',
  },
});
