import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../theme/Colors';

function getDocumentContent(text) {
  let content = String(text || '')
    .replace(/^(?:POLÍTICA DE PRIVACIDADE|TERMOS DE USO)\s*[—-]\s*RETRACTA\s*/i, '');
  const updatedAt = content.match(/Última atualização:\s*([^.\n]+?)(?=\s+Aplicativo:|$)/i)?.[1]?.trim() || '';
  const firstSection = content.match(/\b1\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/);
  if (firstSection) content = content.slice(content.indexOf(firstSection[0]));

  const lines = content
    .replace(/(\s)(\d{1,2}(?:\.\d{1,2})?\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/g, '\n$2')
    .replace(/\s*●\s*/g, '\n• ')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return { updatedAt, lines };
}

function DocumentText({ text }) {
  const { lines } = useMemo(() => getDocumentContent(text), [text]);
  return lines.map((line, index) => {
    if (line.startsWith('• ')) {
      return (
        <View key={`bullet-${index}`} style={styles.bulletRow}>
          <Feather name="check-circle" size={14} color={palette.configDark} />
          <Text style={styles.bulletText}>{line.slice(2)}</Text>
        </View>
      );
    }

    const section = line.match(/^(\d{1,2}\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\s—–-]{2,}?)(?:\s+)(.*)$/);
    if (section) {
      return (
        <View key={`section-${index}`} style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>{section[1].trim()}</Text>
          {section[2] ? <Text style={styles.paragraph}>{section[2]}</Text> : null}
        </View>
      );
    }

    if (/^\d{1,2}(?:\.\d{1,2})?\.\s/.test(line)) {
      return <Text key={`subsection-${index}`} style={styles.subsectionHeading}>{line}</Text>;
    }

    return <Text key={`paragraph-${index}`} style={styles.paragraph}>{line}</Text>;
  });
}

export default function LegalDocumentModal({
  visible,
  title,
  text,
  sections,
  description,
  onClose,
}) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const isHelp = Array.isArray(sections);
  const document = useMemo(() => getDocumentContent(text), [text]);
  const descriptionText = description || (
    title?.toLowerCase().includes('problema')
      ? 'Confira orientações rápidas para identificar e resolver situações comuns.'
      : 'Respostas objetivas para ajudar você a usar os recursos do RETRACTA.'
  );

  useEffect(() => {
    if (visible) setExpandedIndex(null);
  }, [title, visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <LinearGradient colors={['#26344F', '#1D2333']} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerIcon}>
              <Feather name={isHelp ? 'help-circle' : 'file-text'} size={18} color="#fff" />
            </View>
            <Text style={styles.eyebrow}>{isHelp ? 'CENTRAL DE AJUDA' : 'DOCUMENTO RETRACTA'}</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar documento" style={styles.closeButton}>
              <Feather name="x" size={21} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {isHelp ? descriptionText : document.updatedAt ? `Atualizado em ${document.updatedAt}` : 'Leia as informações deste documento.'}
          </Text>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {isHelp ? (
            <>
              <View style={styles.introCard}>
                <View style={styles.introIcon}>
                  <Feather name={title?.toLowerCase().includes('problema') ? 'tool' : 'message-circle'} size={18} color={palette.configDark} />
                </View>
                <Text style={styles.introText}>{descriptionText}</Text>
              </View>
              {sections.map((section, index) => {
                const expanded = expandedIndex === index;
                return (
                  <View key={`${section.question}-${index}`} style={styles.helpCard}>
                    <TouchableOpacity
                      style={styles.questionRow}
                      onPress={() => setExpandedIndex(expanded ? null : index)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                    >
                      <View style={styles.questionNumber}>
                        <Text style={styles.questionNumberText}>{String(index + 1).padStart(2, '0')}</Text>
                      </View>
                      <Text style={styles.question}>{section.question}</Text>
                      <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={palette.configDark} />
                    </TouchableOpacity>
                    {expanded && (
                      <View style={styles.answerWrap}>
                        <View style={styles.answerDivider} />
                        <Text style={styles.answer}>{section.answer}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          ) : (
            <>
              {document.updatedAt ? (
                <View style={styles.documentBadge}>
                  <Feather name="shield" size={15} color={palette.success} />
                  <Text style={styles.documentBadgeText}>Versão vigente · {document.updatedAt}</Text>
                </View>
              ) : null}
              <View style={styles.documentCard}>
                <DocumentText text={text} />
              </View>
            </>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F5FA' },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { flex: 1, marginLeft: 10, color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 18 },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 18, marginTop: 5 },
  content: { padding: 18, paddingBottom: 36 },
  introCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 12 },
  introIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#2C6FE018', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  introText: { flex: 1, color: palette.textDark, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  helpCard: { backgroundColor: '#fff', borderRadius: 16, marginTop: 9, paddingHorizontal: 14, shadowColor: '#000', shadowOpacity: 0.035, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  questionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  questionNumber: { width: 31, height: 31, borderRadius: 10, backgroundColor: '#2C6FE018', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  questionNumberText: { color: palette.configDark, fontSize: 10, fontWeight: '800' },
  question: { flex: 1, color: palette.textDark, fontSize: 13, lineHeight: 18, fontWeight: '700', marginRight: 8 },
  answerWrap: { paddingBottom: 14 },
  answerDivider: { height: 1, backgroundColor: palette.border, marginBottom: 11 },
  answer: { color: palette.textMuted, fontSize: 12, lineHeight: 19, paddingHorizontal: 2 },
  documentBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 12 },
  documentBadgeText: { color: palette.textDark, fontSize: 10, fontWeight: '700', marginLeft: 7 },
  documentCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18 },
  sectionBlock: { marginBottom: 17, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: palette.border },
  sectionHeading: { color: palette.configDark, fontSize: 14, lineHeight: 20, fontWeight: '800', marginBottom: 7 },
  subsectionHeading: { color: palette.textDark, fontSize: 13, lineHeight: 19, fontWeight: '800', marginTop: 7, marginBottom: 4 },
  paragraph: { color: palette.textDark, fontSize: 12, lineHeight: 19, marginBottom: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 9, paddingLeft: 3 },
  bulletText: { flex: 1, color: palette.textDark, fontSize: 12, lineHeight: 19, marginLeft: 8 },
});
