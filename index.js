import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'

import P from 'pino'
import qrcode from 'qrcode-terminal'

const randomDelay = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    auth: state,
    browser: ['Ubuntu', 'Chrome', '22.04'],
    markOnlineOnConnect: true
  })

  sock.ev.on('creds.update', saveCreds)

  // QR + connection
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('📲 Scan QR to login')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected')
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

      console.log('❌ Disconnected. Reconnecting:', shouldReconnect)
      if (shouldReconnect) startBot()
    }
  })

  // 👇 FAKE TYPING & RECORDING (NO MESSAGE SENT)
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const jid = msg.key.remoteJid
    if (!jid || jid.endsWith('@g.us')) return // ignore groups (safer)

    // Typing
    await sock.sendPresenceUpdate('composing', jid)
    await new Promise(r => setTimeout(r, randomDelay(2000, 5000)))

    // Recording
    await sock.sendPresenceUpdate('recording', jid)
    await new Promise(r => setTimeout(r, randomDelay(2000, 4000)))

    // Back to online
    await sock.sendPresenceUpdate('available', jid)
  })
}

startBot()
