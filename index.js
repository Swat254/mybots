import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";

import qrcode from "qrcode-terminal";

let sock;
let presenceInterval = null;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["Chrome", "Windows", "10"],
    syncFullHistory: false,
    markOnlineOnConnect: true
  });

  // 🔗 CONNECTION UPDATES
  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    // 📲 QR CODE
    if (qr) {
      console.clear();
      console.log("📲 Scan this QR with WhatsApp → Linked Devices");
      qrcode.generate(qr, { small: true });
    }

    // ✅ CONNECTED
    if (connection === "open") {
      console.log("✅ WhatsApp Bot Connected Successfully!");

      // 🟢 Always online
      if (!presenceInterval) {
        presenceInterval = setInterval(async () => {
          try {
            await sock.sendPresenceUpdate("available");
          } catch (err) {
            console.log("⚠️ Presence error:", err.message);
          }
        }, 20000); // every 20 seconds
      }
    }

    // ❌ DISCONNECTED
    if (connection === "close") {
      console.log("❌ Connection closed");

      if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
      }

      const reason = lastDisconnect?.error?.output?.statusCode;

      if (reason !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnecting...");
        startBot();
      } else {
        console.log("🚫 Logged out. Delete session folder and rescan QR.");
      }
    }
  });

  // 💾 SAVE SESSION
  sock.ev.on("creds.update", saveCreds);

  // 💬 MESSAGE HANDLER (Typing/Recording only)
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const jid = msg.key.remoteJid;

    try {
      // ✍️ Fake typing
      await sock.sendPresenceUpdate("composing", jid);
      await delay(random(2000, 5000));

      // 🎤 Fake recording
      await sock.sendPresenceUpdate("recording", jid);
      await delay(random(1000, 2500));

      // ✅ Do NOT send any message (no autoreply)
    } catch (err) {
      console.log("⚠️ Presence update error:", err.message);
    }
  });
}

// ⏳ Delay helper
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Random delay helper
function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// 🚀 START BOT
startBot();
