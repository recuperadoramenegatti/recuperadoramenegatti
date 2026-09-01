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

## Passo 3 — Criar o segredo de login

O sistema precisa de um texto aleatório para proteger as sessões de login.
Sem abrir nenhum programa:

1. Abra qualquer página no navegador
2. Aperte **F12** (ou clique com o botão direito → **Inspecionar**) para
   abrir as Ferramentas do Desenvolvedor
3. Clique na aba **Console**
4. Cole isto e aperte Enter:
   ```js
   crypto.randomUUID() + crypto.randomUUID()
   ```
5. Copie o texto que aparecer (algo como
   `"a1b2c3d4-...-e5f6g7h8-..."`, sem as aspas)

Em **Settings → Environment Variables**, crie duas variáveis com esse mesmo
valor colado:

| Nome              | Valor                          |
| ----------------- | ------------------------------- |
| `NEXTAUTH_SECRET`  | o texto copiado acima            |
| `AUTH_SECRET`      | o mesmo texto copiado acima      |

E mais uma, com o endereço que a própria Vercel deu ao projeto (aparece no
topo da página do projeto, algo como `https://menegatti-erp.vercel.app`):

| Nome            | Valor                                 |
| --------------- | -------------------------------------- |
| `NEXTAUTH_URL`  | o endereço `https://...vercel.app`     |

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

| Campo   | Valor           |
| ------- | --------------- |
| Usuário | `admin`         |
| Senha   | `menegatti2024` |

**Troque a senha imediatamente** em *Configurações → Empresa → Credenciais de
acesso*.

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

- **Build falhou dizendo que não encontrou `DATABASE_URL`**: revise o Passo 2
  — a variável precisa se chamar exatamente `DATABASE_URL` e estar marcada
  para o ambiente **Production**.
- **Login não funciona / sessão não gruda**: confira se `NEXTAUTH_URL` é
  exatamente o endereço `https://...vercel.app` do projeto, sem barra no
  final, e se `NEXTAUTH_SECRET` e `AUTH_SECRET` têm o mesmo valor.
- **Qualquer variável nova só tem efeito depois de um novo deploy**: use o
  botão **Redeploy** na aba **Deployments**.
