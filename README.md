# NASA-VENANCIO

Aplicacao web para explorar a imagem astronomica do dia (APOD) da NASA, incluindo a explicacao e a opcao de consultar datas anteriores.

## Requisitos

- Node.js 20 ou superior.

## Configuracao e execucao

1. Na raiz do projeto, execute:

   ```powershell
   node server.js
   ```

2. Abra `http://localhost:3000` (ou a porta definida em `PORT`).

A aplicacao usa o feed APOD publico da NASA, sem exigir chave de API. O servidor consulta a rota oficial para a data selecionada e extrai a imagem do HTML APOD, em vez de usar a miniatura generica do artigo.

## Testes

```powershell
node --test
```

Os testes usam respostas simuladas e nao precisam chamar a API da NASA.