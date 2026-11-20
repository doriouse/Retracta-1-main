import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import { Platform, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth } from './utils/firebaseAuth';
import HomeScreen from './screens/homeScreen';
import AgendaScreen from './screens/Agendascreen';
import DadosScreen from './screens/Dadosscreen';
import ConfigScreen from './screens/Configscreen';
import LoginScreen from './screens/LoginScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import SignupScreen from './screens/SignupScreen';
import SplashScreen from './screens/SplashScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const TAB_CONFIG = {
  Início: { icon: 'sun', activeColor: '#E8452F' },
  Agenda: { icon: 'calendar', activeColor: '#6C4CE0' },
  Dados: { icon: 'bar-chart-2', activeColor: '#1FB88C' },
  Config: { icon: 'settings', activeColor: '#1D2333' },
};

const TAB_ORDER = ['Início', 'Agenda', 'Dados', 'Config'];

function withSwipeNavigation(Screen, index) {
  return function SwipeNavigationScreen(props) {
    const touchStart = React.useRef(null);
    const onTouchStart = (event) => {
      const { pageX, pageY } = event.nativeEvent;
      touchStart.current = { x: pageX, y: pageY };
    };
    const onTouchEnd = (event) => {
      if (!touchStart.current) return;
      const { pageX, pageY } = event.nativeEvent;
      const deltaX = pageX - touchStart.current.x;
      const deltaY = pageY - touchStart.current.y;
      touchStart.current = null;
      if (Math.abs(deltaX) < 70 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
      const nextIndex = index + (deltaX < 0 ? 1 : -1);
      if (nextIndex >= 0 && nextIndex < TAB_ORDER.length) {
        props.navigation.navigate(TAB_ORDER[nextIndex]);
      }
    };

    return (
      <View style={{ flex: 1 }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => { touchStart.current = null; }}>
        <Screen {...props} />
      </View>
    );
  };
}

const SwipeHomeScreen = withSwipeNavigation(HomeScreen, 0);
const SwipeAgendaScreen = withSwipeNavigation(AgendaScreen, 1);
const SwipeDadosScreen = withSwipeNavigation(DadosScreen, 2);
const SwipeConfigScreen = withSwipeNavigation(ConfigScreen, 3);

// As 4 telas principais ficam isoladas num Tab.Navigator próprio
function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: TAB_CONFIG[route.name]?.activeColor || '#1D2333',
        tabBarInactiveTintColor: '#A3A9BC',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 1,
          borderTopColor: '#EAEDF3',
          backgroundColor: '#fff',
        },
        tabBarIcon: ({ color, size }) => (
          <Feather name={TAB_CONFIG[route.name]?.icon || 'circle'} size={size ?? 20} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Início" component={SwipeHomeScreen} />
      <Tab.Screen name="Agenda" component={SwipeAgendaScreen} />
      <Tab.Screen name="Dados" component={SwipeDadosScreen} />
      <Tab.Screen name="Config" component={SwipeConfigScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const [user, setUser] = React.useState(auth.currentUser);
  const [loading, setLoading] = React.useState(!auth.currentUser);

  React.useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser);
    setLoading(false);
  }), []);

  if (loading) return <SplashScreen />;

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        key={user ? 'signed-in' : 'signed-out'}
        initialRouteName={user ? 'MainApp' : 'Login'}
        screenOptions={{ headerShown: false }}
      >
        {user ? (
          <Stack.Screen name="MainApp" component={MainTabs} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}