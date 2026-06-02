/**
 * Teste local: node scripts/test-groner-busca.mjs "BICHO LEGAL"
 * Requer .env com GRONER_TENANT e GRONER_TOKEN
 */
import { config } from 'dotenv';
import { buscarContatosGroner, isGronerConfigured } from '../lib/groner/client.js';

config();

const termo = process.argv[2] || 'BICHO LEGAL';

if (!isGronerConfigured()) {
  console.error('❌ Crie o arquivo .env com GRONER_TENANT e GRONER_TOKEN');
  console.error('   copy .env.example .env');
  process.exit(1);
}

console.log(`🔍 Buscando na Groner: "${termo}"...\n`);

try {
  const contatos = await buscarContatosGroner({
    nome: termo,
    email: '',
    documento: '',
    telefone: '',
  });

  if (!contatos.length) {
    console.log('Nenhum contato encontrado.');
    process.exit(0);
  }

  console.log(`✅ ${contatos.length} contato(s):\n`);
  for (const c of contatos) {
    console.log(`— ${c.nome} (Lead #${c.id})`);
    console.log(`  Email: ${c.email || '—'}`);
    console.log(`  Doc: ${c.documento || '—'}`);
    console.log(`  Tel: ${c.telefone || '—'}`);
    if (c.endereco) console.log(`  End: ${c.endereco}`);
    if (c.projetos?.length) {
      c.projetos.forEach((p) => {
        console.log(`  Projeto #${p.id}: ${p.nome}${p.consumo ? ` (${p.consumo} kWh)` : ''}`);
      });
    }
    console.log('');
  }
} catch (err) {
  console.error('❌ Erro:', err.message);
  if (err.data) console.error(JSON.stringify(err.data, null, 2));
  process.exit(1);
}
