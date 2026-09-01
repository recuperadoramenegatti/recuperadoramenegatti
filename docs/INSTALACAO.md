# Instalação na máquina da empresa

Guia para instalar o sistema no computador da Recuperadora Menegatti. Não é
preciso saber programar.

O sistema roda **dentro da sua empresa**. Os dados ficam no seu computador,
não na internet, e não há mensalidade de servidor.

---

## Windows: instalador de um clique (o mais fácil)

Se o computador da empresa é Windows, este é o caminho mais simples que
existe — baixar um arquivo e instalar, como qualquer outro programa.

1. Baixe **`MenegattiERP-Setup.exe`** (peça o link de download a quem
   preparou o sistema para você, ou veja
   [como gerá-lo você mesmo](#gerar-o-instalador-para-quem-mantém-o-sistema))
2. Dê **dois cliques** no arquivo baixado
3. O Windows provavelmente vai mostrar um aviso **"O Windows protegeu o
   computador"** — isso é esperado, o instalador não tem um certificado pago
   de editora (custaria uma mensalidade sem necessidade nenhuma para um
   sistema de uso interno). Clique em **Mais informações** e depois em
   **Executar assim mesmo**
4. Siga o assistente: **Avançar → Instalar**. Não precisa mexer em nada —
   nem instalar Node.js, nem abrir terminal
5. A instalação leva de 5 a 15 minutos (com internet); ao final, o sistema
   abre sozinho no navegador

Pronto — o mesmo resultado do passo a passo manual abaixo, sem nenhum dos
passos manuais. Um atalho **"Sistema Menegatti"** fica na área de trabalho, e
o sistema passa a iniciar sozinho com o Windows. Para desinstalar, use
**Configurações → Aplicativos** do Windows como qualquer outro programa.

> Linux ou macOS, ou prefere entender cada passo? Siga o caminho manual
> abaixo — ele funciona em qualquer sistema.

---

## Caminho manual (Linux, macOS, ou por escolha)

### Antes de começar

Você vai precisar de:

- Um computador com **Windows 10/11**, Linux ou macOS
- **Internet**, só na hora de instalar (o uso diário funciona sem)
- Cerca de **20 minutos**, quase todos de espera

### Passo 1 — Instalar o Node.js

O sistema é construído sobre o Node.js, um programa gratuito da comunidade de
software livre. Ele precisa estar no computador antes.

1. Abra <https://nodejs.org>
2. Clique no botão que diz **LTS** (é a versão estável recomendada)
3. Execute o arquivo baixado e clique em *Avançar* até o fim, sem mudar nada

Se o computador pedir para reiniciar, reinicie.

> Já tem Node.js instalado? Ótimo, pule este passo. O instalador avisa se a
> versão for antiga demais.

---

### Passo 2 — Instalar o sistema

#### Windows

1. Copie a pasta do sistema para o computador — por exemplo, para
   `C:\Menegatti`
2. Abra a pasta
3. Dê **dois cliques** em **`instalar.bat`**
4. Uma janela preta vai abrir e escrever várias linhas. **Isso é normal.**
   Deixe trabalhando; leva de 5 a 15 minutos
5. Ao terminar, o sistema abre sozinho no navegador

#### Linux ou macOS

Abra o terminal na pasta do sistema e rode:

```bash
./instalar.sh
```

---

### Passo 3 — Primeiro acesso

O sistema abre no navegador. Entre com:

| Campo   | Valor           |
| ------- | --------------- |
| Usuário | `admin`         |
| Senha   | `menegatti2024` |

**Troque a senha agora**, em *Configurações → Empresa → Credenciais de
acesso*. Essa senha é a única coisa entre o computador e todos os números
financeiros da empresa.

Pronto. O sistema já vem com os parâmetros da Menegatti carregados — a folha,
os cinco centros de custo, as taxas por hora — e pode orçar o primeiro serviço
imediatamente.

---

## O dia a dia

### Abrir o sistema

Dê dois cliques no atalho **Sistema Menegatti** na área de trabalho.

Se o servidor estiver parado, o atalho o liga e espera ficar pronto antes de
abrir o navegador. Você não precisa saber se está ligado ou não.

### O sistema liga sozinho

Depois da instalação, ele sobe junto com o computador e fica rodando em
segundo plano, sem janela nenhuma na tela. Você não precisa fazer nada: é só
usar o atalho da área de trabalho quando quiser abrir.

> Nas versões anteriores o servidor ficava numa janela preta que não podia
> ser fechada. Isso foi resolvido justamente porque fechar a janela errada
> derrubava o sistema no meio do trabalho.

### Desligar o sistema

Raramente é preciso — ele não atrapalha nada rodando em segundo plano. Mas se
quiser desligar, dê dois cliques em **`parar.bat`**, na pasta do sistema.

> **No Windows**, o sistema sobe quando alguém faz login, não quando o
> computador liga. Foi uma escolha: assim ele roda com a mesma conta que é
> dona do arquivo do banco, o que evita a causa mais comum de problema numa
> instalação dessas — permissão de arquivo. Se o computador precisar servir o
> sistema sem ninguém logado, veja *Instalar como serviço*, mais abaixo.

### Usar de outro computador

Se a oficina tem um computador no escritório e outro no chão de fábrica, o
segundo pode abrir o sistema pela rede.

Na janela do servidor aparece um endereço parecido com:

```
De outro computador da oficina:
  http://192.168.0.15:3000
```

Digite esse endereço no navegador do outro computador. O login continua sendo
pedido — a rede não dá acesso livre.

Se não funcionar, o firewall do Windows pode estar bloqueando. Rode o
`instalar.bat` **como administrador** (botão direito → *Executar como
administrador*): ele libera a porta.

---

## Backup — leia esta parte

O sistema faz cópias automáticas sozinho, mas **todas ficam no mesmo
computador**. Elas protegem contra apagar algo por engano. Não protegem contra
o computador quebrar, ser roubado ou pegar fogo.

**Uma vez por semana**, faça isto:

1. *Configurações → Backup e segurança*
2. Clique em **Exportar backup completo**
3. Salve o arquivo em um **pen drive**, no e-mail ou na nuvem — em qualquer
   lugar que não seja este computador

São dois minutos. É o que separa um susto de uma perda.

O sistema avisa na própria tela quando passa uma semana sem backup baixado.

---

## Quando algo dá errado

### "O Node.js não está instalado"

Volte ao Passo 1. Depois de instalar, feche a janela preta e dê dois cliques
no `instalar.bat` de novo.

### A instalação para no meio com erro

Quase sempre é falta de internet. Confira a conexão e rode de novo — pode
rodar quantas vezes precisar, não estraga nada.

Se persistir, tente como administrador (botão direito → *Executar como
administrador*).

### O navegador diz que não conseguiu conectar

O servidor está parado. Dê dois cliques no atalho **Sistema Menegatti** e
espere alguns segundos.

### Cliquei no atalho e não abriu nada

O atalho agora mostra o motivo em vez de fechar sozinho: se o sistema não
subir, aparece uma janela com as últimas mensagens do servidor e o que
costuma resolver.

Se quiser ver o registro completo, ele fica em **`logs\servidor.log`**, dentro
da pasta do sistema. Esse arquivo é o que dizer numa conversa de suporte.

### "A porta 3000 já está em uso"

Outro programa ocupou o endereço. Abra o `iniciar.bat` no Bloco de Notas,
troque `set PORT=3000` por `set PORT=3001` e salve. No Linux:

```bash
PORT=3001 ./iniciar.sh
```

### Esqueci a senha

Na tela de entrada, clique em **"Esqueci minha senha"**. O sistema pede o
**código de recuperação** e deixa você escolher uma senha nova.

**Onde está esse código?** Ele apareceu uma única vez, dentro de uma moldura,
no final da instalação — é aquele no formato `ABCD-EFGH-JKLM-NPQR`. Ele foi
feito para ser anotado num papel e guardado junto com os documentos da
empresa. Pode digitar com ou sem os hífens, em maiúsculas ou minúsculas.

Cada código serve **uma vez só**: ao usá-lo, a tela mostra um código novo
para você anotar no lugar do antigo.

#### E se o papel com o código se perdeu?

Configure um **código mestre**, que fica sob controle de quem administra o
sistema e não se perde:

- **Na máquina da empresa**: abra o arquivo `.env` na pasta do sistema e
  acrescente uma linha como
  `CODIGO_RECUPERACAO="frase-longa-que-so-a-direcao-conhece-2026"`.
  Depois desligue e ligue o sistema.
- **Na Vercel**: crie a variável `CODIGO_RECUPERACAO` em
  *Settings → Environment Variables* e clique em **Redeploy**.

Esse código passa a funcionar em "Esqueci minha senha" como qualquer outro —
e, por não ficar guardado no banco, continua valendo mesmo depois de usado.

#### Último recurso

Se nem o papel nem o código mestre existirem, ainda dá para redefinir pelo
banco. Na pasta do sistema:

```bash
npm run db:studio
```

Apague o registro da tabela `User` e depois rode `npm run db:seed`. O usuário
`admin` volta com a senha `menegatti2024`.

---

## Trocar de computador

1. No computador antigo: *Configurações → Backup* → **Exportar backup completo**
2. No novo: instale seguindo este guia
3. No novo: *Configurações → Backup* → **Restaurar backup**, modo
   **Substituir**

Todos os orçamentos, clientes, ordens e configurações vão junto.

---

## Instalar como serviço (opcional, avançado)

Só é necessário se o computador precisar servir o sistema **sem ninguém
logado** — por exemplo, uma máquina que fica ligada num canto só para isso.

### Linux

O `instalar.sh` já configura um serviço de usuário do systemd. Para que ele
suba sem login aberto:

```bash
sudo loginctl enable-linger $USER
systemctl --user status menegatti     # conferir
```

### Windows

Requer uma ferramenta externa como o [NSSM](https://nssm.cc). Chame quem cuida
da informática — a configuração de conta e permissão de arquivo precisa ser
feita com cuidado, ou o serviço sobe mas não consegue escrever no banco.

---

## Onde ficam as coisas

| O quê                  | Onde                                   |
| ---------------------- | -------------------------------------- |
| Todos os dados         | `prisma/menegatti.db` — um único arquivo |
| Backups automáticos    | `backups/`                             |
| Configuração e segredo | `.env`                                 |

Copiar o arquivo `prisma/menegatti.db` copia o sistema inteiro. É exatamente
isso que o backup faz, com verificação de integridade por cima.

---

## Gerar o instalador (para quem mantém o sistema)

Esta parte é para quem edita o código, não para quem só vai usar o sistema.

O `MenegattiERP-Setup.exe` citado lá em cima não é um arquivo comum do
repositório — ele é **gerado** a partir do código, já com um Node.js
portátil embutido, então quem for instalar não precisa ter Node.js no
computador. Para gerar (ou atualizar) esse arquivo:

```bash
# numa máquina Linux com NSIS instalado (sudo apt install nsis)
./installer/windows/gerar-instalador.sh
```

O resultado sai em `installer/windows/dist/MenegattiERP-Setup.exe`. O script
baixa o Node.js oficial do site nodejs.org e confere o checksum antes de
empacotar — nada é baixado de fonte não verificada.

### Deixar num link permanente

Para que qualquer pessoa baixe pelo navegador, sem precisar pedir o arquivo:

1. No GitHub, abra o repositório → **Releases** → **Draft a new release**
2. Em *Tag*, escreva algo como `v1.0.0`
3. Arraste o arquivo `MenegattiERP-Setup.exe` para a caixa de anexos
4. Clique em **Publish release**

O link da página do release (algo como
`github.com/.../releases/latest`) é o "link de download" — pode ser
compartilhado, colocado num favorito do navegador da empresa, ou linkado
direto no README. Não precisa programar nada para isso, é só arrastar o
arquivo na página do GitHub.
