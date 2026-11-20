import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { palette } from '../theme/Colors';

export default function LegalDocumentModal({ visible, title, text, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar documento">
            <Feather name="x" size={22} color={palette.textDark} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.body}>{text}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: palette.border },
  title: { color: palette.textDark, fontSize: 18, fontWeight: '800', flex: 1, marginRight: 12 },
  content: { padding: 20, paddingBottom: 40 },
  body: { color: palette.textDark, fontSize: 14, lineHeight: 22 },
});
