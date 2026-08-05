import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

const Order = ({ navigation }) => {
  const { width } = useWindowDimensions();

  const [quantity, setQuantity] = useState(1);
  const [orderNotes, setOrderNotes] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('applePay');

  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const checkScale = useRef(new Animated.Value(0)).current;

  const checkOpacity = useRef(new Animated.Value(0)).current;

  const popupScale = useRef(new Animated.Value(0.85)).current;

  const redirectTimer = useRef(null);
  const animationTimer = useRef(null);

  const unitPrice = 18.5;
  const addOns = 2;
  const deliveryFee = 4;
  const serviceTax = 1.25;

  const responsive = useMemo(() => {
    const isTablet = width >= 768;

    return {
      isTablet,

      contentWidth: isTablet ? Math.min(width - 80, 720) : width,

      horizontalPadding: isTablet ? 28 : 14,
    };
  }, [width]);

  const originalPrice = unitPrice * quantity;

  const totalAmount = originalPrice + addOns + deliveryFee + serviceTax;

  useEffect(() => {
    return () => {
      if (redirectTimer.current) {
        clearTimeout(redirectTimer.current);
      }

      if (animationTimer.current) {
        clearTimeout(animationTimer.current);
      }
    };
  }, []);

  const increaseQuantity = () => {
    setQuantity(currentQuantity => currentQuantity + 1);
  };

  const decreaseQuantity = () => {
    setQuantity(currentQuantity =>
      currentQuantity > 1 ? currentQuantity - 1 : 1,
    );
  };

  const removeItem = () => {
    Alert.alert('Remove Item', 'Are you sure you want to remove this item?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          console.log('Item removed');
        },
      },
    ]);
  };

  const redirectToHome = () => {
    setShowSuccessPopup(false);
    setIsPlacingOrder(false);

    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          params: {
            screen: 'Home',
          },
        },
      ],
    });
  };

  const runSuccessAnimation = () => {
    checkScale.setValue(0);
    checkOpacity.setValue(0);
    popupScale.setValue(0.85);

    Animated.parallel([
      Animated.spring(popupScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),

      Animated.timing(checkOpacity, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),

      Animated.spring(checkScale, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePlaceOrder = () => {
    if (isPlacingOrder) {
      return;
    }

    const orderData = {
      product: 'Premium Homestyle Tiffin',
      quantity,
      orderNotes,
      paymentMethod: selectedPayment,
      originalPrice,
      addOns,
      deliveryFee,
      serviceTax,
      totalAmount,
    };

    console.log('Order placed:', orderData);

    setIsPlacingOrder(true);
    setShowSuccessPopup(true);

    /*
     * Wait until Modal is mounted,
     * then start the check animation.
     */
    animationTimer.current = setTimeout(() => {
      runSuccessAnimation();
    }, 150);

    /*
     * Redirect to Home after popup is shown.
     */
    redirectTimer.current = setTimeout(() => {
      redirectToHome();
    }, 3000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View
        style={[
          styles.screenContainer,
          {
            width: responsive.contentWidth,
          },
        ]}
      >
        {/* Header */}

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
            onPress={() => navigation.replace('MainTabs')}
          >
            <Image
              source={require('../assets/login-icons/back.png')}
              style={styles.headerIcon}
              resizeMode="contain"
            />
          </Pressable>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Cart Summary</Text>

            <Text numberOfLines={1} style={styles.headerLocation}>
              Melbourne, VIC
            </Text>
          </View>

          <Pressable hitSlop={12} style={styles.headerButton}>
            <Image
              source={require('../assets/login-icons/notification.png')}
              style={styles.headerIcon}
              resizeMode="contain"
            />

            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: responsive.horizontalPadding,
            },
          ]}
        >
          {/* Product card */}

          <View
            style={[
              styles.sectionCard,
              responsive.isTablet && styles.tabletProductCard,
            ]}
          >
            <Image
              source={require('../assets/tiffin-2.png')}
              resizeMode="cover"
              style={styles.productImage}
            />

            <View style={styles.productDetails}>
              <View style={styles.productTitleRow}>
                <Text numberOfLines={2} style={styles.productName}>
                  Premium Homestyle Tiffin
                </Text>

                <Text style={styles.productPrice}>${unitPrice.toFixed(2)}</Text>
              </View>

              <Text style={styles.deliveryText}>Delivery: Wed, 01 Jul</Text>

              <View style={styles.productTags}>
                <View style={styles.tag}>
                  <Image
                    source={require('../assets/login-icons/time-left.png')}
                    style={styles.smallIcon}
                    resizeMode="contain"
                  />

                  <Text style={styles.tagText}>25–30 mins</Text>
                </View>
              </View>

              <View style={styles.productActions}>
                <View style={styles.quantityContainer}>
                  <Pressable
                    hitSlop={8}
                    style={styles.quantityButton}
                    onPress={decreaseQuantity}
                  >
                    <Image
                      source={require('../assets/login-icons/minus.png')}
                      style={styles.smallIcon}
                      resizeMode="contain"
                    />
                  </Pressable>

                  <Text style={styles.quantityText}>{quantity}</Text>

                  <Pressable
                    hitSlop={8}
                    style={styles.quantityButton}
                    onPress={increaseQuantity}
                  >
                    <Image
                      source={require('../assets/login-icons/add.png')}
                      style={styles.smallIcon}
                      resizeMode="contain"
                    />
                  </Pressable>
                </View>

                <Pressable
                  hitSlop={10}
                  style={styles.removeButton}
                  onPress={removeItem}
                >
                  {/* <Ionicons
                    name="trash-outline"
                    size={14}
                    color="#DF4D4D"
                  /> */}

                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Order notes */}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Order Notes</Text>

            <TextInput
              value={orderNotes}
              onChangeText={setOrderNotes}
              placeholder="Add any special instructions..."
              placeholderTextColor="#A39EAA"
              multiline
              textAlignVertical="top"
              maxLength={250}
              style={styles.notesInput}
            />

            <View style={styles.noteInformation}>
              <Ionicons
                name="information-circle-outline"
                size={17}
                color="#5272C7"
              />

              <Text style={styles.noteInformationText}>
                Orders placed before 11:30 AM are eligible for same-day
                delivery. Weekly subscriptions get free delivery.
              </Text>
            </View>
          </View>

          {/* Delivery address */}

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Image
                  source={require('../assets/login-icons/location.png')}
                  style={styles.smallIcon}
                  resizeMode="contain"
                />

                <Text style={styles.sectionTitle}>Delivery Address</Text>
              </View>

              <Pressable
                hitSlop={10}
                onPress={() => navigation.navigate('Address')}
              >
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.addressCard}
              onPress={() => navigation.navigate('Address')}
            >
              <View style={styles.addressIcon}>
                <Image
                  source={require('../assets/login-icons/home.png')}
                  style={styles.addressHomeIcon}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.addressDetails}>
                <Text style={styles.addressType}>Home</Text>

                <Text style={styles.addressText}>
                  123 Baker Street, Melbourne
                </Text>

                <Text style={styles.addressText}>VIC 3000</Text>

                <Text style={styles.addressPhone}>Phone: +61 400 000 000</Text>
              </View>

              <Image
                source={require('../assets/login-icons/edit.png')}
                style={styles.smallIcon}
                resizeMode="contain"
              />
            </Pressable>
          </View>

          {/* Payment method */}

          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="card-outline" size={17} color="#6252A1" />

              <Text style={styles.sectionTitle}>Payment Method</Text>
            </View>

            <PaymentOption
              title="Apple Pay"
              subtitle="Visa ending in 4242"
              icon="logo-apple"
              selected={selectedPayment === 'applePay'}
              onPress={() => setSelectedPayment('applePay')}
            />

            <PaymentOption
              title="Credit Card"
              subtitle="Mastercard ending in 8391"
              icon="card-outline"
              selected={selectedPayment === 'card'}
              onPress={() => setSelectedPayment('card')}
            />
          </View>

          {/* Bill summary */}

          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="receipt-outline" size={17} color="#6252A1" />

              <Text style={styles.sectionTitle}>Bill Summary</Text>
            </View>

            <BillRow
              label="Original Price"
              value={`$${originalPrice.toFixed(2)}`}
            />

            <BillRow
              label="Add-ons (Extra Roti)"
              value={`$${addOns.toFixed(2)}`}
            />

            <BillRow
              label="Delivery Fee"
              value={`$${deliveryFee.toFixed(2)}`}
            />

            <BillRow label="Service Tax" value={`$${serviceTax.toFixed(2)}`} />

            <View style={styles.billDivider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>

              <Text style={styles.totalAmount}>${totalAmount.toFixed(2)}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Place Order button */}

        <View
          style={[
            styles.bottomBar,
            {
              paddingHorizontal: responsive.horizontalPadding,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isPlacingOrder}
            style={[
              styles.placeOrderButton,
              isPlacingOrder && styles.placeOrderButtonDisabled,
            ]}
            onPress={handlePlaceOrder}
          >
            <Text style={styles.placeOrderText}>
              {isPlacingOrder ? 'Placing Order...' : 'Place Order'}
            </Text>

            {!isPlacingOrder && (
              <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Success popup */}

      <Modal
        visible={showSuccessPopup}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        presentationStyle="overFullScreen"
        hardwareAccelerated={true}
        onRequestClose={() => {}}
      >
        <View style={styles.successPopupOverlay}>
          <Animated.View
            style={[
              styles.successPopupCard,
              {
                transform: [
                  {
                    scale: popupScale,
                  },
                ],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.successCircleOuter,
                {
                  opacity: checkOpacity,
                  transform: [
                    {
                      scale: checkScale,
                    },
                  ],
                },
              ]}
            >
              <View style={styles.successCircleInner}>
                {/* <Ionicons
                  name="checkmark"
                  size={52}
                  color="#FFFFFF"
                /> */}
                <Image
                  source={require('../assets/login-icons/mark.png')}
                  style={styles.gif}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>

            <Text style={styles.successPopupTitle}>
              Order Placed Successfully!
            </Text>

            <Text style={styles.successPopupDescription}>
              Your order has been confirmed and is now being prepared.
            </Text>

            <View style={styles.orderConfirmedBadge}>
              <Ionicons
                name="checkmark-circle-outline"
                size={17}
                color="#178A58"
              />

              <Text style={styles.orderConfirmedText}>Order confirmed</Text>
            </View>

            <View style={styles.preparingOrderBox}>
              <View style={styles.preparingOrderIcon}>
                <Ionicons name="restaurant-outline" size={18} color="#A00B0F" />
              </View>

              <View style={styles.preparingOrderContent}>
                <Text style={styles.preparingOrderTitle}>
                  Preparing your meal
                </Text>

                <Text style={styles.preparingOrderDescription}>
                  Estimated time: 25–30 minutes
                </Text>
              </View>
            </View>

            <Text style={styles.redirectText}>Redirecting to Home...</Text>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const PaymentOption = ({ title, subtitle, icon, selected, onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.paymentOption, selected && styles.selectedPaymentOption]}
    >
      <View style={styles.paymentIconContainer}>
        <Ionicons name={icon} size={18} color="#282130" />
      </View>

      <View style={styles.paymentDetails}>
        <Text style={styles.paymentTitle}>{title}</Text>

        <Text style={styles.paymentSubtitle}>{subtitle}</Text>
      </View>

      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
    </Pressable>
  );
};

const BillRow = ({ label, value }) => {
  return (
    <View style={styles.billRow}>
      <Text style={styles.billLabel}>{label}</Text>

      <Text style={styles.billValue}>{value}</Text>
    </View>
  );
};

export default Order;

const styles = StyleSheet.create({
    gif: {
    width: 80,
    height: 80,
  },

  safeArea: {
    flex: 1,
    backgroundColor: '#F1EEF5',
  },

  screenContainer: {
    flex: 1,
    alignSelf: 'center',
    backgroundColor: '#F8F6FA',
  },

  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECE8F0',
  },

  headerButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },

  headerIconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F2',
    borderRadius: 19,
  },

  headerIcon: {
    width: 20,
    height: 20,
  },

  headerTitleContainer: {
    flex: 1,
    alignItems: 'flex-start',
    paddingHorizontal: 8,
  },

  headerTitle: {
    color: '#241D2B',
    fontSize: 16,
    fontWeight: '800',
  },

  headerLocation: {
    color: '#7D7483',
    fontSize: 10,
    marginTop: 2,
  },

  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 5,
    height: 5,
    backgroundColor: '#F05B39',
    borderRadius: 3,
  },

  scrollContent: {
    paddingTop: 13,
    paddingBottom: 105,
  },

  sectionCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE8F1',
    borderRadius: 15,
    padding: 12,
    marginBottom: 12,

    shadowColor: '#3C3044',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,

    elevation: 2,
  },

  tabletProductCard: {
    padding: 16,
  },

  productImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#EEE8E3',
  },

  productDetails: {
    flex: 1,
    marginTop: 11,
  },

  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  productName: {
    flex: 1,
    color: '#201827',
    fontSize: 14,
    fontWeight: '800',
    paddingRight: 12,
  },

  productPrice: {
    color: '#1E1725',
    fontSize: 13,
    fontWeight: '800',
  },

  deliveryText: {
    color: '#756B7C',
    fontSize: 10,
    marginTop: 4,
  },

  productTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 9,
  },

  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F1F8',
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 5,
  },

  tagText: {
    color: '#6E6574',
    fontSize: 8,
    fontWeight: '600',
    marginLeft: 4,
  },

  smallIcon: {
    width: 13,
    height: 13,
  },

  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 9,
  },

  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F3FA',
    borderRadius: 20,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },

  quantityButton: {
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },

  quantityText: {
    minWidth: 28,
    color: '#33273E',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },

  removeText: {
    color: '#DF4D4D',
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 4,
  },

  sectionTitle: {
    color: '#2A2230',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 5,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  changeText: {
    color: '#6B50A2',
    fontSize: 10,
    fontWeight: '700',
  },

  notesInput: {
    width: '100%',
    minHeight: 82,
    color: '#29212F',
    fontSize: 11,
    lineHeight: 16,
    backgroundColor: '#FAF8FC',
    borderWidth: 1,
    borderColor: '#E6E0EB',
    borderRadius: 11,
    padding: 11,
  },

  noteInformation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F1F5FF',
    borderRadius: 10,
    padding: 10,
    marginTop: 9,
  },

  noteInformationText: {
    flex: 1,
    color: '#60709A',
    fontSize: 9,
    lineHeight: 14,
    marginLeft: 7,
  },

  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9FC',
    borderWidth: 1,
    borderColor: '#DCD5E4',
    borderRadius: 12,
    padding: 11,
  },

  addressIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D2432',
    borderRadius: 18,
    marginRight: 10,
  },

  addressHomeIcon: {
    width: 17,
    height: 17,
  },

  addressDetails: {
    flex: 1,
  },

  addressType: {
    color: '#28202E',
    fontSize: 11,
    fontWeight: '800',
  },

  addressText: {
    color: '#766D7B',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 1,
  },

  addressPhone: {
    color: '#514858',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
  },

  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E1EA',
    borderRadius: 11,
    paddingHorizontal: 10,
    marginBottom: 8,
  },

  selectedPaymentOption: {
    borderColor: '#3B3242',
    backgroundColor: '#FCFBFD',
  },

  paymentIconContainer: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F1F6',
    borderRadius: 9,
    marginRight: 10,
  },

  paymentDetails: {
    flex: 1,
  },

  paymentTitle: {
    color: '#2D2533',
    fontSize: 11,
    fontWeight: '700',
  },

  paymentSubtitle: {
    color: '#8B828F',
    fontSize: 8,
    marginTop: 2,
  },

  radioOuter: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#9E97A3',
    borderRadius: 9,
  },

  radioOuterSelected: {
    borderColor: '#27202D',
  },

  radioInner: {
    width: 9,
    height: 9,
    backgroundColor: '#27202D',
    borderRadius: 5,
  },

  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },

  billLabel: {
    color: '#817985',
    fontSize: 10,
  },

  billValue: {
    color: '#4A414F',
    fontSize: 10,
    fontWeight: '600',
  },

  billDivider: {
    height: 1,
    backgroundColor: '#ECE8EF',
    marginVertical: 8,
  },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  totalLabel: {
    color: '#211A27',
    fontSize: 12,
    fontWeight: '800',
  },

  totalAmount: {
    color: '#19131E',
    fontSize: 16,
    fontWeight: '900',
  },

  bottomBar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    minHeight: 78,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopWidth: 1,
    borderTopColor: '#E5E0E8',
    paddingVertical: 11,

    shadowColor: '#332A38',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 10,

    elevation: 12,
  },

  placeOrderButton: {
    width: '100%',
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A00B0F',
    borderRadius: 11,
  },

  placeOrderButtonDisabled: {
    opacity: 0.65,
  },

  placeOrderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 7,
  },

  successPopupOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 12, 17, 0.72)',
    paddingHorizontal: 22,
  },

  successPopupCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingHorizontal: 23,
    paddingTop: 34,
    paddingBottom: 27,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 14,
    },
    shadowOpacity: 0.3,
    shadowRadius: 24,

    elevation: 30,
  },

  successCircleOuter: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DDF7E9',
    borderRadius: 54,
    marginBottom: 22,
  },

  successCircleInner: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor: '#20A66A',
    borderRadius: 40,

    shadowColor: '#20A66A',
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.35,
    shadowRadius: 13,

    elevation: 9,
  },

  successPopupTitle: {
    color: '#18121C',
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'center',
  },

  successPopupDescription: {
    maxWidth: 285,
    color: '#77707D',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 9,
  },

  orderConfirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF9F2',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginTop: 18,
  },

  orderConfirmedText: {
    color: '#178A58',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 5,
  },

  preparingOrderBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#F3E1DE',
    borderRadius: 14,
    padding: 11,
    marginTop: 18,
  },

  preparingOrderIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCE6E3',
    borderRadius: 11,
    marginRight: 10,
  },

  preparingOrderContent: {
    flex: 1,
  },

  preparingOrderTitle: {
    color: '#2E2228',
    fontSize: 11,
    fontWeight: '800',
  },

  preparingOrderDescription: {
    color: '#8A7E84',
    fontSize: 9,
    marginTop: 3,
  },

  redirectText: {
    color: '#989099',
    fontSize: 10,
    marginTop: 20,
  },
});
