let ws = null;
let typingTimeout;

const joinBtn = document.getElementById("joinBtn");
const sendBtn = document.getElementById("sendBtn");
const statusSelect = document.getElementById("status");

joinBtn.addEventListener("click", join);
sendBtn.addEventListener("click", sendMsg);
statusSelect.addEventListener("change", changeStatus);
document.getElementById("msg").addEventListener("input", typing);

function join() {
  if (ws && ws.readyState === WebSocket.OPEN) return; // Уже подключен

  const name = document.getElementById("name").value.trim();
  const room = document.getElementById("room").value.trim();

  if (!name || !room) {
    alert("Введите имя и комнату!");
    return;
  }

  // Закрываем старое соединение, если есть
  if (ws) ws.close();

  ws = new WebSocket("ws://" + location.host);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "joinRoom", name, room }));
  };

  ws.onmessage = handleMessage;

  ws.onclose = () => {
    addChat("🔔 Соединение закрыто");
    ws = null;
    clearUsers();
  };
}

function handleMessage(event) {
  const data = JSON.parse(event.data);

  if (data.type === "error") {
    alert(data.message);
    return;
  }

  if (data.type === "notification") addChat("&#128075 " + data.message);

  if (data.type === "message") addChat(data.from + ": " + data.text);

  if (data.type === "typing") {
    const typingDiv = document.getElementById("typing");
    typingDiv.textContent = data.name + " печатает...";
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => { typingDiv.textContent = ""; }, 1000);
  }

  if (data.type === "userList" || data.users) {
    updateUsers(data.users || []);
  }
}

function sendMsg() {
  const input = document.getElementById("msg");
  const text = input.value.trim();
  if (!text || !ws) return;
  ws.send(JSON.stringify({ type: "roomMessage", text }));
  input.value = "";
}

function changeStatus() {
  if (!ws) return;
  const status = document.getElementById("status").value;
  ws.send(JSON.stringify({ type: "changeStatus", status }));
}

function typing() {
  if (!ws) return;
  ws.send(JSON.stringify({ type: "typing" }));
}

function addChat(text) {
  const div = document.getElementById("chat");
  div.innerHTML += "<div>" + text + "</div>";
  div.scrollTop = div.scrollHeight;
}

function updateUsers(users) {
  const list = document.getElementById("users");
  list.innerHTML = "";
  users.forEach(u => {
    const li = document.createElement("li");
    li.className = "user";

    const dot = document.createElement("span");
    dot.className = "dot " + getStatusClass(u.status);

    const text = document.createElement("span");
    text.textContent = `${u.name} — ${u.status}`;

    li.appendChild(dot);
    li.appendChild(text);
    list.appendChild(li);
  });

  document.getElementById("onlineCount").textContent = "Онлайн: " + users.length;
}

function clearUsers() {
  document.getElementById("users").innerHTML = "";
  document.getElementById("onlineCount").textContent = "Онлайн: 0";
}

function getStatusClass(status) {
  if (status === "Онлайн") return "online";
  if (status === "Занят") return "busy";
  if (status === "Отошёл") return "away";
  return "online";
}
