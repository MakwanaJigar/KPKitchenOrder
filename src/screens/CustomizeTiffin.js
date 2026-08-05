import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Ionicons from 'react-native-vector-icons/Ionicons';

const initialDishes = [
  {
    id: '1',
    name: 'Signature Dal Makhani',
    description: '24-hour slow cooked black lentils',
    icon: 'restaurant-outline',
  },
  {
    id: '2',
    name: 'Heritage Mix Veg',
    description: 'Seasonal farm-fresh vegetables',
    icon: 'leaf-outline',
  },
];

const CustomizeTiffin = ({ navigation }) => {
  const { width } = useWindowDimensions();

  const [dishes, setDishes] = useState(initialDishes);

  const responsive = useMemo(() => {
    const isTablet = width >= 768;

    return {
      isTablet,
      contentWidth: isTablet ? Math.min(width - 80, 700) : width,
      horizontalPadding: isTablet ? 28 : 16,
      heroHeight: isTablet ? 330 : undefined,
    };
  }, [width]);

  const removeDish = dishId => {
    setDishes(currentDishes =>
      currentDishes.filter(dish => dish.id !== dishId),
    );
  };

  const handleAddToCart = () => {
    const cartItem = {
      id: 'executive-thali',
      name: 'The Executive Thali',
      plan: 'Premium Plan',
      price: 18.5,
      dishes,
    };

    console.log('Added to cart:', cartItem);

    // Navigate to your cart screen when required:
    // navigation.navigate('Cart');
  };

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
                style={styles.passwordEyes}
              />
          </Pressable>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Customize Tiffin</Text>

            {/* <View style={styles.locationRow}>
              
              <Image
                source={require('../assets/login-icons/location.png')}
                style={styles.passwordEyes}
              />

              <Text numberOfLines={1} style={styles.locationText}>
                Melbourne, VIC
              </Text>
            </View> */}
          </View>

          <Pressable
            hitSlop={12}
            style={styles.headerIconButton}
            onPress={() => console.log('Notification pressed')}
          >
            {/* <Ionicons name="notifications-outline" size={20} color="#B94B10" /> */}
            <Image
                source={require('../assets/login-icons/notification.png')}
                style={styles.passwordEyes}
              />

            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Hero image */}

          <View
            style={[
              styles.heroContainer,
              responsive.heroHeight && {
                height: responsive.heroHeight,
              },
            ]}
          >
            <Image
              source={require('../assets/tiffin-2.png')}
              style={styles.heroImage}
              resizeMode="cover"
            />

            <View style={styles.heroOverlay} />

            <View style={styles.planBadge}>
              <Ionicons name="star" size={12} color="#FFFFFF" />

              <Text style={styles.planBadgeText}>Premium Plan</Text>
            </View>
          </View>

          <View
            style={[
              styles.content,
              {
                paddingHorizontal: responsive.horizontalPadding,
              },
            ]}
          >
            {/* Product introduction */}

            <View style={styles.introductionSection}>
              <Text style={styles.title}>The Executive Thali</Text>

              <Text style={styles.description}>
                A curator-selected journey through regional flavours, designed
                for the modern professional.
              </Text>
            </View>

            {/* Included dishes */}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Included Dishes</Text>

              <Text style={styles.sectionHelper}>Default Selection</Text>
            </View>

            <View style={styles.dishesContainer}>
              {dishes.length > 0 ? (
                dishes.map(dish => (
                  <View key={dish.id} style={styles.dishCard}>
                    <View style={styles.dishIconContainer}>
                      <Ionicons name={dish.icon} size={19} color="#B95B22" />
                    </View>

                    <View style={styles.dishTextContainer}>
                      <Text numberOfLines={1} style={styles.dishName}>
                        {dish.name}
                      </Text>

                      <Text numberOfLines={2} style={styles.dishDescription}>
                        {dish.description}
                      </Text>
                    </View>

                    <Pressable
                      hitSlop={10}
                      style={styles.removeButton}
                      onPress={() => removeDish(dish.id)}
                    >
                      {/* <Ionicons
                        name="close-circle-outline"
                        size={15}
                        color="#E04D46"
                      /> */}

                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  </View>
                ))
              ) : (
                <View style={styles.emptyDishesContainer}>
                  <Ionicons
                    name="restaurant-outline"
                    size={25}
                    color="#A49A95"
                  />

                  <Text style={styles.emptyDishesText}>No dishes selected</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Fixed bottom section */}

        <View
          style={[
            styles.bottomBar,
            {
              paddingHorizontal: responsive.horizontalPadding,
            },
          ]}
        >
          <View style={styles.priceContainer}>
            <Text style={styles.totalLabel}>TOTAL</Text>

            <Text style={styles.totalPrice}>$18.50</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.addToCartButton}
            // onPress={handleAddToCart}
            onPress={() => navigation.replace('Order')}
          >
            {/* <Ionicons name="cart" size={19} color="#FFFFFF" /> */}
            <Image
                source={require('../assets/login-icons/shopping-cart.png')}
                style={styles.passwordEyes}
              />

            <Text style={styles.addToCartText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default CustomizeTiffin;

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

  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 5,
    height: 5,
    backgroundColor: '#E14F29',
    borderRadius: 3,
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

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },

  locationText: {
    maxWidth: 180,
    color: '#82756F',
    fontSize: 10,
    marginLeft: 2,
  },

  scrollContent: {
    paddingBottom: 104,
  },

  heroContainer: {
    width: '100%',
    aspectRatio: 1.42,
    position: 'relative',
    backgroundColor: '#E5DCD4',
    overflow: 'hidden',
  },

  heroImage: {
    width: '100%',
    height: '100%',
  },

  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30, 18, 10, 0.08)',
  },

  planBadge: {
    position: 'absolute',
    top: 12,
    right: 13,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#A00B0F',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,

    shadowColor: '#54220A',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,

    elevation: 4,
  },

  planBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 5,
  },

  content: {
    paddingTop: 20,
    paddingBottom: 24,
  },

  introductionSection: {
    marginBottom: 23,
  },

  title: {
    color: '#15100D',
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
  },

  description: {
    color: '#755F55',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    maxWidth: 560,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },

  sectionTitle: {
    color: '#A00B0F',
    fontSize: 15,
    fontWeight: '800',
  },

  sectionHelper: {
    color: '#6F5A51',
    fontSize: 9,
    fontWeight: '600',
  },

  dishesContainer: {
    width: '100%',
  },

  dishCard: {
    width: '100%',
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E9E4',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,

    shadowColor: '#5B3A2A',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,

    elevation: 2,
  },

  dishIconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5EA',
    borderRadius: 12,
    marginRight: 11,
  },

  dishTextContainer: {
    flex: 1,
    paddingRight: 8,
  },

  dishName: {
    color: '#211914',
    fontSize: 12,
    fontWeight: '800',
  },

  dishDescription: {
    color: '#8A746A',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 3,
  },

  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },

  removeText: {
    color: '#A00B0F',
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 3,
  },

  emptyDishesContainer: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF7F4',
    borderWidth: 1,
    borderColor: '#EEE7E1',
    borderRadius: 16,
  },

  emptyDishesText: {
    color: '#8D817B',
    fontSize: 11,
    marginTop: 6,
  },

  bottomBar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 251, 0.98)',
    borderTopWidth: 1,
    borderTopColor: '#ECE4DE',
    paddingVertical: 12,

    shadowColor: '#4C3022',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.09,
    shadowRadius: 10,

    elevation: 12,
  },

  priceContainer: {
    minWidth: 74,
    marginRight: 14,
  },

  totalLabel: {
    color: '#8D7E77',
    fontSize: 9,
    fontWeight: '700',
  },

  totalPrice: {
    color: '#A00B0F',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 1,
  },

  addToCartButton: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A00B0F',
    borderRadius: 13,

    shadowColor: '#A00B0F',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,

    elevation: 5,
  },

  addToCartText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  passwordEyes: {
    width: 20,
    height: 20,
  },
});
