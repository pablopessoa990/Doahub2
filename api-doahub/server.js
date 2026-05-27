require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const mysql = require("mysql2");
const { MercadoPagoConfig, Payment } = require("mercadopago");
const multer = require("multer");
const path = require("path");



const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "doahub"
});

db.connect((erro) => {
    if (erro) {
        console.log("Erro ao conectar no banco:", erro);
    } else {
        console.log("Banco conectado com sucesso!");
    }
});

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

const payment = new Payment(client);

app.get("/", (req, res) => {
    res.send("API DoaHub rodando!");
});

app.post("/cadastro", async (req, res) => {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ mensagem: "Preencha todos os campos" });
    }

    try {
        const senhaCriptografada = await bcrypt.hash(senha, 10);

        db.query(
            "INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)",
            [nome, email, senhaCriptografada, "usuario"],
            (erro) => {
                if (erro) {
                    return res.status(500).json({ mensagem: "Erro ao cadastrar usuário" });
                }

                res.json({ mensagem: "Usuário cadastrado com sucesso!" });
            }
        );
    } catch {
        res.status(500).json({ mensagem: "Erro no servidor" });
    }
});

app.post("/login", (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ mensagem: "Preencha email e senha" });
    }

    db.query("SELECT * FROM usuarios WHERE email = ?", [email], async (erro, resultado) => {
        if (erro) {
            return res.status(500).json({ mensagem: "Erro no servidor" });
        }

        if (resultado.length === 0) {
            return res.status(401).json({ mensagem: "Email ou senha incorretos" });
        }

        const usuario = resultado[0];

        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

        if (!senhaCorreta) {
            return res.status(401).json({ mensagem: "Email ou senha incorretos" });
        }

        res.json({
            mensagem: "Login realizado com sucesso!",
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                tipo: usuario.tipo
            }
        });
    });
});

app.get("/campanhas", (req, res) => {
    db.query("SELECT * FROM campanhas WHERE status = 'ativa' ORDER BY id DESC", (erro, resultado) => {
        if (erro) {
            return res.status(500).json({ erro: "Erro ao buscar campanhas" });
        }

        res.json(resultado);
    });
});

app.post("/campanhas", (req, res) => {
    const {
        titulo,
        categoria,
        descricao,
        meta,
        cidade,
        estado,
        imagem,
        responsavel,
        telefone,
        email
    } = req.body;

    const sql = `
        INSERT INTO campanhas
        (titulo, categoria, descricao, meta, cidade, estado, imagem, responsavel, telefone, email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            titulo,
            categoria,
            descricao,
            meta,
            cidade,
            estado,
            imagem || "sem-imagem.png",
            responsavel,
            telefone,
            email
        ],
        (erro, resultado) => {
            if (erro) {
                console.log("Erro ao criar campanha:", erro);
                return res.status(500).json({ erro: "Erro ao criar campanha" });
            }

            res.json({
                mensagem: "Campanha criada com sucesso!",
                id: resultado.insertId
            });
        }
    );
});

app.delete("/campanhas/:id", (req, res) => {
    const id = req.params.id;

    db.query("DELETE FROM campanhas WHERE id = ?", [id], (erro) => {
        if (erro) {
            console.log("ERRO AO EXCLUIR:", erro);
            return res.status(500).json({
                erro: "Erro ao excluir campanha"
            });
        }

        res.json({
            mensagem: "Campanha excluída do banco!"
        });
    });
});

app.post("/criar-pagamento", async (req, res) => {
    try {
        const { nome, email, valor, campanha, campanha_id } = req.body;

        if (!valor || Number(valor) <= 0) {
            return res.status(400).json({ erro: "Valor inválido" });
        }

        const resposta = await payment.create({
            body: {
                transaction_amount: Number(valor),
                description: `Doação para ${campanha}`,
                payment_method_id: "pix",
                payer: {
                    email,
                    first_name: nome
                }
            }
        });

        const dadosPix = resposta.point_of_interaction?.transaction_data;

        if (!dadosPix) {
            return res.status(500).json({ erro: "QR Code não foi gerado" });
        }

        db.query(
            `INSERT INTO doacoes
            (campanha_id, nome_doador, email_doador, valor, metodo_pagamento, status, mercado_pago_id, qr_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                campanha_id || null,
                nome,
                email,
                valor,
                "pix",
                resposta.status,
                resposta.id,
                dadosPix.qr_code
            ]
        );

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

app.get("/doacoes", (req, res) => {
    db.query("SELECT * FROM doacoes ORDER BY id DESC", (erro, resultado) => {
        if (erro) {
            return res.status(500).json({ erro: "Erro ao buscar doações" });
        }

        res.json(resultado);
    });
});

app.listen(3000, () => {
    console.log("Servidor rodando em http://localhost:3000");
});