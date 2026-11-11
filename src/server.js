import { createApp } from './app.js'
import { connect } from './db.js'

const port = Number(process.env.PORT || 3000)

await connect()

createApp().listen(port, () => {
  console.log(`Support desk API on http://127.0.0.1:${port}`)
})
