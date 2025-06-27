const messagesElement = document.getElementById("messages");
const subscribeButton = document.getElementById("subscribe");

let isSubscribed = false;

function updateSubscriptionStatus(status) {
  messagesElement.innerHTML = `<p>${status}</p>`;
}

// Verificar se já existe uma subscrição ativa
async function checkExistingSubscription() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Verificar se a subscrição ainda é válida no servidor
      const response = await fetch("/api/subscription-status");
      const status = await response.json();

      if (status.hasSubscriptions) {
        isSubscribed = true;
        subscribeButton.disabled = true;
        updateSubscriptionStatus("Notificações já estão ativas!");
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("Erro ao verificar subscrição existente:", error);
    return false;
  }
}

// Verificar periodicamente se a subscrição ainda está ativa
async function checkSubscriptionHealth() {
  if (!isSubscribed) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log("Subscrição local perdida, tentando re-subscrever...");
      isSubscribed = false;
      subscribeButton.disabled = false;
      updateSubscriptionStatus(
        "Subscrição perdida. Tentando reativar automaticamente..."
      );
      await resubscribe();
      return;
    }

    // Verificar no servidor se ainda temos subscrições ativas
    const response = await fetch("/api/subscription-status");
    const status = await response.json();

    if (!status.hasSubscriptions) {
      console.log("Nenhuma subscrição ativa no servidor, re-subscrevendo...");
      updateSubscriptionStatus("Reativando subscrição automaticamente...");
      await resubscribe();
    } else {
      console.log("Subscrição está saudável");
      updateSubscriptionStatus("Notificações ativas e funcionando");
    }
  } catch (error) {
    console.error("Erro na verificação de saúde da subscrição:", error);
    // Não desativa a subscrição em caso de erro de rede
    if (error.name !== "TypeError" && error.name !== "NetworkError") {
      isSubscribed = false;
      subscribeButton.disabled = false;
      updateSubscriptionStatus(
        "Erro na verificação. Clique para tentar novamente."
      );
    }
  }
}

// Re-subscrever automaticamente
async function resubscribe() {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      updateSubscriptionStatus(
        `Tentativa ${retryCount + 1} de reativar notificações...`
      );
      await subscribeToPushNotifications();
      console.log("Resubscrição bem sucedida");
      return;
    } catch (error) {
      console.error(
        `Erro na tentativa ${retryCount + 1} de resubscrever:`,
        error
      );
      retryCount++;
      if (retryCount < maxRetries) {
        // Esperar um pouco antes de tentar novamente (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, retryCount))
        );
      }
    }
  }

  isSubscribed = false;
  subscribeButton.disabled = false;
  updateSubscriptionStatus("Não foi possível reativar. Tente manualmente.");
}

async function subscribeToPushNotifications() {
  try {
    const registration = await navigator.serviceWorker.ready;

    // Solicitar permissão de notificação
    const permission = await window.Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Permissão de notificação negada");
    }

    // Gerar chaves VAPID no servidor
    const response = await fetch("/api/vapid-public-key");
    const vapidPublicKey = await response.text();
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    // Obter subscrição push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    });

    // Enviar subscrição para o servidor
    const subscribeResponse = await fetch("/api/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscription),
    });

    if (subscribeResponse.ok) {
      isSubscribed = true;
      updateSubscriptionStatus("Notificações ativadas com sucesso!");
      subscribeButton.disabled = true;
    } else {
      throw new Error("Erro ao registrar subscrição no servidor");
    }
  } catch (error) {
    isSubscribed = false;
    updateSubscriptionStatus(`Erro ao ativar notificações: ${error.message}`);
  }
}

// Função auxiliar para converter chave VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Registra o service worker e ativa o botão
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then(async () => {
      // Verificar se já existe uma subscrição ativa
      const hasExisting = await checkExistingSubscription();

      if (!hasExisting) {
        subscribeButton.disabled = false;
      }

      // Configurar verificação periódica (a cada 30 minutos)
      setInterval(checkSubscriptionHealth, 30 * 60 * 1000);

      // Verificação inicial após 1 minuto
      setTimeout(checkSubscriptionHealth, 60 * 1000);
    })
    .catch((error) => {
      updateSubscriptionStatus(
        `Erro ao registrar service worker: ${error.message}`
      );
    });
}

subscribeButton.addEventListener("click", subscribeToPushNotifications);

// Detectar quando a página fica visível novamente (usuário volta para a aba)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isSubscribed) {
    // Verificar saúde da subscrição quando o usuário volta para a página
    setTimeout(checkSubscriptionHealth, 1000);
  }
});
