import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { palette } from '../theme/Colors';
import { createMapHtml } from '../utils/mapHtml';

export default function MapPickerModal({
  visible,
  location,
  onClose,
  onSelect,
  title = 'Local do clima',
  markers = [],
  readOnly = false,
}) {
  const source = createMapHtml(location.latitude, location.longitude, markers, readOnly);

  const handleMessage = (event) => {
    try {
      const selected = JSON.parse(event.nativeEvent.data);
      if (!readOnly && Number.isFinite(selected.latitude) && Number.isFinite(selected.longitude)) onSelect(selected);
    } catch (error) {
      console.error('Invalid map location message', error);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{readOnly ? 'Toque em um marcador para ver o nome do varal.' : 'Busque uma cidade ou toque no mapa para marcar o ponto.'}</Text>
          </View>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar mapa"><Feather name="x" size={22} color={palette.textDark} /></TouchableOpacity>
        </View>
        <WebView
          source={{ html: source }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
          style={styles.map}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingHorizontal: 18, paddingBottom: 14 },
  title: { color: palette.textDark, fontSize: 18, fontWeight: '800' },
  subtitle: { color: palette.textMuted, fontSize: 12, marginTop: 4 },
  map: { flex: 1 },
});
