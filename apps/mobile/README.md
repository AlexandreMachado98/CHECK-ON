# CHECK-ON: aplicativo móvel

Aplicativo Android (React Native + Expo) para o motorista fazer as inspeções dos veículos.

- **Entrar:** com o código da empresa (ex.: `VISTECSSQV`) e a matrícula. Não tem senha. Só entra quem tiver o acesso criado no portal, em Colaboradores → Criar acesso.
- **Funciona sem internet:** na primeira vez, o app baixa os veículos, os checklists e as NCs em aberto. Depois disso, as inspeções ficam guardadas no celular e são enviadas sozinhas quando a conexão voltar.
- **Veículo:** escolhido na lista ou pelo QR Code. No portal, o QR fica em Veículos → QR Code → Imprimir etiqueta.
- **Inspeção:**
  - os itens podem ser conforme/não conforme, texto, número ou foto;
  - a foto é exigida conforme a configuração do checklist;
  - as NCs em aberto do veículo aparecem antes de começar e no item correspondente;
  - o rascunho é salvo a cada resposta, então nada se perde se o app fechar.
- **Envio:**
  - cada inspeção tem um identificador próprio, então reenviar nunca duplica;
  - cada foto é enviada uma vez só;
  - se o servidor recusar uma inspeção, o motivo aparece em "Envios".
- **No portal:** cada inspeção mostra o aparelho que a enviou e o local (com a localização permitida).

O app é independente: não faz parte dos workspaces do repositório. Tem as próprias dependências e não entra no deploy da Vercel.

## Rodar no computador

```bash
cd apps/mobile
npm install
npm run typecheck
npm test
npx expo start
```

Os módulos nativos (câmera, localização, armazenamento seguro) exigem um build de desenvolvimento ou o APK. O endereço da API fica em `app.json` → `expo.extra.apiUrl`.

## Gerar o APK (Android)

### Automático, pelo GitHub (recomendado)

O workflow `.github/workflows/mobile-apk.yml` gera o APK na nuvem da Expo e publica em **Releases** no GitHub, com um link que o motorista abre direto no celular.

**Configuração (uma vez):**
1. Crie uma conta gratuita em https://expo.dev (uma conta só do CHECK-ON).
2. Em expo.dev, abra Account settings → Access tokens → Create token e copie o token.
3. No GitHub, abra Settings → Secrets and variables → Actions → New repository secret. Use o nome `EXPO_TOKEN` e cole o token.

**Para gerar:**
- **Manual:** aba Actions → "APK do aplicativo" → Run workflow.
- **Automático:** aumente `version` e `android.versionCode` em `app.json` e mescle na `main`.

O build leva de 10 a 30 minutos. O APK aparece em Releases como `app-v<versão>-<código>`.

No primeiro build, a Expo cria a chave de assinatura do app e a guarda na conta. Todos os builds seguintes usam a mesma chave. É isso que permite instalar uma versão nova por cima da anterior sem perder os dados do celular.

O plano gratuito da Expo tem um limite mensal de builds, por isso o APK só é gerado quando você pede ou quando a versão muda.

### Pelo computador (alternativa)

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init
npm run build:apk
```

## Versões

Para lançar uma versão nova, aumente `version` (ex.: `1.0.1`) e `android.versionCode` (ex.: `2`) no `app.json`. O celular só aceita a atualização se o `versionCode` for maior que o da versão instalada.

O identificador do app é `com.checkon.app` e não pode mudar depois da primeira instalação nos celulares.
