# nfse-sp

Cliente Node.js/TypeScript para emissão de NFS-e no WebService SOAP da **Prefeitura de São Paulo** (`lotenfe.asmx`).

Suporta emissão individual e em **lote**, consulta de lote assíncrono, consulta por RPS e cancelamento — com autenticação mTLS via certificado A1 e assinatura XML-DSig.

## Instalação

```bash
npm install nfse-sp
```

## Pré-requisitos

- Node.js >= 18
- Certificado A1 (arquivo `.pfx`/`.p12`) emitido para o CNPJ do prestador
- Inscrição municipal ativa na Prefeitura de São Paulo
- Código de serviço LC 116/2003 cadastrado no CNPJ do prestador junto ao fisco SP

## Uso rápido

```typescript
import { NfseSpClient, type DadosRps } from 'nfse-sp'

const client = new NfseSpClient({
  pfxBuf:             Buffer.from(process.env.CERT_BASE64!, 'base64'),
  pfxSenha:           process.env.CERT_SENHA!,
  cnpjPrestador:      '11222333000181',
  inscricaoMunicipal: '12345678',
  codigoServico:      '02692',
})

const rps: DadosRps = {
  inscricaoPrestador:  '12345678',
  serieRps:            'RPS',
  numeroRps:           '42',
  dataEmissao:         '20260701',
  dataEmissaoFormated: '2026-07-01T00:00:00',
  tipoRps:             '1',
  statusRps:           'N',
  tributacaoRps:       'T',
  valorServicos:       '1500.00',
  valorServicosFloat:  1500.00,
  valorDeducoes:       '0.00',
  codigoServico:       '02692',
  indicadorCnpjCpf:    'J',
  documentoTomador:    '12345678000195',
  razaoTomador:        'EMPRESA TOMADORA LTDA',
  aliquota:            0.06,
  discriminacao:       'Serviços de tecnologia da informação',
  enderecoCidade:      '3550308',  // código IBGE de São Paulo
  enderecoUf:          'SP',
  enderecoLogradouro:  'Avenida Paulista',
  enderecoNumero:      '1000',
  enderecoBairro:      'Bela Vista',
  enderecoCep:         '01310100',
}

// Valida sem emitir nota real
const teste = await client.emitirLote([rps], { teste: true })
console.log(teste.sucesso) // true

// Emite de verdade
const retorno = await client.emitirLote([rps])
if (retorno.sucesso) {
  console.log('Protocolo:', retorno.protocoloLote) // consultar depois
  console.log('NFS-e:    ', retorno.numeroNfe)     // ou null se assíncrono
}
```

## API

### `new NfseSpClient(config)`

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `pfxBuf` | `Buffer` | Conteúdo do certificado A1 (`.pfx`/`.p12`) |
| `pfxSenha` | `string` | Senha do certificado |
| `cnpjPrestador` | `string` | CNPJ do prestador (14 dígitos, sem pontuação) |
| `inscricaoMunicipal` | `string` | Inscrição municipal na Prefeitura de SP |
| `codigoServico` | `string` | Código do serviço LC 116/2003 (5 dígitos) |

### Métodos

```typescript
// Emite 1 ou N RPS em um único lote SOAP
client.emitirLote(lote: DadosRps[], opcoes?: { teste?: boolean }): Promise<RetornoSoap>

// Atalho para lote de 1 nota
client.emitirRps(dados: DadosRps, opcoes?: { teste?: boolean }): Promise<RetornoSoap>

// Consulta resultado de um lote assíncrono (use o protocoloLote retornado no emitir)
client.consultarLote(protocolo: string): Promise<RetornoSoap>

// Consulta NFS-e pelo número do RPS original
client.consultarPorRps(serie: string, numero: string): Promise<RetornoSoap>

// Cancela uma NFS-e emitida
client.cancelar(numeroNota: string): Promise<RetornoSoap>
```

### `RetornoSoap`

```typescript
interface RetornoSoap {
  sucesso: boolean
  erros?: Array<{ codigo: string | null; descricao: string | null }>
  numeroNfe?: string | null       // número da NFS-e (emissão síncrona)
  protocoloLote?: string | null   // protocolo para consultar depois (emissão assíncrona)
  linkNfe?: string | null         // link público da nota na Prefeitura
  situacaoNfe?: string | null     // situação do lote (ConsultaLote)
  nfeList?: Array<{               // batch: múltiplas notas no ConsultaLote
    numeroNfe: string
    numeroRps: string
    linkNfe?: string | null
  }>
  xmlCompleto?: string            // XML bruto da resposta (para debug)
}
```

## Emissão assíncrona (comportamento normal da Prefeitura de SP)

A Prefeitura de SP processa os lotes de forma assíncrona. O retorno do `emitirLote` traz um `protocoloLote` mas sem `numeroNfe`. Após alguns minutos, consulte o lote:

```typescript
const envio = await client.emitirLote([rps1, rps2])
// envio.protocoloLote = "123456789"

// Aguarde alguns minutos, então consulte:
const resultado = await client.consultarLote(envio.protocoloLote!)
if (resultado.sucesso && resultado.nfeList?.length) {
  for (const nfe of resultado.nfeList) {
    console.log(`RPS ${nfe.numeroRps} → NFS-e ${nfe.numeroNfe}`)
  }
}
```

## Modo de teste

O WebService da Prefeitura de SP **não possui URL separada de homologação**. Para testar sem emitir nota real, use `{ teste: true }` — isso invoca `TesteEnvioLoteRPS` em vez de `EnvioLoteRPS`:

```typescript
const retorno = await client.emitirLote([rps], { teste: true })
// retorno.protocoloLote === '0'  (não é um protocolo real)
```

## Código IBGE do município

O campo `enderecoCidade` do `DadosRps` deve conter o código IBGE de 7 dígitos do município do tomador (obrigatório para tomadores com CNPJ). Você pode obtê-lo pela API pública do IBGE:

```typescript
const resp = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/SP/municipios')
const municipios = await resp.json()
const sp = municipios.find(m => m.nome === 'São Paulo')
console.log(sp.id) // 3550308
```

## Funções de baixo nível

Para casos avançados, todas as funções internas também são exportadas:

```typescript
import {
  extrairDadosCertificado,
  assinarXmlDocumento,
  gerarAssinaturaRps,
  enviarLoteRps,
  cancelarNfse,
  consultarLote,
  consultarNfePorRps,
} from 'nfse-sp'
```

## Licença

MIT © [Marcio de Souza](https://github.com/marcio-ti-souza)
