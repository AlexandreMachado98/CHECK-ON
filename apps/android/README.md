# CHECK-ON: aplicativo Android (nativo)

Aplicativo do motorista em **Kotlin + Jetpack Compose**. É um projeto Android puro: abre direto no Android Studio, sem Node e sem Expo.

## Rodar no Android Studio

1. **File → Open** e escolha a pasta **`apps/android`** (não a raiz do repositório).
2. Espere o "Gradle sync" terminar. Na primeira vez ele baixa as dependências.
3. Ligue o celular no USB (com a "Depuração USB" ativa) ou ligue um emulador.
4. Escolha o aparelho no topo e clique em **▶ Run**.

O app conversa com o CHECK-ON que está no ar. O endereço fica em `app/build.gradle.kts`, no campo `API_URL`.

## O que o app faz

- **Login:** código da empresa + matrícula, sem senha. Só entra quem tem acesso criado no portal.
- **Sem internet:** o app baixa veículos, checklists e NCs em aberto. A inspeção fica guardada no celular e é enviada sozinha quando a internet volta, mesmo com o app fechado (WorkManager).
- **Escolher o veículo:** pela lista ou pelo QR Code. O QR fica no portal em Veículos → QR Code. O leitor do Google Play Services não pede permissão de câmera.
- **Inspeção:**
  - os itens podem ser conforme/não conforme, texto, número ou foto;
  - segue as mesmas regras da API: itens obrigatórios, foto obrigatória e foto do problema;
  - o rascunho é salvo a cada resposta;
  - a foto é reduzida para no máximo 1600 px.
- **Envio:**
  - cada foto é enviada uma vez só;
  - as inspeções vão em lote, sem duplicar;
  - se o servidor recusar uma inspeção, o motivo aparece em "Envios".
- **No portal:** cada inspeção registra o aparelho e a localização (quando permitida).

## Testes

```bash
./gradlew testDebugUnitTest
```

Os testes cobrem as regras de resposta e foto, a leitura do QR, a busca, a fila sem internet, o reenvio de foto e as recusas.

## APK pelo GitHub

O workflow **"Aplicativo Android"** (`.github/workflows/android.yml`):
- em cada PR, roda os testes e gera o APK de teste (aba Actions → Artifacts);
- na `main`, ou manualmente em Actions → Run workflow, publica o APK em **Releases**.

Para os motoristas atualizarem o app sem desinstalar, todas as versões precisam da **mesma chave de assinatura**:

1. No Android Studio, use **Build → Generate Signed App Bundle / APK → APK → Create new...** e crie o arquivo `.jks`. Guarde o arquivo e a senha: sem eles, não dá para atualizar o app nos celulares.
2. No GitHub, abra **Settings → Secrets and variables → Actions** e crie quatro segredos:
   - `ANDROID_KEYSTORE_BASE64`: o conteúdo do `.jks` em base64. No PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\caminho\checkon.jks"))`;
   - `ANDROID_KEYSTORE_PASSWORD`;
   - `ANDROID_KEY_ALIAS`;
   - `ANDROID_KEY_PASSWORD`.

Sem esses segredos, a Release leva a versão de teste.

## Versões

Para lançar uma versão nova, aumente `versionCode` e `versionName` em `app/build.gradle.kts`.
