const { abrirBanco } = require('./database');
const { abrirBanco: abrirBlog } = require('./blog-database');
const { criarApp } = require('./app');

async function iniciar() {
  const banco = await abrirBanco();
  let blog;
  try {
    blog = abrirBlog();
    const servidor = criarApp(banco, blog).listen(80, '0.0.0.0');
    await new Promise((resolve, reject) => {
      servidor.once('listening', resolve);
      servidor.once('error', reject);
    });
    console.log('Lab 10 disponível em http://localhost/Projects.html');
    for (const sinal of ['SIGINT', 'SIGTERM']) {
      process.once(sinal, () => servidor.close(async () => {
        blog.fechar();
        await banco.fechar();
      }));
    }
  } catch (erro) {
    blog?.fechar();
    await banco.fechar();
    throw erro;
  }
}

iniciar().catch((erro) => {
  console.error('Falha ao iniciar o Lab 10. Verifique a porta 80 e a conexão com o MongoDB:', erro.message);
  process.exitCode = 1;
});
