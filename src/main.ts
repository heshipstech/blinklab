const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error('index.html must contain an element with id "app"');
}

app.textContent = "blinklab";
