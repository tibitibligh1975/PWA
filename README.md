# PWA de Notificações com MongoDB

Este é um PWA para notificações push integrado com MongoDB para persistência de dados.

## Tecnologias

- Node.js
- Express
- MongoDB
- Web Push
- Service Workers

## Configuração Local

1. Instale as dependências:

```bash
npm install
```

2. Gere suas próprias chaves VAPID:

```bash
npx web-push generate-vapid-keys
```

3. Configure as variáveis de ambiente no Railway ou crie um arquivo `.env` local:

```env
MONGODB_URI=sua_url_do_mongodb
VAPID_PUBLIC_KEY=sua_chave_publica
VAPID_PRIVATE_KEY=sua_chave_privada
VAPID_EMAIL=seu_email
```

4. Para desenvolvimento local:

```bash
npm run dev
```

## Deploy no Railway

1. Conecte seu repositório ao Railway
2. Configure as variáveis de ambiente no Railway:
   - MONGODB_URI
   - VAPID_PUBLIC_KEY
   - VAPID_PRIVATE_KEY
   - VAPID_EMAIL
3. O deploy será automático após cada push

## Uso no iPhone

1. Abra o Safari e acesse a URL do seu app
2. Toque no ícone de compartilhamento
3. Selecione "Adicionar à Tela de Início"
4. Abra o app pela tela inicial
5. Clique em "Ativar Notificações"

## Testando Notificações

Para testar o envio de notificações manualmente, acesse:
`/api/send-notification`

## Observações

- O servidor usa MongoDB para armazenar as subscrições de forma persistente
- As notificações são verificadas a cada hora para remover subscrições inválidas
- O sistema é otimizado para deploy no Railway
