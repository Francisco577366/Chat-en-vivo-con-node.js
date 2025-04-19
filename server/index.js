import { createClient } from '@libsql/client'

import express from 'express'
import logger from 'morgan'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

import dotenv from 'dotenv'
dotenv.config()

const port = process.env.PORT || 3000
const app = express()
const server = createServer(app)
const io = new Server(server, {
  connectionStateRecovery: {}
})

const db = createClient({
  url: 'libsql://working-giant-man-francisco577366.aws-us-east-1.turso.io',
  authToken: process.env.DB_TOKEN
})

await db.execute(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    user TEXT
  )
`)

io.on('connection', async (socket) => {
  console.log('¡Un usuario se ha conectado!')

  socket.on('disconnect', () => {
    console.log('Un usuario se ha desconectado.')
  })

  socket.on('chat message', async (msg) => {
    let result
    const username = socket.handshake.auth.username ?? 'anonymous'
    try {
      result = await db.execute({
        sql: 'INSERT INTO messages (content, user) VALUES (:msg, :username)',
        args: { msg, username }
      })
    } catch (e) {
      console.error(e.message)
      return
    }
    io.emit('chat message', msg, result.lastInsertRowid.toString(), username)
  })

  if (!socket.recovered) {
    try {
      const results = await db.execute({
        sql: 'SELECT id, content, user FROM messages WHERE id > ?',
        args: [socket.handshake.auth.serveroffset ?? 0]
      })

      results.rows.forEach(row => {
        socket.emit('chat message', row.content, row.id.toString(), row.user)
      })
    } catch (e) {
      console.error(e.message)
    }
  }
})

// Usa `server.listen` en lugar de `app.listen`
server.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`)
})

app.use(logger('dev'))

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html')
})
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`)
})
