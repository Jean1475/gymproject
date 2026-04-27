import { StyleSheet, Text, View } from 'react-native'
import { F } from '../lib/fonts'

export default function RankingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Ranking</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111110' },
  text: { fontFamily: F.display.regular, fontSize: 22, color: '#f5f4f0' },
})
