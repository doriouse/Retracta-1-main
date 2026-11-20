import React, { useEffect, useRef, useState } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useDayPeriod } from '../utils/Timeofday';
import { dayPeriods, palette } from '../theme/Colors';
import { isRealHistoryEvent, issueVaralCommand, selectVaral, updateUserData } from '../utils/RetractaData';
import { sendLocalNotification } from '../utils/notifications';
import useRetractaData from '../utils/useRetractaData';
import VaralIllustration from '../components/VaralIllustration';

const WEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;

export default function HomeScreen() {
  const periodKey = useDayPeriod();
  const theme = dayPeriods[periodKey];
  const { data, uid, error, loaded, activeVaralId, activeVaral, varais } = useRetractaData();
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [localIsOpen, setLocalIsOpen] = useState(null);
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
  const deviceOnline = Number.isFinite(deviceLastSeen)
    && now - deviceLastSeen < 120000
    && (!activeVaral?.deviceId
      || String(data.device.id || '').toUpperCase() === String(activeVaral.deviceId).toUpperCase());
  const hasDeviceStatus = deviceOnline && typeof data.device.isOpen === 'boolean';
  const isOpen = hasDeviceStatus ? data.device.isOpen : null;
  const visualIsOpen = hasDeviceStatus ? isOpen : localIsOpen;
  const smartMode = data.device.smartMode !== false;
  const location = data.settings.location || { latitude: -23.5505, longitude: -46.6333, name: 'São Paulo' };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setWeather(null);
    setWeatherError('');
    if (!WEATHER_API_KEY) {
      setWeatherLoading(false);
      setWeatherError('Clima indisponível. Configure a chave OpenWeatherMap e reinicie o aplicativo.');
      return () => { active = false; };
    }
    const { latitude, longitude } = location;
    setWeatherLoading(true);
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}&units=metric&lang=pt_br`)
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) {
          throw new Error('A chave do clima foi rejeitada ou ainda não está ativa. Confira a configuração e reinicie o Expo.');
        }
        if (response.status === 429) {
          throw new Error('O limite de consultas ao serviço de clima foi atingido. Tente novamente mais tarde.');
        }
        if (!response.ok) throw new Error('Não foi possível consultar o clima deste local.');
        return result;
      })
      .then((result) => {
        if (active) {
          setWeather({
            condition: result.weather?.[0]?.description || 'Clima atualizado',
            temp: Math.round(result.main.temp),
            humidity: result.main.humidity,
            wind: Math.round(result.wind.speed * 3.6),
            thermalSensation: Math.round(result.main.feels_like),
          });
        }
      })
      .catch((fetchError) => {
        if (active) setWeatherError(fetchError.message === 'Network request failed'
          ? 'Sem conexão com o serviço de clima. Verifique a internet e tente novamente.'
          : fetchError.message);
      })
      .finally(() => {
        if (active) setWeatherLoading(false);
      });
    return () => { active = false; };
  }, [location.latitude, location.longitude]);

  useEffect(() => {
    if (error) Alert.alert('Falha ao sincronizar', error);
  }, [error]);

  useEffect(() => {
    clearInterval(countdownTimer.current);
    clearTimeout(pendingTimer.current);
    setLocalIsOpen(null);
    setCountdown(null);
    setCommandPending(false);
    commandTarget.current = null;
    previousDeviceStatus.current = null;
    previousRainEvent.current = null;
    rainHistoryInitialized.current = false;
  }, [activeVaralId]);

  useEffect(() => {
    if (hasDeviceStatus) setLocalIsOpen(null);
  }, [hasDeviceStatus]);

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
      .filter((event) => isRealHistoryEvent(event) && event.source === 'automatic' && event.isOpen === false)
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
    if (!uid || !hasDeviceStatus) return;
    setCommandPending(true);
    commandTarget.current = target;
    clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => {
      setCommandPending(false);
      Alert.alert('Sem confirmação do ESP32', 'O comando foi enviado, mas o dispositivo ainda não confirmou a posição.');
    }, 60000); // o motor leva ~25 s para percorrer o curso completo
    try {
      await issueVaralCommand(uid, target, 'manual', activeVaralId);
    } catch (commandError) {
      clearTimeout(pendingTimer.current);
      setCommandPending(false);
      Alert.alert('Não foi possível enviar o comando', commandError.message);
    }
  };

  const startCountdown = (target) => {
    if (!hasDeviceStatus || target === isOpen || commandPending) return;
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
    if (!deviceOnline || !uid) return;
    try {
      await updateUserData(uid, 'device', { smartMode: enabled }, activeVaralId);
    } catch (writeError) {
      Alert.alert('Não foi possível atualizar o modo inteligente', writeError.message);
    }
  };

  const activities = Object.entries(data.history || {})
    .map(([id, item]) => ({ ...item, id }))
    .filter(isRealHistoryEvent)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 3);

  const chooseVaral = async (varalId) => {
    if (varalId === activeVaralId || !uid) return;
    try {
      await selectVaral(uid, varalId);
    } catch (selectionError) {
      Alert.alert('Não foi possível selecionar o varal', selectionError.message);
    }
  };

  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={theme.gradient} style={styles.header}>
        <Text style={styles.brand}>RETRACTA</Text>
        <Text style={styles.condition}>{weather?.condition || (weatherLoading ? 'Consultando clima...' : 'Clima indisponível')}</Text>
        <Text style={styles.temp}>{weather ? `${weather.temp}°C` : '—'}</Text>
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
          {location.name || data.settings.city || 'Local do varal'}
        </Text>
        {weatherError ? <Text style={styles.weatherError}>{weatherError}</Text> : null}
      </LinearGradient>

      {varais.length > 1 && (
        <View style={styles.weatherPicker}>
          <Text style={styles.cardLabel}>CLIMA POR VARAL</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.varalButtons}>
            {varais.map((varal) => {
              const selected = varal.id === activeVaralId;
              return (
                <TouchableOpacity
                  key={varal.id}
                  style={[styles.varalButton, selected && styles.varalButtonSelected]}
                  onPress={() => chooseVaral(varal.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.varalButtonText, selected && styles.varalButtonTextSelected]} numberOfLines={1}>
                    {varal.name || 'Meu varal'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {visualIsOpen !== null && (
        <VaralIllustration
          isOpen={visualIsOpen}
          style={varais.length > 1 ? styles.illustrationBelowPicker : undefined}
        />
      )}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>STATUS DO VARAL</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: !hasDeviceStatus ? palette.warning : isOpen ? palette.success : '#9AA3B8' }]} />
          <Text style={styles.statusText}>
            {hasDeviceStatus
              ? (isOpen ? 'Aberto' : 'Recolhido')
              : localIsOpen === null ? 'Indisponível' : localIsOpen ? 'Estendido' : 'Recolhido'}
          </Text>
          {hasDeviceStatus && isOpen && <Feather name="check-circle" size={18} color={palette.success} style={{ marginLeft: 6 }} />}
        </View>
        {!hasDeviceStatus ? (
          <View style={styles.unavailableBox}>
            {deviceOnline ? (
              <Text style={styles.unavailableText}>Aguardando o ESP32 publicar a posição do varal.</Text>
            ) : (
              <>
                <Text style={styles.unavailableText}>ESP32 desconectado.</Text>
                <View style={styles.localActions}>
                  <TouchableOpacity
                    style={[styles.localActionButton, localIsOpen === true && styles.localActionButtonSelected]}
                    onPress={() => setLocalIsOpen(true)}
                  >
                    <Text style={[styles.localActionText, localIsOpen === true && styles.localActionTextSelected]}>Estender</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.localActionButton, localIsOpen === false && styles.localActionButtonSelected]}
                    onPress={() => setLocalIsOpen(false)}
                  >
                    <Text style={[styles.localActionText, localIsOpen === false && styles.localActionTextSelected]}>Recolher</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ) : countdown === null ? (
          <View style={styles.deviceActions}>
            {[true, false].map((target) => {
              const disabled = commandPending || target === isOpen;
              return (
                <TouchableOpacity
                  key={String(target)}
                  style={[styles.deviceActionButton, disabled && styles.deviceActionButtonDisabled]}
                  activeOpacity={0.85}
                  disabled={disabled}
                  onPress={() => startCountdown(target)}
                >
                  <LinearGradient
                    colors={target ? ['#4C8DF0', '#2C6FE0'] : ['#FF9A3D', '#E8452F']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionButtonText}>{target ? 'Estender' : 'Recolher'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.countdownBox}>
            <Text style={styles.countdownText}>{commandTarget.current ? 'Estendendo' : 'Recolhendo'} em {countdown} segundos</Text>
            <TouchableOpacity onPress={cancelCountdown}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
          </View>
        )}
        {hasDeviceStatus && (
          <Text style={styles.pendingText}>
            {commandPending
              ? (data.device.command?.status === 'running' ? 'Varal em movimento...' : 'Aguardando confirmação do ESP32...')
              : 'ESP32 conectado · o movimento será confirmado pelo dispositivo.'}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.smartRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.smartTitle}>Modo Inteligente</Text>
            <Text style={styles.smartSubtitle}>
              {deviceOnline ? 'ESP32 conectado · automação via sensor de chuva' : 'Indisponível até conectar o ESP32.'}
            </Text>
          </View>
          <Switch
            value={smartMode}
            onValueChange={setSmartMode}
            disabled={!deviceOnline}
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
  weatherError: { color: '#fff', fontSize: 11, marginTop: 8, lineHeight: 16 },
  weatherPicker: { backgroundColor: palette.card, borderRadius: 16, marginHorizontal: 18, marginTop: 14, padding: 14 },
  varalButtons: { paddingTop: 10, paddingRight: 4 },
  varalButton: { backgroundColor: '#EEF1F7', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, marginRight: 8, maxWidth: 150 },
  varalButtonSelected: { backgroundColor: palette.configDark },
  varalButtonText: { color: palette.textDark, fontSize: 11, fontWeight: '700' },
  varalButtonTextSelected: { color: '#fff' },
  chipsRow: { flexDirection: 'row', marginTop: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  chipText: { color: '#fff', fontSize: 12, marginLeft: 5, fontWeight: '600' },
  card: { backgroundColor: palette.card, borderRadius: 20, marginHorizontal: 18, marginTop: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  statusText: { fontSize: 22, fontWeight: '800', color: palette.textDark },
  illustrationBelowPicker: { marginTop: 14 },
  deviceActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  deviceActionButton: { flex: 1 },
  deviceActionButtonDisabled: { opacity: 0.45 },
  actionButton: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  countdownBox: { marginTop: 16, borderRadius: 16, padding: 14, backgroundColor: '#FFF3E8', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countdownText: { color: palette.textDark, fontWeight: '700', fontSize: 13 },
  cancelText: { color: palette.danger, fontWeight: '700' },
  pendingText: { color: palette.textMuted, fontSize: 11, marginTop: 10 },
  unavailableBox: { marginTop: 14, padding: 12, backgroundColor: '#FFF5E7', borderRadius: 12 },
  unavailableText: { color: palette.textDark, fontSize: 12, lineHeight: 17 },
  localActions: { flexDirection: 'row', marginTop: 10, gap: 8 },
  localActionButton: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#fff' },
  localActionButtonSelected: { backgroundColor: palette.configDark },
  localActionText: { color: palette.configDark, fontSize: 12, fontWeight: '700' },
  localActionTextSelected: { color: '#fff' },
  smartRow: { flexDirection: 'row', alignItems: 'center' },
  smartTitle: { fontSize: 15, fontWeight: '700', color: palette.textDark },
  smartSubtitle: { fontSize: 12, color: palette.textMuted, marginTop: 2 },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  activityIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: '#E8452F22' },
  activityTitle: { fontSize: 13, fontWeight: '600', color: palette.textDark },
  activityTime: { fontSize: 11, color: palette.textMuted, marginTop: 2 },
});
