import { createApp } from "./app"

const port = Number(process.env.PORT ?? 3000)
const app = createApp()

const server = Bun.serve({ port, fetch: app.fetch })

console.log(`Lantern server listening on http://localhost:${server.port}`)
