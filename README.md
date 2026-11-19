# LAB 10 — Gerenciamento de carros

O Lab 10 usa Node.js, Express e EJS. O MongoDB guarda as coleções `usuarios` e `carros`. O blog do Lab 9 continua acessível na página de projetos e usa SQLite.

## Executar no Windows

1. Instale o Node.js 22.13 ou superior e inicie o MongoDB local. O endereço padrão é `mongodb://127.0.0.1:27017`.
2. Abra o terminal na raiz deste repositório e execute:

   ```powershell
   npm.cmd ci
   npm.cmd start
   ```

3. Abra [http://localhost](http://localhost). O servidor usa a porta 80 e encaminha para `/Projects.html`. Na tabela, clique em **Carros**.

No Linux ou macOS, use `npm ci` e `npm start`. Para usar outro servidor MongoDB, defina a variável de ambiente `MONGODB_URI`. O banco padrão é `lab10`, configurável com `MONGODB_DB`.

## Usar o estoque

- A listagem de carros pode ser consultada antes do login.
- Crie uma conta e entre para cadastrar, editar, vender ou remover carros. Este lab permite a qualquer usuário cadastrado gerenciar o estoque compartilhado. Use-o em ambiente de aula ou desenvolvimento.
- Cadastre um carro com uma unidade, clique em **Vender** e confira o aviso **Esgotado**. A venda atualiza a quantidade no banco e o estoque tem limite mínimo de zero.
- Nome e login ficam na coleção `usuarios`. A senha é armazenada como hash com sal. Marca, modelo, ano e quantidade disponível ficam na coleção `carros`.

## Conferir os dados no MongoDB Compass

1. Abra o MongoDB Compass e conecte-se a `mongodb://127.0.0.1:27017` (ou use o mesmo endereço configurado para o Lab 10).
2. Selecione o banco **lab10** e abra **carros**.
3. Cadastre um carro no site com duas unidades. Atualize a aba **Documents** no Compass e confira `qtde_disponivel: 2`.
4. Clique em **Vender** no site e atualize a aba **Documents** de novo. A quantidade passa para 1 e, após a próxima venda, para 0. O site exibe **Esgotado**.
5. Experimente editar e remover o carro pelo site. Use o mesmo botão de atualização no Compass para conferir cada mudança.
