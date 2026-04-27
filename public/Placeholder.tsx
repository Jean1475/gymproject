// Placeholder screens — solo para que la tab bar funcione sin errores.
import { View, Text, StyleSheet } from 'react-native';

export default function Placeholder({ label }: { label: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.subtitle}>En desarrollo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111110',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 28,
    color: '#f5f4f0',
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
