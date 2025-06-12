// STICKER, STATO DI VISUALIZZAZIONE

/*
  visualizzazione:
  quando un utente si connette, tutti i messaggi presenti nella chat vengono visualizzati
  il numero di utenti non varia la visualizzazione come su wa perche la chatroom e una e non molte
  appena il messaggio viene inviato, viene visualizzato in tempo reale
  NOTA: abbastanza inutile se non sono presenti piu stanze in cui scrivere: ovvero le chat
  
  
  Quando un utente esegue l'accesso, gli vengono mostrati gli utenti a loro volta
  connessi, l'utente puo scegliere di inviare un messaggio privato a uno di questi utenti

  quindi: l'utente entra, sceglie a chi scrivere e iniza quindi una chat privata
  poi se torna indietro, vengono ancora mostrati gli utenti E la chat iniziata prima
  */

const fastify = require("fastify")();
const fastifyStatic = require("@fastify/static");
const path = require("path");
const {
  createSSEManager,
  FastifyHttpAdapter,
} = require("@soluzioni-futura/sse-manager");

async function main() {
  // Static files
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, "public"),
  });

  // Index
  fastify.get("/", (request, reply) => {
    reply.sendFile("users.html");
  });

  const sseManager = await createSSEManager({
    httpAdapter: new FastifyHttpAdapter(fastify),
  });

  // Set per tenere traccia dei nickname attivi
  const connectedUsers = new Set();

  // Array per memorizzare tutti i messaggi della cronologia
  const messageHistory = [];

  fastify.post("/send", async (request, reply) => {
    const msg = request.body; // Fastify parse già il JSON
    console.log("MSG FETCH " + msg.text);

    const messageData = {
      sender: msg.sender,
      text: msg.text,
      usrNumber: connectedUsers.size, // Numero di utenti connessi
      timestamp: new Date().toISOString(),
    };

    // Aggiungi il messaggio alla cronologia
    messageHistory.push(messageData);

    // Broadcast del messaggio a tutti gli utenti connessi
    const messageDataString = JSON.stringify(messageData);
    await sseManager.broadcast("chat-room", {
      data: messageDataString,
    });

    reply.send({ status: "ok" });
  });

  // Endpoint `/writing`:
  // This endpoint is used to notify all connected users about typing activity in the chat.
  // It expects a JSON body containing:
  // - `scrive`: A boolean indicating whether the user is typing.
  // - `sender`: The nickname of the user who is typing.
  // If either `scrive` or `sender` is missing, it responds with a 400 error.
  // Otherwise, it broadcasts the typing activity to all users in the "chat-room".

  const typingUsers = new Map();
  fastify.post("/writing", async (request, reply) => {
    const msg = request.body;

    if (!msg.scrive || !msg.sender) {
      reply
        .code(400)
        .send({ error: "Missing 'scrive' or 'sender' in request body" });
      return;
    
    }
    const nickname = msg.sender;

    // Se già presente, resetta il timeout
    if (typingUsers.has(nickname)) {
      clearTimeout(typingUsers.get(nickname));
    }

    // Imposta un nuovo timeout per rimuovere il nickname dopo 5s
    const timeout = setTimeout(() => {
      typingUsers.delete(nickname);
      console.log(`Timeout: ${nickname} non sta più scrivendo`);
    }, 2000);

    typingUsers.set(nickname, timeout);
    // Broadcast the typing activity to all users in the "chat-room"
    await sseManager.broadcast("chat-room", {
      data: JSON.stringify({
        type: "writing",
        scrive: msg.scrive,
        sender: msg.sender,
        numeroScrittori: typingUsers.size,
        // usersNumber: connectedUsers.size, // Include the number of users typing
      }),
    });
    reply.send({ status: "ok" });
  });

  // fastify.post("/usrConnected", async (request, reply) => {
  //   const msg = request.body;
  //   if (!msg.sender) {
  //     reply.code(400).send({ error: "Missing 'sender' in request body" });
  //     return;
  //   } else {
  //     // Aggiungi il nickname alla lista degli utenti connessi
  //     users.push(msg.sender);
  //     console.log(`${msg.sender} si è connesso`, users.length);
  //   }
  // });

  fastify.get("/stream", async (request, reply) => {
    try {
      const nickname = request.query.nickname?.trim();

      if (!nickname) {
        reply.code(400).send("Nickname mancante");
        return;
      }

      if (connectedUsers.has(nickname)) {
        // Uso diretto delle header HTTP per SSE per inviare errore
        reply.type("text/event-stream");
        reply.header("Cache-Control", "no-cache");
        reply.header("Connection", "keep-alive");
        reply.header("Access-Control-Allow-Origin", "*");

        const errorData = JSON.stringify({
          type: "error",
          message: "Nickname già in uso",
        });

        reply.send(`data: ${errorData}\n\n`);
        return;
      }

      // Aggiungi il nickname alla lista degli utenti connessi
      connectedUsers.add(nickname);
      console.log(`${nickname} si è connesso`, connectedUsers.size);

      // Crea lo stream SSE e aggiungilo alla room
      const stream = await sseManager.createSSEStream(reply);
      await stream.addToRoom("chat-room");

      // Invia la cronologia dei messaggi al nuovo utente
      if (messageHistory.length > 0) {
        console.log(
          `Invio cronologia di ${messageHistory.length} messaggi a ${nickname}`
        );

        for (const message of messageHistory) {
          try {
            await sseManager.broadcast("chat-room", {
              data: JSON.stringify({
                ...message,
                isHistory: true, // Flag per identificare i messaggi della cronologia
              }),
            });
          } catch (historyErr) {
            console.error(
              "Errore nell'invio del messaggio della cronologia:",
              historyErr
            );
          }
        }
      }

      // Gestisci la disconnessione
      stream.on("close", () => {
        connectedUsers.delete(nickname);
        console.log(`${nickname} si è disconnesso`, connectedUsers.size);
      });
    } catch (err) {
      console.error("Errore nel gestire lo stream:", err);
      connectedUsers.delete(nickname); // Rimuovi il nickname in caso di errore

      if (!reply.sent) {
        reply.code(500).send("Errore interno del server");
      }
    }
  });

  fastify.get("/usrNumber", async (request, reply) => {
    // Restituisce il numero di utenti connessi
    const userCount = connectedUsers.size;
    console.log(`Numero di utenti connessi: ${userCount}`);
    reply.send({ numeroUtenti: userCount });
  });

  // Avvio server
  fastify.listen({ port: 3000, host: "0.0.0.0" }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server attivo su ${address}`);
  });
}

main();
