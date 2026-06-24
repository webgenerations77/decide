import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function TabIcon({ active, inactive, focused, color }) {
  return (
    <View style={styles.iconWrap}>
      <View style={[styles.indicator, focused && styles.indicatorActive]} />
      <Ionicons name={focused ? active : inactive} size={24} color={color} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#00d2be',
        tabBarInactiveTintColor: '#4a6a6e',
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Decide',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon active="compass" inactive="compass-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="spin"
        options={{
          title: 'Spin',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon active="dice" inactive="dice-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon active="time" inactive="time-outline" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon active="settings" inactive="settings-outline" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 65,
    backgroundColor: '#001419',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 210, 190, 0.3)',
    paddingBottom: 8,
    paddingTop: 0,
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  tabItem: {
    flex: 1,
    margin: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 0,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  indicator: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginBottom: 4,
  },
  indicatorActive: {
    backgroundColor: '#00d2be',
  },
});
