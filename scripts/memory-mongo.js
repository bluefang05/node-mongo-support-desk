// Local MongoDB for the demo without installing a server: the real mongod binary,
// kept in memory. Data is lost when this process stops.
import { MongoMemoryServer } from 'mongodb-memory-server'

const server = await MongoMemoryServer.create({
  instance: { port: 27017, dbName: 'support_desk' },
})

console.log(`MongoDB (in memory) listening on ${server.getUri()}`)
console.log('Leave this running, then: npm run seed && npm start')

const stop = async () => {
  await server.stop()
  process.exit(0)
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
setInterval(() => {}, 1 << 30)
