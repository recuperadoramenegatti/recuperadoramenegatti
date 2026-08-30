# Instalação na máquina da empresa

Guia para instalar o sistema no computador da Recuperadora Menegatti. Não é
preciso saber programar — são três passos.

O sistema roda **dentro da sua empresa**. Os dados ficam no seu computador,
não na internet, e não há mensalidade de servidor.

---

## Antes de começar

Você vai precisar de:

- Um computador com **Windows 10/11**, Linux ou macOS
- **Internet**, só na hora de instalar (o uso diário funciona sem)
- Cerca de **20 minutos**, quase todos de espera

---

## Passo 1 — Instalar o Node.js

O sistema é construído sobre o Node.js, um programa gratuito da comunidade de
software livre. Ele precisa estar no computador antes.

1. Abra <https://nodejs.org>
2. Clique no botão que diz **LTS** (é a versão estável recomendada)
3. Execute o arquivo baixado e clique em *Avançar* até o fim, sem mudar nada

Se o computador pedir para reiniciar, reinicie.

> Já tem Node.js instalado? Ótimo, pule este passo. O instalador avisa se a
> versão for antiga demais.

---

## Passo 2 — Instalar o sistema

### Windows

1. Copie a pasta do sistema para o computador — por exemplo, para
   `C:\Menegatti`
2. Abra a pasta
3. Dê **dois cliques** em **`instalar.bat`**
4. Uma janela preta vai abrir e escrever várias linhas. **Isso é normal.**
   Deixe trabalhando; leva de 5 a 15 minutos
5. Ao terminar, o sistema abre sozinho no navegador

### Linux ou macOS

Abra o terminal na pasta do sistema e rode:

```bash
./instalar.sh
```

---

## Passo 3 — Primeiro acesso

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

Depois da instalação, ele sobe junto com o computador e fica esperando. Uma
janela pequena chamada *Sistema Menegatti* fica na barra de tarefas.

**Não feche essa janela** enquanto estiver usando o sistema — ela é o próprio
servidor. Se fechar por engano, é só usar o atalho da área de trabalho de novo.

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

### "A porta 3000 já está em uso"

Outro programa ocupou o endereço. Abra o `iniciar.bat` no Bloco de Notas,
troque `set PORT=3000` por `set PORT=3001` e salve. No Linux:

```bash
PORT=3001 ./iniciar.sh
```

### Esqueci a senha

Na pasta do sistema, abra o terminal e rode:

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
