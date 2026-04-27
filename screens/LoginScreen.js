import { useState } from 'react'
import {
  Alert, KeyboardAvoidingView, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { F } from '../lib/fonts'

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) Alert.alert('Error', error.message)
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>GymApp</Text>
        <Text style={styles.subtitle}>Entrena. Compite. Mejora.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin} disabled={loading}>
          <Text style={styles.btnPrimaryText}>{loading ? 'Entrando...' : 'Entrar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.btnSecondaryText}>Crear cuenta</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111110' },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },

  title: {
    fontFamily: F.display.semiBold,
    fontSize: 40,
    color: '#f5f4f0',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: F.body.light,
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 44,
    letterSpacing: 0.3,
  },

  input: {
    fontFamily: F.body.regular,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 18,
    marginBottom: 12,
    fontSize: 16,
    color: '#f5f4f0',
  },

  btnPrimary: {
    backgroundColor: '#E8442A',
    borderRadius: 999,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  btnPrimaryText: {
    fontFamily: F.body.medium,
    color: '#fff',
    fontSize: 16,
  },

  btnSecondary: {
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
    padding: 16,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontFamily: F.body.regular,
    color: '#f5f4f0',
    fontSize: 16,
  },
})
