# Folha de respostas com correção por IA

Fluxo completo: imprimir a folha, aplicar a prova, escanear, subir para o Drive
e deixar o Gemini transcrever e corrigir as marcações.

A tela fica em **Provas → abrir uma prova → Folha de respostas**.

Há dois caminhos para corrigir, e o recomendado é o primeiro:

1. **Planilha com Apps Script** (`apps-script/Correcao.gs`) — o script lê as
   folhas direto da pasta do Drive, chama a API do Gemini e escreve o resultado
   na aba "Respostas" da planilha. O modelo só transcreve; quem compara com o
   gabarito e calcula a nota é o script. Ver [seção 6](#6-corrigir-pela-planilha-recomendado).
2. **Chat do Gemini** — anexar as folhas e colar o prompt copiado da tela.
   Serve para poucas folhas ou para quem não quer configurar a planilha.
   Ver [seção 6b](#6b-alternativa-corrigir-no-chat-do-gemini).

---

## 1. Por que a folha é desenhada assim

A folha **não** é para leitora óptica. É para um modelo de visão ler a imagem
escaneada. Isso muda todas as escolhas de desenho — o que ajuda uma leitora
óptica às vezes atrapalha o modelo, e vice-versa.

| Decisão | Motivo |
|---|---|
| Tudo em tabela com borda preta contínua | Modelo de visão lê grade muito melhor que caixas alinhadas por espaço em branco |
| Número da questão impresso em **toda** linha, com dois dígitos | Nenhuma linha depende de contagem para ser identificada. Folha torta ou cortada continua legível |
| Letra impressa em cinza claro **dentro** de cada quadrado | Âncora de coluna: o modelo sabe qual coluna é qual sem contar da esquerda para a direita |
| Quadrado, não círculo, e do maior tamanho que a página permitir | Área preenchida maior sobrevive melhor à compressão do scanner e à foto de celular |
| Nenhum fundo cinza, tarja ou zebra na grade | Qualquer área escura impressa compete com a marca do aluno |
| Quadrados pretos nos quatro cantos, o superior esquerdo maior | Delimitam a folha e resolvem orientação em imagem girada |
| Número de chamada capturado **duas** vezes (escrito + marcado) | A redundância deixa a IA acusar conflito em vez de chutar de quem é a folha |
| Linha divisória mais grossa a cada 5 questões | Reduz deslocamento de linha na leitura de blocos longos |

O tamanho do quadrado e a altura da linha são calculados a partir da quantidade
de questões: prova curta ganha quadrado grande, porque a sobra da página é de
graça. Todas as páginas de uma mesma folha usam a mesma medida.

### Identificação do aluno

A identificação oficial é o **número de chamada**, nunca o nome. Nome manuscrito
não é confiável em leitura automática, e ainda é dado pessoal de criança —
quanto menos circular por serviço externo, melhor. A linha de nome existe só
para a conferência do professor e é opcional na geração da folha.

---

## 2. Imprimir

1. Abra a prova → **Folha de respostas**.
2. Confira o número de alternativas (A–D, A–E ou A–F). O padrão vem da própria
   prova, pela questão com mais alternativas.
3. Questões dissertativas ficam fora da folha, mas **a numeração das objetivas é
   mantida igual à da prova**. Se a prova tem a 3 e a 8 dissertativas, a folha
   pula da 2 para a 4 — e é assim que tem que ser.
4. **Imprima o campo TURMA preenchido antes de fotocopiar.** Escrever a turma
   folha por folha depois é onde o processo costuma quebrar.
5. Uma folha por aluno. Imprima em papel branco comum, sem timbre no verso.

O código no alto da folha (`FR-XXXXXX`) identifica a prova. É o mesmo código que
vai no prompt: se o professor misturar folhas de duas provas, a IA acusa.

---

## 3. Aplicar

O que orientar aos alunos, na ordem que importa:

- Caneta **azul ou preta**. Lápis some no escaneamento.
- Pintar **todo** o quadrado, até cobrir a letra impressa.
- **Uma** alternativa por questão.
- Errou: **não rasure e não apague** — peça outra folha. Rasura vira `"?"` e a
  folha volta para conferência manual, o que anula o ganho de tempo.
- Não escrever nem apoiar a mão sobre os quadrados pretos dos cantos.

---

## 4. Escanear

| Parâmetro | Valor | Por quê |
|---|---|---|
| Resolução | **300 dpi** | 200 dpi já perde marca fraca; acima de 300 só engorda o arquivo |
| Cor | **Tons de cinza** | Ver abaixo — é o parâmetro que mais estraga o resultado |
| Formato | PDF por turma, ou PNG/JPG por aluno | Os dois funcionam |
| Alinhamento | Folha reta, sem dobra | Inclinação leve o modelo resolve; dobra sobre a grade, não |

> **Não escaneie em preto-e-branco (1 bit).** Esse modo decide, pixel a pixel,
> se cada ponto vira preto ou branco. A letra cinza dentro do quadrado ou some
> por completo — e o modelo perde a âncora de coluna — ou satura em preto e vira
> marca falsa. Os dois casos produzem correção errada com aparência de correção
> certa. Tons de cinza preserva a diferença entre "impresso claro" e "caneta".

Foto de celular funciona como plano B: folha sobre superfície plana, luz de
cima, câmera paralela à mesa, os quatro cantos pretos visíveis no quadro.

---

## 5. Subir para o Drive

Uma pasta por turma e por prova:

```
Provas 2026/
└── 5A - Matematica - Diagnostica 1o bim/
    ├── 5A-01.jpg
    ├── 5A-02.jpg
    └── ...
```

Nomear o arquivo com o número de chamada não é obrigatório — a IA lê o número da
própria folha — mas facilita muito conferir depois quem é quem.

**Não suba folha nenhuma para pasta compartilhada com link público.** A folha
tem número de chamada e, se a linha de nome for usada, nome de criança.

---

## 6. Corrigir pela planilha (recomendado)

O script `apps-script/Correcao.gs` roda dentro de uma planilha Google e faz o
ciclo inteiro: lê a pasta do Drive, manda cada folha para a API do Gemini,
compara com o gabarito e escreve uma linha por aluno na aba **Respostas**.

Diferença importante em relação ao chat: **o modelo só transcreve as marcas**.
Quem compara com o gabarito, conta acertos e calcula a nota é o script.
Modelo que recebe o gabarito junto com a imagem tende a "ler" o que o gabarito
manda quando a marca está ambígua — e erro de aritmética de modelo é
silencioso. Separando, a leitura fica sem viés e a conta fica exata.

### Instalação (uma vez)

1. Crie uma planilha Google nova.
2. **Extensões → Apps Script**, apague o conteúdo e cole `apps-script/Correcao.gs`.
3. Salve, volte à planilha e recarregue. Aparece o menu **Correção IA**.
4. **Correção IA → Preparar planilha** — cria as abas Config, Gabarito,
   Respostas, Itens e Log.
5. Gere uma chave de API em [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   e salve-a por **Correção IA → Configurar chave da API**. A chave fica nas
   Propriedades do Script, não em célula: planilha se compartilha por engano,
   propriedade do script não.

> A chave da API é credencial. Pelo padrão da rede, **não** pode ir para
> repositório, mensagem de commit nem célula de planilha compartilhada.

### A cada prova

1. Na aba **Config**: o ID da pasta do Drive (o script aceita a URL inteira
   colada), o código da folha (`FR-XXXXXX`) e o número de alternativas.
2. No Repositório Pedagógico: **Folha de respostas → Copiar gabarito para
   planilha**, e cole na aba **Gabarito** (duas colunas: questão e letra).
3. **Correção IA → Corrigir folhas da pasta.**

O script processa o que der em ~4,5 minutos (limite do Apps Script) e avisa
quantos arquivos ficaram. É só rodar de novo: **os já processados são pulados**,
porque o ID do arquivo fica gravado na linha.

### O que sai em cada aba

| Aba | Conteúdo |
|---|---|
| **Respostas** | Uma linha por aluno: chamada, turma, acertos, nota, uma coluna por questão. Erro em vermelho, branco/dupla/ilegível em amarelo, questão sem gabarito em cinza |
| **Itens** | Estatística por questão: % de acerto e quantos marcaram cada alternativa — mostra questão mal formulada e distrator forte |
| **Log** | O que foi processado e qualquer erro de leitura ou de API |

Folha com problema (conflito de chamada, marca dupla, ilegível, código de outra
prova) sai com **Revisar = SIM** e o motivo por extenso. Arquivo de duas páginas
do mesmo aluno é juntado na mesma linha pela chamada; se as páginas divergirem
na mesma questão, a célula vira `?` e o motivo registra a divergência.

O professor pode corrigir uma marcação à mão direto na célula e usar
**Correção IA → Recalcular acertos e estatísticas** — recalcula tudo sem gastar
API de novo.

### Modelo e custo

O padrão é `gemini-2.5-pro`. Em teste real com folha de 45 questões, o
`gemini-2.5-flash` **alucinou a leitura com confiança** — transcreveu letras
que não estavam marcadas e ecoou o "7" do exemplo impresso na folha como se
fosse o número de chamada. Erro confiante é pior que `?`: não levanta revisão.
Use `flash` só em folha curta (até ~20 questões) e confira por amostragem.

## 6b. Alternativa: corrigir no chat do Gemini

Para poucas folhas, sem configurar nada: na tela da folha, **Copiar prompt do
Gemini**. O prompt sai pronto, com o gabarito da prova, a lista exata de
questões e o formato de saída.

1. Abra o Gemini e anexe as folhas escaneadas.
2. Cole o prompt.
3. Receba um JSON, um objeto por aluno.

Lotes de **10 a 20 folhas por vez** funcionam melhor que a turma inteira de uma
vez: a atenção do modelo se dilui em anexo muito grande, e conferir um lote
pequeno que deu errado custa menos que refazer tudo.

Nesse caminho o modelo também soma acertos e calcula a nota — **confira as
contas por amostragem**, porque aritmética de modelo erra sem avisar. É o
motivo de a planilha ser o caminho recomendado.

O botão **Baixar gabarito (JSON)** guarda o gabarito usado naquela correção.
Vale arquivar junto com os resultados: se a prova for editada depois, é o que
prova qual gabarito valeu.

### O que a IA devolve (no chat)

```json
[
  {
    "arquivo": "5A-07.jpg",
    "codigo_folha": "FR-A1B2C3",
    "chamada": 7,
    "chamada_escrita": "07",
    "chamada_marcada": "07",
    "chamada_conflito": false,
    "turma": "5A",
    "respostas": [
      { "questao": 1, "marcada": "C", "gabarito": "C", "resultado": "certo" },
      { "questao": 2, "marcada": "-", "gabarito": "A", "resultado": "nao_corrigida" }
    ],
    "acertos": 8,
    "total_com_gabarito": 10,
    "nota": 8.0,
    "revisar": true,
    "motivo_revisao": "Questão 2 em branco"
  }
]
```

Códigos de marcação:

| Valor | Significado |
|---|---|
| `A`…`F` | Alternativa marcada |
| `-` | Nenhum quadrado preenchido |
| `*` | Duas ou mais marcas na mesma questão |
| `?` | Marca fraca, rasurada ou cortada na imagem |

O prompt proíbe o modelo de chutar: na dúvida entre uma letra e `?`, ele devolve
`?`. Isso é de propósito. Uma folha a mais para conferir custa menos que uma
nota errada em boletim.

### Conferência obrigatória

**Toda folha com `revisar: true` vai para conferência humana.** Sem exceção. São
os casos de conflito de número de chamada, marca dupla, marca ilegível ou código
de prova que não bate.

Duas conferências rápidas que pegam quase todo erro sistemático:

1. A quantidade de objetos no JSON bate com a quantidade de folhas escaneadas?
2. Os números de chamada estão repetidos ou faltando alguém da lista da turma?

---

## 7. Limites conhecidos

- **Dissertativa não entra.** A folha é só para objetiva; dissertativa continua
  corrigida no caderno de prova.
- **Sem gabarito, sem correção.** Questão sem alternativa correta cadastrada é
  transcrita mas volta como `sem_gabarito`. A tela avisa quais são antes de
  imprimir.
- **A leitura não é auditada por ninguém além do professor.** O sistema não
  guarda resultado de correção: fica na planilha (ou no JSON) de quem corrigiu.
- **Acima de 60 questões a folha usa duas páginas.** As duas repetem o número de
  chamada, e o prompt manda juntar as páginas do mesmo aluno.

---

## 8. Onde mexer no código

| Arquivo | O quê |
|---|---|
| `src/services/folhaResposta.js` | Geração do HTML da folha, layout, gabarito e prompt do Gemini |
| `src/components/FolhaRespostaModal.jsx` | Tela de opções, pré-visualização e ações |
| `src/pages/provas/ProvaDetalhe.jsx` | Botão que abre a tela |
| `apps-script/Correcao.gs` | Script da planilha: leitura da pasta, chamada à API e gravação dos resultados |

Ao mexer no layout da folha, **mexa nos DOIS prompts junto** — o de
`folhaResposta.js` (chat) e o de `Correcao.gs` (planilha). Os prompts descrevem
a folha para o modelo: grade que muda sem o prompt mudar é erro que aparece só
na correção da primeira turma, quando já é tarde.

Vale checar depois de qualquer mudança de layout:

- prova curta (10 questões) e prova longa (60+, duas páginas);
- prova com dissertativa no meio, para ver se a numeração pula certo;
- 4, 5 e 6 alternativas;
- a folha impressa em papel, preenchida à caneta e escaneada de verdade — é o
  único teste que vale.
