# Sistema de Gestão Financeira e Precificação — Recuperadora Menegatti

Aplicação web para orçar serviços, acompanhar ordens de serviço e enxergar o
resultado financeiro da fábrica: usinagem, solda, caldeiraria, montagem e
acabamento para transporte pesado.

Roda inteira na máquina da empresa. Banco de dados em arquivo local, sem
servidor externo e sem mensalidade — a única integração opcional é a API da
Anthropic, usada apenas no Centro de Inteligência.

---

## Sumário

- [Instalação](#instalação)
- [Primeiro acesso](#primeiro-acesso)
- [Como o sistema calcula](#como-o-sistema-calcula)
- [Parâmetros financeiros](#parâmetros-financeiros)
- [Backup e restauração](#backup-e-restauração)
- [Integração de IA](#integração-de-ia)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Verificação](#verificação)
- [Perguntas frequentes](#perguntas-frequentes)

---

## Instalação

Requisitos: **Node.js 20 ou superior**. Nada mais — nem banco de dados, nem
Docker.

```bash
# 1. Instalar as dependências
npm install

# 2. Criar o arquivo de configuração
cp .env.example .env

# 3. Gerar um segredo de sessão e colá-lo no .env
openssl rand -base64 32
#    → cole o resultado em NEXTAUTH_SECRET e AUTH_SECRET

# 4. Criar o banco e carregar os parâmetros iniciais
npm run setup

# 5. Rodar
npm run dev
```

Acesse **http://localhost:3000**.

Para uso no dia a dia, prefira o modo de produção — é bem mais rápido:

```bash
npm run build
npm start
```

### Deixar rodando sozinho

Para que o sistema suba junto com o computador, o caminho mais simples no
Windows é criar um atalho na pasta de Inicialização apontando para um `.bat`
com `npm start` dentro da pasta do projeto. No Linux, um serviço systemd
resolve. Em ambos os casos o acesso continua sendo pelo navegador, em
`localhost:3000`.

---

## Primeiro acesso

| Campo   | Valor            |
| ------- | ---------------- |
| Usuário | `admin`          |
| Senha   | `menegatti2024`  |

**Troque a senha imediatamente** em *Configurações → Empresa → Credenciais de
acesso*. Ela é a única coisa entre o computador e todos os dados financeiros da
empresa.

A sessão dura 30 dias. Após 5 tentativas de login erradas, o usuário fica
bloqueado por 15 minutos.

---

## Como o sistema calcula

Toda a matemática vive em dois arquivos, e nenhum componente de tela calcula
nada por conta própria:

- **`src/lib/precificacao.ts`** — funções puras, sem banco. É o que permite a
  tela de orçamento recalcular o preço a cada tecla, no navegador, rodando
  exatamente a mesma função que o servidor roda ao salvar. Cliente e banco
  nunca discordam sobre o preço.
- **`src/lib/calculos.ts`** — o que precisa do banco: leitura dos parâmetros,
  agregações sobre as OS, KPIs, séries históricas.

### As três taxas

```
THH  Taxa Hora-Homem
     (folha bruta × multiplicador de encargos) ÷ operadores ÷ horas produtivas
     (170.000 × 1,87) ÷ 14 ÷ 147,8 = R$ 153,59/h

CFR  Custo Fixo Rateado
     (despesas administrativas + energia + manutenção) ÷ total de horas produtivas
     50.600 ÷ 2.070 = R$ 24,45/h

THM  Taxa Hora-Máquina — específica de cada centro de custo, configurável
```

Custo por hora de cada centro = **THH + THM + CFR**:

| Centro              | THM        | Custo/hora   |
| ------------------- | ---------- | ------------ |
| Torno               | R$ 18,50   | R$ 196,54    |
| Fresa               | R$ 22,00   | R$ 200,04    |
| Solda               | R$ 12,00   | R$ 190,04    |
| Montagem/Acabamento | R$ 6,00    | R$ 184,04    |
| Radial              | R$ 15,00   | R$ 193,04    |

### O custo de uma OS

```
CUSTO = (horas de setup × custo hora de setup)
      + Σ (horas do centro × custo hora do centro)
      + insumos com markup
```

O **custo da hora de setup é THH + CFR** — sem THM, porque o setup não ocupa
uma máquina específica.

> **Sobre o CFR.** O custo/hora de cada centro já embute o CFR. A fórmula
> mestre do documento de calibração termina com `+ CFR_HORAS`, mas somá-lo de
> novo contaria o overhead duas vezes. A leitura correta é que o CFR incide
> sobre **todas** as horas da OS, inclusive as de setup — que não pertencem a
> centro nenhum. É assim que está implementado: o overhead é cobrado
> exatamente uma vez por hora trabalhada.

### Do custo ao preço

```
PREÇO MÍNIMO  = CUSTO ÷ (1 − margem desejada)
PREÇO CLIENTE = PREÇO MÍNIMO ÷ (1 − alíquota de impostos)
```

Com custo de R$ 1.000, margem de 30% e alíquota de 14,5%:

```
preço mínimo    = 1.000 ÷ 0,70     = R$ 1.428,57
preço cliente   = 1.428,57 ÷ 0,855 = R$ 1.670,84
impostos        = 1.670,84 × 0,145 = R$   242,27
receita líquida = 1.670,84 − 242,27 = R$ 1.428,57
contribuição    = 1.428,57 − 1.000  = R$   428,57  →  30,0%
```

**A margem de contribuição é medida sobre a receita líquida**, não sobre o
preço cheio. Não é detalhe de apresentação: é o que faz o número do orçamento
bater com a linha de margem de contribuição do DRE. Sobre o preço cheio, esses
mesmos R$ 428,57 apareceriam como 25,65%, e o semáforo acusaria "crítico" numa
OS perfeitamente saudável.

O sistema também mostra a **margem bruta** — `(preço − custo) ÷ preço`, a
fórmula literal do documento de calibração. Ela sempre parece maior porque não
desconta os impostos. Está lá por transparência, mas quem decide é a margem de
contribuição.

### Semáforo de margem

| Faixa                          | Leitura                              |
| ------------------------------ | ------------------------------------ |
| 🔴 abaixo da margem mínima     | Não feche assim                      |
| 🟡 entre a mínima e a ideal    | Aceitável, pouco espaço para desconto |
| 🟢 acima da margem ideal       | Saudável, dá para negociar            |

Os limiares (15% e 30% por padrão) são configuráveis.

### Ponto de equilíbrio

Não é "custos fixos ÷ margem de contribuição". Essa fórmula pressupõe mão de
obra fora do custo do produto — aqui a THH carrega a folha inteira dentro do
preço de cada OS, e dividir custos fixos que já incluem a folha por uma margem
já líquida de mão de obra contaria R$ 317.900 duas vezes.

O modelo usado parte de EBITDA = 0:

```
receita líquida − insumos − MO absorvida − MO ociosa − custos fixos = 0
```

Como (MO absorvida + MO ociosa) é sempre a folha inteira, uma constante:

```
PE (receita líquida) = custos fixos ÷ margem sobre custos variáveis
PE (faturamento bruto) = PE líquido ÷ (1 − alíquota)
```

Com os parâmetros calibrados e ~15% de insumos, isso dá **R$ 507 mil de
faturamento bruto** — coerente com a meta de R$ 500 mil e com o faturamento
atual de R$ 380 mil, que fica abaixo do equilíbrio.

### DRE

Duas decisões de método valem menção:

- **Capacidade ociosa em linha própria.** A folha produtiva é fixa no curto
  prazo, mas só a parcela aplicada nas OS é custo variável. O que sobra é
  ociosidade, e aparece separado — sem essa linha, o custo de ficar parado
  desapareceria dentro da margem.
- **Depreciação fora do EBITDA.** Ela é exibida no bloco de custos fixos por
  fidelidade ao layout gerencial, mas marcada como não-caixa e excluída do
  subtotal. É deduzida uma única vez, do EBITDA para o EBIT.

---

## Parâmetros financeiros

Todos os valores vivem no banco, na tabela `Configuracao`, e são editáveis em
*Configurações → Parâmetros financeiros*. **Nada é fixo no código.** Os valores
do seed são apenas o ponto de partida.

Ao editar, o quadro de taxas ao lado recalcula **antes de salvar** — dá para
ver o efeito de mudar a folha ou a ociosidade sobre o custo/hora de cada centro
e só então confirmar.

Ao salvar, todo o sistema passa a usar os novos valores: dashboard, DRE, ponto
de equilíbrio, alertas, relatórios. **As OS já registradas não mudam** — cada
uma guarda um retrato das taxas do momento em que foi orçada, o que mantém o
histórico auditável.

Grupos disponíveis:

| Grupo                          | O que controla                                  |
| ------------------------------ | ----------------------------------------------- |
| Mão de obra direta             | Base da THH: folha, encargos, jornada, ociosidade |
| Custos fixos indiretos         | Base do CFR: administrativo, energia, manutenção |
| Demais custos fixos            | Entram no DRE e no ponto de equilíbrio           |
| Precificação e metas           | Impostos, margens mínima/ideal, meta mensal      |
| Capital de giro                | PMR e PMP, usados no fluxo de caixa e na NCG     |
| Defaults do orçamento          | Valores pré-preenchidos ao abrir um novo orçamento |
| Limiares de alerta             | Gatilhos do motor de alertas                     |

---

## Backup e restauração

O dono da empresa não pode perder dados. Por isso o backup é **redundante de
propósito**: o mesmo conteúdo sai em três formatos independentes.

### O que vai dentro do ZIP

```
menegatti_backup_2026-08-30_1432.zip
├── menegatti_data.json      todos os registros, em texto legível
├── menegatti_db.sqlite      cópia consistente do banco (VACUUM INTO)
├── menegatti_report.xlsx    DRE, KPIs, OS e clientes dos últimos 12 meses
└── backup_metadata.json     versão, data, totais e checksum de cada arquivo
```

Se o JSON corromper, o SQLite salva. Se ambos falharem, o Excel ainda permite
reconstruir o histórico à mão. E o checksum SHA-256 denuncia a corrupção
**antes** de a restauração encostar nos dados.

### Fazer um backup

*Configurações → Backup e segurança → **Exportar backup completo***

O arquivo é baixado e uma cópia fica arquivada no histórico. **Guarde o
download fora desta máquina** — pen drive, e-mail, nuvem.

### Backups automáticos

| Tipo            | Quando                                    | Quantos guarda |
| --------------- | ----------------------------------------- | -------------- |
| Incremental     | A cada OS salva, no máximo um por hora    | 30             |
| Semanal         | Todo domingo, no primeiro acesso do dia   | 12             |

Ficam em `backups/`, na pasta do projeto. Nunca impedem você de trabalhar: se
um backup falhar, o erro é registrado e a OS é salva do mesmo jeito.

> Os automáticos protegem contra exclusão acidental e erro de operação, mas
> ficam **no mesmo computador que o banco**. Contra perda da máquina, só o
> download guardado em outro lugar resolve.

### Restaurar

*Configurações → Backup e segurança → **Restaurar backup***

O fluxo é: selecionar o ZIP → o sistema valida e mostra o que há dentro →
escolher o modo → confirmar.

| Modo            | O que faz                                                        |
| --------------- | ---------------------------------------------------------------- |
| **Mesclar**     | Mantém tudo o que existe e insere só o que falta. Escolha segura. |
| **Substituir**  | Apaga os dados atuais e grava os do backup.                       |

Duas proteções antes de qualquer escrita:

1. O checksum é conferido. Arquivo adulterado ou corrompido é **rejeitado**.
2. Um backup de segurança do estado atual é gerado. No modo *substituir*, se
   esse backup não puder ser criado, **a restauração é cancelada**.

### Migrar de computador

1. Backup completo na máquina antiga.
2. Instalar o sistema na nova (passos de [Instalação](#instalação)).
3. Restaurar o ZIP em modo **substituir**.

---

## Integração de IA

Opcional. O Centro de Inteligência usa a API da Anthropic para interpretar os
números do mês e produzir um parecer gerencial com plano de ação.

**Sem chave configurada o sistema funciona igual.** A página de insights mostra
os alertas determinísticos — que são calculados direto dos seus dados, sem IA —
e um caminho claro para configurar. Nada quebra.

### Configurar

1. Crie uma chave em <https://console.anthropic.com>.
2. *Configurações → Integração de IA*, cole a chave e salve.
3. Use **Testar conexão** para confirmar.

A chave é cifrada com AES-256-GCM antes de ir para o banco e nunca sai do
servidor — a interface só recebe os quatro últimos caracteres. Isso protege
contra o vazamento do arquivo do banco (backup, cópia, sincronização em
nuvem), que é o risco real aqui.

Alternativamente, defina `ANTHROPIC_API_KEY` no `.env`. A chave cadastrada na
interface tem precedência.

### Alertas sem IA

Dez regras determinísticas rodam sempre, instantâneas, quantificando o impacto
em reais: ociosidade alta, OS abaixo da margem mínima, concentração de
clientes, meta em risco, desvio orçado × realizado, ponto de equilíbrio em
risco, ausência de provisão para manutenção, PMR elevado, recuperação com preço
perto da peça nova e queda de faturamento em dois meses seguidos.

---

## Estrutura do projeto

```
prisma/
  schema.prisma           modelo de dados
  seed.ts                 parâmetros calibrados + usuário admin
scripts/
  verificar-calculos.ts   58 conferências do motor de cálculo
  smoke-os.ts             teste de ponta a ponta contra o banco
  smoke-backup.ts         backup: exportar, validar, apagar, restaurar
src/
  app/
    (auth)/login          tela de acesso
    (dashboard)/          telas protegidas
    api/                  rotas de API
  components/
    ui/                   componentes de base
    charts/               gráficos (paleta validada)
    orcamento/            simulador de precificação
    ordens/ clientes/     gestão
    dre/ financeiro/      telas financeiras
    insights/             centro de inteligência
    configuracoes/        abas de configuração
    pdf/                  documento do orçamento
  lib/
    precificacao.ts       matemática pura (roda no navegador e no servidor)
    calculos.ts           agregações e KPIs (precisa do banco)
    dre.ts                DRE e fluxo de caixa
    indicadores.ts        painel de KPIs
    alertas.ts            as 10 regras determinísticas
    backup.ts             exportação, validação e restauração
    ia.ts                 integração com a Anthropic
    exportacao.ts         relatórios em Excel
    cripto.ts             cifra dos segredos e checksum
backups/                  backups locais (fora do controle de versão)
```

### Comandos

| Comando                | O que faz                                       |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Servidor de desenvolvimento                     |
| `npm run build`        | Compila para produção                           |
| `npm start`            | Roda a versão compilada                         |
| `npm run setup`        | Cria o banco e carrega os parâmetros iniciais   |
| `npm run db:studio`    | Abre o navegador de dados do Prisma             |
| `npm run verificar`    | Confere o motor de cálculo                      |
| `npm run smoke`        | Teste de ponta a ponta contra o banco           |
| `npm run smoke:backup` | Testa o ciclo completo de backup                |
| `npm run typecheck`    | Verificação de tipos                            |
| `npm run lint`         | Análise estática                                |

---

## Verificação

O sistema vem com três suítes que rodam contra dados reais, não contra mocks.

```bash
npm run verificar     # 58 conferências do motor de cálculo
npm run smoke         # cria cliente e OS no banco, confere e limpa
npm run smoke:backup  # exporta, adultera, valida, apaga, restaura
```

`npm run verificar` confere que as taxas derivadas reproduzem exatamente os
números calibrados no diagnóstico financeiro — THH R$ 153,59, CFR R$ 24,45 e o
custo/hora dos cinco centros —, além da fórmula mestre, do semáforo, do
comparativo com peça nova, do ponto de equilíbrio e do comportamento com
entradas degeneradas (OS zerada, centro inexistente).

`npm run smoke:backup` trabalha sobre uma cópia descartável do banco. Ele
adultera um byte do arquivo de dados de propósito para confirmar que o
checksum rejeita o backup corrompido.

---

## Perguntas frequentes

**Mudei um parâmetro. As OS antigas mudam de preço?**
Não. Cada OS guarda as taxas do momento em que foi orçada. Só os novos
orçamentos usam os valores atualizados.

**Posso apagar um cliente que já tem OS?**
Não — apagaria receita reconhecida no DRE. O sistema inativa o cliente: ele
some da busca do orçamento e o histórico continua íntegro. O mesmo vale para
centros de custo já utilizados.

**Por que não consigo excluir uma OS faturada?**
Pela mesma razão. Para retirá-la dos relatórios, mude o status para
*cancelado*.

**A margem que vejo no orçamento é a mesma do DRE?**
Sim, medida da mesma forma: sobre a receita líquida. Foi uma escolha
deliberada para que os dois números sejam comparáveis.

**Onde ficam os dados?**
Num único arquivo, `prisma/menegatti.db`. Copiar esse arquivo copia o sistema
inteiro. É o que o backup faz, com verificação de integridade por cima.

**O modo claro funciona mesmo?**
Sim. As superfícies e bordas são tokens de tema, não sobreposições brancas
fixas — no claro a sobreposição inverte para escura e a hierarquia visual se
mantém. A paleta dos gráficos foi validada contra as duas superfícies. O
sistema continua desenhado para o escuro; o claro existe para ambiente muito
iluminado. Troque em *Configurações → Aparência* ou pelo ícone no topo.

**Preciso de internet?**
Só para os insights de IA. Orçar, faturar, ver o DRE e gerar relatórios
funciona offline.

**Esqueci a senha.**
Apague o usuário do banco com `npm run db:studio` e rode `npm run db:seed`
para recriar o administrador com a senha inicial.
