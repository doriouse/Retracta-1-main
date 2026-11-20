import React, { useEffect, useRef, useState } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useDayPeriod } from '../utils/Timeofday';
import { dayPeriods, palette } from '../theme/Colors';
import { weather as demoWeather } from '../data/Mockdata';
import { issueVaralCommand, updateUserData } from '../utils/RetractaData';
import { appendDemoHistoryEvent, loadDemoValue, saveDemoValue } from '../utils/demoState';
import { sendLocalNotification } from '../utils/notifications';
import useRetractaData from '../utils/useRetractaData';
import VaralIllustration from '../components/VaralIllustration';

const WEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;

export default function HomeScreen() {
  const periodKey = useDayPeriod();
  const theme = dayPeriods[periodKey];
  const { data, uid, error, loaded } = useRetractaData();
  const [weather, setWeather] = useState({
    condition: demoWeather.condition,
    temp: demoWeather.temp,
    humidity: demoWeather.humidity,
    wind: demoWeather.wind,
    thermalSensation: demoWeather.thermalSensation,
    isDemo: true,
  });
  const [weatherError, setWeatherError] = useState('');
  const [demoIsOpen, setDemoIsOpen] = useState(true);
  const [demoSmartMode, setDemoSmartMode] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [countdown, setCountdown] = useState(null);
  const [commandPending, setCommandPending] = useState(false);
  const countdownTimer = useRef(null);
  const pendingTimer = useRef(null);
  const commandTarget = useRef(null);
  const previousDeviceStatus = useRef(null);
  const previousRainEvent = useRef(null);
  const rainHistoryInitialized = useRef(false);
  const deviceLastSeen = Number(data.device.lastSeen || 0);
  const deviceOnline = Number.isFinite(deviceLastSeen) && now - deviceLastSeen < 120000;
  const hasDeviceStatus = deviceOnline && typeof data.device.isOpen === 'boolean';
  const isOpen = hasDeviceStatus ? data.device.isOpen : demoIsOpen;
  const smartMode = deviceOnline ? data.device.smartMode !== false : demoSmartMode;
  const location = data.settings.location || { latitude: -23.5505, longitude: -46.6333, name: 'São Paulo' };

  useEffect(() => {
    if (!uid) return;
    loadDemoValue(uid, 'isOpen', true).then(setDemoIsOpen).catch((loadError) => Alert.alert('Falha ao carregar demonstração', loadError.message));
    loadDemoValue(uid, 'smartMode', true).then(setDemoSmartMode).catch((loadError) => Alert.alert('Falha ao carregar demonstração', loadError.message));
  }, [uid]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    if (!WEATHER_API_KEY) {
      setWeatherError('Chave OpenWeatherMap indisponível; exibindo dados de demonstração.');
      return () => { active = false; };
    }
    const { latitude, longitude } = location;
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}&units=metric&lang=pt_br`)
      .then((response) => {
        return response.json().then((result) => {
          if (!response.ok) throw new Error(result.message || 'OpenWeatherMap não conseguiu localizar este ponto.');
          return result;
        });
      })
      .then((result) => {
        if (active) {
          setWeather({
            condition: result.weather?.[0]?.description || 'Clima atualizado',
            temp: Math.round(result.main.temp),
            humidity: result.main.humidity,
            wind: Math.round(result.wind.speed * 3.6),
            thermalSensation: Math.round(result.main.feels_like),
            isDemo: false,
          });
          setWeatherError('');
        }
      })
      .catch((fetchError) => {
        if (active) {
          setWeather({
            condition: demoWeather.condition,
            temp: demoWeather.temp,
            humidity: demoWeather.humidity,
            wind: demoWeather.wind,
            thermalSensation: demoWeather.thermalSensation,
            isDemo: true,
          });
          setWeatherError(`${fetchError.message} Exibindo dados de demonstração.`);
        }
      });
    return () => { active = false; };
  }, [location.latitude, location.longitude]);

  useEffect(() => {
    if (error) Alert.alert('Falha ao sincronizar', error);
  }, [error]);

  useEffect(() => {
    if (commandPending && deviceOnline && typeof data.device.isOpen === 'boolean' && data.device.isOpen === commandTarget.current) {
      clearTimeout(pendingTimer.current);
      setCommandPending(false);
    }
  }, [commandPending, data.device.isOpen, deviceOnline]);

  useEffect(() => {
    if (!hasDeviceStatus) return;
    if (previousDeviceStatus.current === null) {
      previousDeviceStatus.current = data.device.isOpen;
      return;
    }
    if (previousDeviceStatus.current !== data.device.isOpen && data.settings.notifications?.status) {
      sendLocalNotification(
        'Status do Retracta atualizado',
        data.device.isOpen ? 'O varal está estendido.' : 'O varal foi recolhido.',
      ).catch((notificationError) => console.warn('Não foi possível mostrar a notificação.', notificationError));
    }
    previousDeviceStatus.current = data.device.isOpen;
  }, [data.device.isOpen, data.settings.notifications?.status, hasDeviceStatus]);

  useEffect(() => {
    if (!loaded) return;
    const lastEvent = Object.values(data.history || {})
      .filter((event) => event.source === 'automatic' && event.isOpen === false)
      .sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0))[0];
    if (!rainHistoryInitialized.current) {
      previousRainEvent.current = lastEvent?.timestamp || 0;
      rainHistoryInitialized.current = true;
      return;
    }
    if (!lastEvent || lastEvent.timestamp <= previousRainEvent.current) return;
    if (data.settings.notifications?.rain) {
      sendLocalNotification('Varal recolhido automaticamente', 'O sistema registrou uma ação automática do varal.')
        .catch((notificationError) => console.warn('Não foi possível mostrar a notificação.', notificationError));
    }
    previousRainEvent.current = lastEvent.timestamp;
  }, [data.history, data.settings.notifications?.rain, loaded]);

  useEffect(() => {
    if (countdown === 0) {
      clearInterval(countdownTimer.current);
      setCountdown(null);
      runCommand(commandTarget.current);
    }
  }, [countdown]);

  useEffect(() => () => {
    clearInterval(countdownTimer.current);
    clearTimeout(pendingTimer.current);
  }, []);

  const runCommand = async (target) => {
    if (!uid) return;
    if (!hasDeviceStatus) {
      try {
        await Promise.all([
          saveDemoValue(uid, 'isOpen', target),
          appendDemoHistoryEvent(uid, {
            timestamp: Date.now(),
            source: 'manual',
            mode: 'demo',
            isOpen: target,
            action: target ? 'Varal estendido (demonstração)' : 'Varal recolhido (demonstração)',
          }),
        ]);
        setDemoIsOpen(target);
        setCountdown(null);
      } catch (saveError) {
        Alert.alert('Falha ao salvar a ação demonstrativa', saveError.message);
        return;
      }
      if (data.settings.notifications?.status) {
        sendLocalNotification('Demonstração do Retracta', target ? 'Varal estendido na demonstração.' : 'Varal recolhido na demonstração.')
          .catch((notificationError) => console.warn('Não foi possível mostrar a notificação.', notificationError));
      }
      return;
    }
    setCommandPending(true);
    commandTarget.current = target;
    clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => {
      setCommandPending(false);
      Alert.alert('Sem confirmação do ESP32', 'O comando foi enviado, mas o dispositivo ainda não confirmou a posição.');
    }, 60000); // o motor leva ~25 s para percorrer o curso completo
    try {
      await issueVaralCommand(uid, target, 'manual');
    } catch (commandError) {
      clearTimeout(pendingTimer.current);
      setCommandPending(false);
      Alert.alert('Não foi possível enviar o comando', commandError.message);
    }
  };

  const startCountdown = () => {
    const target = !isOpen;
    commandTarget.current = target;
    setCountdown(10);
    countdownTimer.current = setInterval(() => {
      setCountdown((current) => {
        if (current === null) return null;
        return Math.max(current - 1, 0);
      });
    }, 1000);
  };

  const cancelCountdown = () => {
    clearInterval(countdownTimer.current);
    setCountdown(null);
  };

  const setSmartMode = async (enabled) => {
    if (!deviceOnline) {
      setDemoSmartMode(enabled);
      if (!uid) return;
      saveDemoValue(uid, 'smartMode', enabled).catch((saveError) => Alert.alert('Falha ao salvar o modo demonstração', saveError.message));
      return;
    }
    try {
      await updateUserData(uid, 'device', { smartMode: enabled });
    } catch (writeError) {
      Alert.alert('Não foi possível atualizar o modo inteligente', writeError.message);
    }
  };

  const activities = Object.entries(data.history || {})
    .map(([id, item]) => ({ ...item, id }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 3);

  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={theme.gradient} style={styles.header}>
        <Text style={styles.brand}>RETRACTA</Text>
        <Text style={styles.condition}>{weather.condition}</Text>
        <Text style={styles.temp}>{weather ? `${weather.temp}°C` : '--°C'}</Text>
        {weather ? (
          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Feather name="droplet" size={12} color="#fff" />
              <Text style={styles.chipText}>{weather.humidity}%</Text>
            </View>
            <View style={styles.chip}>
              <Feather name="wind" size={12} color="#fff" />
              <Text style={styles.chipText}>{weather.wind} km/h</Text>
            </View>
            <View style={styles.chip}>
              <Feather name="thermometer" size={12} color="#fff" />
              <Text style={styles.chipText}>{weather.thermalSensation}°C</Text>
            </View>
          </View>
        ) : null}
        <Text style={styles.city}>
          {location.name || data.settings.city || 'São Paulo'}{weather.isDemo ? ' · demonstração' : ''}
        </Text>
      </LinearGradient>

      <VaralIllustration isOpen={isOpen} />

      <View style={styles.card}>
        <Text style={styles.cardLabel}>STATUS DO VARAL</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: !hasDeviceStatus ? palette.warning : isOpen ? palette.success : '#9AA3B8' }]} />
          <Text style={styles.statusText}>{isOpen ? 'Aberto' : 'Recolhido'}</Text>
          {hasDeviceStatus && isOpen && <Feather name="check-circle" size={18} color={palette.success} style={{ marginLeft: 6 }} />}
        </View>
        {countdown === null ? (
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={commandPending}
            onPress={startCountdown}
            style={styles.actionButtonWrap}
          >
            <LinearGradient colors={['#FF9A3D', '#E8452F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionButton}>
              <Text style={styles.actionButtonText}>
                {commandPending ? (data.device.command?.status === 'running' ? 'Varal em movimento...' : 'Aguardando confirmação do ESP32...') : isOpen ? 'Recolher Varal' : 'Estender Varal'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.countdownBox}>
            <Text style={styles.countdownText}>{isOpen ? 'Recolhendo' : 'Estendendo'} em {countdown} segundos</Text>
            <TouchableOpacity onPress={cancelCountdown}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
          </View>
        )}
        <Text style={styles.pendingText}>{hasDeviceStatus ? 'ESP32 conectado · o movimento será confirmado pelo dispositivo.' : 'Modo demonstração · esta ação não aciona o varal físico.'}</Text>
        {weatherError ? <Text style={styles.errorText}>{weatherError}</Text> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.smartRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.smartTitle}>Modo Inteligente</Text>
            <Text style={styles.smartSubtitle}>
              {deviceOnline ? 'ESP32 conectado · automação via sensor de chuva' : 'Demonstração local · sem ESP32 conectado'}
            </Text>
          </View>
          <Switch
            value={smartMode}
            onValueChange={setSmartMode}
            trackColor={{ false: '#D3D9E8', true: '#3F6FE0' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {activities.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>ATIVIDADE RECENTE</Text>
          {activities.map((activity, index) => (
            <View key={activity.id} style={[styles.activityRow, index !== activities.length - 1 && styles.activityRowBorder]}>
              <View style={styles.activityIcon}>
                <Feather name={activity.source === 'automatic' ? 'cloud-rain' : 'repeat'} size={14} color={palette.danger} />
              </View>
              <View>
                <Text style={styles.activityTitle}>{activity.action || 'Ação do varal'}</Text>
                <Text style={styles.activityTime}>{new Date(activity.timestamp || Date.now()).toLocaleString('pt-BR')}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { paddingTop: 54, paddingHorizontal: 20, paddingBottom: 44, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  brand: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 18, letterSpacing: 0.5 },
  condition: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 2, textTransform: 'capitalize' },
  temp: { color: '#fff', fontSize: 52, fontWeight: '700', marginTop: 6 },
  city: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 8 },
  chipsRow: { flexDirection: 'row', marginTop: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  chipText: { color: '#fff', fontSize: 12, marginLeft: 5, fontWeight: '600' },
  card: { backgroundColor: palette.card, borderRadius: 20, marginHorizontal: 18, marginTop: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  statusText: { fontSize: 22, fontWeight: '800', color: palette.textDark },
  actionButtonWrap: { marginTop: 16 },
  actionButton: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  countdownBox: { marginTop: 16, borderRadius: 16, padding: 14, backgroundColor: '#FFF3E8', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countdownText: { color: palette.textDark, fontWeight: '700', fontSize: 13 },
  cancelText: { color: palette.danger, fontWeight: '700' },
  pendingText: { color: palette.textMuted, fontSize: 11, marginTop: 10 },
  errorText: { color: palette.danger, fontSize: 11, marginTop: 10 },
  smartRow: { flexDirection: 'row', alignItems: 'center' },
  smartTitle: { fontSize: 15, fontWeight: '700', color: palette.textDark },
  smartSubtitle: { fontSize: 12, color: palette.textMuted, marginTop: 2 },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  activityIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: '#E8452F22' },
  activityTitle: { fontSize: 13, fontWeight: '600', color: palette.textDark },
  activityTime: { fontSize: 11, color: palette.textMuted, marginTop: 2 },
});
