const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { ObjectId } = require('mongodb');
const session = require('express-session');

const derivarSenha = promisify(scrypt);

function texto(valor, limite) {
  return typeof valor === 'string' && valor.trim().length <= limite ? valor.trim() : '';
}

function inteiro(valor, minimo, maximo) {
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) return null;
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero >= minimo && numero <= maximo ? numero : null;
}

function dadosCarro(campos) {
  const marca = texto(campos?.marca, 60);
  const modelo = texto(campos?.modelo, 80);
  const ano = inteiro(campos?.ano, 1886, 2100);
  const qtde_disponivel = inteiro(campos?.qtde_disponivel, 0, 1000000);
  if (!marca || !modelo || ano === null || qtde_disponivel === null) return null;
  return { marca, modelo, ano, qtde_disponivel };
}

function configurarCarros(app, { usuarios, carros }) {
  const rotas = require('express').Router();
  rotas.use(session({
    name: 'lab10.sid',
    secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 2 * 60 * 60 * 1000 },
  }));
  rotas.use((req, res, next) => {
    res.locals.usuario = req.session.usuario;
    res.locals.token = req.session.token;
    res.set('Cache-Control', 'no-store');
    next();
  });

  function formulario(req, res, pagina, opcoes = {}) {
    req.session.token ??= randomBytes(32).toString('hex');
    res.locals.token = req.session.token;
    return res.render(pagina, { erro: '', dados: {}, ...opcoes });
  }

  function validarFormulario(req, res, next) {
    if (!req.session.token || req.body?._csrf !== req.session.token) {
      return res.status(403).type('text').send('Formulário expirado. Volte à página e tente novamente.');
    }
    next();
  }

  function exigirLogin(req, res, next) {
    if (!req.session.usuario) return res.redirect(303, '/carros/login');
    next();
  }

  function validarId(req, res, next) {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.sendStatus(404);
    req.carroId = new ObjectId(req.params.id);
    next();
  }

  rotas.get('/', async (req, res) => {
    const estoque = await carros.find().sort({ marca: 1, modelo: 1, ano: 1 }).toArray();
    res.render('carros', { estoque });
  });

  rotas.get('/cadastro', (req, res) => formulario(req, res, 'conta', { cadastro: true }));
  rotas.post('/cadastro', validarFormulario, async (req, res) => {
    const nome = texto(req.body.nome, 100);
    const login = texto(req.body.login, 64).toLowerCase();
    const senha = req.body.senha;
    const opcoes = { cadastro: true, dados: { nome, login } };
    if (!nome || !/^[a-z0-9_.-]{3,64}$/.test(login) || typeof senha !== 'string' || senha.length < 8 || senha.length > 128) {
      return formulario(req, res.status(400), 'conta', { ...opcoes, erro: 'Preencha o nome, informe um login válido e use uma senha de 8 a 128 caracteres.' });
    }
    const sal = randomBytes(16).toString('hex');
    const hash = (await derivarSenha(senha, sal, 64)).toString('hex');
    try {
      await usuarios.insertOne({ nome, login, senha: { sal, hash } });
    } catch (erro) {
      if (erro.code !== 11000) throw erro;
      return formulario(req, res.status(409), 'conta', { ...opcoes, erro: 'Esse login já está em uso.' });
    }
    res.redirect(303, '/carros/login?cadastro=1');
  });

  rotas.get('/login', (req, res) => formulario(req, res, 'conta', { cadastro: false, cadastrado: req.query.cadastro === '1' }));
  rotas.post('/login', validarFormulario, async (req, res) => {
    const login = texto(req.body.login, 64).toLowerCase();
    const senha = req.body.senha;
    const usuario = await usuarios.findOne({ login });
    if (typeof senha !== 'string' || senha.length > 128) {
      return formulario(req, res.status(401), 'conta', { cadastro: false, dados: { login }, erro: 'Login ou senha inválidos.' });
    }
    const hash = await derivarSenha(senha, usuario?.senha.sal || 'lab10-usuario-nao-encontrado', 64);
    if (!usuario || !timingSafeEqual(hash, Buffer.from(usuario.senha.hash, 'hex'))) {
      return formulario(req, res.status(401), 'conta', { cadastro: false, dados: { login }, erro: 'Login ou senha inválidos.' });
    }
    await new Promise((resolve, reject) => req.session.regenerate((erro) => erro ? reject(erro) : resolve()));
    req.session.usuario = { nome: usuario.nome };
    res.redirect(303, '/carros/gerenciar');
  });

  rotas.post('/sair', validarFormulario, (req, res, next) => {
    req.session.destroy((erro) => {
      if (erro) return next(erro);
      res.clearCookie('lab10.sid');
      res.redirect(303, '/carros');
    });
  });

  rotas.get('/gerenciar', exigirLogin, async (req, res) => {
    const estoque = await carros.find().sort({ marca: 1, modelo: 1, ano: 1 }).toArray();
    const avisos = new Map([
      ['cadastrado', 'Carro cadastrado.'], ['editado', 'Carro atualizado.'],
      ['vendido', 'Venda registrada.'], ['removido', 'Carro removido.'],
      ['esgotado', 'Esgotado. Nenhuma venda foi registrada.'],
      ['indisponivel', 'Esse carro já foi removido.'],
    ]);
    formulario(req, res, 'gerenciar', { estoque, aviso: avisos.get(req.query.status) });
  });

  rotas.post('/gerenciar', exigirLogin, validarFormulario, async (req, res) => {
    const dados = dadosCarro(req.body);
    if (!dados) {
      const estoque = await carros.find().sort({ marca: 1, modelo: 1, ano: 1 }).toArray();
      return formulario(req, res.status(400), 'gerenciar', { estoque, aviso: null, dados: req.body, erro: 'Informe a marca, o modelo, um ano entre 1886 e 2100 e uma quantidade inteira entre 0 e 1000000.' });
    }
    await carros.insertOne({ ...dados, versao: 0 });
    res.redirect(303, '/carros/gerenciar?status=cadastrado');
  });

  rotas.get('/:id/editar', exigirLogin, validarId, async (req, res) => {
    const dados = await carros.findOne({ _id: req.carroId });
    if (!dados) return res.sendStatus(404);
    formulario(req, res, 'editar', { dados, id: req.carroId.toHexString() });
  });

  rotas.post('/:id/editar', exigirLogin, validarFormulario, validarId, async (req, res) => {
    const dados = dadosCarro(req.body);
    const versao = inteiro(req.body.versao, 0, Number.MAX_SAFE_INTEGER);
    const id = req.carroId.toHexString();
    if (!dados || versao === null) {
      return formulario(req, res.status(400), 'editar', { dados: req.body, id, erro: 'Revise os campos e informe um ano e uma quantidade inteira válidos.' });
    }
    const resultado = await carros.updateOne({ _id: req.carroId, versao }, { $set: dados, $inc: { versao: 1 } });
    if (!resultado.matchedCount) {
      const atual = await carros.findOne({ _id: req.carroId });
      if (!atual) return res.sendStatus(404);
      return formulario(req, res.status(409), 'editar', { dados: atual, id, erro: 'O estoque mudou enquanto você editava. Confira os dados atuais antes de salvar.' });
    }
    res.redirect(303, '/carros/gerenciar?status=editado');
  });

  rotas.post('/:id/vender', exigirLogin, validarFormulario, validarId, async (req, res) => {
    const resultado = await carros.updateOne(
      { _id: req.carroId, qtde_disponivel: { $gt: 0 } },
      { $inc: { qtde_disponivel: -1, versao: 1 } },
    );
    const status = resultado.modifiedCount ? 'vendido'
      : await carros.findOne({ _id: req.carroId }) ? 'esgotado' : 'indisponivel';
    res.redirect(303, `/carros/gerenciar?status=${status}`);
  });

  rotas.post('/:id/remover', exigirLogin, validarFormulario, validarId, async (req, res) => {
    const resultado = await carros.deleteOne({ _id: req.carroId });
    res.redirect(303, `/carros/gerenciar?status=${resultado.deletedCount ? 'removido' : 'indisponivel'}`);
  });

  app.use('/carros', rotas);
}

module.exports = { configurarCarros };
