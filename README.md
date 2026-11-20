# RETRACTA

Aplicativo Expo/React Native para o varal retrátil. O app usa Firebase Authentication e Realtime Database, consulta o OpenWeatherMap e oferece agenda, notificações locais e estatísticas a partir do histórico real enviado pelo ESP32.

O aplicativo também permite baixar relatórios de estatísticas em PDF, cadastrar vários varais com suas localizações e IDs de dispositivos, alternar entre eles e navegar pelas abas com gestos laterais.

## Objetivo e público-alvo

O RETRACTA busca facilitar a secagem e a proteção de roupas por meio de um varal retrátil automatizado, que pode ser monitorado e controlado pelo aplicativo. O projeto atende pessoas que usam varais em residências e querem acompanhar o equipamento, configurar horários e consultar as condições do tempo.

## Funcionalidades principais

- Cadastro e autenticação de usuários por e-mail e senha, com recuperação de senha.
- Tela inicial com clima da localização do varal selecionado e controle manual quando o ESP32 está conectado.
- Agendamentos, notificações locais, histórico e estatísticas com exportação em PDF.
- Cadastro, seleção e remoção de vários varais, mapa de locais e associação por ID de dispositivo.
- Configurações, saúde do equipamento, manuais, FAQ, solução de problemas, termos e política de privacidade.
- Splash screen com identidade RETRACTA, navegação por abas e gestos laterais.

## Tecnologias

React Native e Expo; Firebase Authentication e Realtime Database; AsyncStorage; Expo Notifications, Print e Sharing; OpenWeatherMap; OpenStreetMap, Leaflet e Nominatim.

## Integrantes do grupo

- Arthur Souza da Silva
- Davi Nathan Mendes Sousa
- Giovanna Cintra Santana
- Laura Araújo Caprarola

## Executar o aplicativo

```sh
npm install
npx expo start -c
```

Entre com uma conta criada em Firebase Authentication. Sem um ESP32 conectado, o estado, os comandos do motor e as automações aparecem como indisponíveis; o aplicativo não inventa uma posição nem envia comandos. Para habilitar essas funções, o firmware precisa publicar um `lastSeen` recente e `device/isOpen` como booleano. Após 120 segundos sem atualização, os controles ficam indisponíveis.

## Configuração do Firebase

O projeto usado está configurado em [firebaseConfig.js](./firebaseConfig.js). Os valores também podem ser substituídos por variáveis `EXPO_PUBLIC_FIREBASE_*` em `.env.local` (copie [`.env.example`](./.env.example)). Variáveis `EXPO_PUBLIC_*` são incluídas no aplicativo: nunca coloque nelas senhas, chaves de serviço ou segredos privados. A chave OpenWeather fica visível no cliente e deve ter restrições e limites configurados no provedor.

No console do Firebase:

1. Habilite **Authentication → E-mail/senha**. O app usa login, cadastro e envio de e-mail de redefinição de senha; não usa login passwordless por link nem Cordova.
2. Crie o **Realtime Database** na região correta e confirme que sua URL é a `databaseURL` configurada no app.
3. Publique regras que restrinjam a conta do app aos próprios dados. Para uso somente com a conta do aplicativo:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "deviceAccess": {
      ".read": false,
      ".write": false
    }
  }
}
```

O app oferece autenticação por e-mail e senha, incluindo cadastro e redefinição de senha. Não é necessário configurar login Google.

## OpenWeatherMap e mapa

O app consulta `/data/2.5/weather` com as coordenadas do varal selecionado na tela **Início**. Edite o nome e a localização em **Config → Meus varais**, no botão de engrenagem. A seleção de local usa mapa OpenStreetMap e geocodificação Nominatim; requer internet e respeita a atribuição exibida no mapa. Preencha `EXPO_PUBLIC_OPENWEATHER_API_KEY` no `.env.local`, reinicie o Expo com `npx expo start -c` e restrinja a chave no painel do OpenWeatherMap. Para varais novos, a localização fica em `users/{uid}/varais/{varalId}/settings/location`; o cadastro legado usa `users/{uid}/settings/location`. Se a API falhar, o app mostra o erro sem apresentar valores substitutos.

## Notificações

- A permissão do sistema é solicitada quando o usuário ativa uma preferência de notificação.
- No Android, o app usa o canal de fallback do Expo para evitar falhas ao criar um canal personalizado durante o pedido de permissão.
- As notificações de agenda são lembretes locais recorrentes nos dias e horário selecionados. Elas não acionam o motor.
- O agendamento de manutenção não está funcional nesta versão; nenhum pedido de serviço é enviado.
- Mudanças de posição e eventos de chuva recebidos do Firebase podem gerar notificações locais enquanto a Home está aberta.
- Push quando o app está encerrado exige uma função backend confiável (por exemplo, Firebase Cloud Functions com FCM/Expo Push Service). Não envie credenciais de serviço ao app nem ao firmware. As opções no app não fingem que um ESP32 desconectado enviou uma notificação.
- O FAQ e o diagnóstico de notificações, conexão e clima ficam em **Config → Ajuda e manual**.

## Cadastro de vários varais e dispositivos

Em **Config → Varais e dispositivos**, cadastre cada varal com um nome, coordenadas e o ID publicado pelo ESP32. Use a engrenagem para editar nome, localização ou ID, e o mapa para conferir os locais cadastrados. Na tela **Início**, os botões selecionam um varal por vez; clima, estado, agenda, histórico e estatísticas acompanham a seleção. O cadastro do app não autentica nem autoriza um ESP32: a autorização do Firebase continua sendo uma operação administrativa.

Para manter usuários existentes, o app preserva o formato antigo na raiz `users/{uid}` como varal `legacy`. Novos varais são armazenados separadamente:

```json
{
  "settings": { "activeVaralId": "varal-id" },
  "varais": {
    "varal-id": {
      "name": "Varal da varanda",
      "deviceId": "RTR-4821-PRO",
      "location": { "latitude": -23.55, "longitude": -46.63, "name": "São Paulo" },
      "device": { "id": "RTR-4821-PRO", "lastSeen": 1793470000000 },
      "settings": {},
      "schedules": [],
      "history": {}
    }
  }
}
```

Para conectar um ESP32 novo, adapte o firmware para usar o caminho específico `users/{uid}/varais/{varalId}` para estado, comandos, configurações, agenda e histórico. O dispositivo deve publicar `device/id` igual ao ID cadastrado; o app só indica conexão quando esse ID coincide e `device/lastSeen` foi atualizado nos últimos 120 segundos. Configure `deviceAccess/{deviceUid}/{ownerUid}/{varalId}` fora do app e restrinja as regras do Realtime Database ao varal autorizado. O firmware legado, que usa apenas `users/{uid}/device`, continua compatível com o varal `legacy` enquanto as regras atuais autorizarem esse caminho; ele precisa ser atualizado para controlar os novos cadastros.

## Contrato de dados do Realtime Database

Cada instalação do app lê e escreve dentro de `users/{uid}`. O formato esperado é:

```json
{
  "device": {
    "id": "RTR-4821-PRO",
    "firmware": "1.0.0",
    "isOpen": true,
    "smartMode": true,
    "lastSeen": 1793470000000,
    "command": {
      "commandId": "id-unico",
      "isOpen": false,
      "source": "manual",
      "createdAt": 1793470000000,
      "status": "pending"
    }
  },
  "schedules": [
    {
      "id": "schedule-id",
      "title": "Recolher à noite",
      "active": true,
      "time": "19:30 · Recolher varal",
      "action": "close",
      "days": [0, 1, 2, 3, 4, 5, 6],
      "subtitle": "Todos os dias",
      "icon": "moon"
    }
  ],
  "history": {
    "event-id": {
      "timestamp": 1793470000000,
      "source": "automatic",
      "isOpen": false,
      "action": "Varal recolhido por chuva"
    }
  }
}
```

### Implementação do firmware, passo a passo

1. **Defina a identidade do dispositivo.** Use Wi-Fi, sincronize a hora com NTP e autentique o ESP32 com uma conta Firebase própria para o dispositivo. Não grave no firmware a senha do usuário do aplicativo, uma chave de serviço Firebase nem credenciais de administrador.
2. **Autorize apenas o dispositivo correto.** Para cada ESP32 com UID próprio, configure no Firebase Admin o vínculo `deviceAccess/{deviceUid}/{ownerUid}/{varalId}: true`. Para o formato de vários varais, aplique regras no nó do varal, não no nó inteiro do usuário:

   ```json
   {
     "rules": {
       "users": {
         "$uid": {
           ".read": "auth != null && auth.uid === $uid",
           ".write": "auth != null && auth.uid === $uid",
           "varais": {
             "$varalId": {
               ".read": "auth != null && (auth.uid === $uid || root.child('deviceAccess').child(auth.uid).child($uid).child($varalId).val() === true)",
               ".write": "auth != null && (auth.uid === $uid || root.child('deviceAccess').child(auth.uid).child($uid).child($varalId).val() === true)"
             }
           }
         }
       },
       "deviceAccess": {
         ".read": false,
         ".write": false
       }
     }
   }
   ```

   Crie os vínculos com Firebase Admin/Console, nunca pelo aplicativo público. O firmware de vários varais deve usar o caminho específico `users/{uid}/varais/{varalId}`. Não use regras `.read: true` ou `.write: true`.
3. **Publique o estado ao iniciar.** Após conectar ao Wi-Fi/Firebase e ler o sensor/posição real, publique `device/isOpen`, `device/smartMode`, `device/lastSeen`, `device/id` e `device/firmware` dentro de `users/{uid}/varais/{varalId}`. Atualize `lastSeen` periodicamente (por exemplo, a cada 30 segundos) como timestamp Unix em milissegundos obtido por NTP. Não use `millis()` como relógio: ele reinicia a cada boot.
4. **Escute `device/command`.** Observe ou consulte o comando dentro do varal para detectar um `commandId` novo com `status: "pending"`. Valide que `isOpen` é booleano e não repita um `commandId` já executado. Compare o estado alvo com a posição atual; não mova o motor se já estiver nessa posição.
5. **Execute com segurança e confirme.** Verifique limites e condições seguras, mova o motor sem bloquear a leitura do sensor por longos períodos, e só depois publique a posição física confirmada em `device/isOpen`. Marque o comando como concluído (por exemplo, `device/command/status: "completed"` e `completedAt`) ou como erro com uma mensagem segura. O app espera essa confirmação e não representa um comando pendente como posição alcançada.
6. **Respeite o modo inteligente.** Leia `device/smartMode` dentro do varal; só execute a automação do sensor de chuva quando estiver `true`. Priorize uma proteção contra chuva sobre um horário de abertura. Serializar comandos manuais, agendamentos e movimentos do sensor evita duas movimentações simultâneas.
7. **Execute os agendamentos no ESP32.** Leia `schedules` dentro do varal, ignore regras inativas e dispare no máximo uma vez por regra/data local. `days` usa `0=domingo, 1=segunda, …, 6=sábado`; `time` inicia com `HH:mm`; `action` é `open` ou `close`. O ESP32 deve usar a hora local configurada e persistir a última execução para não repetir a ação após reconexão ou reinicialização. O app não executa agendamentos de motor em segundo plano.
8. **Registre o histórico confirmado.** Depois de cada mudança real de posição (manual, chuva ou agenda), crie um novo filho em `history` dentro do varal com `timestamp` Unix em milissegundos, `source` (`manual` ou `automatic`), `isOpen` booleano e descrição `action`. Registre a posição inicial conhecida no início. As telas de estatísticas usam esses eventos; sem histórico completo, as métricas não são completas.
9. **Teste a perda de rede.** Se o Firebase cair, não deixe o motor alternar repetidamente nem marque comando como concluído. Refaça a conexão com atraso progressivo, valide novamente o `commandId` após reconectar e mantenha os limites de segurança locais.

### Atenção ao motor e ao trecho Arduino

O trecho de exemplo atual só movimenta o motor localmente ao detectar chuva. Ele ainda não consulta comandos do app, não publica a posição e usa `step()` bloqueante. Ao adaptar o firmware, mantenha a lógica de proteção contra chuva, mas acrescente a conexão autenticada, leitura idempotente de comandos, publicação de posição/heartbeat, suporte a `smartMode` e agendamentos, registro do histórico e tratamento de falha de rede. Dimensione deslocamento e limites conforme o motor e sensores físicos do protótipo; não use os passos de exemplo sem validar os limites mecânicos.

## Armazenamento das telas

- Conta, preferências, localização, agenda e telemetria ficam no Firebase conforme as regras acima.
- Estatísticas e histórico usam os eventos reais confirmados em `history` no Firebase. Sem eventos do ESP32, as métricas são indicadas como indisponíveis.
- Termos e política exibidos na tela vêm dos PDFs fornecidos e são empacotados como texto em `assets/legal`.
- Manuais em PDF são abertos pelo compartilhamento do sistema para que o usuário escolha um leitor.

## Validar o pacote

```sh
npx expo export --platform all
```

O comando acima valida a geração dos bundles web, Android e iOS. O funcionamento com múltiplos ESP32s também depende do firmware e das regras Firebase descritas nesta documentação.
