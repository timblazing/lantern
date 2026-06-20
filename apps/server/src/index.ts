const port = Number(process.env.PORT ?? 3000)

const server = Bun.serve({
  port,
  fetch() {
    return new Response("Lantern server placeholder — see Plan 003")
  },
})

console.log(`Lantern server listening on http://localhost:${server.port}`)
