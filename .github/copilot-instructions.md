# Instrucoes do projeto NASA-VENANCIO

## Tecnologias utilizadas
- Use Node.js 20 ou superior, APIs nativas do Node (`http`, `fs`, `path`) e `fetch` nativo para o servidor.
- Use HTML semantico, CSS e JavaScript nativo no navegador; nao adicione frameworks, bibliotecas, bundlers ou dependencias externas.
- Consulte o feed publico APOD da NASA em `https://science.nasa.gov/wp-json/wp/v2/apod-basic/{yymmdd}`; nao use nem solicite chave de API.
- Sirva a aplicacao e a rota de dados pelo mesmo servidor local, na porta definida por `PORT` ou 3000. Execute com `node server.js`.
- Justificativa: esta aplicacao pequena nao precisa de compilacao, dependencias de interface ou segredo de API. O endpoint publico do feed fornece o HTML APOD oficial; APIs nativas do Node atendem a aplicacao e fazem a consulta. Referencias: [implementacao oficial APOD](https://github.com/nasa/apod-api/blob/master/application.py) e [feed APOD da NASA](https://science.nasa.gov/wp-json/wp/v2/apod-basic/261113).

## Arquitetura do sistema
- Mantenha `server.js` na raiz como servidor HTTP, proxy APOD e servidor dos arquivos estaticos de `public/`.
- Mantenha `public/index.html`, `public/styles.css` e `public/app.js` como estrutura, apresentacao e comportamento da interface, respectivamente.
- Exponha `GET /api/apod` como unica rota de dados. Aceite opcionalmente `date=YYYY-MM-DD`, valide a data no servidor, converta para `yymmdd` e consulte o endpoint APOD correspondente.
- Para APODs do tipo imagem, extraia o primeiro `img src` de `basic_html` para `image_url`; nao use `hdurl` como imagem, pois pode apontar para uma miniatura generica do artigo. Mantenha `permalink` como link para a publicacao original.
- Responda JSON ao navegador; repasse erros de rede, HTTP e formato invalido como erros explicitos, sem apresentar dados ficticios como sucesso.
- A interface deve mostrar a APOD do dia por padrao e permitir escolher uma data valida, exibir imagem ou video conforme `media_type`, e mostrar titulo, data e explicacao.
- Justificativa: uma unica rota de proxy centraliza validacao e mantem o frontend independente do formato da API. O servidor Node atende tanto a interface quanto a API sem adicionar outro servico.

## Estilizacao do frontend
- Use HTML semantico, controles de formulario nativos acessiveis, rotulos associados e botoes com nomes claros.
- Crie uma pagina responsiva com tema escuro inspirado no ceu noturno; mantenha bom contraste, tipografia legivel e a midia como foco visual.
- Preserve a proporcao da imagem (`max-width: 100%`, altura automatica); use `object-fit: contain` se houver limite de altura.
- Implemente estados visiveis de carregamento, erro e conteudo; nao dependa exclusivamente de cor para comunicar estado.
- Evite estilos inline, manipulacao de HTML insegura e recursos visuais que exijam bibliotecas externas.

## Seguranca
- Nao solicite, armazene, envie ou exponha chave de API: o feed APOD publico nao exige credenciais.
- Use somente a origem e o caminho NASA definidos no servidor; nao aceite URL fornecida pelo cliente.
- Aceite somente datas estritamente no formato `YYYY-MM-DD`, entre `1995-06-16` e hoje; rejeite datas invalidas antes de chamar a NASA.
- Construa a URL externa com `URL`/`URLSearchParams`, permita apenas a origem e o endpoint NASA definidos acima, e nao aceite URL fornecida pelo cliente.
- Sirva somente arquivos dentro de `public/`; normalize e valide caminhos para impedir acesso a arquivos fora dessa pasta. Nao renderize dados da API com `innerHTML`; use APIs DOM seguras e atributos apropriados.
- Justificativa: usar um feed publico sem credencial elimina o risco de expor uma chave. A validacao da data e a origem fixa limitam as entradas controladas pelo usuario.

## Verificacao
- Use apenas o runner de testes nativo `node --test` para testes automatizados.
- Cubra a validacao de datas e respostas/erros da rota APOD sem depender de chamadas reais a API nos testes.
- Confirme que a pagina pode ser servida localmente e que nenhum codigo enviado ao navegador contem segredos.
