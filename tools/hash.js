const bcrypt = require('bcryptjs');
const pass = process.argv[2];
if (!pass) {
  console.log('Uso: npm run hash -- "SUA_SENHA"');
  process.exit(1);
}
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(pass, salt);
console.log(hash);
