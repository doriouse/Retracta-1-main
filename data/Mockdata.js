export const weather = {
  condition: 'Parcialmente nublado',
  temp: 22,
  humidity: 62,
  wind: 14,
  thermalSensation: 27,
};

export const clothesPieces = [
  { id: 1, color: '#4C8DF0' },
  { id: 2, color: '#8B6CF0' },
  { id: 3, color: '#F0A93A' },
  { id: 4, color: '#2FBE79' },
  { id: 5, color: '#E8452F' },
];

export const schedules = [
  {
    id: 1,
    title: 'Abertura matinal',
    subtitle: 'Todo dia útil',
    time: '07:00 · Abrir varal',
    icon: 'sun',
    color: '#F0A93A',
    status: 'Ativo',
    active: true,
  },
  {
    id: 2,
    title: 'Recolher à noite',
    subtitle: 'Todos os dias',
    time: '19:30 · Recolher varal',
    icon: 'clock',
    color: '#4C8DF0',
    status: 'Ativo',
    active: true,
  },
  {
    id: 3,
    title: 'Proteção contra chuva',
    subtitle: 'Sensor de chuva',
    time: 'Automático · Prioridade alta',
    icon: 'cloud-rain',
    color: '#6C4CE0',
    status: 'Ativo',
    active: true,
  },
  {
    id: 4,
    title: 'Final de semana',
    subtitle: 'Sáb e Dom',
    time: '08:00 · Abrir varal',
    icon: 'calendar',
    color: '#7A7F91',
    status: 'Inativo',
    active: false,
  },
];

export const notificationSettings = [
  {
    id: 1,
    title: 'Alerta de chuva',
    subtitle: 'Avisa quando o sensor detecta chuva e o varal for recolhido automaticamente',
  },
  {
    id: 2,
    title: 'Agendamentos',
    subtitle: 'Confirma cada ação programada antes de executar',
  },
  {
    id: 3,
    title: 'Mudança de status',
    subtitle: 'Notifica toda vez que o varal abre ou fecha',
  },
  {
    id: 4,
    title: 'Manutenção preventiva',
    subtitle: 'Lembrete quando a próxima revisão estiver próxima',
  },
];

export const helpItems = [
  { id: 1, title: 'Manual de instalação', subtitle: 'Como instalar o varal na parede' },
  { id: 2, title: 'Manual de montagem', subtitle: 'Passo a passo de montagem' },
  { id: 3, title: 'Manual de manutenção', subtitle: 'Cuidados, limpeza e conservação' },
  { id: 4, title: 'Perguntas frequentes', subtitle: 'FAQ com as dúvidas mais comuns' },
  { id: 5, title: 'Solução de problemas', subtitle: 'Diagnóstico de erros e falhas' },
  { id: 6, title: 'Contato com suporte', subtitle: 'Fale conosco — seg a sex, 8h–18h' },
];

export const aboutInfo = {
  appVersion: '2.1.0',
  appVersionDate: 'Atualizado em julho de 2025',
  appVersionStatus: 'Atual',
};