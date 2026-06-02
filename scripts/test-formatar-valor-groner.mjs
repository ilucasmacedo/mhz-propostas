import {
  parseNumeroGroner,
  formatarMoedaGroner,
  formatarValorCampoGroner,
} from '../lib/groner/formatar-valor-groner.js';

const casos = [
  { entrada: 59.9, campo: 'mensalidade', esperado: '59,90' },
  { entrada: 1239.9, campo: 'valorTotalProposta', esperado: '1239,90' },
  { entrada: '59,90', campo: 'mensalidade', esperado: '59,90' },
  { entrada: '1.239,90', campo: 'valorTotalProposta', esperado: '1239,90' },
  { entrada: 8.5, campo: 'kwp', esperado: '8,50' },
  { entrada: 12, campo: 'qtdPlacas', esperado: '12' },
];

let ok = 0;
for (const { entrada, campo, esperado } of casos) {
  const saida = formatarValorCampoGroner(campo, entrada);
  const passou = saida === esperado;
  if (passou) ok += 1;
  console.log(`${passou ? '✓' : '✗'} ${campo}(${JSON.stringify(entrada)}) → ${saida} (esperado ${esperado})`);
}

console.log(`\n${ok}/${casos.length} casos OK`);

const parseCasos = [
  ['59,90', 59.9],
  ['1.239,90', 1239.9],
  ['59.9', 59.9],
];
for (const [entrada, esperado] of parseCasos) {
  const n = parseNumeroGroner(entrada);
  console.log(`parse ${entrada} → ${n} ${n === esperado ? '✓' : '✗'}`);
}

if (ok !== casos.length) process.exit(1);
