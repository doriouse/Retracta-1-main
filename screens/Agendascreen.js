import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { palette } from '../theme/Colors';
import { saveUserData } from '../utils/RetractaData';
import { syncScheduleNotifications } from '../utils/notifications';
import useRetractaData from '../utils/useRetractaData';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const SCHEDULE_ICONS = ['sun', 'cloud-rain', 'clock', 'calendar', 'home', 'moon', 'zap', 'umbrella', 'wind', 'activity'];

export default function AgendaScreen() {
  const { data, uid, loaded, hasSchedules, activeVaralId } = useRetractaData();
  const schedules = data.schedules;
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState(() => {
    const date = new Date();
    date.setHours(8, 0, 0, 0);
    return date;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [action, setAction] = useState('open');
  const [icon, setIcon] = useState('sun');
  const activeCount = schedules.filter((item) => item.active).length;

  useEffect(() => {
    if (loaded && !hasSchedules && !data.settings.scheduleInitialized && uid) {
      Promise.all([
        saveUserData(uid, 'schedules', [], activeVaralId),
        saveUserData(uid, 'settings/scheduleInitialized', true, activeVaralId),
      ]).catch((error) => Alert.alert('Falha ao carregar agenda', error.message));
    }
  }, [activeVaralId, data.settings.scheduleInitialized, hasSchedules, loaded, uid]);

  const persist = async (updated) => {
    try {
      await Promise.all([
        saveUserData(uid, 'schedules', updated, activeVaralId),
        saveUserData(uid, 'settings/scheduleInitialized', true, activeVaralId),
      ]);
    } catch (error) {
      Alert.alert('Não foi possível salvar o agendamento', error.message);
      return false;
    }

    if (data.settings.notifications?.schedules) {
      try {
        await syncScheduleNotifications(updated, true, activeVaralId);
      } catch (error) {
        Alert.alert('Agendamento salvo sem atualizar os lembretes', error.message);
      }
    }
    return true;
  };

  const toggle = (id) => persist(schedules.map((item) => (
    item.id === id ? { ...item, active: !item.active, status: item.active ? 'Inativo' : 'Ativo' } : item
  )));

  const addSchedule = () => {
    if (!title.trim() || days.length === 0) {
      Alert.alert('Dados inválidos', 'Informe um nome e selecione ao menos um dia da semana.');
      return;
    }
    const hour = String(time.getHours()).padStart(2, '0');
    const minute = String(time.getMinutes()).padStart(2, '0');
    const newSchedule = {
      id: `schedule-${Date.now()}`,
      title: title.trim(),
      subtitle: days.length === 7 ? 'Todos os dias' : days.map((day) => WEEKDAYS[day]).join(', '),
      time: `${hour}:${minute} · ${action === 'open' ? 'Estender' : 'Recolher'} varal`,
      action,
      days,
      icon,
      color: action === 'open' ? '#F0A93A' : '#4C8DF0',
      status: 'Ativo',
      active: true,
    };
    persist([...schedules, newSchedule]).then((saved) => {
      if (!saved) return;
      setTitle('');
      const resetTime = new Date();
      resetTime.setHours(8, 0, 0, 0);
      setTime(resetTime);
      setDays([0, 1, 2, 3, 4, 5, 6]);
      setIcon('sun');
      setShowTimePicker(false);
      setModalVisible(false);
    });
  };

  const removeSchedule = (schedule) => {
    Alert.alert('Remover agendamento', `Deseja remover "${schedule.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => persist(schedules.filter((item) => item.id !== schedule.id)) },
    ]);
  };

  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[palette.agendaPrimary, '#4B2FB0']} style={styles.header}>
        <Text style={styles.title}>Agendamentos</Text>
        <Text style={styles.subtitle}>{activeCount} de {schedules.length} agendamentos ativos</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${schedules.length ? (activeCount / schedules.length) * 100 : 0}%` }]} />
        </View>
      </LinearGradient>

      <View style={styles.noticeCard}>
        <Feather name="info" size={16} color={palette.warning} />
        <Text style={styles.noticeText}>Os horários geram lembretes locais e não movimentam o motor. A execução depende de firmware ESP32 compatível.</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.sectionLabel}>PROGRAMADOS</Text>
        {schedules.map((schedule) => (
          <View key={schedule.id} style={[styles.card, { borderLeftColor: schedule.active ? schedule.color : '#D3D9E8' }]}>
            <View style={[styles.iconWrap, { backgroundColor: `${schedule.color}22` }]}>
              <Feather name={schedule.icon || 'clock'} size={18} color={schedule.color} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{schedule.title}</Text>
                {schedule.active && <Text style={styles.statusPillText}>Ativo</Text>}
              </View>
              <Text style={styles.cardSubtitle}>{schedule.subtitle}</Text>
              <Text style={styles.cardTime}>{schedule.time}</Text>
            </View>
            <Switch value={Boolean(schedule.active)} onValueChange={() => toggle(schedule.id)} trackColor={{ false: '#D3D9E8', true: schedule.color }} thumbColor="#fff" />
            <TouchableOpacity onPress={() => removeSchedule(schedule)} style={styles.removeButton} accessibilityLabel="Remover agendamento">
              <Feather name="trash-2" size={16} color={palette.textMuted} />
            </TouchableOpacity>
          </View>
        ))}
        {schedules.length === 0 && <Text style={styles.emptyText}>Nenhum horário cadastrado.</Text>}

        <TouchableOpacity activeOpacity={0.85} style={styles.newButtonWrap} onPress={() => setModalVisible(true)}>
          <LinearGradient colors={[palette.agendaPrimary, '#4B2FB0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.newButton}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.newButtonText}>Novo Agendamento</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.tipBox}>
          <Feather name="zap" size={16} color={palette.agendaPrimary} />
          <Text style={styles.tipText}>
            <Text style={{ fontWeight: '700' }}>Dica inteligente{'\n'}</Text>
            O ESP32 deve ler os horários salvos nesta agenda para executar as regras mesmo quando o aplicativo estiver fechado.
          </Text>
        </View>
        <View style={{ height: 24 }} />
      </View>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo agendamento</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Feather name="x" size={22} color={palette.textMuted} /></TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Nome da regra</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Ex.: Abrir pela manhã" style={styles.input} />
            <Text style={styles.inputLabel}>Horário</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTimePicker(true)}>
              <Feather name="clock" size={16} color={palette.agendaPrimary} />
              <Text style={styles.pickerButtonText}>{time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={time}
                mode="time"
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                onChange={(event, selectedTime) => {
                  if (event.type === 'set' && selectedTime) setTime(selectedTime);
                  if (Platform.OS !== 'ios') setShowTimePicker(false);
                }}
              />
            )}
            {Platform.OS === 'ios' && showTimePicker && (
              <TouchableOpacity onPress={() => setShowTimePicker(false)} style={styles.pickerDone}>
                <Text style={styles.pickerDoneText}>Concluir seleção do horário</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.inputLabel}>Dias da semana</Text>
            <View style={styles.daysRow}>
              {WEEKDAYS.map((day, index) => {
                const selected = days.includes(index);
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => setDays((current) => selected ? current.filter((value) => value !== index) : [...current, index].sort())}
                    style={[styles.dayButton, selected && styles.dayButtonActive]}
                  >
                    <Text style={[styles.dayButtonText, selected && styles.dayButtonTextActive]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.inputLabel}>Ação</Text>
            <View style={styles.actionChoice}>
              {['open', 'close'].map((value) => (
                <TouchableOpacity key={value} onPress={() => setAction(value)} style={[styles.actionOption, action === value && styles.actionOptionActive]}>
                  <Text style={[styles.actionOptionText, action === value && styles.actionOptionTextActive]}>{value === 'open' ? 'Estender' : 'Recolher'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Ícone do agendamento</Text>
            <View style={styles.iconsGrid}>
              {SCHEDULE_ICONS.map((iconName) => (
                <TouchableOpacity
                  key={iconName}
                  accessibilityLabel={`Selecionar ícone ${iconName}`}
                  onPress={() => setIcon(iconName)}
                  style={[styles.iconChoice, icon === iconName && styles.iconChoiceActive]}
                >
                  <Feather name={iconName} size={19} color={icon === iconName ? '#fff' : palette.agendaPrimary} />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={addSchedule} style={styles.saveButton}><Text style={styles.saveButtonText}>Salvar horário</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { paddingTop: 54, paddingHorizontal: 20, paddingBottom: 26, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  progressTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, marginTop: 16, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },
  noticeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5E7', borderRadius: 14, marginHorizontal: 18, marginTop: 12, padding: 14 },
  noticeText: { flex: 1, color: palette.textDark, fontSize: 11, lineHeight: 16, marginLeft: 9 },
  body: { paddingHorizontal: 18, marginTop: 18 },
  sectionLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.card, borderRadius: 16, borderLeftWidth: 4, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: palette.textDark, flexShrink: 1 },
  cardSubtitle: { fontSize: 12, color: palette.textMuted, marginTop: 2 },
  cardTime: { fontSize: 12, color: palette.textMuted, marginTop: 2 },
  statusPillText: { fontSize: 10, color: palette.success, fontWeight: '700', marginLeft: 4 },
  removeButton: { padding: 6, marginLeft: 4 },
  emptyText: { color: palette.textMuted, fontSize: 13, marginVertical: 14 },
  newButtonWrap: { marginTop: 6, marginBottom: 16 },
  newButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 16 },
  newButtonText: { color: '#fff', fontWeight: '700', fontSize: 15, marginLeft: 8 },
  tipBox: { flexDirection: 'row', backgroundColor: `${palette.agendaPrimary}14`, borderRadius: 16, padding: 14 },
  tipText: { flex: 1, marginLeft: 10, color: palette.textDark, fontSize: 12, lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { color: palette.textDark, fontSize: 18, fontWeight: '800' },
  inputLabel: { color: palette.textMuted, fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: palette.border, borderRadius: 12, paddingHorizontal: 12, height: 44, color: palette.textDark },
  pickerButton: { borderWidth: 1, borderColor: palette.border, borderRadius: 12, height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 9 },
  pickerButtonText: { color: palette.textDark, fontWeight: '700' },
  pickerDone: { alignItems: 'center', padding: 8 },
  pickerDoneText: { color: palette.agendaPrimary, fontWeight: '700' },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  dayButton: { width: 39, height: 39, borderRadius: 20, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  dayButtonActive: { backgroundColor: palette.agendaPrimary, borderColor: palette.agendaPrimary },
  dayButtonText: { color: palette.textMuted, fontSize: 11, fontWeight: '600' },
  dayButtonTextActive: { color: '#fff' },
  iconsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  iconChoice: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  iconChoiceActive: { backgroundColor: palette.agendaPrimary, borderColor: palette.agendaPrimary },
  actionChoice: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionOption: { flex: 1, borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 12, alignItems: 'center' },
  actionOptionActive: { backgroundColor: palette.agendaPrimary, borderColor: palette.agendaPrimary },
  actionOptionText: { color: palette.textMuted, fontWeight: '600' },
  actionOptionTextActive: { color: '#fff' },
  saveButton: { backgroundColor: palette.agendaPrimary, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 18 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
