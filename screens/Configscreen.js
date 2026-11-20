import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Asset } from 'expo-asset';
import { Feather } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { signOut } from 'firebase/auth';
import { palette } from '../theme/Colors';
import { aboutInfo, helpItems, notificationSettings } from '../data/Mockdata';
import { auth } from '../utils/firebaseAuth';
import { updateUserData } from '../utils/RetractaData';
import {
  requestNotificationPermission,
  syncScheduleNotifications,
} from '../utils/notifications';
import useRetractaData from '../utils/useRetractaData';
import LegalDocumentModal from '../components/LegalDocumentModal';
import privacyPolicy from '../assets/legal/privacy.json';
import termsOfUse from '../assets/legal/terms.json';
import manualMontagem from '../assets/documents/manual-montagem.pdf';
import manualManutencao from '../assets/documents/manual-manutencao.pdf';
import VaralManager from '../components/VaralManager';

function SectionLabel({ icon, children }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Feather name={icon} size={13} color={palette.textMuted} />
      <Text style={styles.sectionLabel}>{children}</Text>
    </View>
  );
}

function ToggleRow({ title, subtitle, value, onValueChange, disabled = false }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={Boolean(value)}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: '#D3D9E8', true: palette.configDark }}
        thumbColor="#fff"
      />
    </View>
  );
}

function NavRow({ title, subtitle, rightLabel, onPress }) {
  return (
    <TouchableOpacity style={styles.navRow} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSubtitle}>{subtitle}</Text>
      </View>
      {rightLabel ? <Text style={styles.navRowRight}>{rightLabel}</Text> : null}
      <Feather name="chevron-right" size={16} color="#C0C5D4" style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
}

function formatUptime(totalSeconds) {
  const seconds = Number(totalSeconds);
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

function wifiQuality(rssi) {
  if (typeof rssi !== 'number') return '—';
  if (rssi >= -60) return 'Excelente';
  if (rssi >= -70) return 'Boa';
  if (rssi >= -80) return 'Regular';
  return 'Fraca';
}

const HEALTH_ALERTS = {
  posicao_incerta: 'O aparelho reiniciou durante um movimento. Confira a posição real do varal.',
  sensor_chuva_travado: 'O sensor de chuva está há horas detectando água. Limpe e seque a placa do sensor.',
  wifi_fraco: 'Sinal Wi-Fi fraco no aparelho. Aproxime o roteador ou use um repetidor.',
};

const FAQ_ITEMS = [
  {
    question: 'O aplicativo funciona sem o ESP32?',
    answer: 'Sem o ESP32 conectado, a posição do varal, os comandos de movimento e a automação ficam indisponíveis. Nenhum comando é enviado ao motor.',
  },
  {
    question: 'Como sei se o varal está conectado?',
    answer: 'A tela Início e esta tela mostram o estado da conexão. O ESP32 precisa atualizar o lastSeen no Firebase regularmente; após 120 segundos sem atualização, os controles ficam indisponíveis.',
  },
  {
    question: 'Os agendamentos movimentam o varal?',
    answer: 'Os lembretes de agenda são notificações locais e não acionam o motor. Para executar movimentos programados, o firmware do ESP32 precisa implementar os agendamentos.',
  },
  {
    question: 'Como vejo o clima de outro varal?',
    answer: 'Na tela Início, selecione o varal nos botões abaixo do clima. A consulta usa as coordenadas cadastradas em Meus varais.',
  },
  {
    question: 'Por que o clima não carrega?',
    answer: 'Verifique a conexão com a internet e a chave OpenWeatherMap. Uma chave rejeitada ou ainda não ativada será informada na tela Início. Após alterar .env.local, reinicie o Expo com npx expo start -c.',
  },
  {
    question: 'Como funcionam as notificações?',
    answer: 'Ative a opção desejada e autorize notificações nas configurações do celular. Lembretes de agenda são locais. Alertas remotos com o app fechado exigem um servidor.',
  },
  {
    question: 'Meus dados ficam salvos?',
    answer: 'Os dados da conta e do dispositivo ficam no Firebase. O histórico das estatísticas usa apenas eventos registrados pelo ESP32.',
  },
  {
    question: 'O agendamento de manutenção funciona?',
    answer: 'Não. A solicitação de manutenção não está disponível nesta versão e nenhum serviço é contratado pelo aplicativo.',
  },
];

const TROUBLESHOOTING_ITEMS = [
  {
    question: 'O Android mostra erro ao pedir permissão de notificações.',
    answer: 'O app pede a permissão diretamente e usa o canal de fallback do Expo para exibir notificações. Feche e abra o aplicativo novamente. Se o erro continuar, atualize o Expo Go compatível com o SDK do projeto ou instale uma nova versão de desenvolvimento do app.',
  },
  {
    question: 'Não recebo notificações.',
    answer: 'Confira a permissão de notificações do Retracta nas configurações do Android e se a preferência correspondente está ativada no app. O sistema pode limitar notificações em segundo plano.',
  },
  {
    question: 'A posição ou os controles estão indisponíveis.',
    answer: 'Confirme que o ESP32 está conectado à internet e autenticado no Firebase, e que atualiza users/{uid}/device/lastSeen e device/isOpen. Consulte o contrato de integração no README.',
  },
];

export default function ConfigScreen() {
  const { data, uid, lastSync, error, varais, activeVaralId, activeVaral } = useRetractaData();
  const settings = data.settings;
  const notifications = settings.notifications || {};
  const [legalDocument, setLegalDocument] = useState(null);
  const [now, setNow] = useState(Date.now());
  const lastSeen = Number(data.device.lastSeen || 0);
  const deviceOnline = Number.isFinite(lastSeen)
    && now - lastSeen < 120000
    && (!activeVaral?.deviceId
      || String(data.device.id || '').toUpperCase() === String(activeVaral.deviceId).toUpperCase());
  const smartMode = data.device.smartMode !== false;
  const autoReopen = data.device.autoReopen !== false;
  const health = deviceOnline && data.device.health ? data.device.health : null;
  const healthColor = !health ? palette.textMuted : health.status === 'fault' ? palette.danger : health.status === 'attention' ? palette.warning : palette.success;
  const healthIconName = !health ? 'help-circle' : health.status === 'fault' ? 'alert-octagon' : health.status === 'attention' ? 'alert-triangle' : 'check-circle';
  const healthTitle = !health ? 'Sem dados do aparelho' : health.status === 'fault' ? 'Atenção: verifique o varal' : health.status === 'attention' ? 'Funcionando, com um aviso' : 'O varal está ótimo';
  const healthText = !health
    ? 'Os dados de saúde aparecem quando o ESP32 está conectado.'
    : HEALTH_ALERTS[health.alert] || 'Wi-Fi, sensor de chuva e motor sem alertas.';
  const rainSensorLabel = !health ? '—' : health.rainSensor === 'rain' ? 'Detectando chuva' : health.rainSensor === 'suspect' ? 'Suspeito' : 'Seco';
  const lastMoveText = health && health.lastMoveAt
    ? `${new Date(health.lastMoveAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${health.lastMoveMs ? ` · ${Math.round(health.lastMoveMs / 1000)} s` : ''}`
    : '—';

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const updateSettings = async (path, values) => {
    try {
      await updateUserData(uid, path, values, activeVaralId);
      return true;
    } catch (writeError) {
      Alert.alert('Não foi possível salvar a configuração', writeError.message);
      return false;
    }
  };

  const toggleNotification = async (key) => {
    const enabled = !notifications[key];
    if (enabled) {
      let granted;
      try {
        granted = await requestNotificationPermission();
      } catch (permissionError) {
        Alert.alert('Falha ao solicitar permissão', permissionError.message);
        return;
      }
      if (!granted) {
        Alert.alert(
          'Notificações desativadas no aparelho',
          'Autorize as notificações do Retracta nas configurações do celular para ativar este aviso.',
        );
        return;
      }
    }

    const saved = await updateSettings('settings/notifications', { [key]: enabled });
    if (!saved) return;
    if (key === 'schedules') {
      try {
        await syncScheduleNotifications(data.schedules, enabled, activeVaralId);
      } catch (notificationError) {
        Alert.alert('Não foi possível atualizar os lembretes', notificationError.message);
      }
    }
  };

  const toggleSmartMode = async (value) => {
    if (!deviceOnline) return;
    await updateSettings('device', { smartMode: value });
  };

  const toggleAutoReopen = async (value) => {
    if (!deviceOnline) return;
    await updateSettings('device', { autoReopen: value });
  };

  const cycleSensitivity = () => {
    const options = ['Baixa', 'Média', 'Alta'];
    const next = options[(options.indexOf(settings.sensorSensitivity || 'Média') + 1) % options.length];
    updateSettings('settings', { sensorSensitivity: next });
  };

  const cycleDelay = () => {
    const options = [1, 3, 5, 10];
    const next = options[(options.indexOf(Number(settings.retractionDelay) || 3) + 1) % options.length];
    updateSettings('settings', { retractionDelay: next });
  };

  const shareManual = async (module) => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Compartilhamento indisponível', 'Este aparelho não possui um leitor/compartilhador de PDF disponível.');
        return;
      }
      const asset = Asset.fromModule(module);
      await asset.downloadAsync();
      await Sharing.shareAsync(asset.localUri || asset.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Abrir manual RETRACTA',
      });
    } catch (shareError) {
      Alert.alert('Não foi possível abrir o manual', shareError.message);
    }
  };

  const openHelpItem = (item) => {
    if (item.id === 1 || item.id === 2) {
      shareManual(manualMontagem);
    } else if (item.id === 3) {
      shareManual(manualManutencao);
    } else if (item.id === 4 || item.id === 5) {
      const entries = item.id === 4 ? FAQ_ITEMS : TROUBLESHOOTING_ITEMS;
      setLegalDocument({
        title: item.id === 4 ? 'Perguntas frequentes' : 'Solução de problemas',
        sections: entries,
        description: item.id === 4
          ? 'Toque em uma pergunta para consultar a resposta.'
          : 'Abra um tópico para ver orientações práticas de diagnóstico.',
      });
    } else if (item.id === 6) {
      Linking.openURL('mailto:retractacompany@gmail.com?subject=Suporte%20RETRACTA&body=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20aplicativo%20RETRACTA.')
        .catch((linkError) => Alert.alert('Não foi possível abrir o e-mail', linkError.message));
    }
  };

  const logout = () => Alert.alert('Sair da conta', 'Deseja encerrar sua sessão?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Sair', style: 'destructive', onPress: () => signOut(auth).catch((signOutError) => Alert.alert('Falha ao sair', signOutError.message)) },
  ]);
  const syncText = lastSync ? new Date(lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Aguardando';
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Configurações</Text>
            <Text style={styles.subtitle}>{auth.currentUser?.email || 'Conta Retracta'}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Feather name="log-out" size={16} color="#fff" />
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.deviceCard}>
        <View style={styles.deviceTop}>
          <View style={styles.deviceIcon}><Feather name="smartphone" size={20} color="#fff" /></View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.deviceName}>{activeVaral?.name || 'Varal Retracta'}</Text>
            <Text style={styles.deviceId}>ID: {activeVaral?.deviceId || data.device.id || 'Aguardando dispositivo'}</Text>
            <View style={styles.connRow}>
              <View style={[styles.connDot, { backgroundColor: deviceOnline ? '#4ADE80' : '#F0A93A' }]} />
              <Text style={styles.connText}>{deviceOnline ? 'ESP32 conectado' : 'ESP32 desconectado · controles indisponíveis'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.deviceStatsRow}>
          <View style={styles.deviceStat}>
            <Text style={styles.deviceStatNumber}>{data.device.firmware || '—'}</Text>
            <Text style={styles.deviceStatLabel}>Firmware</Text>
          </View>
          <View style={styles.deviceStat}>
            <Text style={styles.deviceStatNumber}>
              {!deviceOnline || data.device.isOpen === undefined ? 'Indisponível' : data.device.isOpen ? 'Aberto' : 'Recolhido'}
            </Text>
            <Text style={styles.deviceStatLabel}>Posição recebida</Text>
          </View>
          <View style={styles.deviceStat}>
            <Text style={styles.deviceStatNumber}>{health && typeof health.cycles === 'number' ? health.cycles : '—'}</Text>
            <Text style={styles.deviceStatLabel}>Ciclos</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <SectionLabel icon="wind">VARAIS E DISPOSITIVOS</SectionLabel>
        <VaralManager
          uid={uid}
          data={data}
          varais={varais}
          activeVaralId={activeVaralId}
        />

        <SectionLabel icon="heart">SAÚDE DO EQUIPAMENTO</SectionLabel>
        <View style={styles.healthCard}>
          <View style={[styles.healthIcon, { backgroundColor: `${healthColor}1A` }]}><Feather name={healthIconName} size={18} color={healthColor} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.healthTitle}>{healthTitle}</Text>
            <Text style={styles.toggleSubtitle}>{healthText}</Text>
          </View>
        </View>
        {health && (
          <View style={[styles.card, { marginTop: 12 }]}>
            <NavRow title="Sinal Wi-Fi" subtitle={`${health.wifiSsid || 'Rede'} · ${typeof health.wifiRssi === 'number' ? `${health.wifiRssi} dBm` : '—'}`} rightLabel={wifiQuality(health.wifiRssi)} />
            <View style={styles.rowDivider} />
            <NavRow title="Sensor de chuva" subtitle="Estado lido agora pelo ESP32" rightLabel={rainSensorLabel} />
            <View style={styles.rowDivider} />
            <NavRow title="Ligado há" subtitle={`Último reinício: ${health.resetReason || '—'}`} rightLabel={formatUptime(health.uptimeSec)} />
            <View style={styles.rowDivider} />
            <NavRow title="Última movimentação" subtitle="Data e duração do último curso do motor" rightLabel={lastMoveText} />
            <View style={styles.rowDivider} />
            <NavRow title="Movimentos do motor" subtitle="Total de vezes que o varal recolheu ou estendeu" rightLabel={String(health.movements ?? '—')} />
          </View>
        )}
        <View style={styles.syncCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.syncTitle}>Última sincronização</Text>
            <Text style={styles.syncSubtitle}>{error ? 'Erro na conexão com o Firebase' : 'Último dado recebido pelo aplicativo'}</Text>
          </View>
          <View style={styles.syncPill}>
            <Feather name={error ? 'x' : 'check'} size={10} color={error ? palette.danger : palette.success} />
            <Text style={[styles.syncPillText, error && { color: palette.danger }]}> {error ? 'Falhou' : syncText}</Text>
          </View>
        </View>
        <View style={styles.maintenanceNotice}>
          <Feather name="tool" size={17} color={palette.warning} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.toggleTitle}>Agendamento de manutenção</Text>
            <Text style={styles.toggleSubtitle}>Não funcional nesta versão. Nenhuma solicitação de serviço é enviada.</Text>
          </View>
        </View>

        <SectionLabel icon="sliders">GERAL</SectionLabel>
        <View style={styles.card}>
          <ToggleRow title="Modo Inteligente" subtitle={deviceOnline ? 'Automação via sensor de chuva' : 'Indisponível até conectar o ESP32.'} value={smartMode} onValueChange={toggleSmartMode} disabled={!deviceOnline} />
          <View style={styles.rowDivider} />
          <ToggleRow title="Estender de novo quando a chuva parar" subtitle={deviceOnline ? 'Requer automação configurada no ESP32.' : 'Indisponível até conectar o ESP32.'} value={autoReopen} onValueChange={toggleAutoReopen} disabled={!deviceOnline} />
          <View style={styles.rowDivider} />
          <NavRow title="Sensibilidade do sensor" subtitle="Preferência enviada ao ESP32" rightLabel={settings.sensorSensitivity || 'Média'} onPress={cycleSensitivity} />
          <View style={styles.rowDivider} />
          <NavRow title="Delay de retração" subtitle="Atraso configurado antes de recolher" rightLabel={`${settings.retractionDelay || 3}s`} onPress={cycleDelay} />
        </View>

        <SectionLabel icon="wifi">CONEXÃO</SectionLabel>
        <View style={styles.card}>
          <NavRow title="Wi-Fi do ESP32" subtitle="A rede deve ser configurada no firmware do dispositivo" rightLabel={deviceOnline ? 'Online' : 'Desconectado'} onPress={() => Alert.alert('Configuração Wi-Fi', 'Configure o SSID e a senha da rede diretamente no firmware. Consulte o contrato de integração no README.')} />
        </View>

        <SectionLabel icon="bell">NOTIFICAÇÕES</SectionLabel>
        <View style={styles.card}>
          {notificationSettings.map((notification, index) => {
            const key = ({ 1: 'rain', 2: 'schedules', 3: 'status' })[notification.id];
            return (
              <React.Fragment key={notification.id}>
                <ToggleRow
                  title={notification.title}
                  subtitle={notification.subtitle}
                  value={notifications[key]}
                  onValueChange={() => toggleNotification(key)}
                />
                {index !== notificationSettings.length - 1 && <View style={styles.rowDivider} />}
              </React.Fragment>
            );
          })}
          <Text style={styles.notificationNote}>Lembretes de agenda são locais e não acionam o motor. Alertas remotos exigem um servidor Firebase.</Text>
        </View>

        <SectionLabel icon="lock">PRIVACIDADE</SectionLabel>
        <View style={styles.card}>
          <ToggleRow title="Dados de uso anônimos" subtitle="Preferência de compartilhamento de métricas não pessoais" value={settings.anonymousData} onValueChange={(value) => updateSettings('settings', { anonymousData: value })} />
          <View style={styles.rowDivider} />
          <NavRow title="Política de privacidade" subtitle="Leia o documento RETRACTA fornecido" onPress={() => setLegalDocument({ title: 'Política de Privacidade — RETRACTA', text: privacyPolicy })} />
        </View>

        <SectionLabel icon="help-circle">AJUDA E MANUAL</SectionLabel>
        <View style={styles.card}>
          {helpItems.map((item, index) => (
            <React.Fragment key={item.id}>
              <NavRow title={item.title} subtitle={item.subtitle} onPress={() => openHelpItem(item)} />
              {index !== helpItems.length - 1 && <View style={styles.rowDivider} />}
            </React.Fragment>
          ))}
        </View>

        <SectionLabel icon="info">SOBRE</SectionLabel>
        <View style={styles.card}>
          <NavRow title="Versão do aplicativo" subtitle={`${aboutInfo.appVersion} · ${aboutInfo.appVersionDate}`} rightLabel={aboutInfo.appVersionStatus} onPress={() => Alert.alert('Retracta', `Versão ${aboutInfo.appVersion}`)} />
          <View style={styles.rowDivider} />
          <NavRow title="Versão do firmware" subtitle="Software interno que controla o motor e os sensores do dispositivo" rightLabel={data.device.firmware ? `v${data.device.firmware}` : '—'} />
          <View style={styles.rowDivider} />
          <NavRow title="Tempo ligado do dispositivo" subtitle="Tempo desde o último reinício do ESP32" rightLabel={health ? formatUptime(health.uptimeSec) : '—'} />
          <View style={styles.rowDivider} />
          <NavRow title="Termos de uso" subtitle="Leia o documento RETRACTA fornecido" onPress={() => setLegalDocument({ title: 'Termos de Uso — RETRACTA', text: termsOfUse })} />
        </View>
        <View style={[styles.card, { marginTop: 12 }]}>
          {aboutInfo.teamMembers.map((member, index) => (
            <React.Fragment key={member}>
              <NavRow title={member} subtitle="Integrante do grupo RETRACTA" />
              {index !== aboutInfo.teamMembers.length - 1 && <View style={styles.rowDivider} />}
            </React.Fragment>
          ))}
        </View>
        <View style={{ height: 24 }} />
      </View>

      <LegalDocumentModal
        visible={Boolean(legalDocument)}
        title={legalDocument?.title || ''}
        text={legalDocument?.text || ''}
        sections={legalDocument?.sections}
        description={legalDocument?.description}
        onClose={() => setLegalDocument(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { backgroundColor: palette.configDark, paddingTop: 54, paddingHorizontal: 20, paddingBottom: 32, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 },
  logoutButton: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  logoutText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  deviceCard: { marginHorizontal: 18, marginTop: -20, borderRadius: 20, padding: 18, backgroundColor: '#2C6FE0' },
  deviceTop: { flexDirection: 'row', alignItems: 'center' },
  deviceIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  deviceName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deviceId: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  connRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  connDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  connText: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  deviceStatsRow: { flexDirection: 'row', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 12 },
  deviceStat: { flex: 1, alignItems: 'center' },
  deviceStatNumber: { color: '#fff', fontSize: 14, fontWeight: '800' },
  deviceStatLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 3 },
  body: { paddingHorizontal: 18, marginTop: 4 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 10 },
  sectionLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginLeft: 6 },
  healthCard: { backgroundColor: palette.card, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  healthIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${palette.success}1A` },
  healthTitle: { fontSize: 14, fontWeight: '800', color: palette.textDark, marginBottom: 4 },
  toggleSubtitle: { fontSize: 11.5, color: palette.textMuted, marginTop: 3, lineHeight: 16 },
  syncCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.card, borderRadius: 16, padding: 14, marginTop: 12 },
  syncTitle: { fontSize: 13, fontWeight: '700', color: palette.textDark },
  syncSubtitle: { fontSize: 11, color: palette.textMuted, marginTop: 2 },
  syncPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: `${palette.success}1A`, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  syncPillText: { fontSize: 10, color: palette.success, fontWeight: '700' },
  maintenanceNotice: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.card, borderRadius: 16, padding: 14, marginTop: 12 },
  card: { backgroundColor: palette.card, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: palette.textDark },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  navRowRight: { fontSize: 12, fontWeight: '700', color: palette.textDark, marginRight: 2, maxWidth: 120 },
  rowDivider: { height: 1, backgroundColor: palette.border },
  notificationNote: { fontSize: 11, color: palette.textMuted, lineHeight: 16, paddingBottom: 12 },
});
