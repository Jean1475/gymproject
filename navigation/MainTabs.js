import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Feather } from '@expo/vector-icons'
import FeedScreen from '../screens/FeedScreen'
import EntrenarScreen from '../screens/EntrenarScreen'
import RankingScreen from '../screens/RankingScreen'
import PerfilScreen from '../screens/PerfilScreen'

const Tab = createBottomTabNavigator()

const ACTIVE = '#E8442A'
const INACTIVE = 'rgba(255,255,255,0.3)'

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, size }) => {
          const icons = {
            Feed: 'home',
            Entrenar: 'activity',
            Ranking: 'award',
            Perfil: 'user',
          }
          return (
            <Feather
              name={icons[route.name]}
              size={size}
              color={focused ? ACTIVE : INACTIVE}
            />
          )
        },
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: '#111110',
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(255,255,255,0.07)',
        },
        tabBarLabelStyle: {
          color: '#f5f4f0',
          fontSize: 11,
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Entrenar" component={EntrenarScreen} />
      <Tab.Screen name="Ranking" component={RankingScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  )
}
