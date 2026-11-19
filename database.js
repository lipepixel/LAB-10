const { MongoClient } = require('mongodb');

async function abrirBanco(uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017') {
  const cliente = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await cliente.connect();
    const db = cliente.db(process.env.MONGODB_DB || 'lab10');
    const usuarios = db.collection('usuarios');
    const carros = db.collection('carros');
    await usuarios.createIndex({ login: 1 }, { unique: true });
    await carros.createIndex({ marca: 1, modelo: 1, ano: 1 });
    return { usuarios, carros, fechar: () => cliente.close() };
  } catch (erro) {
    await cliente.close();
    throw erro;
  }
}

module.exports = { abrirBanco };
