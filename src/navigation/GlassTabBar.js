import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const tabImages = {
  Home: {
    active: require('../assets/login-icons/home.png'),
    inactive: require('../assets/login-icons/home-1.png'),
  },

  // Menu: {
  //   active: require('../assets/login-icons/home-1.png'),
  //   inactive: require('../assets/login-icons/home-1.png'),
  // },

  // Orders: {
  //   active: require('../assets/tab-icons/orders-active.png'),
  //   inactive: require('../assets/tab-icons/orders.png'),
  // },

  // Bills: {
  //   active: require('../assets/tab-icons/bills-active.png'),
  //   inactive: require('../assets/tab-icons/bills.png'),
  // },

  Profile: {
    active: require('../assets/login-icons/home.png'),
    inactive: require('../assets/login-icons/home-1.png'),
  },
};

const GlassTabBar = ({ state, descriptors, navigation }) => {
  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View style={styles.glassContainer}>
        <View style={styles.glassHighlight} />

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const options = descriptors[route.key].options;

          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const imageData = tabImages[route.name];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={
                isFocused
                  ? {
                      selected: true,
                    }
                  : {}
              }
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}
            >
              <View
                style={[
                  styles.iconContainer,
                  isFocused && styles.activeIconContainer,
                ]}
              >
                {imageData ? (
                  <Image
                    source={isFocused ? imageData.active : imageData.inactive}
                    resizeMode="contain"
                    style={[
                      styles.tabImage,
                      isFocused && styles.activeTabImage,
                    ]}
                  />
                ) : null}
              </View>

              <Text
                numberOfLines={1}
                style={[styles.tabLabel, isFocused && styles.activeTabLabel]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default GlassTabBar;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 0,
    bottom: Platform.OS === 'ios' ? 18 : 12,
    left: 0,
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  glassContainer: {
    width: '100%',
    maxWidth: 600,
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',

    backgroundColor: 'rgba(255, 255, 255, 0.88)',

    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',

    borderRadius: 24,

    shadowColor: '#33243F',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,

    elevation: 12,
    overflow: 'hidden',
  },

  glassHighlight: {
    position: 'absolute',
    top: 0,
    right: 12,
    left: 12,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },

  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconContainer: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },

  activeIconContainer: {
    backgroundColor: '#A00B0F',
    shadowColor: '#A00B0F',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    borderRadius: 50,
    padding: 20,
  },

  tabImage: {
    width: 21,
    height: 21,
  },

  activeTabImage: {
    width: 20,
    height: 20,
  },

  tabLabel: {
    color: '#A00B0F',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
  },

  activeTabLabel: {
    color: '#A00B0F',
    fontWeight: '800',
  },
});
