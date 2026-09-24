import React, { useEffect, useRef, useState } from 'react';

import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

/* =========================================================
 * APP ALERT
 * =========================================================
 *
 * Drop-in replacement for React Native's Alert.alert
 * using the KP Kitchen theme.
 *
 * Usage (same signature as Alert.alert):
 *
 * AppAlert.alert(title, message, buttons, options);
 *
 * buttons: [{ text, style: 'default' | 'cancel' | 'destructive', onPress }]
 * options: { cancelable, onDismiss, type: 'success' | 'error' | 'warning' | 'info' }
 *
 * <AppAlertHost /> must be mounted once at the app root.
 * ========================================================= */

/* =========================================================
 * THEME
 * ========================================================= */

const COLORS = {
  primary: '#A00B0F',
  background: '#FFF9F4',
  card: '#FFFFFF',
  title: '#172A46',
  message: '#5F6B7A',
  border: '#EFE4DA',
  overlay: 'rgba(23, 42, 70, 0.55)',
};

const TYPE_STYLES = {
  success: { color: '#23834B', tint: '#E7F5EC', symbol: '✓' },
  error: { color: '#A00B0F', tint: '#FBE9E9', symbol: '✕' },
  warning: { color: '#D98A00', tint: '#FFF4DE', symbol: '!' },
  info: { color: '#172A46', tint: '#E8EDF4', symbol: 'i' },
};

/* =========================================================
 * TYPE DETECTION
 * =========================================================
 *
 * Picks an icon from the title when no type is given.
 * ========================================================= */

const detectType = (title = '', buttons = []) => {
  const text = String(title).toLowerCase();

  if (/success|successful|placed|updated|saved|sent|verified|done|added|created|welcome/.test(text)) {
    return 'success';
  }

  if (/fail|error|invalid|unable|denied|expired|mismatch|wrong/.test(text)) {
    return 'error';
  }

  if (
    /delete|remove|logout|log out|cancel|sure|confirm|required|missing|warning|default/.test(text) ||
    buttons.some(button => button?.style === 'destructive')
  ) {
    return 'warning';
  }

  return 'info';
};

/* =========================================================
 * GLOBAL QUEUE
 * ========================================================= */

let hostListener = null;

const pendingQueue = [];

let nextId = 1;

export const AppAlert = {
  alert: (title, message, buttons, options = {}) => {
    const config = {
      id: nextId++,
      title: title ?? '',
      message: message ?? '',
      buttons:
        Array.isArray(buttons) && buttons.length > 0
          ? buttons
          : [{ text: 'OK' }],
      options: options || {},
    };

    if (hostListener) {
      hostListener(config);
    } else {
      /*
       * Host not mounted yet — show once it mounts.
       */
      pendingQueue.push(config);
    }
  },
};

/* =========================================================
 * HOST
 * ========================================================= */

export const AppAlertHost = () => {
  const { width } = useWindowDimensions();

  const [queue, setQueue] = useState([]);

  const scale = useRef(new Animated.Value(0.9)).current;

  const opacity = useRef(new Animated.Value(0)).current;

  const current = queue[0];

  /* =======================================================
   * REGISTER LISTENER
   * ======================================================= */

  useEffect(() => {
    hostListener = config => {
      setQueue(previousQueue => [...previousQueue, config]);
    };

    if (pendingQueue.length > 0) {
      setQueue(previousQueue => [
        ...previousQueue,
        ...pendingQueue.splice(0),
      ]);
    }

    return () => {
      hostListener = null;
    };
  }, []);

  /* =======================================================
   * ENTRY ANIMATION
   * ======================================================= */

  useEffect(() => {
    if (!current) {
      return;
    }

    scale.setValue(0.9);

    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),

      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [current, scale, opacity]);

  if (!current) {
    return null;
  }

  const { title, message, buttons, options } = current;

  const type = TYPE_STYLES[options.type] ? options.type : detectType(title, buttons);

  const typeStyle = TYPE_STYLES[type];

  const cardWidth = Math.min(width - 48, 360);

  /*
   * Cancel button on the left, others after it.
   */
  const orderedButtons = [
    ...buttons.filter(button => button?.style === 'cancel'),
    ...buttons.filter(button => button?.style !== 'cancel'),
  ];

  const stackVertically = orderedButtons.length > 2;

  /* =======================================================
   * CLOSE
   * ======================================================= */

  const closeCurrent = () => {
    setQueue(previousQueue => previousQueue.slice(1));
  };

  const handleButtonPress = button => {
    closeCurrent();

    /*
     * Run after the modal closes so callbacks that
     * navigate or open another alert behave correctly.
     */
    setTimeout(() => {
      button?.onPress?.();
    }, 50);
  };

  const handleBackdropPress = () => {
    if (!options.cancelable) {
      return;
    }

    closeCurrent();

    setTimeout(() => {
      options.onDismiss?.();
    }, 50);
  };

  /*
   * Android back button: behave like the cancel
   * button when there is one, otherwise like OK
   * for single-button alerts.
   */
  const handleRequestClose = () => {
    const cancelButton = buttons.find(button => button?.style === 'cancel');

    if (cancelButton) {
      handleButtonPress(cancelButton);
    } else if (buttons.length === 1) {
      handleButtonPress(buttons[0]);
    } else if (options.cancelable) {
      handleBackdropPress();
    }
  };

  /* =======================================================
   * UI
   * ======================================================= */

  return (
    <Modal
      key={current.id}
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleRequestClose}
    >
      <Pressable style={styles.overlay} onPress={handleBackdropPress}>
        <Animated.View
          style={[
            styles.card,
            {
              width: cardWidth,
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          {/* Stop backdrop press inside the card */}
          <Pressable>
            <View style={[styles.accentBar, { backgroundColor: typeStyle.color }]} />

            <View style={styles.body}>
              <View style={[styles.iconOuter, { backgroundColor: typeStyle.tint }]}>
                <View style={[styles.iconInner, { backgroundColor: typeStyle.color }]}>
                  <Text style={styles.iconSymbol}>{typeStyle.symbol}</Text>
                </View>
              </View>

              {!!title && <Text style={styles.title}>{title}</Text>}

              {!!message && <Text style={styles.message}>{message}</Text>}

              <View
                style={[
                  styles.buttonRow,
                  stackVertically && styles.buttonColumn,
                ]}
              >
                {orderedButtons.map((button, index) => {
                  const isCancel = button?.style === 'cancel';

                  const isDestructive = button?.style === 'destructive';

                  return (
                    <TouchableOpacity
                      key={`${button?.text ?? 'button'}-${index}`}
                      activeOpacity={0.85}
                      onPress={() => handleButtonPress(button)}
                      style={[
                        styles.button,
                        stackVertically ? styles.buttonFull : styles.buttonFlex,
                        !stackVertically && index > 0 && styles.buttonGap,
                        stackVertically && index > 0 && styles.buttonStackGap,
                        isCancel ? styles.buttonCancel : styles.buttonPrimary,
                        isDestructive && styles.buttonDestructive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          isCancel ? styles.buttonCancelText : styles.buttonPrimaryText,
                        ]}
                        numberOfLines={1}
                      >
                        {button?.text ?? 'OK'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

export default AppAlert;

/* =========================================================
 * STYLES
 * ========================================================= */

const styles = StyleSheet.create({
  overlay: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: COLORS.overlay,

    paddingHorizontal: 24,
  },

  card: {
    backgroundColor: COLORS.card,

    borderRadius: 22,

    overflow: 'hidden',

    shadowColor: '#000000',

    shadowOffset: {
      width: 0,

      height: 10,
    },

    shadowOpacity: 0.2,

    shadowRadius: 20,

    elevation: 12,
  },

  accentBar: {
    height: 5,

    width: '100%',
  },

  body: {
    alignItems: 'center',

    paddingHorizontal: 22,

    paddingTop: 22,

    paddingBottom: 20,

    backgroundColor: COLORS.card,
  },

  /* =====================================================
   * ICON
   * ===================================================== */

  iconOuter: {
    width: 68,

    height: 68,

    borderRadius: 34,

    alignItems: 'center',

    justifyContent: 'center',

    marginBottom: 14,
  },

  iconInner: {
    width: 44,

    height: 44,

    borderRadius: 22,

    alignItems: 'center',

    justifyContent: 'center',
  },

  iconSymbol: {
    color: '#FFFFFF',

    fontSize: 22,

    fontWeight: '900',
  },

  /* =====================================================
   * TEXT
   * ===================================================== */

  title: {
    color: COLORS.title,

    fontSize: 18,

    fontWeight: '800',

    textAlign: 'center',

    marginBottom: 6,
  },

  message: {
    color: COLORS.message,

    fontSize: 14,

    lineHeight: 20,

    textAlign: 'center',
  },

  /* =====================================================
   * BUTTONS
   * ===================================================== */

  buttonRow: {
    flexDirection: 'row',

    width: '100%',

    marginTop: 20,
  },

  buttonColumn: {
    flexDirection: 'column',
  },

  button: {
    minHeight: 46,

    borderRadius: 12,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 12,
  },

  buttonFlex: {
    flex: 1,
  },

  buttonFull: {
    width: '100%',
  },

  buttonGap: {
    marginLeft: 10,
  },

  buttonStackGap: {
    marginTop: 10,
  },

  buttonPrimary: {
    backgroundColor: COLORS.primary,
  },

  buttonDestructive: {
    backgroundColor: '#C62828',
  },

  buttonCancel: {
    backgroundColor: COLORS.background,

    borderWidth: 1,

    borderColor: COLORS.border,
  },

  buttonText: {
    fontSize: 14,

    fontWeight: '800',
  },

  buttonPrimaryText: {
    color: '#FFFFFF',
  },

  buttonCancelText: {
    color: COLORS.title,
  },
});
