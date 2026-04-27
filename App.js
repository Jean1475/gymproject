import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useFonts } from 'expo-font'
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
} from '@expo-google-fonts/playfair-display'
import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
} from '@expo-google-fonts/dm-sans'
import { supabase } from './lib/supabase'
import LoginScreen from './screens/LoginScreen'
import RegisterScreen from './screens/RegisterScreen'
import MainTabs from './navigation/MainTabs'
import CompartirScreen from './screens/CompartirScreen'
import EditarPerfilScreen from './screens/EditarPerfilScreen'

const Stack = createNativeStackNavigator()

export default function App() {
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  const [fontsLoaded] = useFonts({
    'PlayfairDisplay-Regular':  PlayfairDisplay_400Regular,
    'PlayfairDisplay-Medium':   PlayfairDisplay_500Medium,
    'PlayfairDisplay-SemiBold': PlayfairDisplay_600SemiBold,
    'DMSans-Light':   DMSans_300Light,
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium':  DMSans_500Medium,
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setSessionLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (sessionLoading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111110' }}>
        <ActivityIndicator color="#E8442A" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="Home" component={MainTabs} />
            <Stack.Screen
              name="Compartir"
              component={CompartirScreen}
              options={{ presentation: 'modal' }}
            />
            <Stack.Screen name="EditarPerfil" component={EditarPerfilScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
