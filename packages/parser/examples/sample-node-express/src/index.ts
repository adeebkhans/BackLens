import express from "express";
import { createUser } from "./controllers/userController";

const app = express();
app.use(express.json());

app.post("/users", (req, res) => {
  createUser(req.body);
  res.json({ ok: true });
});

app.listen(3000, () => {
  console.log("listening");
});
