# Deploy na Vercel (o caminho mais fácil)

Esta é a forma mais simples de colocar o sistema no ar: **nada é instalado no
seu computador**. Você não precisa instalar Node.js, abrir terminal, nem
rodar comando nenhum. Tudo acontece no navegador, pelo site da Vercel.

A diferença para a instalação na máquina da empresa
([docs/INSTALACAO.md](INSTALACAO.md)) é onde os dados ficam: aqui eles ficam
num banco de dados na nuvem (gratuito para o uso desta empresa), não no seu
computador. Se você prefere manter os dados fisicamente dentro da empresa,
use o instalador local. Se você só quer o sistema funcionando o mais rápido
possível, sem instalar nada, siga este guia.

---

## Antes de começar

Você vai precisar de:

- Uma conta na Vercel (grátis) — pode entrar direto com sua conta do GitHub
- **5 minutos**

---

## Passo 1 — Criar o projeto

Clique no botão abaixo. Ele leva direto para a Vercel com o projeto já
configurado para importar deste repositório.

[![Deploy na Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frecuperadoramenegatti%2Frecuperadoramenegatti%2Ftree%2Fclaude%2Fmenegatti-financial-system-jmoh5i&project-name=menegatti-erp&repository-name=menegatti-erp)

Se pedir para conectar sua conta do GitHub, aceite — é assim que a Vercel
acessa o código para fazer o deploy.

> Depois que este projeto for oficialmente mesclado à branch principal do
> repositório, o link acima pode ser trocado pelo endereço simples do
> repositório (sem o `/tree/...`). Até lá, ele aponta direto para a versão
> pronta do sistema.

---

## Passo 2 — Criar o banco de dados (pela própria Vercel)

Ainda na tela de configuração do projeto (ou depois, na aba **Storage** do
projeto já criado):

1. Clique em **Storage** → **Create Database**
2. Escolha a opção de banco **Postgres** (Neon é a opção mais comum hoje)
3. Dê um nome como `menegatti-db` e confirme
4. Clique em **Connect** para ligar esse banco ao projeto

Isso cria automaticamente uma variável de ambiente com a conexão do banco.

### Se a Vercel recusar: "você atingiu o limite de bancos"

O plano gratuito da Vercel permite poucos bancos por conta. Se ela recusar a
criação, **crie o banco fora dela**. O sistema não sabe a diferença — para ele
é uma conexão Postgres como qualquer outra — e continua sendo de graça.

1. Entre em <https://neon.com> e crie uma conta (dá para entrar com o GitHub,
   sem cadastrar cartão)
2. Crie um projeto. A tela seguinte mostra a **Connection string**: um texto
   que começa com `postgresql://`. Copie inteiro
   - Se houver a opção **Pooled connection**, prefira ela
3. Na Vercel, vá em **Settings → Environment Variables**
4. Crie a variável `DATABASE_URL` e cole esse texto no valor
5. Marque as **três** caixas: Production, Preview e Development
6. Em **Deployments**, três pontinhos do deploy mais recente → **Redeploy**

Pronto — o resto do guia segue igual. Serve qualquer Postgres hospedado
(Supabase, Railway, Aiven, um servidor da própria empresa); o Neon é só o
mais simples de abrir sem cartão.

### Confira o nome da variável

O sistema espera a variável se chamar exatamente **`DATABASE_URL`**. Depois
de conectar o banco:

1. Vá em **Settings** → **Environment Variables** do projeto
2. Veja se já existe uma variável chamada `DATABASE_URL`
   - **Se já existe**: ótimo, pule para o Passo 3
   - **Se o nome for outro** (ex.: `POSTGRES_PRISMA_URL` ou
     `POSTGRES_URL`): copie o valor dela e crie uma nova variável chamada
     `DATABASE_URL` com esse mesmo valor, marcada para os três ambientes
     (Production, Preview, Development)

---

## Passo 3 — Segredo de login (não precisa fazer nada)

O sistema precisa de um texto secreto para assinar as sessões de login. Ele
**se vira sozinho**: quando não há nada configurado, deriva o segredo da
própria conexão do banco. Não há passo a cumprir aqui, e não há como ficar
trancado do lado de fora por causa disso.

Se você preferir definir o seu, crie em **Settings → Environment Variables**
duas variáveis com o mesmo valor — `NEXTAUTH_SECRET` e `AUTH_SECRET` — e
marque as três caixas (Production, Preview, Development). É opcional.

`NEXTAUTH_URL` também não é necessária: o sistema reconhece sozinho o
endereço em que está publicado.

### Código de recuperação (opcional, mas recomendado)

Crie a variável `CODIGO_RECUPERACAO` com uma frase que só você saiba (pelo
menos 8 caracteres). Com ela, a tela **Esqueci minha senha** sempre devolve o
acesso, mesmo que o papel com o código guardado se perca.

---


## Passo 4 — Deploy

Clique em **Deploy** (ou, se o projeto já existia, em **Redeploy** depois de
salvar as variáveis de ambiente).

A Vercel vai instalar tudo, criar as tabelas no banco e carregar os
parâmetros iniciais da Menegatti automaticamente — não é preciso rodar nada à
mão. Isso leva de 2 a 5 minutos.

Ao final, clique em **Visit** para abrir o sistema.

---

## Primeiro acesso

| Campo   | Valor              |
| ------- | ------------------ |
| Usuário | `Menegatti`        |
| Senha   | `Menegatti26fin`   |

**Troque a senha** em *Configurações → Empresa → Credenciais de acesso*. A
partir do momento em que você a trocar por essa tela, nenhuma publicação
futura desfaz a sua senha — ela é sua.

Enquanto a senha ainda for a do instalador, cada publicação realinha o acesso
com as credenciais acima. É a rede de segurança que impede ficar trancado do
lado de fora.

Esqueceu a senha? Clique em **Esqueci minha senha** na tela de login e use o
código de recuperação (aquele que apareceu no primeiro acesso) ou o valor de
`CODIGO_RECUPERACAO`, se você tiver criado essa variável.

---

## Sobre backups nesse modo

Na Vercel os dados já ficam guardados de forma duradoura no banco Postgres
(fora do alcance de travar/formatar um computador). O botão **Exportar
backup**, em *Configurações → Backup*, continua funcionando normalmente e
baixa o ZIP completo (dados + relatório) direto no seu navegador — use-o
quando quiser uma cópia extra fora da Vercel. O agendamento automático de
backup em disco, pensado para a instalação local, fica desativado nesse modo
porque não existe disco permanente numa função da Vercel — o Postgres já
cumpre esse papel.

---

## Chave da Anthropic (opcional)

O Centro de Inteligência (insights por IA) é opcional. Para ativá-lo, crie a
variável `ANTHROPIC_API_KEY` em Settings → Environment Variables, ou cadastre
a chave direto pela interface em *Configurações → Integração de IA* depois do
primeiro acesso — o valor salvo pela interface tem prioridade sobre a
variável de ambiente.

---

## Se algo der errado

- **"No Output Directory named 'public' found after the Build completed"**:
  a Vercel está tratando o projeto como site estático em vez de Next.js. O
  build funcionou (a mensagem aparece *depois* de "Compiled successfully");
  ela só foi procurar a saída no lugar errado.

  O repositório já traz um `vercel.json` declarando `"framework": "nextjs"`,
  o que normalmente resolve. Se ainda assim aparecer, ajuste pelo painel:
  **Settings → Build and Deployment**, coloque **Framework Preset** em
  **Next.js** e desligue qualquer "Override" em **Output Directory**. Depois
  clique em **Redeploy**.

- **O deploy publica uma versão antiga do sistema**: confira qual branch está
  em **Settings → Git → Production Branch**. Ela precisa apontar para a
  branch onde o código está de fato. Se apontar para uma branch parada, todo
  deploy vai publicar aquele código antigo, por mais que você atualize o
  resto.

- **O sistema abre na tela "Falta conectar um banco de dados"**: é o Passo 2
  que ficou pela metade. A variável precisa se chamar exatamente
  `DATABASE_URL` e estar marcada nas **três** caixas — Production, Preview e
  Development. Marcada só em Production, o endereço da branch (aquele com
  `-git-` no meio) continua caindo nessa tela, porque ele roda no ambiente
  **Preview**. Depois de corrigir, clique em **Redeploy**.
- **Login não funciona / sessão não gruda**: não é preciso configurar
  `NEXTAUTH_URL` nem os segredos — o sistema resolve sozinho. Se você chegou
  a criar `NEXTAUTH_SECRET` e `AUTH_SECRET`, confira que os dois têm o mesmo
  valor; valores diferentes derrubam a sessão.
- **Qualquer variável nova só tem efeito depois de um novo deploy**: use o
  botão **Redeploy** na aba **Deployments**.
