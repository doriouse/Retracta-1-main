import React, { useEffect, useMemo, useState } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { palette } from '../theme/Colors';
import { loadDemoValue } from '../utils/demoState';
import useRetractaData from '../utils/useRetractaData';

const DAY = 24 * 60 * 60 * 1000;
const PERIODS = [7, 30];

function getIntervals(events, start, end, startingOpen) {
  let open = startingOpen;
  let cursor = start;
  const intervals = [];

  events.filter((event) => event.timestamp >= start && event.timestamp <= end).forEach((event) => {
    if (open && event.timestamp > cursor) intervals.push({ start: cursor, end: event.timestamp });
    if (typeof event.isOpen === 'boolean') open = event.isOpen;
    cursor = Math.max(cursor, event.timestamp);
  });
  if (open && end > cursor) intervals.push({ start: cursor, end });
  return intervals;
}

function isAutomatic(event) {
  return /auto|rain|sensor|chuva/i.test(event.source || '');
}

function getMetrics(events, periodDays, now) {
  const start = now - periodDays * DAY;
  const before = events.filter((event) => event.timestamp < start).slice(-1)[0];
  const periodEvents = events.filter((event) => event.timestamp >= start && event.timestamp <= now);
  const firstInPeriod = periodEvents.find((event) => typeof event.isOpen === 'boolean');
  const startingOpen = typeof before?.isOpen === 'boolean'
    ? before.isOpen
    : typeof firstInPeriod?.isOpen === 'boolean' ? !firstInPeriod.isOpen : false;
  const intervals = getIntervals(events, start, now, startingOpen);
  const hours = intervals.reduce((sum, item) => sum + (item.end - item.start) / 3600000, 0);
  const openDates = new Set();
  intervals.forEach((interval) => {
    let date = new Date(interval.start);
    date.setHours(0, 0, 0, 0);
    while (date.getTime() < interval.end) {
      openDates.add(date.toDateString());
      date = new Date(date.getTime() + DAY);
    }
  });
  const autoActions = periodEvents.filter(isAutomatic).length;
  const autoRetracted = periodEvents.filter((event) => event.isOpen === false && isAutomatic(event)).length;
  return { start, hours, daysOpen: openDates.size, autoRetracted, autoActions, intervals, events: periodEvents };
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function DadosScreen() {
  const [period, setPeriod] = useState(7);
  const { data, uid } = useRetractaData();
  const isFocused = useIsFocused();
  const [demoHistory, setDemoHistory] = useState([]);
  useEffect(() => {
    let active = true;
    setDemoHistory([]);
    if (!uid || !isFocused) return () => { active = false; };
    loadDemoValue(uid, 'history', [])
      .then((history) => {
        if (active) setDemoHistory(history);
      })
      .catch((error) => Alert.alert('Falha ao carregar ações demonstrativas', error.message));
    return () => { active = false; };
  }, [isFocused, uid]);
  const now = Date.now();
  const events = useMemo(() => [
    ...Object.entries(data.history || {}).map(([id, event]) => ({ ...event, id })),
    ...demoHistory,
  ]
    .filter((event) => typeof event.timestamp === 'number')
    .sort((a, b) => a.timestamp - b.timestamp), [data.history, demoHistory]);
  const metrics = getMetrics(events, period, now);
  const previous = getMetrics(events, period, metrics.start);
  const change = previous.hours ? Math.round(((metrics.hours - previous.hours) / previous.hours) * 100) : null;
  const bins = Array.from({ length: 7 }, (_, index) => {
    const binStart = metrics.start + (period * DAY * index) / 7;
    const binEnd = metrics.start + (period * DAY * (index + 1)) / 7;
    const hours = metrics.intervals.reduce((sum, interval) => (
      sum + Math.max(0, Math.min(interval.end, binEnd) - Math.max(interval.start, binStart)) / 3600000
    ), 0);
    return {
      label: period === 7
        ? new Date(binStart).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
        : `${Math.floor((index * period) / 7) + 1}-${Math.floor(((index + 1) * period) / 7)}`,
      hours,
    };
  });
  const maxHours = Math.max(...bins.map((item) => item.hours), 1);
  const efficiency = Math.min(100, Math.round((metrics.hours / (period * 12)) * 100));
  const history = [...metrics.events].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[palette.dadosSecondary, palette.dadosPrimary]} style={styles.header}>
        <Text style={styles.title}>Relatórios</Text>
        <Text style={styles.subtitle}>Últimos {period} dias</Text>
        <View style={styles.rowBottom}>
          <Text style={styles.bigNumber}>{metrics.hours.toFixed(1)}h</Text>
          <Text style={styles.bigLabel}>ao ar livre</Text>
          <View style={styles.changePill}>
            <Feather name={change === null || change >= 0 ? 'trending-up' : 'trending-down'} size={11} color="#fff" />
            <Text style={styles.changeText}>{change === null ? ' Sem comparação' : ` ${change > 0 ? '+' : ''}${change}%`}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.tabsRow}>
        {PERIODS.map((days) => (
          <TouchableOpacity key={days} style={[styles.tab, period === days && styles.tabActive]} onPress={() => setPeriod(days)}>
            <Text style={[styles.tabText, period === days && styles.tabTextActive]}>{days} dias</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Feather name="sun" size={16} color={palette.warning} />
          <Text style={styles.statNumber}>{metrics.daysOpen}</Text>
          <Text style={styles.statLabel}>Dias com varal aberto</Text>
        </View>
        <View style={styles.statCard}>
          <Feather name="cloud-rain" size={16} color="#4C8DF0" />
          <Text style={styles.statNumber}>{metrics.events.filter((event) => event.isOpen === false).length}</Text>
          <Text style={styles.statLabel}>Recolhimentos</Text>
        </View>
        <View style={styles.statCard}>
          <Feather name="activity" size={16} color={palette.dadosPrimary} />
          <Text style={styles.statNumber}>{events.length}</Text>
          <Text style={styles.statLabel}>Ações registradas · total</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.rowSpaceBetween}>
          <Text style={styles.cardTitle}>Horas ao ar livre</Text>
          {change !== null && <View style={styles.changePillLight}><Feather name={change >= 0 ? 'trending-up' : 'trending-down'} size={11} color={palette.dadosPrimary} /><Text style={styles.changeTextDark}> {change > 0 ? '+' : ''}{change}%</Text></View>}
        </View>
        <Text style={styles.chartSubtitle}>Período selecionado · horas por intervalo</Text>
        <View style={styles.chart}>
          {bins.map((item, index) => (
            <View key={`${item.label}-${index}`} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${(item.hours / maxHours) * 100}%` }]} />
              </View>
              <Text style={styles.barLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.legendRow}><View style={styles.legendDot} /><Text style={styles.legendText}>Horas com o varal estendido</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Metas do período</Text>
        {[
          { label: 'Dias com sol aproveitado', value: metrics.daysOpen, max: period, color: '#F0A93A' },
          { label: 'Ações automáticas executadas', value: metrics.autoActions, max: Math.max(period, 5), color: '#6C4CE0' },
          { label: 'Eficiência de uso', value: efficiency, max: 100, color: '#2FBE79', percent: true },
        ].map((goal) => (
          <View key={goal.label} style={{ marginTop: 14 }}>
            <View style={styles.rowSpaceBetween}>
              <Text style={styles.goalLabel}>{goal.label}</Text>
              <Text style={styles.goalValue}>{goal.percent ? `${goal.value}%` : `${goal.value} / ${goal.max}`}</Text>
            </View>
            <View style={styles.goalTrack}><View style={[styles.goalFill, { width: `${Math.min(100, (goal.value / goal.max) * 100)}%`, backgroundColor: goal.color }]} /></View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Histórico de ações · últimos {period} dias</Text>
        {history.length ? history.map((event, index) => (
          <View key={event.id} style={[styles.historyRow, index !== history.length - 1 && styles.historyRowBorder]}>
            <View style={[styles.historyIcon, { backgroundColor: isAutomatic(event) ? '#4C8DF022' : '#2FBE7922' }]}>
              <Feather name={isAutomatic(event) ? 'cloud-rain' : 'repeat'} size={14} color={isAutomatic(event) ? '#4C8DF0' : palette.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyTitle}>{event.action || (event.isOpen ? 'Varal estendido' : 'Varal recolhido')}</Text>
              <Text style={styles.historyTime}>{formatTime(event.timestamp)} · {isAutomatic(event) ? 'Automática' : 'Manual'}</Text>
            </View>
          </View>
        )) : <Text style={styles.emptyText}>As ações do varal aparecerão aqui após a sincronização com o Firebase.</Text>}
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { paddingTop: 54, paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  rowBottom: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 14 },
  bigNumber: { color: '#fff', fontSize: 40, fontWeight: '800' },
  bigLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginLeft: 8, marginBottom: 6 },
  changePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 'auto', marginBottom: 6 },
  changeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tabsRow: { flexDirection: 'row', backgroundColor: '#E4E8F1', marginHorizontal: 18, marginTop: -16, borderRadius: 14, padding: 4 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 12, color: palette.textMuted, fontWeight: '600' },
  tabTextActive: { color: palette.dadosPrimary, fontWeight: '700' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 18, marginTop: 16, gap: 10 },
  statCard: { flex: 1, backgroundColor: palette.card, borderRadius: 16, padding: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  statNumber: { fontSize: 18, fontWeight: '800', color: palette.textDark, marginTop: 8 },
  statLabel: { fontSize: 10, color: palette.textMuted, marginTop: 2, lineHeight: 13 },
  card: { backgroundColor: palette.card, borderRadius: 20, marginHorizontal: 18, marginTop: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: palette.textDark },
  rowSpaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  changePillLight: { flexDirection: 'row', alignItems: 'center', backgroundColor: `${palette.dadosPrimary}1A`, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  changeTextDark: { color: palette.dadosPrimary, fontSize: 11, fontWeight: '700' },
  chartSubtitle: { fontSize: 11, color: palette.textMuted, marginTop: 2 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', height: 110, marginTop: 16, alignItems: 'flex-end' },
  barCol: { alignItems: 'center', flex: 1 },
  barTrack: { width: 18, height: 90, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 5, minHeight: 4, backgroundColor: '#4C9DF0' },
  barLabel: { fontSize: 9, color: palette.textMuted, marginTop: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5, backgroundColor: '#4C9DF0' },
  legendText: { fontSize: 10, color: palette.textMuted },
  goalLabel: { fontSize: 12, color: palette.textDark },
  goalValue: { fontSize: 12, color: palette.textMuted, fontWeight: '600' },
  goalTrack: { height: 6, borderRadius: 3, backgroundColor: palette.border, marginTop: 6, overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 3 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: palette.border },
  historyIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  historyTitle: { fontSize: 13, fontWeight: '600', color: palette.textDark },
  historyTime: { fontSize: 11, color: palette.textMuted, marginTop: 2 },
  emptyText: { fontSize: 12, color: palette.textMuted, marginTop: 12, lineHeight: 18 },
});
