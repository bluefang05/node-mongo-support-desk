import { MongoClient } from 'mongodb'

const URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017'
const DB_NAME = process.env.MONGO_DB || 'support_desk'

let client
let db

export async function connect(uri = URI, dbName = DB_NAME) {
  if (db) return db

  client = new MongoClient(uri)
  await client.connect()
  db = client.db(dbName)

  await db.collection('tickets').createIndex({ status: 1, updatedAt: -1 })
  await db.collection('tickets').createIndex({ subject: 'text', description: 'text' })
  await db.collection('users').createIndex({ email: 1 }, { unique: true })

  return db
}

export function getDb() {
  if (!db) throw new Error('Database not connected. Call connect() first.')
  return db
}

export async function disconnect() {
  await client?.close()
  client = undefined
  db = undefined
}
