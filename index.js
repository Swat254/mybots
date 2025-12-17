import makeWASocket, {
    useSingleFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import P from 'pino';

// Save auth credentials
const { state, saveState } = useSingleFileAuthState('./auth_info.json');

async function startBot() {
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        logger: P({ level: 'info' }),
        printQRInTerminal: true,
        auth: state,
        version,
    });

    // Save auth when updated
    sock.ev.on('creds.update', saveState);

    // Connection updates
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr, pairingCode } = update;

        if (qr) console.log('📸 QR code string (scan in WhatsApp Web):', qr);
        if (pairingCode) console.log('🔑 Pairing code (manual link on phone):', pairingCode);

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log('❌ Disconnected. Reason:', reason);
            if (reason !== DisconnectReason.loggedOut) startBot();
        } else if (connection === 'open') {
            console.log('✅ Connected!');
            alwaysOnline(sock);
        }
    });
}

// Function to simulate always online, typing, and recording
async function alwaysOnline(sock) {
    const jid = 'status@broadcast'; // You can use your own chat ID if needed

    setInterval(async () => {
        try {
            // Simulate "online" status
            await sock.updatePresence(jid, 'available');

            // Simulate typing
            await sock.sendPresenceUpdate('composing', jid);
            await new Promise((res) => setTimeout(res, 3000));

            // Simulate recording voice note
            await sock.sendPresenceUpdate('recording', jid);
            await new Promise((res) => setTimeout(res, 3000));
        } catch (e) {
            console.log('Error simulating status:', e);
        }
    }, 10000); // repeat every 10 seconds
}

// Start the bot
startBot();
