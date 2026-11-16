# Sai da Dívida — versão 2

Aplicativo web instalável, em português, com contas, reservas, cartões, dívidas, metas, aplicações, bens, holerites e 13 calculadoras explicadas.

Leia **[GUIA-INSTALACAO.html](GUIA-INSTALACAO.html)** para publicar no GitHub Pages e ativar o Supabase.

## Executar

Com Node.js 24:

```sh
node scripts/serve.mjs
```

Abra `http://127.0.0.1:4181/`. Não abra `dist/index.html` diretamente como arquivo: módulos, leitura de configuração e instalação precisam de HTTP/HTTPS.

## Testar

```sh
npx pnpm@11.25.0 install --frozen-lockfile
node --test tests/*.test.mjs
```

O aplicativo não tem dependências de execução instaladas por npm. `linkedom` e `fake-indexeddb` são usados somente nos testes. PDF.js 6.5.438 e Tesseract.js 7.0.0 são carregados sob demanda pelo leitor de holerites; a imagem/PDF é processada no navegador. A leitura inicial requer internet, e a qualidade de OCR varia conforme o documento.

## Publicar

O `index.html` da raiz encaminha para `dist/`, preservando os parâmetros e o fragmento de autenticação. GitHub Pages deve publicar a raiz da branch escolhida. O manifesto e os caminhos também funcionam em subdiretórios.

Configure `dist/app-config.json` com URL do Supabase e chave **publicável/anon**. Nunca use `service_role` ou chave secreta no frontend.

Execute `supabase/001_financeiro.sql` no SQL Editor do seu projeto. Ele adiciona `sdd_documents`, `sdd_operations` e as funções da V2; não altera as tabelas financeiras antigas. Cada usuário só lê o próprio documento, e gravações são atômicas e verificam a revisão para evitar sobrescrita silenciosa.

## Modos de dados

- **Demonstração:** dados fictícios, sem gravação financeira.
- **Este dispositivo:** IndexedDB neste navegador, inclusive offline após carregar o aplicativo. Não sincroniza entre aparelhos e não está criptografado pelo aplicativo; exporte backups e proteja seu dispositivo.
- **Conta conectada:** Supabase Auth e banco com isolamento por usuário. O documento conectado não é guardado no cache offline. Escritas precisam de conexão.

Configurações → Importar versão anterior lê registros do próprio usuário, mostra uma revisão e cria cópias identificadas. Receitas e despesas antigas viram previsões no mês escolhido; saldos históricos não são inventados. Dívidas parceladas têm saldo sugerido pelo número de parcelas restantes, para conferência. Reimportações usam identificadores de origem para evitar duplicidade.

## Regras financeiras

Valores em centavos inteiros. Transferências são uma única operação vinculando origem e destino. Criar uma meta não movimenta dinheiro. Uma aplicação com finalidade reserva é contada apenas em reservas; o vínculo de meta não duplica patrimônio. Compra no cartão é reconhecida na data da compra, e o pagamento de fatura reduz caixa e dívida sem nova despesa. Parcelas somam exatamente o valor contratado, inclusive centavos restantes.

Verbas trabalhistas são estimativas educativas **brutas**. Não apuram automaticamente direitos, avos, médias, tributos, reflexos ou convenções coletivas. Aviso, férias, 13º e FGTS mostram premissas e memória de cálculo. A multa de FGTS é separada do valor em conta. Resultados financeiros não garantem rendimentos nem substituem o contrato.

## Verificações e limites

Há testes de matemática, importações, formulários, persistência e conflitos entre sessões. O fluxo visual precisa ser conferido em navegadores reais antes de liberar a terceiros. O SQL deve ser executado e validado em seu Supabase; os testes locais de conexão usam respostas simuladas. O leitor de holerites exige revisão humana e bloqueia a repetição do mesmo arquivo já lançado. Fotos, PDFs e texto integral não são armazenados; apenas campos conferidos e identificador do arquivo são guardados.

## Voltar à versão anterior

A base da reformulação é o commit `32cb4f30d808aac68081b5f4b0e3d505291a8eed`. Antes de substituir a branch de produção, exporte seus dados e mantenha a V2 em branch separada. Para voltar, reverta a alteração de código ou publique novamente a branch anterior; não apague as tabelas antigas ou as novas para fazer rollback.
