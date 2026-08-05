import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Ionicons from 'react-native-vector-icons/Ionicons';

const dateOptions = [
  {
    id: '1',
    label: 'TODAY',
    day: '24',
    month: 'JUL',
  },
  {
    id: '2',
    label: 'MON',
    day: '25',
    month: 'JUL',
  },
  {
    id: '3',
    label: 'TUE',
    day: '26',
    month: 'JUL',
  },
  {
    id: '4',
    label: 'WED',
    day: '27',
    month: 'JUL',
  },
  {
    id: '5',
    label: 'THU',
    day: '28',
    month: 'JUL',
  },
];

const mealData = [
  {
    id: '1',
    name: 'Zesty Quinoa Power Bowl',
    price: '$14.50',
    description:
      'Nutritious seasonal vegetables, protein-rich quinoa and fresh greens.',
    image: require('../assets/tiffin-1.png'),
    foodType: 'VEGETARIAN',
    category: 'Lunch',
    calories: '420 kcal',
    preparationTime: '15 min',
    available: true,
    // favourite: false,
  },
  {
    id: '2',
    name: 'Smoked Brisket Brioche',
    price: '$18.90',
    description:
      'Slow-cooked smoked premium beef, pickled red onion and house-made sauce.',
    image: require('../assets/tiffin-2.png'),
    foodType: 'NON-VEG',
    category: 'Lunch',
    calories: '650 kcal',
    preparationTime: '20 min',
    available: true,
    // favourite: true,
  },
  {
    id: '3',
    name: 'Atlantic Pan-Seared Salmon',
    price: '$22.00',
    description:
      'Pan-seared salmon served with seasonal vegetables and creamy sauce.',
    image: require('../assets/tiffin-3.png'),
    foodType: 'NON-VEG',
    category: 'Dinner',
    calories: '570 kcal',
    preparationTime: '25 min',
    available: true,
    // favourite: false,
  },
  {
    id: '3',
    name: 'Atlantic Pan-Seared Salmon',
    price: '$22.00',
    description:
      'Pan-seared salmon served with seasonal vegetables and creamy sauce.',
    image: require('../assets/tiffin-3.png'),
    foodType: 'NON-VEG',
    category: 'Dinner',
    calories: '570 kcal',
    preparationTime: '25 min',
    available: true,
    // favourite: false,
  },
];

const Home = ({ navigation }) => {
  const { width } = useWindowDimensions();

  // const [selectedDate, setSelectedDate] = useState('1');
  const [meals, setMeals] = useState(mealData);

  const layout = useMemo(() => {
    const isTablet = width >= 768;

    return {
      isTablet,
      pageWidth: isTablet ? Math.min(width - 64, 900) : width,
      horizontalPadding: isTablet ? 28 : 16,
      cardColumns: isTablet ? 2 : 1,
    };
  }, [width]);

  // const toggleFavourite = mealId => {
  //   setMeals(currentMeals =>
  //     currentMeals.map(meal =>
  //       meal.id === mealId
  //         ? {
  //             ...meal,
  //             favourite: !meal.favourite,
  //           }
  //         : meal,
  //     ),
  //   );
  // };

  const handleOrder = meal => {
    if (!meal.available) {
      return;
    }

    console.log('Order selected:', meal);
  };

  // const renderDateItem = ({item}) => {
  //   const isSelected = selectedDate === item.id;

  //   return (
  //     <Pressable
  //       onPress={() => setSelectedDate(item.id)}
  //       style={[
  //         styles.dateCard,
  //         isSelected && styles.selectedDateCard,
  //       ]}>
  //       <Text
  //         style={[
  //           styles.dateLabel,
  //           isSelected && styles.selectedDateText,
  //         ]}>
  //         {item.label}
  //       </Text>

  //       <Text
  //         style={[
  //           styles.dateNumber,
  //           isSelected && styles.selectedDateText,
  //         ]}>
  //         {item.day}
  //       </Text>

  //       <Text
  //         style={[
  //           styles.dateMonth,
  //           isSelected && styles.selectedDateText,
  //         ]}>
  //         {item.month}
  //       </Text>
  //     </Pressable>
  //   );
  // };

  const renderMealCard = ({ item }) => {
    const isVegetarian = item.foodType === 'VEGETARIAN';

    return (
      <View
        style={[
          styles.mealCard,
          layout.cardColumns === 2 && styles.tabletMealCard,
        ]}
      >
        <View style={styles.imageContainer}>
          <Image
            source={item.image}
            style={styles.mealImage}
            resizeMode="cover"
          />

          <View
            style={[
              styles.foodTypeBadge,
              isVegetarian ? styles.vegetarianBadge : styles.nonVegetarianBadge,
            ]}
          >
            <View
              style={[
                styles.foodTypeDot,
                isVegetarian ? styles.vegetarianDot : styles.nonVegetarianDot,
              ]}
            />

            <Text
              style={[
                styles.foodTypeText,
                isVegetarian ? styles.vegetarianText : styles.nonVegetarianText,
              ]}
            >
              {item.foodType}
            </Text>
          </View>

          {/* <Pressable
            hitSlop={10}
            onPress={() => toggleFavourite(item.id)}
            style={styles.favouriteButton}
          >
            <Ionicons
              name={item.favourite ? 'heart' : 'heart-outline'}
              size={19}
              color={item.favourite ? '#F15A29' : '#FFFFFF'}
            />
          </Pressable> */}

          {!item.available && (
            <View style={styles.soldOutImageOverlay}>
              <View style={styles.soldOutBadge}>
                <Text style={styles.soldOutBadgeText}>SOLD OUT</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.mealContent}>
          <View style={styles.mealTitleRow}>
            <Text numberOfLines={2} style={styles.mealName}>
              {item.name}
            </Text>

            <Text style={styles.mealPrice}>{item.price}</Text>
          </View>

          <Text numberOfLines={2} style={styles.mealDescription}>
            {item.description}
          </Text>

          <View style={styles.mealMetaRow}>
            <View style={styles.metaItem}>
              {/* <Ionicons
                name="restaurant-outline"
                size={12}
                color="#7456A7"
              /> */}
              <Image
                source={require('../assets/login-icons/spoon-and-fork-crossed.png')}
                style={styles.TimeIcons}
              />

              <Text style={styles.metaText}>{item.category}</Text>
            </View>

            {/* <View style={styles.metaItem}>
              <Ionicons
                name="flame-outline"
                size={12}
                color="#7456A7"
              />

              <Text style={styles.metaText}>
                {item.calories}
              </Text>
            </View> */}

            <View style={styles.metaItem}>
              {/* <Ionicons
                name="time-outline"
                size={12}
                color="#7456A7"
              /> */}
              <Image
                source={require('../assets/login-icons/time-left.png')}
                style={styles.TimeIcons}
              />

              <Text style={styles.metaText}>{item.preparationTime}</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!item.available}
            onPress={() => navigation.replace('CustomizeTiffin')}
            // onPress={() => handleOrder(item)}
            style={[
              styles.orderButton,
              !item.available && styles.disabledOrderButton,
            ]}
          >
            <Text
              style={[
                styles.orderButtonText,
                !item.available && styles.disabledOrderButtonText,
              ]}
            >
              {item.available ? 'ORDER NOW' : 'SOLD OUT'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const ListHeader = () => (
    <>
      <View style={styles.header}>
        <Pressable style={styles.locationContainer}>
          <View style={styles.locationIconContainer}>
            {/* <Ionicons
              name="location"
              size={15}
              color="#7354A4"
            /> */}
            <Image
              source={require('../assets/login-icons/location.png')}
              style={styles.passwordEyes}
            />
          </View>

          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>Delivering to</Text>

            <View style={styles.locationValueRow}>
              <Text numberOfLines={1} style={styles.locationValue}>
                Melbourne, VIC
              </Text>

              {/* <Ionicons
                name="chevron-down"
                size={13}
                color="#1B1724"
              /> */}
            </View>
          </View>
        </Pressable>

        <Pressable hitSlop={10} style={styles.notificationButton}>
          {/* <Ionicons
            name="notifications-outline"
            size={20}
            color="#7354A4"
          /> */}
          <Image
            source={require('../assets/login-icons/notification.png')}
            style={styles.passwordnotification}
          />

          <View style={styles.notificationDot} />
        </Pressable>
      </View>

      {/* <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>
          Select Date
        </Text>

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.viewMenuButton}>
          <Text style={styles.viewMenuText}>
            View Menu
          </Text>

          <Ionicons
            name="arrow-forward"
            size={13}
            color="#7354A4"
          />
        </TouchableOpacity>
      </View> */}

      {/* <FlatList
        horizontal
        data={dateOptions}
        keyExtractor={item => item.id}
        renderItem={renderDateItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateList}
      /> */}

      {/* <View style={styles.cutoffNotice}>
        <View style={styles.cutoffIconContainer}>
          <Ionicons
            name="alarm-outline"
            size={18}
            color="#E66A22"
          />
        </View>

        <Text style={styles.cutoffText}>
          Order cutoff for today is{' '}
          <Text style={styles.cutoffHighlight}>
            11:30 AM
          </Text>
          . Order soon!
        </Text>
      </View> */}

      <View style={styles.menuHeadingRow}>
        <View>
          <Text style={styles.menuEyebrow}>TODAY&apos;S MENU</Text>

          <Text style={styles.menuHeading}>Freshly prepared for you</Text>
        </View>

        <View style={styles.itemCountBadge}>
          <Text style={styles.itemCountText}>{meals.length} meals</Text>
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF8FD" />

      <View
        style={[
          styles.pageContainer,
          {
            width: layout.pageWidth,
            paddingHorizontal: layout.horizontalPadding,
          },
        ]}
      >
        <FlatList
          key={`meal-columns-${layout.cardColumns}`}
          data={meals}
          keyExtractor={item => item.id}
          renderItem={renderMealCard}
          numColumns={layout.cardColumns}
          columnWrapperStyle={
            layout.cardColumns === 2 ? styles.cardColumnWrapper : undefined
          }
          ListHeaderComponent={ListHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </SafeAreaView>
  );
};

export default Home;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8FD',
  },

  pageContainer: {
    flex: 1,
    alignSelf: 'center',
  },

  listContent: {
    paddingTop: 8,
    paddingBottom: 120,
  },

  header: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  locationContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  locationIconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EAF8',
    borderRadius: 9,
    marginRight: 8,
  },

  locationTextContainer: {
    flex: 1,
  },

  locationLabel: {
    color: '#97909E',
    fontSize: 10,
    marginBottom: 2,
  },

  locationValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  locationValue: {
    maxWidth: 180,
    color: '#1B1724',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 4,
  },

  notificationButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE9F2',
    borderRadius: 12,
  },

  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 6,
    height: 6,
    backgroundColor: '#F15A29',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    borderRadius: 3,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
  },

  sectionTitle: {
    color: '#17121E',
    fontSize: 15,
    fontWeight: '800',
  },

  viewMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  viewMenuText: {
    color: '#7354A4',
    fontSize: 11,
    fontWeight: '600',
    marginRight: 3,
  },

  dateList: {
    paddingBottom: 4,
  },

  dateCard: {
    width: 58,
    minHeight: 69,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECE7F0',
    borderRadius: 13,
    marginRight: 9,
  },

  selectedDateCard: {
    backgroundColor: '#7655A8',
    borderColor: '#7655A8',
    shadowColor: '#7655A8',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.24,
    shadowRadius: 7,
    elevation: 4,
  },

  dateLabel: {
    color: '#8D8592',
    fontSize: 8,
    fontWeight: '700',
  },

  dateNumber: {
    color: '#211A28',
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 2,
  },

  dateMonth: {
    color: '#8D8592',
    fontSize: 8,
    fontWeight: '600',
  },

  selectedDateText: {
    color: '#FFFFFF',
  },

  cutoffNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5E9',
    borderWidth: 1,
    borderColor: '#FFE6CA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 15,
  },

  cutoffIconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    marginRight: 9,
  },

  cutoffText: {
    flex: 1,
    color: '#735F53',
    fontSize: 11,
    lineHeight: 16,
  },

  cutoffHighlight: {
    color: '#E15D1B',
    fontWeight: '800',
  },

  menuHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 12,
  },

  menuEyebrow: {
    color: '#A00B0F',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  menuHeading: {
    color: '#17121E',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 3,
  },

  itemCountBadge: {
    backgroundColor: '#F0EAF8',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  itemCountText: {
    color: '#A00B0F',
    fontSize: 9,
    fontWeight: '700',
  },

  cardColumnWrapper: {
    justifyContent: 'space-between',
  },

  mealCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE8F0',
    borderRadius: 17,
    marginBottom: 16,
    overflow: 'hidden',

    shadowColor: '#4A3B53',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,

    elevation: 3,
  },

  tabletMealCard: {
    width: '48.8%',
  },

  imageContainer: {
    width: '100%',
    height: 190,
    backgroundColor: '#E9E5EC',
  },

  mealImage: {
    width: '100%',
    height: '100%',
  },

  foodTypeBadge: {
    position: 'absolute',
    top: 11,
    left: 11,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  vegetarianBadge: {
    borderWidth: 1,
    borderColor: '#CFEBD6',
  },

  nonVegetarianBadge: {
    borderWidth: 1,
    borderColor: '#F5CFC7',
  },

  foodTypeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  vegetarianDot: {
    backgroundColor: '#3AA65A',
  },

  nonVegetarianDot: {
    backgroundColor: '#E45B45',
  },

  foodTypeText: {
    fontSize: 8,
    fontWeight: '800',
  },

  vegetarianText: {
    color: '#318C4C',
  },

  nonVegetarianText: {
    color: '#CC4E3B',
  },

  favouriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22, 18, 28, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 16,
  },

  soldOutImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28, 25, 30, 0.33)',
  },

  soldOutBadge: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 7,
  },

  soldOutBadgeText: {
    color: '#4C4650',
    fontSize: 10,
    fontWeight: '800',
  },

  mealContent: {
    padding: 14,
  },

  mealTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  mealName: {
    flex: 1,
    color: '#17121E',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    paddingRight: 12,
  },

  mealPrice: {
    color: '#17121E',
    fontSize: 13,
    fontWeight: '800',
  },

  mealDescription: {
    color: '#000',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 6,
  },

  mealMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 11,
    marginBottom: 14,
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#edaaac6a',
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 4,
  },

  metaText: {
    color: '#A00B0F',
    fontSize: 8,
    fontWeight: '600',
    marginLeft: 4,
  },

  orderButton: {
    width: '100%',
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A00B0F',
    borderRadius: 11,
  },

  disabledOrderButton: {
    backgroundColor: '#A00B0F',
  },

  orderButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  disabledOrderButtonText: {
    color: '#A00B0F',
  },
  passwordEyes: {
    width: 20,
    height: 20,
  },
  passwordnotification: {
    width: 17,
    height: 17,
  },
  TimeIcons :{
     width: 13,
    height: 13,
  }
});
