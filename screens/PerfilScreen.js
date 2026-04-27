import { StyleSheet, Text, View } from 'react-native'

export default function PerfilScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Perfil</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111110' },
  text: { color: '#f5f4f0', fontSize: 18 },
})
