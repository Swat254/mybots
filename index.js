import makeWASocket, {
    DisconnectReason,
    useSingleFileAuthState,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import P from "pino";

// --- Auth and store setup ---
const { state, saveState } = useSingleFileAuthState('./auth_info.json');
const store = makeInMemoryStore({ logger: P().child({ level: 'silent', stream: 'store' }) });

// --- Start bot ---
async function startBot() {
    try {
        const { version } = await fetchLatestBaileysVersion();
        console.log(`Using WA version v${version.join('.')}`);

        const sock = makeWASocket({
            version,
            printQRInTerminal: true,
            auth: state,
            logger: P({ level: 'silent' }),
        });

        store.bind(sock.ev);

        // --- Connection updates ---
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr, pairingCode } = update;

            if (qr) console.log('📸 QR code:', qr);
            if (pairingCode) console.log('🔑 Pairing code:', pairingCode);

            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error).output.statusCode;
                console.log('❌ Connection closed. Reason:', reason);
                if (reason === DisconnectReason.loggedOut) {
                    console.log('🛑 Logged out. Delete auth file and restart.');
                } else {
                    console.log('🔄 Reconnecting...');
                    startBot();
                }
            } else if (connection === 'open') {
                console.log('✅ Connected to WhatsApp!');
            }
        });

        // --- Save auth updates ---
        sock.ev.on('creds.update', saveState);

        // --- Message handler ---
        sock.ev.on('messages.upsert', async (msg) => {
            try {
                const messages = msg.messages;
                if (!messages || !messages.length) return;

                const message = messages[0];
                if (!message.message || message.key.fromMe) return;

                const sender = message.key.remoteJid;
                const text = message.message.conversation || message.message.extendedTextMessage?.text;
                if (!text) return;

                console.log(`📩 Message from ${sender}: ${text}`);

                // --- Command handling ---
                if (text.startsWith('!')) {
                    const cmd = text.slice(1).trim().toLowerCase();

                    switch(cmd) {
                        case 'ping':
                            await sock.sendMessage(sender, { text: '🏓 Pong!' });
                            break;
                        case 'help':
                            await sock.sendMessage(sender, { text: 'Commands:\n!ping\n!help' });
                            break;
                        default:
                            await sock.sendMessage(sender, { text: `❓ Unknown command: ${cmd}` });
                    }
                } else {
                    // --- AI response (demo/mock) ---
                    const reply = `🤖 You said: "${text}"`;
                    await sock.sendMessage(sender, { text: reply });
                }

            } catch (err) {
                console.log('❌ Message handler error:', err);
            }
        });

        // --- Keep-alive log for Railway ---
        setInterval(() => {
            console.log('🤖 Bot is alive...');
        }, 60_000);

    } catch (err) {
        console.log('❌ Error starting bot:', err);
    }
}

// --- Global error handling ---
process.on('uncaughtException', (err) => console.log('❌ Uncaught Exception:', err));
process.on('unhandledRejection', (reason) => console.log('❌ Unhandled Rejection:', reason));

// --- Launch bot ---
startBot();
