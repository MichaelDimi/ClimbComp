import express from "express";
import cors from "cors";
import competitions from "./routes/competitions";
import authRouter from "./routes/auth";
import venuesRouter from "./routes/venues";
import problemsRouter from "./routes/problems";
import reportsRouter from "./routes/reports";


const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/competitions", competitions);
app.use("/api/venues", venuesRouter);
app.use("/api/problems", problemsRouter);
app.use("/api/reports", reportsRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`Listening on port ${port}\n`);
    console.log(`http://localhost:${port}`)
});
