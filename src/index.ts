import { createApp } from "./app";

const port = Number(process.env.PORT ?? "3000");
const server = createApp();

server.listen(port, () => {
  console.log(`voice agent session gateway listening on :${port}`);
});
