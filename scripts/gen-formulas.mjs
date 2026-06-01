const FAIXAS = [
  { max: 5, ACESSO: 9.9, PADRAO: 39.9, PREMIUM: 59.9 },
  { max: 10, ACESSO: 14.9, PADRAO: 49.9, PREMIUM: 89.9 },
  { max: 15, ACESSO: 19.9, PADRAO: 59.9, PREMIUM: 119.9 },
  { max: 20, ACESSO: 24.9, PADRAO: 69.9, PREMIUM: 149.9 },
  { max: 25, ACESSO: 29.9, PADRAO: 79.9, PREMIUM: 179.9 },
  { max: 30, ACESSO: 34.9, PADRAO: 89.9, PREMIUM: 209.9 },
  { max: 35, ACESSO: 39.9, PADRAO: 99.9, PREMIUM: 239.9 },
  { max: 40, ACESSO: 44.9, PADRAO: 109.9, PREMIUM: 269.9 },
  { max: 45, ACESSO: 49.9, PADRAO: 119.9, PREMIUM: 299.9 },
  { max: 50, ACESSO: 54.9, PADRAO: 129.9, PREMIUM: 329.9 },
];

const PLANO_TEXTO = {
  NENHUM: ['NENHUM', 'Nenhum', 'Sem plano'],
  ACESSO: ['ACESSO', 'Acesso', 'Basic'],
  PADRAO: ['PADRAO', 'Padrao', 'Padrão'],
  PREMIUM: ['PREMIUM', 'Premium'],
};

const build = (p) => {
  let result = '0';
  for (let i = FAIXAS.length - 1; i >= 0; i--) {
    const f = FAIXAS[i];
    result = `if([[CampoKwpProjeto]] <= ${f.max}, ${f[p]}, ${result})`;
  }
  return result;
};

const matchPlano = (codigo) => {
  let expr = '0';
  for (const texto of PLANO_TEXTO[codigo]) {
    expr = `if([[CampoPlanoProjeto]] LIKE '%${texto}%', 1, ${expr})`;
  }
  return expr;
};

const mensalidade = `if([[CampoKwpProjeto]] > 50, 0, if(${matchPlano('NENHUM')}, 0, if(${matchPlano('ACESSO')}, ${build('ACESSO')}, if(${matchPlano('PADRAO')}, ${build('PADRAO')}, if(${matchPlano('PREMIUM')}, ${build('PREMIUM')}, 0)))))`;

const desconto = `if([[CampoKwpProjeto]] > 50, 0, if(${matchPlano('PADRAO')}, 1, if(${matchPlano('PREMIUM')}, 1, 0)))`;

const desloc = `if([[CampoKmProjeto]] <= 50, 0, Round((Ceiling([[CampoKmProjeto]]) - 50) * if([[CampoKmProjeto]] <= 200, 2.4, if([[CampoKmProjeto]] <= 400, 3.2, 4)), 2))`;

console.log(JSON.stringify({ mensalidade, desconto, desloc }, null, 2));
