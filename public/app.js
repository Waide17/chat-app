let nickname = "";
let timer = null;
document.getElementById("login-input").focus();
document.getElementById("text-input").addEventListener("input", () => {
  console.log("Invio scrive:", document.getElementById("text-input").value);
  const scrive = document.getElementById("text-input").value !== "";
  fetch("/writing", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    type: "writing",
    body: JSON.stringify({ scrive, sender: nickname }),
  }).catch((err) => {
    console.error("Errore invio scrive:", err);
  });
});

document.querySelector("#login button").addEventListener("click", () => {
  nickname = document.querySelector("#login input").value.trim();
  if (nickname !== "") {
    const channels = new EventSource(
      `/stream?nickname=${encodeURIComponent(nickname)}`
    );
    document
      .getElementById("login")
      .setAttribute("style", "display:none !important");
    document
      .getElementById("chat")
      .setAttribute("style", "display:block !important");
    document.getElementById("text-input").focus();

    // function isWriting() {
    //   if (document.getElementById("text-input").value !== "") {
    //     fetch("/writing", {
    //       method: "POST",
    //       headers: {
    //         "Content-Type": "application/json",
    //       },
    //       body: JSON.stringify({ scrive: true, sender: nickname }),
    //     }).catch((err) => {
    //       console.error("Errore invio messaggio:", err);
    //     });
    //   } else {
    //     fetch("/writing", {
    //       method: "POST",
    //       body: JSON.stringify({ scrive: false, sender: nickname }),
    //     }).catch((err) => {
    //       console.error("Errore invio messaggio:", err);
    //     });
    //   }
    // }

    function startTimer() {
      timer = setTimeout(() => {
        document
          .getElementById("writing-box")
          .setAttribute("style", "display:none !important");
      }, 1000);
    }

    //setInterval(isWriting, 1000);

    channels.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "error") {
          alert(data.message);
          channels.close();
          location.reload();
          return;
        }

        // if (data.scrive && data.sender !== nickname) {
        //   // Display the writing-box element when another user is typing
        //   document
        //     .getElementById("writing-box")
        //     .setAttribute("style", "display:block !important");
        //   document.getElementById(
        //     "writing-box"
        //   ).textContent = `${data.sender} sta scrivendo...`;
        //   clearTimeout(timer);
        //   startTimer();
        // }
        //startTimer();
        // setTimeout(() => {
        //   document
        //     .getElementById("writing-box")
        //     .setAttribute("style", "display:none !important");
        // }, 3500); // Hide after 2 seconds

        // Mostra tutti i messaggi della cronologia, inclusi quelli dell'utente corrente

        if (data.type === "writing" && data.sender !== nickname) {
          // Display the writing-box element when another user is typing
          document
            .getElementById("writing-box")
            .setAttribute("style", "display:block !important");

          if (data.numeroScrittori && data.numeroScrittori > 1) {
            document.getElementById("writing-box").textContent = `${
              data.sender
            } e ${data.numeroScrittori - 1} altri stanno scrivendo...`;
          } else {
            document.getElementById(
              "writing-box"
            ).textContent = `${data.sender} sta scrivendo...`;
          }
          clearTimeout(timer);
          startTimer();
        }

        // document
        //   .getElementById("writing-box")
        //   .setAttribute("style", "display:none !important");

        if (data.text !== undefined && data.sender !== undefined) {
          const div = document.createElement("div");
          div.classList.add("message");
          // Aggiungi classe per messaggi della cronologia
          if (data.isHistory) {
            div.classList.add("history");
          }
          if (data.sender === nickname) {
            div.classList.add("self");
            div.textContent = `${data.text}`;
          } else {
            div.classList.add("other");
            div.textContent = `${data.sender}: ${data.text}`;
          }
          // Aggiungi timestamp se disponibile (opzionale)
          if (data.timestamp && data.isHistory) {
            const timeElement = document.createElement("small");
            timeElement.classList.add("timestamp");
            const time = new Date(data.timestamp).toLocaleTimeString();
            timeElement.textContent = ` (${time})`;
            div.appendChild(timeElement);
          }
          document.getElementById("messages").appendChild(div);
          // Scorri verso il basso solo se non è cronologia o se è l'ultimo messaggio
          if (!data.isHistory) {
            div.scrollIntoView();
          }
        }
      } catch (e) {
        console.error("Messaggio non in formato JSON:", event.data);
      }
    };

    channels.onerror = (err) => {
      console.error("Errore SSE:", err);
      alert("Errore nella connessione. Nickname già in uso?");
      location.reload();
    };

    // Quando la connessione è stabilita, scorri verso il basso
    // Event handler triggered when the SSE connection is successfully established.
    channels.onopen = () => {
      // fetch("/usrConnected", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({ sender: nickname }),
      // }).catch((err) => {
      //   console.error("Errore invio utente connesso:", err);
      // });

      setInterval(() => {
        fetch("/usrNumber", {
          method: "GET",
        })
          .then((response) => response.json())
          .then((data) => {
            console.log("Numero di utenti connessi:", data.numeroUtenti);
            const userCountElement = document.getElementById("user-number");
            userCountElement.setAttribute("style", "display:block !important");
            if (data.numeroUtenti === 0) {
              userCountElement.textContent = "Nessun utente connesso";
            }
            if (data.numeroUtenti > 1) {
              userCountElement.textContent = ` (${data.numeroUtenti} utenti connessi)`;
            } else if (data.numeroUtenti === 1) {
              userCountElement.textContent = " (1 utente connesso)";
            }
          })
          .catch((error) => {
            console.error("Errore nel fetch:", error);
            alert(
              "Si è verificato un errore durante il recupero del numero di utenti connessi. Riprova più tardi."
            );
          });
      }, 5000); // Controlla ogni 2 secondi

      console.log("Connessione SSE stabilita");
      // Piccolo delay per permettere il caricamento della cronologia
      setTimeout(() => {
        const messagesContainer = document.getElementById("messages");
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 1000);
    };
  } else {
    alert("Inserisci un nickname.");
  }
});

// Funzione per inviare messaggi
function sendMessage() {
  const input = document.querySelector("#message-input input");
  const message = input.value.trim();
  if (message !== "") {
    console.log("Invio messaggio:", message);
    fetch("/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sender: nickname, text: message }),
    }).catch((err) => {
      console.error("Errore invio messaggio:", err);
    });
    input.value = "";
  }
}

// Event listener per il pulsante di invio
document
  .querySelector("#message-input button")
  .addEventListener("click", sendMessage);

// Permetti di inviare messaggi premendo Enter
document
  .querySelector("#message-input input")
  .addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

document.querySelector("#login input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    document.querySelector("#login button").click();
  }
});
