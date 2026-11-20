import React, { useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { palette } from '../theme/Colors';
import { createVaral, deleteVaral, selectVaral, updateVaralProfile } from '../utils/RetractaData';
import { syncScheduleNotifications } from '../utils/notifications';
import MapPickerModal from './MapPickerModal';

const DEFAULT_LOCATION = { latitude: -23.5505, longitude: -46.6333, name: 'São Paulo' };

function isOnline(varal) {
  const lastSeen = Number(varal.device?.lastSeen || 0);
  return Number.isFinite(lastSeen)
    && Date.now() - lastSeen < 120000
    && (!varal.deviceId
      || String(varal.device?.id || '').toUpperCase() === String(varal.deviceId).toUpperCase());
}

export default function VaralManager({ uid, data, varais, activeVaralId }) {
  const [formVisible, setFormVisible] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [editingVaral, setEditingVaral] = useState(null);
  const [name, setName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [location, setLocation] = useState(data.settings.location || DEFAULT_LOCATION);
  const [saving, setSaving] = useState(false);

  const markers = varais
    .map((varal) => ({
      latitude: Number(varal.location?.latitude),
      longitude: Number(varal.location?.longitude),
      name: varal.name,
    }))
    .filter((marker) => Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude));
  const mapCenter = markers[0] || DEFAULT_LOCATION;

  const resetForm = () => {
    setEditingVaral(null);
    setName('');
    setDeviceId('');
    setLocation(data.settings.location || DEFAULT_LOCATION);
    setFormVisible(false);
  };

  const editVaral = (varal) => {
    setEditingVaral(varal);
    setName(varal.name || '');
    setDeviceId(varal.deviceId || '');
    setLocation(varal.settings?.location || varal.location || DEFAULT_LOCATION);
    setFormVisible(true);
  };

  const saveVaral = async () => {
    if (saving) return;
    const trimmedName = name.trim();
    const normalizedDeviceId = deviceId.trim().toUpperCase();
    const requiresDeviceId = !editingVaral || Boolean(editingVaral.deviceId);
    if (!trimmedName || (requiresDeviceId && !normalizedDeviceId)) {
      Alert.alert('Dados obrigatórios', 'Informe o nome do varal e o ID configurado no dispositivo.');
      return;
    }
    if (normalizedDeviceId && varais.some((varal) => (
      varal.id !== editingVaral?.id
      && String(varal.deviceId || '').toUpperCase() === normalizedDeviceId
    ))) {
      Alert.alert('Dispositivo já cadastrado', 'Este ID já está associado a um varal desta conta.');
      return;
    }

    try {
      setSaving(true);
      if (editingVaral) {
        await updateVaralProfile(uid, editingVaral.id, {
          name: trimmedName,
          deviceId: normalizedDeviceId,
          location,
        });
      } else {
        const id = `varal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const value = {
          name: trimmedName,
          deviceId: normalizedDeviceId,
          createdAt: Date.now(),
          location,
          device: { smartMode: true, autoReopen: true },
          schedules: [],
          history: {},
          settings: {
            ...data.settings,
            scheduleInitialized: false,
            location,
          },
        };
        await createVaral(uid, id, value);
      }
      resetForm();
    } catch (error) {
      Alert.alert(
        editingVaral ? 'Não foi possível atualizar o varal' : 'Não foi possível cadastrar o varal',
        error.message,
      );
    } finally {
      setSaving(false);
    }
  };

  const changeVaral = async (id) => {
    if (id === activeVaralId) return;
    try {
      await selectVaral(uid, id);
    } catch (error) {
      Alert.alert('Não foi possível selecionar o varal', error.message);
    }
  };

  const confirmRemoveVaral = (varal) => {
    Alert.alert(
      'Remover varal',
      `Deseja remover "${varal.name}" e todos os dados associados a este cadastro?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            const nextActiveVaralId = activeVaralId === varal.id ? 'legacy' : activeVaralId;
            try {
              await deleteVaral(uid, varal.id, nextActiveVaralId);
            } catch (error) {
              Alert.alert('Não foi possível remover o varal', error.message);
              return;
            }

            try {
              await syncScheduleNotifications([], false, varal.id);
            } catch (error) {
              Alert.alert('Varal removido com pendência', `Não foi possível cancelar os lembretes: ${error.message}`);
              return;
            }
            Alert.alert('Varal removido', 'O cadastro e seus dados foram removidos.');
          },
        },
      ],
    );
  };

  return (
    <View>
      <View style={styles.sectionHeading}>
        <View style={styles.headingText}>
          <Text style={styles.sectionTitle}>Meus varais</Text>
          <Text style={styles.sectionSubtitle}>Cadastre locais e associe cada dispositivo à sua conta.</Text>
        </View>
        <TouchableOpacity style={styles.mapButton} onPress={() => setMapVisible(true)} accessibilityLabel="Ver mapa dos varais">
          <Feather name="map" size={17} color={palette.configDark} />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {varais.map((varal, index) => {
          const online = isOnline(varal);
          const selected = varal.id === activeVaralId;
          const coords = varal.location
            ? `${Number(varal.location.latitude).toFixed(4)}, ${Number(varal.location.longitude).toFixed(4)}`
            : 'Local não definido';
          return (
            <React.Fragment key={varal.id}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.varalRow}>
                <TouchableOpacity
                  style={styles.varalContent}
                  onPress={() => changeVaral(varal.id)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.varalIcon, selected && styles.varalIconSelected]}>
                    <Feather name="wind" size={17} color={selected ? '#fff' : palette.configDark} />
                  </View>
                  <View style={styles.varalText}>
                    <View style={styles.nameRow}>
                      <Text style={styles.varalName} numberOfLines={1}>{varal.name || 'Varal Retracta'}</Text>
                      {selected && <Text style={styles.selectedLabel}>ATIVO</Text>}
                    </View>
                    <Text style={styles.varalMeta} numberOfLines={1}>{varal.deviceId ? `ID ${varal.deviceId}` : 'Dispositivo não vinculado'}</Text>
                    <Text style={styles.varalMeta} numberOfLines={1}>{coords}</Text>
                  </View>
                  <View style={styles.connection}>
                    <View style={[styles.connectionDot, { backgroundColor: online ? palette.success : palette.warning }]} />
                    <Text style={styles.connectionText}>{online ? 'Conectado' : 'Aguardando'}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => editVaral(varal)}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar ${varal.name}`}
                >
                  <Feather name="settings" size={16} color={palette.configDark} />
                </TouchableOpacity>
                {!varal.legacy && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => confirmRemoveVaral(varal)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover ${varal.name}`}
                  >
                    <Feather name="trash-2" size={16} color={palette.danger} />
                  </TouchableOpacity>
                )}
              </View>
            </React.Fragment>
          );
        })}
        <TouchableOpacity style={styles.addButton} onPress={() => setFormVisible(true)}>
          <Feather name="plus" size={16} color={palette.configDark} />
          <Text style={styles.addButtonText}>Adicionar varal e dispositivo</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={formVisible} transparent animationType="slide" onRequestClose={resetForm}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingVaral ? 'Editar varal' : 'Novo varal'}</Text>
              <TouchableOpacity onPress={resetForm} accessibilityLabel="Fechar cadastro">
                <Feather name="x" size={21} color={palette.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Nome do local</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex.: Varal da varanda"
              maxLength={50}
            />
            <Text style={styles.label}>ID do dispositivo</Text>
            <TextInput
              style={styles.input}
              value={deviceId}
              onChangeText={setDeviceId}
              placeholder="Ex.: RTR-4821-PRO"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={80}
            />
            <Text style={styles.helper}>O ID precisa corresponder ao publicado pelo firmware do ESP32. Se alterar o ID, atualize também o firmware.</Text>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={() => {
                setFormVisible(false);
                setLocationPickerVisible(true);
              }}
            >
              <Feather name="map-pin" size={16} color={palette.configDark} />
              <Text style={styles.locationText}>
                Localização: {location.name || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
              </Text>
              <Feather name="chevron-right" size={16} color={palette.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={saveVaral} disabled={saving}>
              <Text style={styles.saveButtonText}>
                {saving ? 'Salvando...' : editingVaral ? 'Salvar alterações' : 'Cadastrar varal'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <MapPickerModal
        visible={locationPickerVisible}
        location={location}
        title={editingVaral ? 'Local do varal' : 'Local do novo varal'}
        markers={markers}
        onClose={() => {
          setLocationPickerVisible(false);
          setFormVisible(true);
        }}
        onSelect={(point) => {
          setLocation({ ...point, name: `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}` });
          setLocationPickerVisible(false);
          setFormVisible(true);
        }}
      />
      <MapPickerModal
        visible={mapVisible}
        location={mapCenter}
        title="Mapa dos varais cadastrados"
        markers={markers}
        readOnly
        onClose={() => setMapVisible(false)}
        onSelect={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headingText: { flex: 1 },
  sectionTitle: { color: palette.textDark, fontSize: 15, fontWeight: '800' },
  sectionSubtitle: { color: palette.textMuted, fontSize: 11, marginTop: 3 },
  mapButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: palette.card, borderRadius: 18, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  varalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  varalContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  varalIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  varalIconSelected: { backgroundColor: palette.configDark },
  varalText: { flex: 1, marginLeft: 10, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  varalName: { flexShrink: 1, color: palette.textDark, fontSize: 13, fontWeight: '700' },
  selectedLabel: { color: palette.configDark, fontSize: 8, fontWeight: '800' },
  varalMeta: { color: palette.textMuted, fontSize: 10, marginTop: 2 },
  connection: { alignItems: 'center', minWidth: 52 },
  connectionDot: { width: 7, height: 7, borderRadius: 4 },
  connectionText: { color: palette.textMuted, fontSize: 9, marginTop: 4 },
  removeButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: `${palette.danger}14`, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  editButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  divider: { height: 1, backgroundColor: palette.border },
  addButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: palette.border },
  addButtonText: { color: palette.configDark, fontSize: 12, fontWeight: '700', marginLeft: 7 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { color: palette.textDark, fontSize: 18, fontWeight: '800' },
  label: { color: palette.textMuted, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 5 },
  input: { height: 46, borderWidth: 1, borderColor: palette.border, borderRadius: 12, paddingHorizontal: 12, color: palette.textDark },
  helper: { color: palette.textMuted, fontSize: 10, marginTop: 5, lineHeight: 14 },
  locationButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 12, marginTop: 16 },
  locationText: { flex: 1, color: palette.textDark, fontSize: 11, marginHorizontal: 8 },
  saveButton: { backgroundColor: palette.configDark, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 16 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
