import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { BlurView } from 'expo-blur'
import { StyleSheet } from 'react-native'
import { Home, Dumbbell, BarChart3, User } from 'lucide-react-native'
import FeedScreen from '../screens/FeedScreen'
import EntrenarScreen from '../screens/EntrenarScreen'
import RankingScreen from '../screens/RankingScreen'
import PerfilScreen from '../screens/PerfilScreen'

const Tab = createBottomTabNavigator()

const TEXT = '#f5f4f0'
const MUTED = 'rgba(255,255,255,0.5)'
const BORDER = 'rgba(255,255,255,0.07)'

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TEXT,
        tabBarInactiveTintColor: MUTED,
        tabBarStyle: {
          position: 'absolute',
          borderTopColor: BORDER,
          borderTopWidth: 0.5,
          backgroundColor: 'transparent',
          elevation: 0,
        },
        tabBarBackground: () => (
          <BlurView tint="dark" intensity={80} style={StyleSheet.absoluteFill} />
        ),
        tabBarLabelStyle: {
          fontFamily: 'DMSans-Medium',
          fontSize: 10.5,
          letterSpacing: 0.1,
        },
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Home size={24} color={color} fill={focused ? color : 'transparent'} strokeWidth={1.6} />
          ),
        }}
      />
      <Tab.Screen
        name="Entrenar"
        component={EntrenarScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Dumbbell size={24} color={color} strokeWidth={1.6} />
          ),
        }}
      />
      <Tab.Screen
        name="Ranking"
        component={RankingScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <BarChart3 size={24} color={color} strokeWidth={1.6} />
          ),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={PerfilScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <User size={24} color={color} fill={focused ? color : 'transparent'} strokeWidth={1.6} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}
