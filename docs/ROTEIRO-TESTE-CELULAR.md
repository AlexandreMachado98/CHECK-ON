# Roteiro de teste no celular (app 1.4.24)

Teste final antes de entregar ao cliente: o que os testes automáticos não cobrem (aparelho, câmera,
rede de verdade). Leva cerca de 1 hora. Marque cada item e anote o que estranhar.

## Antes de começar

- **Celular:** de preferência um modelo de entrada (2 a 3 GB de RAM, tela de ~6"), que é o que a
  frota costuma usar. Se der, repita o bloco 3 num celular melhor para comparar.
- **No portal:**
  - 1 colaborador de teste com acesso ao app;
  - 2 veículos ativos, cada um com QR Code impresso ou na tela de outro aparelho;
  - 1 checklist com pelo menos 1 item crítico e itens de foto obrigatória.
- **Instalação:** o APK da última versão, baixado nas Releases do GitHub. A tag `app-v1.4.24-37` é publicada sozinha quando o PR da 1.4.24 entra na `main`. Se a release disser "Versão de TESTE", desinstale a versão anterior antes.
- **Anotações:** a cada problema, anote o número do item, o que fez, o que esperava e o que
  aconteceu, com print se possível.

## 1. Entrada e primeira abertura

- [ ] 1.1 Instalar e abrir. A tela pede **Código da empresa** e **Matrícula**.
- [ ] 1.2 Matrícula errada: a mensagem é clara e o app não trava.
- [ ] 1.3 Entrar com os dados certos. Aparece "Baixando os dados..." e depois a lista de veículos com a saudação.
- [ ] 1.4 Fechar e abrir o app de novo: entra direto, sem pedir login.

## 2. Inspeção completa com internet

- [ ] 2.1 **Ler QR Code do veículo:** abre o veículo certo em poucos segundos.
- [ ] 2.2 Escolher o checklist e responder alguns itens com **Conforme**, **Não conforme** e **N/A**. Os botões cabem na tela, sem texto cortado.
- [ ] 2.3 Marcar **Não conforme** num item crítico. Aparece o aviso de item crítico.
- [ ] 2.4 Tirar foto num item:
  - a miniatura aparece **nítida** em 1 a 2 segundos;
  - tocar abre a foto em tela cheia, com zoom de pinça e de toque duplo;
  - a foto fica na orientação certa, tanto com o celular em pé quanto deitado.
- [ ] 2.5 **Tirar outra** foto no mesmo item. A miniatura troca.
- [ ] 2.6 Recolher e abrir uma seção pelo título. **Próximo** leva ao próximo item pendente.
- [ ] 2.7 A tela não apaga sozinha durante a inspeção.
- [ ] 2.8 Assinar com o dedo, usar **Desfazer** e assinar de novo.
- [ ] 2.9 **Concluir inspeção**:
  - aparece a tela "Inspeção enviada" com a animação;
  - aparecem a situação do veículo e as NCs abertas.
- [ ] 2.10 No portal, a inspeção aparece em **Inspeções** com:
  - as fotos (miniaturas leves; o clique abre a foto inteira);
  - a assinatura;
  - o PDF, que abre com as fotos.

## 3. Inspeção pesada: 40 fotos, 4G fraco

Use dados móveis com 1 ou 2 barras de sinal, ou o modo "rede lenta" do celular, se ele tiver.

- [ ] 3.1 Fazer uma inspeção com **foto em todos os itens** (o ideal são 30 a 40).
- [ ] 3.2 A rolagem da lista continua suave depois de muitas fotos, sem travadas.
- [ ] 3.3 Ao concluir:
  - a barra mostra **"Enviando fotos: X de 40"** e o número sobe;
  - no fim, aparece "Enviando inspeção..." e depois "Inspeção enviada".
- [ ] 3.4 Anotar quanto tempo levou o envio: ______ min.
- [ ] 3.5 Repetir, mas voltar ao início e bloquear a tela durante o envio. O envio termina sozinho e aparece no portal.

## 4. Sem internet

- [ ] 4.1 Ligar o **modo avião**. A tela inicial mostra o aviso "Sem internet".
- [ ] 4.2 Fazer uma inspeção completa com fotos. Ao concluir, aparece "Inspeção guardada".
- [ ] 4.3 Fazer uma segunda inspeção, no outro veículo. O resumo mostra "2 inspeções aguardando envio".
- [ ] 4.4 Fechar o app de vez (tirar dos recentes) e desligar o modo avião, **sem abrir o app**.
  As duas inspeções chegam ao portal em alguns minutos.
- [ ] 4.5 Ligar o modo avião **no meio do envio** de uma inspeção com fotos, e depois desligar.
  O envio continua de onde parou e nada é duplicado no portal.

- [ ] 4.6 Conectar num **Wi-Fi que pede login** (posto, hotel, shopping) **sem** fazer o login dele e tentar enviar:
  - o app não fecha;
  - a inspeção fica guardada;
  - aparece "Erro no último envio" pedindo para entrar no Wi-Fi ou usar os dados móveis.

  Depois de trocar para os dados móveis, a inspeção é enviada.

## 5. Interrupções

- [ ] 5.1 No meio de uma inspeção, tocar em Voltar. O app pergunta antes de sair e o rascunho fica guardado.
- [ ] 5.2 Abrir outro app, voltar depois de alguns minutos e continuar. As respostas e fotos estão lá.
- [ ] 5.3 Girar a tela no meio da inspeção. Nada se perde.
- [ ] 5.4 Começar outra inspeção com um rascunho aberto. O app pergunta entre **Continuar a anterior** e **Descartar e começar esta**.
- [ ] 5.5 Inspecionar de novo um veículo já inspecionado hoje. Aparece o aviso **Já inspecionado hoje**.

- [ ] 5.6 (Se tiver um celular quase cheio) Encher a memória com um vídeo grande e fazer uma inspeção:
  - o app não fecha ao responder;
  - aparece o aviso **Celular sem espaço** no topo;
  - ao tirar foto, aparece **Foto não guardada**, em vez de um item com foto quebrada.
  - ao enviar ou puxar a tela para atualizar, o app não fecha; na fila aparece o aviso de falta de espaço.

  Depois de liberar espaço, tudo volta ao normal.

## 6. Sessão encerrada no meio do envio

- [ ] 6.1 Com modo avião, guardar uma inspeção com várias fotos.
- [ ] 6.2 No portal, **bloquear** o acesso ao app desse colaborador.
- [ ] 6.3 Desligar o modo avião e abrir o app. Ele pede para entrar de novo, e a inspeção **não** aparece como recusada.
- [ ] 6.4 No portal, desbloquear o colaborador. No app, entrar de novo: a inspeção é enviada sozinha e chega completa ao portal.

## 7. Inspeção recusada

- [ ] 7.1 No portal, mudar o checklist (desativar um item, por exemplo) e, no app, enviar uma inspeção feita na versão antiga.
  Se o servidor recusar, a tela mostra o **Motivo**.
- [ ] 7.2 **Refazer com estas respostas**:
  - abre um rascunho já preenchido;
  - o app pede só a assinatura e o que mudou;
  - a inspeção reenviada chega ao portal.

## 8. Aparência

- [ ] 8.1 Tema escuro do celular: tudo legível, inclusive a assinatura e os avisos.
- [ ] 8.2 Fonte do celular no tamanho maior: botões e textos não se sobrepõem.
- [ ] 8.3 Celular pequeno (tela de ~5,5"): os botões de resposta não cortam o texto.

## 9. Portal, com dados reais

- [ ] 9.1 **Colaboradores:** a lista com fotos carrega rápido.
- [ ] 9.2 Ler o QR do crachá com outro celular: a página de verificação abre rápido no 4G e mostra a foto.
- [ ] 9.3 **Relatórios:**
  - período de 30 dias;
  - filtro por frente;
  - **Baixar PDF** e **Planilha** abrem certo (a planilha no Excel, com acentos corretos).
- [ ] 9.4 **Não Conformidades:** o painel mostra as mais graves primeiro.

## 10. Infraestrutura (1 minuto, no painel do Neon)

- [ ] 10.1 Confirmar que o banco está na região **São Paulo (`aws-sa-east-1`)**, a mesma da API.
  Em outra região, cada envio fica bem mais lento (ver `docs/BENCHMARK.md`, "Envio com o banco longe da API").

## O que os testes automáticos já cobrem

Não precisa testar à mão:
- regras de envio: foto apagada do celular, sessão encerrada, "muitas tentativas", envio repetido sem duplicar;
- contagem do progresso;
- tamanho e qualidade das fotos;
- miniaturas;
- textos das telas;
- isolamento entre empresas e frentes;
- segurança da API (28 verificações);
- carga de 200 motoristas ao mesmo tempo.

Os detalhes estão em `docs/BENCHMARK.md`.
