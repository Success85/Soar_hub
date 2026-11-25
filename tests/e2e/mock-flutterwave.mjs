// A stand-in for the Flutterwave v3 API used by end-to-end tests. Checkout "pays" instantly:
// the returned payment link is the app's own callback URL with status=successful.
import http from "node:http";

const port = Number(process.env.MOCK_FLW_PORT ?? 4010);
const orders = new Map();
let next = Date.now(); // unique across restarts, like real Flutterwave ids

const send = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (req.url === "/health") return send(res, 200, { ok: true });
      if (!String(req.headers.authorization ?? "").startsWith("Bearer FLWSECK_TEST")) return send(res, 401, { status: "error", message: "Invalid authorization key" });
      if (req.method === "POST" && req.url === "/v3/payments") {
        const b = JSON.parse(raw || "{}");
        const id = ++next;
        orders.set(String(id), b);
        const link = `${b.redirect_url}${b.redirect_url.includes("?") ? "&" : "?"}status=successful&tx_ref=${encodeURIComponent(b.tx_ref)}&transaction_id=${id}`;
        return send(res, 200, { status: "success", message: "Hosted Link", data: { link } });
      }
      const m = /^\/v3\/transactions\/(\d+)\/verify$/.exec(req.url ?? "");
      if (req.method === "GET" && m && orders.has(m[1])) {
        const o = orders.get(m[1]);
        return send(res, 200, { status: "success", data: { id: Number(m[1]), tx_ref: o.tx_ref, status: "successful", amount: o.amount, charged_amount: o.amount, currency: o.currency, payment_type: "card", customer: { email: o.customer?.email } } });
      }
      return send(res, 404, { status: "error", message: "Not found" });
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`mock flutterwave on ${port}`));
