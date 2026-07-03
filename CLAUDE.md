# nfse-sp — Contexto do projeto para Claude

## O que é este projeto

Pacote npm open-source que encapsula a integração com o WebService SOAP da **Prefeitura de São Paulo** para emissão de NFS-e (Nota Fiscal de Serviço Eletrônica).

Extraído do sistema `tickets.com` (em `/mnt/nve/var/www/tickets.com/`) onde foi desenvolvido e testado em produção. A lógica de aplicação (banco de dados, rotas Express, busca IBGE) ficou no sistema de origem — este pacote contém apenas a camada de comunicação com a Prefeitura.

## Autor e contas

- Autor: Marcio de Souza — marcio.ti.souza@gmail.com
- npm: conta pessoal do autor
- GitHub: conta pessoal do autor

## Stack

- TypeScript, ESM (type: "module"), Node >= 18
- `node-forge` — extração de chave/cert do .pfx (PKCS#12)
- `xml-crypto` v6 — assinatura XML-DSig enveloped
- `@xmldom/xmldom` — parse do XML de resposta SOAP
- `axios` — requisição SOAP com mTLS (https.Agent com pfx/passphrase)

## Estrutura de arquivos

```
src/
  certificate.ts  — extrairDadosCertificado(): extrai chave privada e cert do .pfx
  sign.ts         — assinarXmlDocumento(): XML-DSig com xpath:'/*' (1 referência)
  soap.ts         — executarRequisicaoSoap() + interpretarResposta() + RetornoSoap
  rps.ts          — DadosRps, gerarAssinaturaRps(), enviarLoteRps()
  cancel.ts       — cancelarNfse()
  query.ts        — consultarLote(), consultarNfePorRps()
  client.ts       — NfseSpClient (API principal de alto nível) + NfseSpConfig
  index.ts        — re-exports públicos
examples/
  emitir-lote.ts  — exemplo de uso
```

## Decisões técnicas importantes

### XML-DSig: xpath `'/*'` obrigatório
A Prefeitura valida a assinatura e só aceita uma única referência. Usar `'//*'` cria uma referência por elemento e causa erro [1057]. O `xpath: '/*'` seleciona apenas o elemento raiz.

### Assinatura interna do RPS (SHA1 posicional)
Diferente da assinatura XML-DSig do documento, cada RPS tem uma assinatura interna calculada concatenando campos em posições fixas:
```
inscricao(8) + serie(5) + numero(12) + dataEmissao(8) + tributacao(1) + status(1) + issRetido(1=N) + valorServicos(15) + deducoes(15) + codServico(5) + indicador(1) + documento(14)
```
- `indicadorCnpjCpf`: usa **'2'** para CNPJ e **'1'** para CPF (numérico, não 'J'/'F')
- `TipoRPS` no XML: string `'RPS'` (não o número '1')

### EnderecoTomador (evita erro [318])
Para tomadores com CNPJ, a Prefeitura exige o bloco `<EnderecoTomador>` com código IBGE do município (7 dígitos). O campo `enderecoCidade` de `DadosRps` deve conter esse código, não o nome da cidade.

### Emissão assíncrona (comportamento padrão da Prefeitura SP)
O retorno do `EnvioLoteRPS` traz `protocoloLote` mas raramente o `numeroNfe` imediato. É necessário chamar `consultarLote(protocolo)` alguns minutos depois para obter os números das NFS-e.

### Modo de teste
Não há URL separada de homologação. Usar `TesteEnvioLoteRPS` (método SOAP diferente, mesma URL). Em modo teste, `protocoloLote` retorna `'0'`.

### Endpoint SOAP
```
https://nfe.prefeitura.sp.gov.br/ws/lotenfe.asmx
```
SOAPAction: `"http://www.prefeitura.sp.gov.br/nfe/ws/<acao>"`

## Origem: sistema tickets.com

O módulo original fica em:
```
/mnt/nve/var/www/tickets.com/v2/server/src/modules/nfse_sp/
```

Além do código deste pacote, o sistema de origem contém:
- `nfse-sp.service.ts` — camada de aplicação (busca IBGE, persistência no banco, guards de duplicação)
- `nfse-sp.routes.ts` — rotas Express
- `config.ts` — lê vars de ambiente e monta NfseSpConfig

A ideia é que outros projetos usem este pacote e implementem a camada de aplicação adequada para seu contexto.

## Erros comuns já resolvidos (não regredir)

| Código | Causa | Solução |
|--------|-------|---------|
| [1057] | Múltiplas referências XML-DSig | `xpath: '/*'` em vez de `'//*'` |
| [1206] | Assinatura SHA1 do RPS errada | Ordem dos campos + indicador numérico ('2'/'1') |
| [318]  | Cidade/UF do tomador ausente | `<EnderecoTomador>` com código IBGE |
| [306]  | Código de serviço inválido | Verificar código junto ao contador/Prefeitura |

## Publicação

- `npm run build` — compila TypeScript para `dist/`
- `npm publish` — publica no npm (requer `npm login`)
- O `prepublishOnly` roda o build automaticamente
- Arquivos publicados: `dist/`, `README.md`, `LICENSE`
