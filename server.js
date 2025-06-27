const express = require("express");
const webpush = require("web-push");
const path = require("path");
const { MongoClient } = require("mongodb");
const app = express();

// Middleware para processar JSON
app.use(express.json());

// URL de conexão do MongoDB
const mongoUrl =
  "mongodb://mongo:DbrjgxDIdlMHsbmekuKThXonKKnFDAZu@tramway.proxy.rlwy.net:45300";
let db;
let subscriptionsCollection;

// Conectar ao MongoDB
async function connectToMongo() {
  try {
    const client = await MongoClient.connect(mongoUrl);
    db = client.db("pwa_notifications");
    subscriptionsCollection = db.collection("subscriptions");
    console.log("Conectado ao MongoDB com sucesso!");
  } catch (error) {
    console.error("Erro ao conectar ao MongoDB:", error);
    process.exit(1);
  }
}

// Iniciar conexão com MongoDB
connectToMongo();

// Gerar VAPID keys usando webpush.generateVAPIDKeys() e substituir estas chaves
const vapidKeys = {
  publicKey:
    "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U",
  privateKey: "UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls",
};

webpush.setVapidDetails(
  "mailto:seu-email@exemplo.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Log para debug
function logDebug(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Função para remover uma subscrição inválida
async function removeInvalidSubscription(subscription) {
  try {
    const timestamp = new Date().toISOString();
    logDebug(
      `[${timestamp}] Removendo subscrição inválida:`,
      subscription.endpoint
    );

    await subscriptionsCollection.deleteOne({
      endpoint: subscription.endpoint,
    });
    logDebug(`[${timestamp}] Subscrição removida com sucesso`);
  } catch (error) {
    logDebug("Erro ao remover subscrição:", error);
  }
}

// Função para testar se uma subscrição ainda é válida
async function testSubscription(subscription) {
  const timestamp = new Date().toISOString();
  try {
    logDebug(`[${timestamp}] Testando subscrição:`, subscription.endpoint);

    const testPayload = JSON.stringify({
      title: "Teste de Validação",
      body: "Verificando se a subscrição ainda está ativa",
      silent: true,
    });

    await webpush.sendNotification(subscription, testPayload);
    logDebug(`[${timestamp}] Teste bem sucedido para:`, subscription.endpoint);
    return true;
  } catch (error) {
    logDebug(`[${timestamp}] Erro ao testar subscrição:`, {
      endpoint: subscription.endpoint,
      errorCode: error.statusCode,
      errorMessage: error.message,
    });

    if (error.statusCode === 410 || error.statusCode === 413) {
      await removeInvalidSubscription(subscription);
      return false;
    }
    return false;
  }
}

// Verificar subscrições periodicamente
setInterval(async () => {
  try {
    const timestamp = new Date().toISOString();
    logDebug(`[${timestamp}] Iniciando verificação de subscrições...`);

    const subscriptions = await subscriptionsCollection.find({}).toArray();
    logDebug(
      `Total de subscrições antes da verificação: ${subscriptions.length}`
    );

    for (const subscription of subscriptions) {
      await testSubscription(subscription);
    }

    const remainingSubscriptions =
      await subscriptionsCollection.countDocuments();
    logDebug(
      `[${timestamp}] Verificação concluída. Subscrições ativas: ${remainingSubscriptions}`
    );
  } catch (error) {
    logDebug("Erro durante verificação periódica:", error);
  }
}, 60 * 60 * 1000); // Verificar a cada 1 hora

// Endpoint para verificar status da subscrição
app.get("/api/subscription-status", async (req, res) => {
  try {
    const count = await subscriptionsCollection.countDocuments();
    logDebug(`Status das subscrições: ${count} ativas`);
    res.json({
      activeSubscriptions: count,
      hasSubscriptions: count > 0,
    });
  } catch (error) {
    logDebug("Erro ao verificar status das subscrições:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.get("/api/vapid-public-key", (req, res) => {
  res.send(vapidKeys.publicKey);
});

app.post("/api/subscribe", async (req, res) => {
  try {
    const subscription = req.body;
    logDebug("Nova subscrição recebida:", subscription);

    // Verificar se já existe e atualizar/inserir
    await subscriptionsCollection.updateOne(
      { endpoint: subscription.endpoint },
      { $set: subscription },
      { upsert: true }
    );

    logDebug("Subscrição salva no MongoDB");

    // Enviar notificação de teste
    const testPayload = JSON.stringify({
      title: "Teste de Conexão",
      body: "Sua conexão para notificações está funcionando!",
    });

    await webpush.sendNotification(subscription, testPayload);
    logDebug("Notificação de teste enviada com sucesso");
    res
      .status(201)
      .json({ message: "Subscrição registrada e testada com sucesso" });
  } catch (error) {
    logDebug("Erro ao processar subscrição:", error);
    if (error.statusCode === 410) {
      await removeInvalidSubscription(req.body);
    }
    res.status(500).json({ error: "Erro ao processar subscrição" });
  }
});

// Webhook para receber notificações do gateway
app.post("/webhook", async (req, res) => {
  try {
    logDebug("Webhook recebido:", req.body);
    const data = req.body;

    // Buscar todas as subscrições ativas
    const subscriptions = await subscriptionsCollection.find({}).toArray();

    if (subscriptions.length === 0) {
      logDebug("Erro: Nenhuma subscrição encontrada");
      return res.status(400).json({ error: "Nenhuma subscrição encontrada" });
    }

    logDebug(`Enviando para ${subscriptions.length} subscrições`);

    const comissao = (data.result / 100).toFixed(2).replace(".", ",");

    // Só enviar notificação se a venda for aprovada
    if (data.status === "completed") {
      const payload = JSON.stringify({
        title: `Venda Aprovada 🔥`,
        body: `Sua comissão » R$ ${comissao}`,
      });

      logDebug("Tentando enviar notificação com payload:", payload);

      // Enviar para todas as subscrições ativas
      const sendPromises = subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(subscription, payload);
          logDebug("Notificação enviada para:", subscription.endpoint);
          return { success: true, subscription };
        } catch (pushError) {
          logDebug("Erro ao enviar push:", pushError);
          if (pushError.statusCode === 410) {
            await removeInvalidSubscription(subscription);
          }
          return { success: false, subscription, error: pushError };
        }
      });

      const results = await Promise.all(sendPromises);
      const successful = results.filter((r) => r.success).length;

      logDebug(`Notificações enviadas: ${successful}/${subscriptions.length}`);
      res.status(200).send("OK");
    } else {
      res.status(200).send("OK");
    }
  } catch (err) {
    logDebug("Erro no webhook:", err);
    res.status(500).send("Erro interno");
  }
});

// Rota para enviar notificação manualmente (para testes)
app.get("/api/send-notification", async (req, res) => {
  try {
    const subscriptions = await subscriptionsCollection.find({}).toArray();

    if (subscriptions.length === 0) {
      logDebug("Erro: Tentativa de envio manual sem subscrições");
      return res.status(400).json({ error: "Nenhuma subscrição encontrada" });
    }

    const payload = JSON.stringify({
      title: "Checkoutinho",
      body: "Notificação manual enviada com sucesso!",
    });

    logDebug("Enviando notificação manual:", { payload });

    const sendPromises = subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, payload);
        return { success: true };
      } catch (error) {
        if (error.statusCode === 410) {
          await removeInvalidSubscription(subscription);
        }
        return { success: false, error };
      }
    });

    const results = await Promise.all(sendPromises);
    const successful = results.filter((r) => r.success).length;

    logDebug(
      `Notificações manuais enviadas: ${successful}/${subscriptions.length}`
    );
    res.json({ success: true, sent: successful, total: subscriptions.length });
  } catch (error) {
    logDebug("Erro ao enviar notificações manuais:", error);
    res.status(500).json({ error: "Erro ao enviar notificações" });
  }
});

// Servir arquivos estáticos
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
