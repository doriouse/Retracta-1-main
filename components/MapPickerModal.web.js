import React, { useEffect, useRef } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { palette } from '../theme/Colors';
import { createMapHtml } from '../utils/mapHtml';

export default function MapPickerModal({ visible, location, onClose, onSelect }) {
  const iframe = useRef(null);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== iframe.current?.contentWindow || event.data?.type !== 'retracta-location') return;
      try {
        const selected = JSON.parse(event.data.payload);
        if (Number.isFinite(selected.latitude) && Number.isFinite(selected.longitude)) onSelect(selected);
      } catch (error) {
        console.error('Invalid map location message', error);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSelect]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Local do clima</Text>
            <Text style={styles.subtitle}>Busque uma cidade ou toque no mapa para marcar o ponto.</Text>
          </View>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar mapa"><Feather name="x" size={22} color={palette.textDark} /></TouchableOpacity>
        </View>
        {React.createElement('iframe', {
          ref: iframe,
          title: 'Mapa para selecionar a cidade do clima',
          srcDoc: createMapHtml(location.latitude, location.longitude),
          style: { border: 0, flex: 1, width: '100%' },
          allow: 'geolocation',
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingHorizontal: 18, paddingBottom: 14 },
  title: { color: palette.textDark, fontSize: 18, fontWeight: '800' },
  subtitle: { color: palette.textMuted, fontSize: 12, marginTop: 4 },
});
