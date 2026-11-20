import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

const AUTH_GRADIENT = ['#5B93F5', '#2E5BC8'];

export default function SplashScreen() {
  return (
    <LinearGradient colors={AUTH_GRADIENT} style={styles.screen}>
      <View style={styles.center}>
        <View style={styles.logoBadge}>
          <Feather name="users" size={34} color="#fff" />
          <View style={styles.checkBadge}>
            <Feather name="check" size={12} color="#fff" />
          </View>
        </View>

        <Text style={styles.brand}>RETRACTA</Text>
        <Text style={styles.tagline}>VARAL RETRÁTIL INTELIGENTE</Text>

        <View style={styles.pillsRow}>
          <View style={styles.pill}><Text style={styles.pillText}>Automático</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>Inteligente</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>Conectado</Text></View>
        </View>
      </View>

      <View style={styles.bottom}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.version}>Verificando sua sessão...</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'space-between', paddingVertical: 80 },
  center: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  logoBadge: {
    width: 92, height: 92, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 22,
  },
  checkBadge: {
    position: 'absolute', bottom: -4, right: -4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#2FBE79',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: AUTH_GRADIENT[1],
  },
  brand: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: 4 },
  tagline: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: 6 },
  pillsRow: { flexDirection: 'row', marginTop: 22 },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginHorizontal: 4,
  },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bottom: { alignItems: 'center', paddingHorizontal: 32 },
  version: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 16 },
});