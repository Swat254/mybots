import {
  default as makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'

import P from 'pino'
import qrcode from 'qrcode-terminal'

// OPTIONAL: put your phone number here for pairing code
// Format: countrycode + number, NO +
const PAIRING_NUMBER = '' // e.g. 254712345678

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', '22.04'],
    printQRInTerminal: false
  })

  // Save session
  sock.ev.on('creds.update', saveCreds)

  // CONNECTION EVENTS
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    // ===== QR CODE =====
    if (qr) {
      console.log('\n📲 Scan this QR Code:\n')
      qrcode.generate(qr, { small: true })
    }

    // ===== PAIRING CODE =====
    if (
      !state.creds.registered &&
      PAIRING_NUMBER &&
      connection === 'connecting'
    ) {
      try {
        const code = await sock.requestPairingCode(PAIRING_NUMBER)
        console.log('\n🔗 Pairing Code:', code)
        console.log('📱 WhatsApp → Linked Devices → Link with phone number\n')
      } catch (err) {
        console.log('❌ Pairing code error:', err?.message)
      }
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp Connected Successfully')
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      console.log('❌ Connection closed')

      if (reason !== DisconnectReason.loggedOut) {
        console.log('🔄 Reconnecting...')
        startBot()
      } else {
        console.log('🚫 Logged out. Delete auth folder and restart.')
      }
    }
  })

  // ===== SAFE ONLINE PRESENCE (LOW RATE) =====
  setInterval(async () => {
    try {
      await sock.sendPresenceUpdate('available')
    } catch {}
  }, 45_000)

  // ===== FAKE TYPING / RECORDING (NO REPLY) =====
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg?.key?.remoteJid || msg.key.fromMe) return

    const jid = msg.key.remoteJid

    try {
      await sock.sendPresenceUpdate('composing', jid)

      setTimeout(async () => {
        await sock.sendPresenceUpdate('recording', jid)
      }, 2000)

      setTimeout(async () => {
        await sock.sendPresenceUpdate('available', jid)
      }, 5000)
    } catch {}
  })
}

startBot()
