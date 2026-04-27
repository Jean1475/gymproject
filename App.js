import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { supabase } from './lib/supabase'

export default function App() {
  const [status, setStatus] = useState('Conectando...')

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setStatus('❌ Error de conexión')
      } else {
        setStatus('✅ Supabase conectado')
      }
    })
  }, [])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 20 }}>{status}</Text>
    </View>
  )
}