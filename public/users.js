document.querySelector("#login button").addEventListener("click", () => {
  nickname = document.querySelector("#login input").value.trim()
  if (nickname !== "") {
    // Invia il nickname al server per registrare l'utente
    

    const channels = new EventSource(
      `/stream?nickname=${encodeURIComponent(nickname)}`
    )
    document
      .getElementById("login")
      .setAttribute("style", "display:none !important")

    fetch('/usrNumber', {
        method: 'GET',
    })
    .then(response => response.json())
    .then(data => {
        console.log("Numero di utenti connessi:", data.numeroUtenti);
    })

    .catch(error => {
        console.error("Errore nel recuperare il numero di utenti connessi:", error);
    });





  } else {
    alert("Inserisci un nickname valido.")
  }
})
