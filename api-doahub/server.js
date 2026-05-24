require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Payment } = require("mercadopago");

const app = express();

app.use(cors());
app.use(express.json());

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

const payment = new Payment(client);

app.get("/", (req, res) => {
    res.send("API DoaHub rodando com sucesso!");
});

app.post("/criar-pagamento", async (req, res) => {
    try {
        const { nome, email, valor, campanha } = req.body;

        if (!valor || Number(valor) <= 0) {
            return res.status(400).json({
                erro: "Valor inválido"
            });
        }

        const resposta = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: `Doação para ${campanha}`,
                payment_method_id: "pix",
                payer: {
                    email: email,
                    first_name: nome
                }
            }
        });

        const dadosPix = resposta.point_of_interaction?.transaction_data;

        if (!dadosPix) {
            return res.status(500).json({
                erro: "QR Code não foi gerado"
            });
        }

        res.json({
            id: resposta.id,
            status: resposta.status,
            qr_code: dadosPix.qr_code,
            qr_code_base64: dadosPix.qr_code_base64
        });

    } catch (erro) {
        console.log("ERRO MERCADO PAGO:", erro);

        res.status(500).json({
            erro: "Erro ao gerar pagamento",
            detalhe: erro.message,
            causa: erro.cause
        });
    }
});

app.listen(3000, () => {
    console.log("Servidor rodando em http://localhost:3000");
});