const dateInput = document.querySelector("#apod-date");
const dateForm = document.querySelector("#date-form");
const statusMessage = document.querySelector("#status");
const card = document.querySelector("#apod-card");
const mediaFrame = document.querySelector("#media-frame");
const resultDate = document.querySelector("#result-date");
const mediaType = document.querySelector("#media-type");
const resultTitle = document.querySelector("#result-title");
const resultExplanation = document.querySelector("#result-explanation");
const originalLink = document.querySelector("#original-link");

const today = new Date().toISOString().slice(0, 10);
dateInput.max = today;
dateInput.value = today;

dateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (dateInput.reportValidity()) loadApod(dateInput.value);
});

function showStatus(message, state = "loading") {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
}

function displayApod(apod) {
  mediaFrame.replaceChildren();

  if (apod.media_type === "image") {
    const image = document.createElement("img");
    image.src = apod.image_url;
    image.alt = apod.title;
    image.loading = "eager";
    image.addEventListener("error", () => {
      showStatus("A imagem nao pode ser carregada. Tente novamente mais tarde.", "error");
    }, { once: true });
    mediaFrame.append(image);
  } else {
    const videoLink = document.createElement("a");
    videoLink.className = "video-card";
    videoLink.href = apod.url;
    videoLink.target = "_blank";
    videoLink.rel = "noopener noreferrer";

    const playIcon = document.createElement("span");
    playIcon.setAttribute("aria-hidden", "true");
    playIcon.textContent = "▶";

    const linkText = document.createElement("span");
    linkText.textContent = "Assistir ao vídeo da NASA em uma nova aba";

    videoLink.append(playIcon, linkText);
    mediaFrame.append(videoLink);
  }

  resultDate.textContent = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${apod.date}T00:00:00Z`));
  mediaType.textContent = apod.media_type === "image" ? "IMAGEM" : "VÍDEO";
  resultTitle.textContent = apod.title;
  const explanationDocument = new DOMParser().parseFromString(apod.explanation, "text/html");
  resultExplanation.textContent = explanationDocument.body.textContent || "";
  originalLink.href = apod.url;
  card.hidden = false;
  showStatus("");
}

async function loadApod(date) {
  card.hidden = true;
  showStatus("Buscando a imagem do universo…");

  try {
    const response = await fetch(`/api/apod?date=${encodeURIComponent(date)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Nao foi possivel carregar a imagem.");
    displayApod(result);
  } catch (error) {
    showStatus(error.message || "Nao foi possivel carregar a imagem. Tente novamente.", "error");
  }
}

loadApod(today);
