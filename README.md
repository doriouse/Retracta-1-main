# RETRACTA

Aplicativo Expo/React Native para o varal retrátil. O app usa Firebase Authentication e Realtime Database, consulta o OpenWeatherMap e oferece agenda, notificações locais, estatísticas e um modo de demonstração que não precisa do ESP32.

## Executar e apresentar sem o ESP32

```sh
npm install
npx expo start -c
```

Entre com uma conta criada em Firebase Authentication. Na tela **Início**, quando o campo `device/lastSeen` não tiver sido atualizado pelo ESP32 nos últimos 120 segundos, o app entra no **modo demonstração local**:

- O varal começa estendido e os botões **Recolher/Estender** funcionam com contagem de 10 segundos.
- O estado e o modo inteligente de demonstração são guardados no aparelho em AsyncStorage.
- A tela informa que a ação é demonstrativa; nenhum comando é enviado ao motor.
- As ações locais de demonstração são guardadas no aparelho e aparecem nas estatísticas e no histórico como ações manuais demonstrativas. Elas não são enviadas ao Firebase nem representam movimentos do hardware.
- As estatísticas combinam esses eventos demonstrativos locais com os eventos reais recebidos em `history` do Firebase. O cartão **Recolhimentos** inclui todos os fechamentos no período; a meta de ações automáticas conta apenas eventos automáticos.

Quando o ESP32 publicar um `lastSeen` recente e um estado `isOpen` booleano, a Home troca para o controle real. Se o sinal ficar sem atualização por mais de 120 segundos, volta à demonstração.

## Configuração do Firebase

O projeto usado está configurado em [firebaseConfig.js](./firebaseConfig.js). Os valores também podem ser substituídos por variáveis `EXPO_PUBLIC_FIREBASE_*` em `.env.local` (copie [`.env.example`](./.env.example)). Variáveis `EXPO_PUBLIC_*` são incluídas no aplicativo: nunca coloque nelas senhas, chaves de serviço ou segredos privados.

No console do Firebase:

1. Habilite **Authentication → E-mail/senha**. O app usa login, cadastro e envio de e-mail de redefinição de senha; não usa login passwordless por link nem Cordova.
2. Crie o **Realtime Database** na região correta e confirme que sua URL é a `databaseURL` configurada no app.
3. Publique regras que restrinjam a conta do app aos próprios dados. Para desenvolvimento sem ESP32:

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

O app consulta `/data/2.5/weather` por latitude e longitude. A seleção de local usa mapa OpenStreetMap e geocodificação Nominatim; requer internet e respeita a atribuição exibida no mapa. A cidade e as coordenadas escolhidas são guardadas em `users/{uid}/settings/location`. Preencha `EXPO_PUBLIC_OPENWEATHER_API_KEY` no `.env.local`; restrinja a chave no painel do OpenWeatherMap quando possível. Se a API falhar, a Home mostra clima de demonstração e informa isso na tela, em vez de bloquear a apresentação.

## Notificações

- A permissão do sistema é solicitada quando o usuário ativa uma preferência de notificação.
- No Android, o app usa o canal de fallback do Expo para evitar falhas ao criar um canal personalizado durante o pedido de permissão.
- As notificações de agenda são lembretes locais recorrentes nos dias e horário selecionados. Elas não acionam o motor.
- A manutenção é apenas um registro de demonstração guardado localmente no aparelho. O lembrete local é programado para o dia anterior, quando ainda houver tempo.
- Mudanças de posição e eventos de chuva recebidos do Firebase podem gerar notificações locais enquanto a Home está aberta.
- Push quando o app está encerrado exige uma função backend confiável (por exemplo, Firebase Cloud Functions com FCM/Expo Push Service). Não envie credenciais de serviço ao app nem ao firmware. As opções no app não fingem que um ESP32 desconectado enviou uma notificação.
- O FAQ e o diagnóstico de notificações, conexão e clima ficam em **Config → Ajuda e manual**.

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
2. **Autorize apenas o dispositivo correto.** Para um ESP32 com UID próprio, configure no Firebase Admin um vínculo administrativo `deviceAccess/{deviceUid}/{ownerUid}: true`. Amplie as regras apenas para esse vínculo:

   ```json
   {
     "rules": {
       "users": {
         "$uid": {
           ".read": "auth != null && (auth.uid === $uid || root.child('deviceAccess').child(auth.uid).child($uid).val() === true)",
           ".write": "auth != null && (auth.uid === $uid || root.child('deviceAccess').child(auth.uid).child($uid).val() === true)"
         }
       },
       "deviceAccess": {
         ".read": false,
         ".write": false
       }
     }
   }
   ```

   Crie o vínculo de autorização com Firebase Admin/Console, nunca pelo aplicativo público. Substitua `{uid}` pelo UID real do usuário autorizado. Não use regras `.read: true` ou `.write: true`.
3. **Publique o estado ao iniciar.** Após conectar ao Wi-Fi/Firebase e ler o sensor/posição real, publique `device/isOpen`, `device/smartMode`, `device/lastSeen`, `device/id` e `device/firmware`. Atualize `lastSeen` periodicamente (por exemplo, a cada 30 segundos) como timestamp Unix em milissegundos obtido por NTP. Não use `millis()` como relógio: ele reinicia a cada boot.
4. **Escute `device/command`.** Observe ou consulte esse nó para detectar um `commandId` novo com `status: "pending"`. Valide que `isOpen` é booleano e não repita um `commandId` já executado. Compare o estado alvo com a posição atual; não mova o motor se já estiver nessa posição.
5. **Execute com segurança e confirme.** Verifique limites e condições seguras, mova o motor sem bloquear a leitura do sensor por longos períodos, e só depois publique a posição física confirmada em `device/isOpen`. Marque o comando como concluído (por exemplo, `device/command/status: "completed"` e `completedAt`) ou como erro com uma mensagem segura. O app espera essa confirmação e não representa um comando pendente como posição alcançada.
6. **Respeite o modo inteligente.** Leia `device/smartMode`; só execute a automação do sensor de chuva quando estiver `true`. Priorize uma proteção contra chuva sobre um horário de abertura. Serializar comandos manuais, agendamentos e movimentos do sensor evita duas movimentações simultâneas.
7. **Execute os agendamentos no ESP32.** Leia `schedules`, ignore regras inativas e dispare no máximo uma vez por regra/data local. `days` usa `0=domingo, 1=segunda, …, 6=sábado`; `time` inicia com `HH:mm`; `action` é `open` ou `close`. O ESP32 deve usar a hora local configurada e persistir a última execução para não repetir a ação após reconexão ou reinicialização. O app não executa agendamentos de motor em segundo plano.
8. **Registre o histórico confirmado.** Depois de cada mudança real de posição (manual, chuva ou agenda), crie um novo filho em `history` com `timestamp` Unix em milissegundos, `source` (`manual` ou `automatic`), `isOpen` booleano e descrição `action`. Registre a posição inicial conhecida no início. As telas de estatísticas usam esses eventos; sem histórico completo, as métricas não são completas.
9. **Teste a perda de rede.** Se o Firebase cair, não deixe o motor alternar repetidamente nem marque comando como concluído. Refaça a conexão com atraso progressivo, valide novamente o `commandId` após reconectar e mantenha os limites de segurança locais. O modo demonstração do app nunca deve ser interpretado como feedback do hardware.

### Atenção ao motor e ao trecho Arduino

O trecho de exemplo atual só movimenta o motor localmente ao detectar chuva. Ele ainda não consulta comandos do app, não publica a posição e usa `step()` bloqueante. Ao adaptar o firmware, mantenha a lógica de proteção contra chuva, mas acrescente a conexão autenticada, leitura idempotente de comandos, publicação de posição/heartbeat, suporte a `smartMode` e agendamentos, registro do histórico e tratamento de falha de rede. Dimensione deslocamento e limites conforme o motor e sensores físicos do protótipo; não use os passos de exemplo sem validar os limites mecânicos.

## Armazenamento das telas

- Conta, preferências, localização, agenda e telemetria ficam no Firebase conforme as regras acima.
- Posição/mode local da Home de demonstração e manutenções ilustrativas ficam no AsyncStorage deste aparelho e não entram no histórico estatístico.
- Termos e política exibidos na tela vêm dos PDFs fornecidos e são empacotados como texto em `assets/legal`.
- Manuais em PDF são abertos pelo compartilhamento do sistema para que o usuário escolha um leitor.

## Validar o pacote

```sh
npx expo export --platform all
```
