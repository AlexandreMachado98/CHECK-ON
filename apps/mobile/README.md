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

O APK é gerado na nuvem da Expo. Não precisa de Android Studio.

1. Crie uma conta gratuita em https://expo.dev (uma conta só do CHECK-ON).
2. Na primeira vez, entre na conta e ligue o projeto a ela. Esse passo grava o `projectId` no `app.json`:

   ```bash
   cd apps/mobile
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

3. Gere o APK:

   ```bash
   npm run build:apk
   ```

   No fim, a Expo mostra um link e um QR Code para baixar o `.apk`. No celular, abra o link e permita a instalação de "fontes desconhecidas".

Para uma versão nova, aumente `version` e `android.versionCode` no `app.json` antes do build. O celular só atualiza o app se o `versionCode` for maior.

O identificador do app é `com.checkon.app` e fica fixo depois da primeira instalação nos celulares.
