const mysql = require("mysql2");

const conexao = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "doahub"
});

conexao.connect((erro) => {
    if (erro) {
        console.log("Erro ao conectar no banco:", erro);
    } else {
        console.log("Banco conectado com sucesso!");
    }
});

module.exports = conexao;