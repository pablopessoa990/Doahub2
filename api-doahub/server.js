const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const db = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

// ROTA DE CADASTRO
app.post("/cadastro", async (req, res) => {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({
            mensagem: "Preencha todos os campos"
        });
    }

    try {
        const senhaCriptografada = await bcrypt.hash(senha, 10);

        const sql = "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)";

        db.query(sql, [nome, email, senhaCriptografada], (erro, resultado) => {
            if (erro) {
                if (erro.code === "ER_DUP_ENTRY") {
                    return res.status(400).json({
                        mensagem: "Esse email já está cadastrado"
                    });
                }

                return res.status(500).json({
                    mensagem: "Erro ao cadastrar usuário"
                });
            }

            res.status(201).json({
                mensagem: "Usuário cadastrado com sucesso!",
                id: resultado.insertId
            });
        });

    } catch (erro) {
        res.status(500).json({
            mensagem: "Erro no servidor"
        });
    }
});

// ROTA DE LOGIN
app.post("/login", (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({
            mensagem: "Preencha email e senha"
        });
    }

    const sql = "SELECT * FROM usuarios WHERE email = ?";

    db.query(sql, [email], async (erro, resultado) => {
        if (erro) {
            return res.status(500).json({
                mensagem: "Erro no servidor"
            });
        }

        if (resultado.length === 0) {
            return res.status(401).json({
                mensagem: "Email ou senha incorretos"
            });
        }

        const usuario = resultado[0];

        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

        if (!senhaCorreta) {
            return res.status(401).json({
                mensagem: "Email ou senha incorretos"
            });
        }

        res.json({
            mensagem: "Login realizado com sucesso!",
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email
            }
        });
    });
});

app.listen(3000, () => {
    console.log("API rodando em http://localhost:3000");
});