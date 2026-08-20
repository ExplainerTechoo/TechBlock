const http = require("http");
const { randomBytes } = require("crypto");

const server = http.createServer((req, res) => {
  res.writeHead(200, {"Content-Type": "text/plain"});
  res.end("TechBlock Security Test Running\nHash: " + randomBytes(32).toString("hex"));
});

server.listen(3000, () => {
  console.log("TechBlock test server running on http://localhost:3000");
});

